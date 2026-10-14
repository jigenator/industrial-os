use crate::board::{self, Board, Item, Kind};
use ratatui::crossterm::event::{
    Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers, MouseButton, MouseEvent, MouseEventKind,
};
use ratatui::layout::{Position, Rect};
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime};

pub const COLORS: usize = 5;
const DOUBLE_CLICK: Duration = Duration::from_millis(400);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Button {
    Note,
    Text,
    Color(usize),
    Delete,
    Save,
    Quit,
}

/// The status line's message. Errors are worded, never shown by color alone.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum Status {
    #[default]
    None,
    Saved,
    Error(String),
}

#[derive(Clone, Copy, Debug)]
enum Drag {
    Move { dx: i32, dy: i32 },
    Resize,
    Pan { col: u16, row: u16 },
}

pub struct App {
    pub board: Board,
    pub path: PathBuf,
    /// World cell shown at the canvas's top-left corner.
    pub cam: (i32, i32),
    pub selected: Option<usize>,
    pub editing: bool,
    pub color: usize,
    pub dirty: bool,
    pub quit: bool,
    pub status: Status,
    /// The file's modification time when this pane last loaded or saved it, used to notice
    /// another pane saving the same board.
    disk_mtime: Option<SystemTime>,
    /// Set after a refused save, so a second save overwrites on purpose.
    overwrite: bool,
    /// Screen regions, refreshed by every render so hit tests match what is drawn.
    pub canvas: Rect,
    pub buttons: Vec<(Rect, Button)>,
    drag: Option<Drag>,
    last_click: Option<(Instant, u16, u16)>,
    mouse: (u16, u16),
}

impl App {
    pub fn new(board: Board, path: PathBuf) -> Self {
        let disk_mtime = board::modified(&path);
        Self {
            board,
            path,
            cam: (0, 0),
            selected: None,
            editing: false,
            color: 0,
            dirty: false,
            quit: false,
            status: Status::None,
            disk_mtime,
            overwrite: false,
            canvas: Rect::default(),
            buttons: Vec::new(),
            drag: None,
            last_click: None,
            mouse: (0, 0),
        }
    }

    pub fn handle(&mut self, event: Event) {
        match event {
            Event::Key(k) if k.kind == KeyEventKind::Press => self.key(k),
            Event::Mouse(m) => self.mouse(m),
            _ => {}
        }
    }

    fn to_world(&self, col: u16, row: u16) -> (i32, i32) {
        (
            col as i32 - self.canvas.x as i32 + self.cam.0,
            row as i32 - self.canvas.y as i32 + self.cam.1,
        )
    }

    fn key(&mut self, k: KeyEvent) {
        if k.modifiers.contains(KeyModifiers::CONTROL) {
            match k.code {
                KeyCode::Char('s') => self.save(),
                KeyCode::Char('c') => self.request_quit(),
                KeyCode::Char('q') => self.quit = true,
                _ => {}
            }
            return;
        }
        if self.editing {
            return self.edit_key(k);
        }
        match k.code {
            KeyCode::Char('q') => self.request_quit(),
            KeyCode::Char('n') => self.add(Kind::Note),
            KeyCode::Char('t') => self.add(Kind::Text),
            KeyCode::Char(c @ '1'..='5') => self.set_color(c as usize - '1' as usize),
            KeyCode::Enter | KeyCode::Char('e') => self.editing = self.selected.is_some(),
            KeyCode::Delete | KeyCode::Backspace => self.delete(),
            KeyCode::Esc => self.selected = None,
            KeyCode::Tab => self.cycle(1),
            KeyCode::BackTab => self.cycle(-1),
            KeyCode::Left => self.arrow(-1, 0, k.modifiers),
            KeyCode::Right => self.arrow(1, 0, k.modifiers),
            KeyCode::Up => self.arrow(0, -1, k.modifiers),
            KeyCode::Down => self.arrow(0, 1, k.modifiers),
            _ => {}
        }
    }

    /// Keyboard selection, in drawing order. Selecting does not raise, so the order stays put.
    fn cycle(&mut self, step: isize) {
        let n = self.board.items.len() as isize;
        if n == 0 {
            return;
        }
        let next = match self.selected {
            Some(i) => (i as isize + step).rem_euclid(n),
            None if step > 0 => 0,
            None => n - 1,
        };
        self.selected = Some(next as usize);
    }

    /// Arrows move the selected item, Shift+arrows resize a selected note, and with nothing
    /// selected they pan.
    fn arrow(&mut self, dx: i32, dy: i32, mods: KeyModifiers) {
        let Some(i) = self.selected else {
            self.cam.0 += dx * 4;
            self.cam.1 += dy * 2;
            return;
        };
        let item = &mut self.board.items[i];
        if mods.contains(KeyModifiers::SHIFT) {
            item.resize(item.w as i32 + dx, item.h as i32 + dy);
        } else {
            item.x += dx;
            item.y += dy;
        }
        self.dirty = true;
    }

