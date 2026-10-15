use crate::board::{self, Arrow, ArrowCell, Board, Item, Kind};
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
    Arrow,
    Pan { col: u16, row: u16 },
}

pub struct App {
    pub board: Board,
    pub path: PathBuf,
    /// World cell shown at the canvas's top-left corner.
    pub cam: (i32, i32),
    pub selected: Option<usize>,
    pub editing: bool,
    /// Byte offset on a UTF-8 boundary while editing.
    pub cursor: usize,
    cut_buffer: String,
    desired_column: Option<usize>,
    pub selected_arrow: Option<usize>,
    pub connecting: bool,
    /// Target index while choosing a keyboard connection; absent on a one-item board.
    pub connect_target: Option<usize>,
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
            cursor: 0,
            cut_buffer: String::new(),
            desired_column: None,
            selected_arrow: None,
            connect_target: None,
            connecting: false,
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
                KeyCode::Char('s') => return self.save(),
                KeyCode::Char('c') => return self.request_quit(),
                KeyCode::Char('q') => {
                    self.quit = true;
                    return;
                }
                _ => {}
            }
        }
        if self.editing {
            return self.edit_key(k);
        }
        if k.modifiers.contains(KeyModifiers::CONTROL) {
            return;
        }
        if self.connecting {
            match k.code {
                KeyCode::Tab => self.cycle_target(1),
                KeyCode::BackTab => self.cycle_target(-1),
                KeyCode::Enter => {
                    self.connect_to(self.connect_target, true);
                    self.connect_target = None;
                    self.connecting = false;
                }
                KeyCode::Esc => {
                    self.connect_target = None;
                    self.connecting = false;
                }
                _ => {}
            }
            return;
        }
        match k.code {
            KeyCode::Char('q') => self.request_quit(),
            KeyCode::Char('n') => self.add(Kind::Note),
            KeyCode::Char('t') => self.add(Kind::Text),
            KeyCode::Char(c @ '1'..='5') if self.selected_arrow.is_none() => self.set_color(c as usize - '1' as usize),
            KeyCode::Char('a') if self.selected.is_some() => self.cycle_target(1),
            KeyCode::Enter | KeyCode::Char('e') => self.begin_edit(),
            KeyCode::Delete | KeyCode::Backspace => self.delete(),
            KeyCode::Esc => {
                self.selected = None;
                self.selected_arrow = None;
                self.drag = None;
            }
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
        let items = self.board.items.len();
        let n = (items + self.board.arrows.len()) as isize;
        if n == 0 {
            return;
        }
        let current = self.selected.or(self.selected_arrow.map(|i| items + i));
        let next = match current {
            Some(i) => (i as isize + step).rem_euclid(n),
            None if step > 0 => 0,
            None => n - 1,
        } as usize;
        self.selected = (next < items).then_some(next);
        self.selected_arrow = (next >= items).then(|| next - items);
    }

    fn cycle_target(&mut self, step: isize) {
        let Some(source) = self.selected else {
            return;
        };
        self.connecting = true;
        self.drag = None;
        let n = self.board.items.len();
        if n < 2 {
            return;
        }
        let mut target = self.connect_target.unwrap_or(source);
        loop {
            target = (target as isize + step).rem_euclid(n as isize) as usize;
            if target != source {
                break;
            }
        }
        self.connect_target = Some(target);
    }

    fn connect_to(&mut self, target: Option<usize>, toggle: bool) {
        let (Some(source), Some(target)) = (self.selected, target) else {
            return;
        };
        if source == target {
            return;
        }
        let arrow = Arrow { from: self.board.items[source].id, to: self.board.items[target].id };
        if let Some(i) = self.board.arrows.iter().position(|a| *a == arrow) {
            if !toggle {
                return;
            }
            self.board.arrows.remove(i);
        } else {
            self.board.arrows.push(arrow);
        }
        self.dirty = true;
    }

    pub fn arrow_drag(&self) -> bool {
        matches!(self.drag, Some(Drag::Arrow))
    }

    pub fn arrow_target(&self) -> Option<usize> {
        self.connect_target.or_else(|| {
            if !self.arrow_drag() || !self.canvas.contains(Position::new(self.mouse.0, self.mouse.1)) {
                return None;
            }
            let (x, y) = self.to_world(self.mouse.0, self.mouse.1);
            self.board.hit(x, y).filter(|i| Some(*i) != self.selected)
        })
    }

    pub fn world_clip(&self) -> (i32, i32, i32, i32) {
        (
            self.cam.0,
            self.cam.1,
            self.cam.0.saturating_add(self.canvas.width as i32),
            self.cam.1.saturating_add(self.canvas.height as i32),
        )
    }

    pub fn preview(&self) -> Vec<ArrowCell> {
        if !self.arrow_drag() && !self.connecting {
            return Vec::new();
        }
        let Some(source) = self.selected else {
            return Vec::new();
        };
        if self.connecting && self.connect_target.is_none() {
            return Vec::new();
        }
        let from = &self.board.items[source];
        let (to, to_outer, to_id) = self
            .arrow_target()
            .map(|i| {
                let target = &self.board.items[i];
                (target.rect(), target.outer_box(), target.id)
            })
            .unwrap_or_else(|| {
                let (x, y) = self.to_world(self.mouse.0, self.mouse.1);
                let point = (x, y, x.saturating_add(1), y.saturating_add(1));
                (point, point, from.id)
            });
        let obstacles = self.board.obstacles(&[from.id, to_id]);
        board::route(from.rect(), to, from.outer_box(), to_outer, &obstacles, false, self.world_clip())
    }

    /// Arrows move the selected item, Shift+arrows resize a selected note, and with nothing
    /// selected they pan.
    fn arrow(&mut self, dx: i32, dy: i32, mods: KeyModifiers) {
        if self.selected_arrow.is_some() {
            return;
        }
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

    fn begin_edit(&mut self) {
        if let Some(i) = self.selected {
            self.editing = true;
            let item = &mut self.board.items[i];
            let old_height = item.h;
            item.fit_height();
            self.dirty |= item.h != old_height;
            self.cursor = item.text.len();
            self.desired_column = None;
            self.connect_target = None;
            self.connecting = false;
            self.drag = None;
        }
    }

    fn edit_key(&mut self, k: KeyEvent) {
        let Some(i) = self.selected else {
            self.editing = false;
            return;
        };
        if k.code == KeyCode::Esc {
            self.finish_edit();
            return;
        }
        let item = &mut self.board.items[i];
        let text = &item.text;
        let cursor = self.cursor;
        let prev = text[..cursor].char_indices().next_back().map_or(0, |(i, _)| i);
        let next = text[cursor..].chars().next().map_or(cursor, |c| cursor + c.len_utf8());
        let start = text[..cursor].rfind('\n').map_or(0, |i| i + 1);
        let end = text[cursor..].find('\n').map_or(text.len(), |i| cursor + i);
        let ctrl = k.modifiers.contains(KeyModifiers::CONTROL);
        let alt = k.modifiers.contains(KeyModifiers::ALT);
        let mut change = None;
        let mut cut = false;
        let mut vertical = false;
        match k.code {
            KeyCode::Home | KeyCode::Char('a') if k.code == KeyCode::Home || ctrl => self.cursor = start,
            KeyCode::End | KeyCode::Char('e') if k.code == KeyCode::End || ctrl => self.cursor = end,
            KeyCode::Left | KeyCode::Char('b') if k.code == KeyCode::Left || ctrl || alt => {
                self.cursor = if alt { word_back(text, cursor, false) } else { prev };
            }
            KeyCode::Right | KeyCode::Char('f') if k.code == KeyCode::Right || ctrl || alt => {
                self.cursor = if alt { word_forward(text, cursor) } else { next };
            }
            KeyCode::Up | KeyCode::Down => {
                vertical = true;
                let col = *self.desired_column.get_or_insert_with(|| item.cursor_cell(cursor).0);
                self.cursor = item.vertical_cursor(cursor, if k.code == KeyCode::Up { -1 } else { 1 }, col);
            }
            KeyCode::Char('k') if ctrl => {
                change = Some((cursor..if end == cursor { next } else { end }, String::new()));
                cut = true;
            }
            KeyCode::Char('u') if ctrl => {
                change = Some((start..cursor, String::new()));
                cut = true;
            }
            KeyCode::Char('w') if ctrl => {
                change = Some((word_back(text, cursor, true)..cursor, String::new()));
                cut = true;
            }
            KeyCode::Backspace if alt => {
                change = Some((word_back(text, cursor, false)..cursor, String::new()));
                cut = true;
            }
            KeyCode::Char('d') if alt => {
                change = Some((cursor..word_forward(text, cursor), String::new()));
                cut = true;
            }
            KeyCode::Delete | KeyCode::Char('d') if k.code == KeyCode::Delete || ctrl => {
                change = Some((cursor..next, String::new()))
            }
            KeyCode::Backspace | KeyCode::Char('h') if k.code == KeyCode::Backspace || ctrl => {
                change = Some((prev..cursor, String::new()))
            }
            KeyCode::Char('y') if ctrl => change = Some((cursor..cursor, self.cut_buffer.clone())),
            KeyCode::Enter => change = Some((cursor..cursor, "\n".into())),
            KeyCode::Tab => change = Some((cursor..cursor, "  ".into())),
            KeyCode::Char(c) if !ctrl && !alt => change = Some((cursor..cursor, c.to_string())),
            _ => {}
        }
        if !vertical {
            self.desired_column = None;
        }
        if let Some((range, replacement)) = change {
            if cut {
                self.cut_buffer = item.text[range.clone()].to_string();
            }
            if item.text[range.clone()] != replacement {
                self.cursor = range.start + replacement.len();
                item.text.replace_range(range, &replacement);
                item.fit_height();
                self.dirty = true;
            }
        }
    }

    /// Leaves edit mode; a text item left empty is removed.
    fn finish_edit(&mut self) {
        self.editing = false;
        if let Some(i) = self.selected {
            let item = &self.board.items[i];
            if item.kind == Kind::Text && item.text.trim().is_empty() {
                self.board.remove(i);
                self.selected = None;
                self.dirty = true;
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
            MouseEventKind::Up(_) => {
                if self.arrow_drag() && self.canvas.contains(Position::new(col, row)) {
                    let (x, y) = self.to_world(col, row);
                    self.connect_to(self.board.hit(x, y), false);
                }
                self.drag = None;
            }
            MouseEventKind::ScrollUp => self.cam.1 -= 2,
            MouseEventKind::ScrollDown => self.cam.1 += 2,
            MouseEventKind::ScrollLeft => self.cam.0 -= 4,
            MouseEventKind::ScrollRight => self.cam.0 += 4,
            MouseEventKind::Moved => {}
        }
    }

    fn press(&mut self, col: u16, row: u16) {
        self.connect_target = None;
        self.connecting = false;
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
            self.selected_arrow = self.board.hit_arrow(x, y);
            self.drag = if self.selected_arrow.is_some() { None } else { Some(Drag::Pan { col, row }) };
            if double && self.selected_arrow.is_none() {
                self.spawn(Item::text(x, y, self.color));
            }
            return;
        };
        if hit != self.board.items.len() - 1 {
            self.dirty = true;
        }
        let i = self.board.raise(hit);
        self.selected = Some(i);
        self.selected_arrow = None;
        let item = &self.board.items[i];
        self.drag = if double {
            self.begin_edit();
            None
        } else if item.is_resize_handle(x, y) {
            Some(Drag::Resize)
        } else if item.is_border(x, y) {
            Some(Drag::Arrow)
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
                // While editing, keep room for the cursor inside the border.
                if self.editing {
                    item.fit_height();
                }
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

    fn spawn(&mut self, mut item: Item) {
        if self.editing {
            self.finish_edit();
        }
        item.id = match self.board.next_id() {
            Ok(id) => id,
            Err(e) => {
                self.status = Status::Error(e.to_string());
                return;
            }
        };
        self.board.items.push(item);
        self.selected = Some(self.board.items.len() - 1);
        self.selected_arrow = None;
        self.begin_edit();
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
        self.connect_target = None;
        self.connecting = false;
        self.drag = None;
        if let Some(i) = self.selected_arrow.take() {
            self.board.arrows.remove(i);
            self.dirty = true;
        }
        if let Some(i) = self.selected.take() {
            self.board.remove(i);
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

/// Readline skips separators first, then consumes the preceding word.
fn word_back(text: &str, cursor: usize, whitespace: bool) -> usize {
    let word = |c: char| {
        if whitespace { !c.is_whitespace() } else { c.is_alphanumeric() }
    };
    let mut pos = cursor;
    let mut in_word = false;
    for (i, c) in text[..cursor].char_indices().rev() {
        if word(c) {
            in_word = true;
        } else if in_word {
            break;
        }
        pos = i;
    }
    pos
}

fn word_forward(text: &str, cursor: usize) -> usize {
    let mut pos = cursor;
    let mut in_word = false;
    for c in text[cursor..].chars() {
        if c.is_alphanumeric() {
            in_word = true;
        } else if in_word {
            break;
        }
        pos += c.len_utf8();
    }
    pos
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
        assert_eq!(app.board.items, [Item { id: 1, text: "hi".into(), ..Item::text(10, 4, 0) }]);
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
        assert_eq!(app.board.items[0], Item { id: 1, ..Item::note(28, 8, 4) });
        assert!(app.editing);
    }

    fn connected_app() -> App {
        let mut app = app();
        app.board.items = vec![Item::note(0, 0, 0), Item::note(35, 0, 0)];
        app.board.normalize().unwrap();
        app
    }

    fn modified_key(app: &mut App, code: KeyCode, mods: KeyModifiers) {
        app.handle(Event::Key(KeyEvent::new(code, mods)));
    }

    fn editing(text: &str) -> App {
        let mut app = app();
        app.spawn(Item::text(0, 0, 0));
        typ(&mut app, text);
        app.dirty = false;
        app
    }

    #[test]
    fn border_drag_snaps_connects_and_empty_self_duplicate_releases_cancel() {
        let mut app = connected_app();
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 23, 3);
        assert!(app.arrow_drag());
        assert!(app.preview().is_empty());
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 30, 3);
        assert!(!app.preview().is_empty());
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 36, 3);
        assert_eq!(app.arrow_target(), Some(0)); // source was raised
        assert_eq!(
            app.preview(),
            board::route(
                app.board.items[1].rect(),
                app.board.items[0].rect(),
                app.board.items[1].outer_box(),
                app.board.items[0].outer_box(),
                &[],
                false,
                app.world_clip()
            )
        );
        mouse(&mut app, MouseEventKind::Up(MouseButton::Left), 36, 3);
        assert_eq!(app.board.arrows, [Arrow { from: 1, to: 2 }]);
        assert_eq!(app.selected, Some(1));
        assert!(app.dirty);
        for target in [(36, 3), (70, 20), (1, 2)] {
            app.last_click = None;
            app.dirty = false;
            mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 23, 3);
            mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), target.0, target.1);
            mouse(&mut app, MouseEventKind::Up(MouseButton::Left), target.0, target.1);
            assert_eq!(app.board.arrows.len(), 1);
            assert!(!app.dirty);
        }
        // A border double-click still edits, starting at the end.
        app.last_click = None;
        app.board.items[1].text = "edit me".into();
        click(&mut app, 23, 3);
        click(&mut app, 23, 3);
        assert!(app.editing);
        assert_eq!(app.cursor, 7);
    }

    #[test]
    fn keyboard_connect_cycles_targets_toggles_and_cancels() {
        let mut app = connected_app();
        app.board.items.push(Item { id: 3, text: "target".into(), ..Item::text(50, 12, 0) });
        key(&mut app, KeyCode::Tab);
        key(&mut app, KeyCode::Char('a'));
        assert_eq!(app.connect_target, Some(1));
        key(&mut app, KeyCode::Tab);
        assert_eq!(app.connect_target, Some(2));
        key(&mut app, KeyCode::BackTab);
        assert_eq!(app.connect_target, Some(1));
        key(&mut app, KeyCode::Enter);
        assert_eq!(app.board.arrows, [Arrow { from: 1, to: 2 }]);
        assert_eq!(app.selected, Some(0));
        assert!(app.dirty);
        app.dirty = false;
        key(&mut app, KeyCode::Char('a'));
        key(&mut app, KeyCode::Enter);
        assert!(app.board.arrows.is_empty());
        assert!(app.dirty);
        app.dirty = false;
        key(&mut app, KeyCode::Char('a'));
        key(&mut app, KeyCode::Esc);
        assert_eq!(app.connect_target, None);
        assert!(!app.dirty);
        key(&mut app, KeyCode::Char('a'));
        key(&mut app, KeyCode::BackTab);
        key(&mut app, KeyCode::Enter);
        assert_eq!(app.board.arrows, [Arrow { from: 1, to: 3 }]);
    }

    #[test]
    fn arrow_click_selection_item_precedence_cycle_and_delete() {
        let mut app = connected_app();
        app.board.arrows.push(Arrow { from: 1, to: 2 });
        click(&mut app, 29, 4);
        assert_eq!(app.selected_arrow, Some(0));
        assert_eq!(app.selected, None);
        app.dirty = false;
        for k in [KeyCode::Left, KeyCode::Right, KeyCode::Up, KeyCode::Down, KeyCode::Char('1')] {
            key(&mut app, k);
        }
        assert_eq!(app.cam, (0, 0));
        assert!(!app.dirty);
        key(&mut app, KeyCode::Esc);
        assert_eq!(app.selected_arrow, None);
        key(&mut app, KeyCode::Tab);
        key(&mut app, KeyCode::Tab);
        key(&mut app, KeyCode::Tab);
        assert_eq!(app.selected_arrow, Some(0));
        key(&mut app, KeyCode::BackTab);
        assert_eq!(app.selected, Some(1));
        key(&mut app, KeyCode::Tab);
        key(&mut app, KeyCode::Backspace);
        assert!(app.board.arrows.is_empty());
        assert!(app.dirty);
        app.board.arrows.push(Arrow { from: 1, to: 2 });
        app.board.items.push(Item { id: 3, w: 8, h: 3, ..Item::note(27, 2, 0) });
        assert_eq!(app.board.hit_arrow(29, 3), None);
        click(&mut app, 29, 4);
        assert_eq!(app.selected, Some(2));
        assert_eq!(app.selected_arrow, None);
    }

    #[test]
    fn deleting_items_and_empty_text_removes_all_touching_arrows() {
        let mut app = connected_app();
        app.board.items.push(Item { id: 3, ..Item::text(60, 0, 0) });
        app.board.arrows = vec![Arrow { from: 1, to: 2 }, Arrow { from: 2, to: 3 }, Arrow { from: 3, to: 2 }];
        app.selected = Some(2);
        app.begin_edit();
        app.dirty = false;
        key(&mut app, KeyCode::Esc);
        assert_eq!(app.board.arrows, [Arrow { from: 1, to: 2 }]);
        assert!(app.dirty);
        app.selected = Some(0);
        app.dirty = false;
        key(&mut app, KeyCode::Delete);
        assert!(app.board.arrows.is_empty());
        assert!(app.dirty);
    }

    #[test]
    fn readline_character_line_and_word_motion_aliases() {
        use KeyCode::*;
        use KeyModifiers as M;
        let mut app = editing("one\n日本 two--three");
        let end = app.cursor;
        for home in [(Home, M::NONE), (Char('a'), M::CONTROL)] {
            modified_key(&mut app, home.0, home.1);
            assert_eq!(app.cursor, 4);
            key(&mut app, Right);
            assert_eq!(app.cursor, 7);
            modified_key(&mut app, Char('f'), M::CONTROL);
            assert_eq!(app.cursor, 10);
            key(&mut app, Left);
            assert_eq!(app.cursor, 7);
            modified_key(&mut app, Char('b'), M::CONTROL);
            assert_eq!(app.cursor, 4);
            key(&mut app, End);
            assert_eq!(app.cursor, end);
        }
        modified_key(&mut app, Char('b'), M::ALT);
        assert_eq!(app.cursor, 16);
        modified_key(&mut app, Left, M::ALT);
        assert_eq!(app.cursor, 11);
        modified_key(&mut app, Char('f'), M::ALT);
        assert_eq!(app.cursor, 14);
        modified_key(&mut app, Right, M::ALT);
        assert_eq!(app.cursor, end);
        modified_key(&mut app, Char('e'), M::CONTROL);
        assert_eq!(app.cursor, end);
        assert!(!app.dirty);
    }

    #[test]
    fn readline_cuts_delete_yank_and_insert_at_cursor() {
        use KeyCode::*;
        use KeyModifiers as M;
        for (code, mods, input, start, expected, cut) in [
            (Char('k'), M::CONTROL, "abc\ndef", 1, "a\ndef", "bc"),
            (Char('k'), M::CONTROL, "abc\ndef", 3, "abcdef", "\n"),
            (Char('u'), M::CONTROL, "abc\ndef", 6, "abc\nf", "de"),
            (Char('w'), M::CONTROL, "one two--three  ", 16, "one ", "two--three  "),
            (Backspace, M::ALT, "one two--three  ", 16, "one two--", "three  "),
            (Char('d'), M::ALT, "one --two!", 3, "one!", " --two"),
        ] {
            let mut app = editing(input);
            app.cursor = start;
            modified_key(&mut app, code, mods);
            assert_eq!(app.board.items[0].text, expected, "{code:?}");
            assert_eq!(app.cut_buffer, cut);
            assert!(app.dirty);
            modified_key(&mut app, Char('y'), M::CONTROL);
            assert_eq!(app.board.items[0].text, input);
        }
        for (code, mods, pos, expected) in [
            (Delete, M::NONE, 1, "ab"),
            (Char('d'), M::CONTROL, 1, "ab"),
            (Backspace, M::NONE, 4, "ab"),
            (Char('h'), M::CONTROL, 4, "ab"),
        ] {
            let mut app = editing("a日b");
            app.cursor = pos;
            modified_key(&mut app, code, mods);
            assert_eq!(app.board.items[0].text, expected);
            assert_eq!(app.cursor, 1);
        }
        let mut app = editing("world");
        modified_key(&mut app, Char('a'), M::CONTROL);
        typ(&mut app, "hello ");
        key(&mut app, Enter);
        key(&mut app, Tab);
        assert_eq!(app.board.items[0].text, "hello \n  world");
        assert_eq!(app.cursor, 9);
        let mut app = editing("");
        for (code, mods) in [(Backspace, M::NONE), (Delete, M::NONE), (Char('k'), M::CONTROL), (Char('y'), M::CONTROL)]
        {
            modified_key(&mut app, code, mods);
            assert!(!app.dirty);
        }
    }

    #[test]
    fn readline_vertical_motion_wraps_clamps_and_restores_column() {
        use KeyCode::*;
        let mut app = editing("abcde\nx\n日本abcd");
        app.cursor = 4;
        key(&mut app, Up);
        assert_eq!(app.cursor, 4);
        key(&mut app, Down);
        assert_eq!(app.cursor, 7);
        key(&mut app, Down);
        assert_eq!(app.cursor, 14);
        key(&mut app, Down);
        assert_eq!(app.cursor, 14);
        key(&mut app, Up);
        key(&mut app, Up);
        assert_eq!(app.cursor, 4);
        app.board.items[0].kind = Kind::Note;
        app.board.items[0].w = 8;
        app.board.items[0].text = "hello big world".into();
        app.cursor = 3;
        app.desired_column = None;
        key(&mut app, Down);
        assert_eq!(app.cursor, 9);
        key(&mut app, Down);
        assert_eq!(app.cursor, 13);
        key(&mut app, Up);
        key(&mut app, Up);
        assert_eq!(app.cursor, 3);
        assert!(!app.dirty);
        typ(&mut app, " lots of text ");
        assert!(app.board.items[0].h >= app.board.items[0].lines().len() as u16 + 2);
    }

    #[test]
    fn globals_keep_their_meaning_while_editing_and_connecting() {
        let path = std::env::temp_dir().join(format!("wb-global-{}.json", std::process::id()));
        let mut app = editing("world");
        app.path = path.clone();
        modified_key(&mut app, KeyCode::Char('s'), KeyModifiers::CONTROL);
        assert_eq!(app.status, Status::Saved);
        assert!(app.editing);
        modified_key(&mut app, KeyCode::Char('q'), KeyModifiers::CONTROL);
        assert!(app.quit);
        app.quit = false;
        modified_key(&mut app, KeyCode::Char('c'), KeyModifiers::CONTROL);
        assert!(app.quit);
        std::fs::remove_file(path).unwrap();
        let mut app = connected_app();
        app.selected = Some(0);
        app.cycle_target(1);
        modified_key(&mut app, KeyCode::Char('q'), KeyModifiers::CONTROL);
        assert!(app.quit);
    }

    #[test]
    fn one_item_can_enter_and_cancel_connect_mode_without_self_arrows() {
        let mut app = app();
        app.spawn(Item::note(0, 0, 0));
        key(&mut app, KeyCode::Esc);
        app.dirty = false;
        key(&mut app, KeyCode::Char('a'));
        assert!(app.connecting);
        assert_eq!(app.connect_target, None);
        assert!(app.preview().is_empty());
        key(&mut app, KeyCode::Tab);
        key(&mut app, KeyCode::Enter);
        assert!(!app.connecting);
        assert!(app.board.arrows.is_empty());
        assert!(!app.dirty);
    }

    #[test]
    fn mouse_connector_can_snap_to_free_text() {
        let mut app = connected_app();
        app.board.items[1] = Item { id: 2, text: "target".into(), ..Item::text(35, 0, 0) };
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 23, 3);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 36, 1);
        assert_eq!(app.arrow_target(), Some(0));
        mouse(&mut app, MouseEventKind::Up(MouseButton::Left), 36, 1);
        assert_eq!(app.board.arrows, [Arrow { from: 1, to: 2 }]);
    }

    #[test]
    fn editing_full_note_grows_to_keep_virtual_cursor_row_inside_border() {
        for (w, h) in [(8, 3), (24, 7)] {
            let mut app = app();
            app.board.items.push(Item { id: 1, w, h, ..Item::note(0, 0, 0) });
            app.selected = Some(0);
            key(&mut app, KeyCode::Enter);
            let text = if w == 8 { "abcdef".into() } else { "x".repeat((w as usize - 2) * (h as usize - 2)) };
            typ(&mut app, &text);
            let item = &app.board.items[0];
            let (_, row) = item.cursor_offset(app.cursor);
            assert_eq!(item.text, text);
            assert_eq!(item.lines().len(), h as usize - 2);
            assert_eq!(item.h, h + 1);
            assert!(row < item.h as i32 - 1);
            assert!(app.dirty);

            // Starting an edit of an existing exactly-full note needs the same space.
            key(&mut app, KeyCode::Esc);
            app.board.items[0].h = h;
            app.dirty = false;
            key(&mut app, KeyCode::Enter);
            let item = &app.board.items[0];
            assert_eq!(item.h, h + 1);
            assert!(item.cursor_offset(app.cursor).1 < item.h as i32 - 1);
            assert!(app.dirty);

            // Shrinking it by its corner while still editing refits it.
            let (cw, ch) = (w - 1, h + 1);
            mouse(&mut app, MouseEventKind::Down(MouseButton::Left), cw, ch);
            mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), cw - 1, ch - 1);
            mouse(&mut app, MouseEventKind::Up(MouseButton::Left), cw - 1, ch - 1);
            let item = &app.board.items[0];
            assert!(app.editing);
            assert_eq!(item.w, (w - 1).max(board::MIN_NOTE_W));
            assert!(item.cursor_offset(app.cursor).1 < item.h as i32 - 1);
        }
    }
}