    fn edit_key(&mut self, k: KeyEvent) {
        let Some(i) = self.selected else {
            self.editing = false;
            return;
        };
        let item = &mut self.board.items[i];
        match k.code {
            KeyCode::Esc => return self.finish_edit(),
            KeyCode::Enter => item.text.push('\n'),
            KeyCode::Tab => item.text.push_str("  "),
            KeyCode::Backspace => {
                item.text.pop();
            }
            KeyCode::Char(c) => item.text.push(c),
            _ => return,
        }
        item.fit_height();
        self.dirty = true;
    }

    /// Leaves edit mode; a text item left empty is removed.
    fn finish_edit(&mut self) {
        self.editing = false;
        if let Some(i) = self.selected {
            let item = &self.board.items[i];
            if item.kind == Kind::Text && item.text.trim().is_empty() {
                self.board.items.remove(i);
                self.selected = None;
            }
        }
    }

    fn mouse(&mut self, m: MouseEvent) {
        let (col, row) = (m.column, m.row);
        self.mouse = (col, row);
        match m.kind {
            MouseEventKind::Down(MouseButton::Left) => self.press(col, row),
            MouseEventKind::Down(_) => self.drag = Some(Drag::Pan { col, row }),
            MouseEventKind::Drag(_) => self.drag_to(col, row),
            MouseEventKind::Up(_) => self.drag = None,
            MouseEventKind::ScrollUp => self.cam.1 -= 2,
            MouseEventKind::ScrollDown => self.cam.1 += 2,
            MouseEventKind::ScrollLeft => self.cam.0 -= 4,
            MouseEventKind::ScrollRight => self.cam.0 += 4,
            MouseEventKind::Moved => {}
        }
    }

    fn press(&mut self, col: u16, row: u16) {
        let pos = Position::new(col, row);
        if let Some(&(_, button)) = self.buttons.iter().find(|(r, _)| r.contains(pos)) {
            return self.button(button);
        }
        if !self.canvas.contains(pos) {
            return;
        }
        // Terminals report single clicks only, so double-clicks are timed here.
        let double = self
            .last_click
            .is_some_and(|(t, c, r)| c == col && r == row && t.elapsed() < DOUBLE_CLICK);
        self.last_click = if double { None } else { Some((Instant::now(), col, row)) };

        let (x, y) = self.to_world(col, row);
        if self.editing && self.board.hit(x, y) != self.selected {
            self.finish_edit();
        }
        // Hit again: finishing an edit can remove an item and shift indexes.
        let Some(hit) = self.board.hit(x, y) else {
            self.selected = None;
            self.drag = Some(Drag::Pan { col, row });
            if double {
                self.spawn(Item::text(x, y, self.color));
            }
            return;
        };
        if hit != self.board.items.len() - 1 {
            self.dirty = true;
        }
        let i = self.board.raise(hit);
        self.selected = Some(i);
        let item = &self.board.items[i];
        self.drag = if double {
            self.editing = true;
            None
        } else if item.is_resize_handle(x, y) {
            Some(Drag::Resize)
        } else {
            Some(Drag::Move { dx: x - item.x, dy: y - item.y })
        };
    }

    fn drag_to(&mut self, col: u16, row: u16) {
        let (x, y) = self.to_world(col, row);
        match (self.drag, self.selected) {
            (Some(Drag::Pan { col: c, row: r }), _) => {
                self.cam.0 -= col as i32 - c as i32;
                self.cam.1 -= row as i32 - r as i32;
                self.drag = Some(Drag::Pan { col, row });
            }
            (Some(Drag::Move { dx, dy }), Some(i)) => {
                let item = &mut self.board.items[i];
                (item.x, item.y) = (x - dx, y - dy);
                self.dirty = true;
            }
            (Some(Drag::Resize), Some(i)) => {
                let item = &mut self.board.items[i];
                item.resize(x - item.x + 1, y - item.y + 1);
                self.dirty = true;
            }
            _ => {}
        }
    }

    fn button(&mut self, button: Button) {
        match button {
            Button::Note => self.add(Kind::Note),
            Button::Text => self.add(Kind::Text),
            Button::Color(c) => self.set_color(c),
            Button::Delete => self.delete(),
            Button::Save => self.save(),
            Button::Quit => self.request_quit(),
        }
    }

    /// Adds an item under the mouse, or in the middle of the view when the mouse is elsewhere.
    fn add(&mut self, kind: Kind) {
        let (x, y) = if self.canvas.contains(Position::new(self.mouse.0, self.mouse.1)) {
            self.to_world(self.mouse.0, self.mouse.1)
        } else {
            let (cx, cy) = self.to_world(
                self.canvas.x + self.canvas.width / 2,
                self.canvas.y + self.canvas.height / 2,
            );
            match kind {
                Kind::Note => (cx - 12, cy - 3),
                Kind::Text => (cx, cy),
            }
        };
        self.spawn(match kind {
            Kind::Note => Item::note(x, y, self.color),
            Kind::Text => Item::text(x, y, self.color),
        });
    }

    fn spawn(&mut self, item: Item) {
        if self.editing {
            self.finish_edit();
        }
        self.board.items.push(item);
        self.selected = Some(self.board.items.len() - 1);
        self.editing = true;
        self.dirty = true;
    }

    fn set_color(&mut self, color: usize) {
        self.color = color % COLORS;
        if let Some(i) = self.selected {
            self.board.items[i].color = self.color;
            self.dirty = true;
        }
    }

    fn delete(&mut self) {
        if let Some(i) = self.selected.take() {
            self.board.items.remove(i);
            self.editing = false;
            self.dirty = true;
        }
    }

    /// Saves the board, unless another pane saved it since this one loaded it; then the first
    /// attempt is refused and a second one overwrites.
    fn save(&mut self) {
        if board::modified(&self.path) != self.disk_mtime && !self.overwrite {
            self.overwrite = true;
            self.status = Status::Error("board changed in another pane; save again to overwrite".into());
            return;
        }
        match self.board.save(&self.path) {
            Ok(()) => {
                self.dirty = false;
                self.overwrite = false;
                self.disk_mtime = board::modified(&self.path);
                self.status = Status::Saved;
            }
            Err(e) => self.status = Status::Error(format!("save failed: {}", e.kind())),
        }
    }

    /// Saves and quits; if saving fails, stays open so nothing is lost.
    fn request_quit(&mut self) {
        if self.editing {
            self.finish_edit();
        }
        if self.dirty {
            self.save();
        }
        if let Status::Error(message) = &mut self.status {
            message.push_str("; Ctrl+Q quits without saving");
        } else if !self.dirty {
            self.quit = true;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app() -> App {
        let mut app = App::new(Board::default(), std::env::temp_dir().join("wb-app-test.json"));
        app.canvas = Rect::new(0, 1, 80, 22);
        app
    }

    fn mouse(app: &mut App, kind: MouseEventKind, col: u16, row: u16) {
        app.handle(Event::Mouse(MouseEvent { kind, column: col, row, modifiers: KeyModifiers::NONE }));
    }

    fn click(app: &mut App, col: u16, row: u16) {
        mouse(app, MouseEventKind::Down(MouseButton::Left), col, row);
        mouse(app, MouseEventKind::Up(MouseButton::Left), col, row);
    }

    fn typ(app: &mut App, s: &str) {
        for c in s.chars() {
            app.handle(Event::Key(KeyEvent::new(KeyCode::Char(c), KeyModifiers::NONE)));
        }
    }

    fn key(app: &mut App, code: KeyCode) {
        app.handle(Event::Key(KeyEvent::new(code, KeyModifiers::NONE)));
    }

    #[test]
    fn double_click_empty_space_creates_text_and_types() {
        let mut app = app();
        click(&mut app, 10, 5);
        click(&mut app, 10, 5);
        assert!(app.editing);
        typ(&mut app, "hi");
        key(&mut app, KeyCode::Esc);
        assert_eq!(app.board.items, [Item { text: "hi".into(), ..Item::text(10, 4, 0) }]);
    }

    #[test]
    fn empty_text_is_discarded_when_editing_ends() {
        let mut app = app();
        click(&mut app, 10, 5);
        click(&mut app, 10, 5);
        click(&mut app, 30, 9);
        assert!(app.board.items.is_empty());
        assert!(!app.editing);
    }

    #[test]
    fn drag_moves_and_corner_resizes_a_note() {
        let mut app = app();
        app.board.items.push(Item::note(2, 2, 0));
        // Body grab at screen (5,4) = world (5,3); offset (3,1) is kept while dragging.
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 5, 4);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 15, 9);
        mouse(&mut app, MouseEventKind::Up(MouseButton::Left), 15, 9);
        assert_eq!((app.board.items[0].x, app.board.items[0].y), (12, 7));
        // Bottom-right corner of a 24x7 note at (12,7) is world (35,13) = screen (35,14).
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 35, 14);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 40, 16);
        let n = &app.board.items[0];
        assert_eq!((n.w, n.h), (29, 9));
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 0, 1);
        let n = &app.board.items[0];
        assert_eq!((n.w, n.h), (board::MIN_NOTE_W, board::MIN_NOTE_H));
        assert!(app.dirty);
    }

    #[test]
    fn clicking_raises_selects_and_double_click_edits() {
        let mut app = app();
        app.board.items.push(Item::note(0, 0, 0));
        app.board.items.push(Item::note(30, 0, 1));
        click(&mut app, 2, 2);
        assert_eq!(app.board.items[1].color, 0);
        assert_eq!(app.selected, Some(1));
        click(&mut app, 2, 2);
        assert!(app.editing);
        typ(&mut app, "x");
        key(&mut app, KeyCode::Enter);
        typ(&mut app, "y");
        assert_eq!(app.board.items[1].text, "x\ny");
    }

    #[test]
    fn dragging_empty_space_or_scrolling_pans() {
        let mut app = app();
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 20, 10);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 15, 8);
        assert_eq!(app.cam, (5, 2));
        mouse(&mut app, MouseEventKind::ScrollDown, 0, 5);
        assert_eq!(app.cam, (5, 4));
        mouse(&mut app, MouseEventKind::Down(MouseButton::Right), 15, 8);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Right), 25, 8);
        assert_eq!(app.cam, (-5, 4));
    }

    #[test]
    fn keyboard_selects_moves_and_resizes_without_a_mouse() {
        let mut app = app();
        app.board.items.push(Item::note(0, 0, 0));
        app.board.items.push(Item::text(30, 0, 1));
        key(&mut app, KeyCode::Down);
        assert_eq!(app.cam, (0, 2), "arrows pan with nothing selected");
        key(&mut app, KeyCode::Tab);
        assert_eq!(app.selected, Some(0));
        key(&mut app, KeyCode::BackTab);
        key(&mut app, KeyCode::BackTab);
        assert_eq!(app.selected, Some(0));
        key(&mut app, KeyCode::Right);
        key(&mut app, KeyCode::Down);
        app.handle(Event::Key(KeyEvent::new(KeyCode::Right, KeyModifiers::SHIFT)));
        app.handle(Event::Key(KeyEvent::new(KeyCode::Up, KeyModifiers::SHIFT)));
        let n = &app.board.items[0];
        assert_eq!((n.x, n.y, n.w, n.h), (1, 1, 25, 6));
        assert_eq!(app.board.items[1].x, 30, "selecting does not reorder");
        assert_eq!(app.cam, (0, 2));
        key(&mut app, KeyCode::Enter);
        assert!(app.editing);
    }

    #[test]
    fn save_refuses_once_when_another_pane_saved_first() {
        let path = std::env::temp_dir().join(format!("wb-conflict-{}.json", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let mut a = App::new(Board::default(), path.clone());
        let mut b = App::new(Board::default(), path.clone());
        a.board.items.push(Item::note(0, 0, 0));
        a.save();
        assert_eq!(a.status, Status::Saved);
        b.board.items.push(Item::note(9, 9, 1));
        b.dirty = true;
        b.save();
        assert!(matches!(b.status, Status::Error(_)));
        assert_eq!(Board::load(&path).unwrap().items[0].x, 0, "a's board is untouched");
        b.save();
        assert_eq!(b.status, Status::Saved);
        assert_eq!(Board::load(&path).unwrap().items[0].x, 9);
        std::fs::remove_file(&path).unwrap();
    }

    #[test]
    fn failed_save_keeps_the_pane_open() {
        let mut app = App::new(Board::default(), "/dev/null/board.json".into());
        app.board.items.push(Item::note(0, 0, 0));
        app.dirty = true;
        key(&mut app, KeyCode::Char('q'));
        assert!(!app.quit);
        let Status::Error(message) = &app.status else { panic!("expected an error") };
        assert!(message.starts_with("save failed") && message.ends_with("Ctrl+Q quits without saving"));
        app.handle(Event::Key(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::CONTROL)));
        assert!(app.quit);
    }

    #[test]
    fn keys_add_recolor_and_delete() {
        let mut app = app();
        mouse(&mut app, MouseEventKind::Moved, 10, 3);
        key(&mut app, KeyCode::Char('n'));
        assert_eq!((app.board.items[0].x, app.board.items[0].y), (10, 2));
        key(&mut app, KeyCode::Esc);
        key(&mut app, KeyCode::Char('3'));
        assert_eq!(app.board.items[0].color, 2);
        key(&mut app, KeyCode::Delete);
        assert!(app.board.items.is_empty());
    }

    #[test]
    fn toolbar_buttons_dispatch() {
        let mut app = app();
        app.buttons = vec![(Rect::new(0, 0, 5, 1), Button::Note), (Rect::new(6, 0, 3, 1), Button::Color(4))];
        click(&mut app, 7, 0);
        assert_eq!(app.color, 4);
        click(&mut app, 1, 0);
        assert_eq!(app.board.items[0], Item::note(28, 8, 4));
        assert!(app.editing);
    }
}
