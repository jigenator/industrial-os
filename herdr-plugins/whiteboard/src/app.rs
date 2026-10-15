use crate::board::{self, Arrow, ArrowCell, Board, Item, Kind};
use ratatui::crossterm::event::{
    Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers, MouseButton, MouseEvent, MouseEventKind,
};
use ratatui::layout::{Position, Rect};
use std::path::PathBuf;
use std::ops::Range;
use std::time::{Duration, Instant, SystemTime};

pub const COLORS: usize = 8;
const DOUBLE_CLICK: Duration = Duration::from_millis(400);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Button {
    Note,
    Text,
    Color(usize),
    Delete,
    Save,
    Quit,
    Format(Format),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Format { Copy, Bold, Italic, Strike, Code, Link, Heading, Bullet, Checkbox }

/// The status line's message. Errors are worded, never shown by color alone.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum Status {
    #[default]
    None,
    Saved,
    Copied,
    Hint(String),
    Error(String),
}

#[derive(Clone, Copy, Debug)]
enum Drag {
    Move { dx: i32, dy: i32 },
    Resize,
    Select,
    Scroll { id: u64, grab: usize },
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
    pub anchor: Option<usize>,
    pub format_pending: bool,
    /// Raw UTF-8 clipboard requests, drained only by the terminal host.
    pub clipboard_outbox: Vec<String>,
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
            anchor: None,
            format_pending: false,
            clipboard_outbox: Vec::new(),
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
        if matches!(self.status, Status::Copied | Status::Hint(_)) && matches!(&event, Event::Key(_) | Event::Paste(_) | Event::Mouse(MouseEvent { kind: MouseEventKind::Down(_) | MouseEventKind::ScrollUp | MouseEventKind::ScrollDown, .. })) {
            self.status = Status::None;
        }
        match event {
            Event::Key(k) if k.kind == KeyEventKind::Press => self.key(k),
            Event::Mouse(m) => self.mouse(m),
            Event::Paste(text) if self.editing => self.paste(&text),
            _ => {}
        }
        self.follow_cursor();
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
            KeyCode::Char(c @ '1'..='8') if self.selected_arrow.is_none() => self.set_color(c as usize - '1' as usize),
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
            KeyCode::PageUp => self.scroll_selected(-1),
            KeyCode::PageDown => self.scroll_selected(1),
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
            self.anchor = None;
            self.format_pending = false;
            let item = &mut self.board.items[i];
            item.editing = true;
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
        if self.format_pending {
            self.format_pending = false;
            if let KeyCode::Char(c) = k.code {
                let action = match c {
                    'c' => Some(Format::Copy), 'b' => Some(Format::Bold),
                    'i' => Some(Format::Italic), 's' => Some(Format::Strike),
                    '`' => Some(Format::Code), 'l' => Some(Format::Link),
                    'h' => Some(Format::Heading), '-' => Some(Format::Bullet),
                    'x' => Some(Format::Checkbox), _ => None,
                };
                if let Some(action) = action { self.format(action); }
            }
            return;
        }
        if k.modifiers.contains(KeyModifiers::CONTROL) && k.code == KeyCode::Char('t') {
            self.format_pending = self.selection().is_some();
            return;
        }
        if k.code == KeyCode::Esc {
            self.finish_edit();
            return;
        }
        let selection = self.selection();
        let motion = matches!(k.code, KeyCode::Home | KeyCode::End | KeyCode::Left | KeyCode::Right | KeyCode::Up | KeyCode::Down)
            || (k.modifiers.intersects(KeyModifiers::CONTROL | KeyModifiers::ALT) && matches!(k.code, KeyCode::Char('a' | 'e' | 'b' | 'f')));
        if motion && k.modifiers.contains(KeyModifiers::SHIFT) {
            self.anchor.get_or_insert(self.cursor);
        } else if motion {
            self.anchor = None;
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
            // Ctrl+J is how a raw line feed arrives, including from an unbracketed paste.
            KeyCode::Enter | KeyCode::Char('j') if k.code == KeyCode::Enter || ctrl => {
                change = Some((cursor..cursor, "\n".into()))
            }
            KeyCode::Tab => change = Some((cursor..cursor, "  ".into())),
            KeyCode::Char(c) if !ctrl && !alt => change = Some((cursor..cursor, c.to_string())),
            _ => {}
        }
        if !vertical {
            self.desired_column = None;
        }
        if let Some((mut range, replacement)) = change {
            if !cut && let Some(selection) = selection { range = selection; }
            self.anchor = None;
            if cut {
                self.cut_buffer = item.text[range.clone()].to_string();
            }
            self.cursor = range.start + replacement.len();
            if item.text[range.clone()] != replacement {
                item.text.replace_range(range, &replacement);
                item.fit_height();
                self.dirty = true;
            }
        }
    }

    /// Inserts pasted text at the cursor, keeping its line breaks; tabs become two spaces, like `Tab`.
    fn paste(&mut self, text: &str) {
        let Some(i) = self.selected else { return };
        let text: String = text
            .replace("\r\n", "\n")
            .replace('\r', "\n")
            .replace('\t', "  ")
            .chars()
            .filter(|&c| c == '\n' || !c.is_control())
            .collect();
        if text.is_empty() {
            return;
        }
        let range = self.selection().unwrap_or(self.cursor..self.cursor);
        self.anchor = None;
        let item = &mut self.board.items[i];
        self.cursor = range.start + text.len();
        item.text.replace_range(range, &text);
        self.desired_column = None;
        item.fit_height();
        self.dirty = true;
    }

    /// Leaves edit mode; a text item left empty is removed.
    fn finish_edit(&mut self) {
        self.editing = false;
        self.anchor = None;
        self.format_pending = false;
        if let Some(i) = self.selected {
            let item = &mut self.board.items[i];
            item.editing = false;
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
                if matches!(self.drag, Some(Drag::Select)) { self.copy_selection(); }
                self.drag = None;
            }
            MouseEventKind::ScrollUp => self.wheel(col, row, -2),
            MouseEventKind::ScrollDown => self.wheel(col, row, 2),
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
            self.format_pending = false;
            if !matches!(button, Button::Format(_)) {
                self.anchor = None;
            }
            return self.button(button);
        }
        self.anchor = None;
        self.format_pending = false;
        if !self.canvas.contains(pos) {
            return;
        }
        // Terminals report single clicks only, so double-clicks are timed here.
        let double = self
            .last_click
            .is_some_and(|(t, c, r)| c == col && r == row && t.elapsed() < DOUBLE_CLICK);
        self.last_click = if double { None } else { Some((Instant::now(), col, row)) };

        let (x, y) = self.to_world(col, row);
        if let Some(i) = self.board.hit(x, y) {
            let item = &self.board.items[i];
            if x == item.x + item.w as i32 - 1 && y > item.y && y < item.y + item.h as i32 - 1
                && let Some((start, len)) = item.scrollbar()
            {
                let at = (y - item.y - 1) as usize;
                if (start..start + len).contains(&at) {
                    self.drag = Some(Drag::Scroll { id: item.id, grab: at - start });
                } else {
                    self.scroll_note(i, if at < start { -(item.inner_height() as i32) } else { item.inner_height() as i32 });
                    self.drag = None;
                }
                return;
            }
        }
        if self.editing
            && let Some(i) = self.selected.filter(|&i| self.board.hit(x, y) == Some(i))
        {
            let item = &self.board.items[i];
            if !item.is_border(x, y) {
                let inset = i32::from(item.kind == Kind::Note);
                self.cursor = item.cursor_at_cell((x - item.x - inset) as usize, (y - item.y - inset) as usize + item.scroll_offset());
                self.anchor = Some(self.cursor);
                self.desired_column = None;
                self.drag = Some(Drag::Select);
                self.last_click = None;
                return;
            }
        }
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
            (Some(Drag::Select), Some(i)) => {
                let item = &self.board.items[i];
                let inset = i32::from(item.kind == Kind::Note);
                let row = (y - item.y - inset).max(0) as usize + item.scroll_offset();
                self.cursor = item.cursor_at_cell((x - item.x - inset).max(0) as usize, row);
                self.desired_column = None;
            }
            (Some(Drag::Scroll { id, grab }), _) => {
                let Some(item) = self.board.items.iter_mut().find(|item| item.id == id) else {
                    self.drag = None;
                    return;
                };
                if let Some((_, len)) = item.scrollbar() {
                    let travel = item.inner_height() - len;
                    let at = (y - item.y - 1).max(0) as usize;
                    item.scroll = at.saturating_sub(grab).min(travel) * item.max_scroll() / travel.max(1);
                }
            }
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
            Button::Format(action) => self.format(action),
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

    pub fn selection(&self) -> Option<Range<usize>> {
        let anchor = self.anchor.filter(|&a| self.editing && a != self.cursor)?;
        Some(anchor.min(self.cursor)..anchor.max(self.cursor))
    }

    fn copy_selection(&mut self) {
        let (Some(i), Some(range)) = (self.selected, self.selection()) else {
            return;
        };
        self.cut_buffer = self.board.items[i].text[range].to_string();
        self.clipboard_outbox.push(self.cut_buffer.clone());
    }

    fn format(&mut self, action: Format) {
        if action == Format::Copy {
            self.copy_selection();
            return;
        }
        let (Some(i), Some(mut range)) = (self.selected, self.selection()) else {
            return;
        };
        if action == Format::Link && self.board.items[i].text[range.clone()].contains('\n') {
            if !matches!(self.status, Status::Error(_)) {
                self.status = Status::Hint("link needs a selection on one line".into());
            }
            return;
        }
        let text = &mut self.board.items[i].text;
        let mut selected = None;
        let replacement = match action {
            Format::Bold | Format::Italic | Format::Strike | Format::Code => {
                let mark = match action {
                    Format::Bold => "**",
                    Format::Italic => "*",
                    Format::Strike => "~~",
                    _ => "`",
                };
                let Some(replacement) = format_inline(text, &mut range, mark) else {
                    if !matches!(self.status, Status::Error(_)) {
                        self.status = Status::Hint("selection contains existing formatting markers".into());
                    }
                    return;
                };
                replacement
            }
            Format::Link => {
                let raw = &text[range.clone()];
                if raw.starts_with('[')
                    && raw.ends_with(')')
                    && let Some(end) = raw.find("](")
                    && raw[end + 2..].find(')') == Some(raw.len() - end - 3)
                    && !raw[end + 2..raw.len() - 1].chars().any(char::is_whitespace)
                {
                    raw[1..end].to_string()
                } else if text[..range.start].ends_with('[')
                    && text[range.end..].starts_with("](")
                    && let Some(end) = text[range.end + 2..].find(')')
                    && !text[range.end + 2..range.end + 2 + end].chars().any(char::is_whitespace)
                {
                    let raw = raw.to_string();
                    range.start -= 1;
                    range.end += end + 3;
                    raw
                } else {
                    selected = Some(range.start + raw.len() + 3..range.start + raw.len() + 6);
                    format!("[{raw}](url)")
                }
            }
            Format::Heading | Format::Bullet | Format::Checkbox => {
                range.start = text[..range.start].rfind('\n').map_or(0, |p| p + 1);
                // An end at the next line's start does not include that line.
                let end = if range.end > range.start && text[..range.end].ends_with('\n') {
                    range.end - 1
                } else {
                    range.end
                };
                range.end = text[end..].find('\n').map_or(text.len(), |p| end + p);
                format_prefixes(&text[range.clone()], action)
            }
            Format::Copy => unreachable!(),
        };
        if text[range.clone()] == replacement {
            return;
        }
        let start = range.start;
        text.replace_range(range, &replacement);
        let selection = selected.unwrap_or(start..start + replacement.len());
        self.anchor = Some(selection.start);
        self.cursor = selection.end;
        self.desired_column = None;
        self.board.items[i].fit_height();
        self.dirty = true;
    }

    fn scroll_note(&mut self, i: usize, delta: i32) {
        let item = &mut self.board.items[i];
        item.scroll = item.scroll_offset().saturating_add_signed(delta as isize).min(item.max_scroll());
    }

    fn scroll_selected(&mut self, direction: i32) {
        if let Some(i) = self.selected {
            self.scroll_note(i, direction * self.board.items[i].inner_height() as i32);
        }
    }

    fn wheel(&mut self, col: u16, row: u16, delta: i32) {
        let (x, y) = self.to_world(col, row);
        if self.canvas.contains(Position::new(col, row))
            && let Some(i) = self.board.hit(x, y)
            && self.board.items[i].max_scroll() > 0
        {
            self.scroll_note(i, delta);
        } else {
            self.cam.1 += delta;
        }
    }

    fn follow_cursor(&mut self) {
        if !self.editing {
            return;
        }
        if let Some(i) = self.selected {
            let item = &mut self.board.items[i];
            if item.kind == Kind::Note {
                let row = item.cursor_cell(self.cursor).1;
                let scroll = item.scroll_offset();
                item.scroll = if row < scroll {
                    row
                } else if row >= scroll + item.inner_height() {
                    row + 1 - item.inner_height()
                } else {
                    scroll
                };
            }
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

/// Replacement and content ranges when markers are inside or just outside the selected line.
fn inline_wrapping(text: &str, range: Range<usize>, mark: &str) -> Option<(Range<usize>, Range<usize>)> {
    let raw = &text[range.clone()];
    let before = &text[..range.start];
    let after = &text[range.end..];
    if mark == "*" {
        let opening_run = before.bytes().rev().take_while(|&b| b == b'*').count()
            + raw.bytes().take_while(|&b| b == b'*').count();
        let closing_run = after.bytes().take_while(|&b| b == b'*').count()
            + raw.bytes().rev().take_while(|&b| b == b'*').count();
        if opening_run % 2 == 0 || closing_run % 2 == 0 {
            return None;
        }
    }
    let opening_inside = raw.starts_with(mark);
    let closing_inside = raw.ends_with(mark);
    if (!opening_inside && !before.ends_with(mark)) || (!closing_inside && !after.starts_with(mark)) {
        return None;
    }
    let content_start = range.start + if opening_inside { mark.len() } else { 0 };
    let content_end = range.end.checked_sub(if closing_inside { mark.len() } else { 0 })?;
    if content_start >= content_end || contains_inline_marker(&text[content_start..content_end], mark) {
        return None;
    }
    let outer_start = if opening_inside { range.start } else { range.start - mark.len() };
    let outer_end = if closing_inside { range.end } else { range.end + mark.len() };
    Some((outer_start..outer_end, content_start..content_end))
}

fn contains_inline_marker(text: &str, mark: &str) -> bool {
    if mark == "*" {
        text.as_bytes().split(|&byte| byte != b'*').any(|run| run.len() % 2 == 1)
    } else {
        text.contains(mark)
    }
}

fn format_inline(text: &str, selection: &mut Range<usize>, mark: &str) -> Option<String> {
    let mut offset = selection.start;
    let lines: Vec<_> = text[selection.clone()]
        .split('\n')
        .map(|line| {
            let range = offset..offset + line.len();
            offset = range.end + 1;
            let wrapped = if line.is_empty() { None } else { inline_wrapping(text, range.clone(), mark) };
            (range, wrapped)
        })
        .collect();
    if lines.iter().any(|(range, wrapped)| wrapped.is_none() && contains_inline_marker(&text[range.clone()], mark)) {
        return None;
    }
    let remove = lines.iter().filter(|(r, _)| !r.is_empty()).all(|(_, wrapped)| wrapped.is_some());
    Some(
        lines
            .into_iter()
            .map(|(range, wrapped)| {
                if range.is_empty() {
                    return String::new();
                }
                if let Some((outer, content)) = wrapped {
                    selection.start = selection.start.min(outer.start);
                    selection.end = selection.end.max(outer.end);
                    text[if remove { content } else { outer }].to_string()
                } else {
                    format!("{mark}{}{mark}", &text[range])
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
    )
}

fn prefix_len(line: &str, action: Format) -> usize {
    let task = ["- [ ] ", "- [x] ", "- [X] "].iter().any(|p| line.starts_with(p));
    match action {
        Format::Heading => {
            let hashes = line.bytes().take_while(|&b| b == b'#').count();
            if (1..=6).contains(&hashes) && line.as_bytes().get(hashes) == Some(&b' ') { hashes + 1 } else { 0 }
        }
        Format::Bullet if !task && line.starts_with("- ") => 2,
        Format::Checkbox if task => 6,
        _ => 0,
    }
}

fn format_prefixes(raw: &str, action: Format) -> String {
    let remove = raw.split('\n').filter(|line| !line.is_empty()).all(|line| prefix_len(line, action) > 0);
    raw.split('\n')
        .map(|line| {
            if line.is_empty() {
                return String::new();
            }
            let prefix = prefix_len(line, action);
            if remove {
                return line[prefix..].to_string();
            }
            if prefix > 0 {
                return line.to_string();
            }
            match action {
                Format::Heading => format!("# {line}"),
                Format::Bullet => format!("- {}", &line[prefix_len(line, Format::Checkbox)..]),
                Format::Checkbox => format!("- [ ] {}", &line[prefix_len(line, Format::Bullet)..]),
                _ => unreachable!(),
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
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

    fn assert_separate_spans_preserved(action: Format, raw: &str) {
        let mut app = editing(raw);
        app.anchor = Some(0);
        app.format(action);
        assert_eq!(app.board.items[0].text, raw);
        assert_eq!(app.selection(), Some(0..raw.len()));
        assert!(!app.dirty);
        assert!(matches!(app.status, Status::Hint(_)));
    }

    #[test]
    fn rereview_bold_does_not_unwrap_separate_spans() {
        assert_separate_spans_preserved(Format::Bold, "**a** and **b**");
    }

    #[test]
    fn rereview_italic_does_not_unwrap_separate_spans() {
        assert_separate_spans_preserved(Format::Italic, "*a* and *b*");
    }

    #[test]
    fn rereview_strike_does_not_unwrap_separate_spans() {
        assert_separate_spans_preserved(Format::Strike, "~~a~~ and ~~b~~");
    }

    #[test]
    fn rereview_code_does_not_unwrap_separate_spans() {
        assert_separate_spans_preserved(Format::Code, "`a` and `b`");
    }

    #[test]
    fn review_scroll_drag_survives_removal_without_changing_target() {
        let mut app = app();
        app.board.items.push(Item { id: 1, text: "a".into(), ..Item::text(40, 2, 0) });
        app.board.items.push(Item {
            id: 2,
            text: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9".into(),
            w: 8,
            h: 6,
            ..Item::note(2, 2, 0)
        });
        app.selected = Some(0);
        app.begin_edit();
        key(&mut app, KeyCode::Backspace);
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 9, 4);
        key(&mut app, KeyCode::Esc);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 9, 6);
        assert_eq!(app.board.items[0].id, 2);
        assert_eq!(app.board.items[0].scroll, 4);
    }

    #[test]
    fn review_scroll_drag_does_not_switch_to_a_shifted_note() {
        let mut app = app();
        app.board.items.push(Item { id: 1, text: "a".into(), ..Item::text(40, 2, 0) });
        for (id, x) in [(2, 2), (3, 20)] {
            app.board.items.push(Item {
                id,
                text: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9".into(),
                w: 8,
                h: 6,
                ..Item::note(x, 2, 0)
            });
        }
        app.selected = Some(0);
        app.begin_edit();
        key(&mut app, KeyCode::Backspace);
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 9, 4);
        key(&mut app, KeyCode::Esc);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 9, 6);
        assert_eq!(app.board.items[0].scroll, 4);
        assert_eq!(app.board.items[1].scroll, 0);
        app.board.remove(0); // A vanished drag target must not redirect to its neighbour.
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 9, 7);
        assert_eq!(app.board.items[0].scroll, 0);
    }

    #[test]
    fn review_italic_toggle_uses_marker_run_parity() {
        for (raw, start, end, expected) in [
            ("**x**", 2, 3, "***x***"),
            ("**x**", 0, 5, "***x***"),
            ("***x***", 3, 4, "**x**"),
            ("***x***", 0, 7, "**x**"),
            ("*a **b** c*", 0, 11, "a **b** c"),
        ] {
            let mut app = editing(raw);
            app.anchor = Some(start);
            app.cursor = end;
            app.format(Format::Italic);
            assert_eq!(app.board.items[0].text, expected, "{raw} {start}..{end}");
        }
    }

    #[test]
    fn review_prefix_toggles_recognize_headings_and_checkbox_lines() {
        for (action, raw, expected) in [
            (Format::Bullet, "- [ ] x", "- x"),
            (Format::Bullet, "- [x] x", "- x"),
            (Format::Bullet, "- x\ny\n", "- x\n- y\n"),
            (Format::Checkbox, "- [x] x\n- y\n", "- [x] x\n- [ ] y\n"),
            (Format::Heading, "## x", "x"),
            (Format::Heading, "###### x\n\n# y", "x\n\ny"),
            (Format::Heading, "## x\ny", "## x\n# y"),
        ] {
            let mut app = editing(raw);
            app.anchor = Some(0);
            app.format(action);
            assert_eq!(app.board.items[0].text, expected, "{action:?}: {raw}");
        }
    }

    #[test]
    fn review_inline_toggles_are_line_local_and_preserve_blank_lines() {
        for (action, mark) in [(Format::Bold, "**"), (Format::Italic, "*"), (Format::Strike, "~~"), (Format::Code, "`")]
        {
            let mut app = editing("a\n\n日本");
            app.anchor = Some(0);
            app.format(action);
            assert_eq!(app.board.items[0].text, format!("{mark}a{mark}\n\n{mark}日本{mark}"));
            app.format(action);
            assert_eq!(app.board.items[0].text, "a\n\n日本");
            app.board.items[0].text = format!("{mark}a{mark}\n\nb");
            app.anchor = Some(0);
            app.cursor = app.board.items[0].text.len();
            app.format(action);
            assert_eq!(app.board.items[0].text, format!("{mark}a{mark}\n\n{mark}b{mark}"));
            let mut blank = editing("\n\n");
            blank.anchor = Some(0);
            blank.format(action);
            assert_eq!(blank.board.items[0].text, "\n\n");
            assert!(!blank.dirty);
        }
    }

    #[test]
    fn review_inline_partial_end_lines_keep_adjacent_markers_paired() {
        let mut app = editing("**abc**\n**日本**");
        app.anchor = Some(2);
        app.cursor -= 2;
        app.format(Format::Bold);
        assert_eq!(app.board.items[0].text, "abc\n日本");
        assert_eq!(app.selection(), Some(0..10));
    }

    #[test]
    fn review_multiline_link_keeps_selection_and_gives_a_hint() {
        let mut app = editing("a\nb");
        app.anchor = Some(0);
        app.format(Format::Link);
        assert_eq!(app.board.items[0].text, "a\nb");
        assert_eq!(app.selection(), Some(0..3));
        assert!(!app.dirty);
        assert!(format!("{:?}", app.status).contains("link needs a selection on one line"));
        key(&mut app, KeyCode::Left);
        assert_eq!(app.status, Status::None);
    }

    #[test]
    fn mouse_selection_copies_raw_utf8_on_release_and_click_clears() {
        let mut app = editing("abcdef gh日本");
        app.board.items[0].kind = Kind::Note;
        app.board.items[0].w = 8;
        app.board.items[0].h = 6;
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 2, 2);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 4, 3);
        assert_eq!(app.selection(), Some(1..9)); // second cell of 日 maps to its start
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 6, 3);
        assert_eq!(app.selection(), Some(1..12));
        assert!(app.clipboard_outbox.is_empty());
        mouse(&mut app, MouseEventKind::Up(MouseButton::Left), 6, 3);
        assert_eq!(app.cut_buffer, "bcdef gh日");
        assert_eq!(app.clipboard_outbox, ["bcdef gh日"]);
        assert_eq!(app.status, Status::None); // main confirms only after sending the request
        assert_eq!(app.board.items[0].x, 0);
        click(&mut app, 1, 2);
        assert_eq!(app.selection(), None);
    }

    #[test]
    fn shift_motion_uses_wrapped_wide_rows_and_keeps_anchor() {
        let mut app = editing("abcdef gh日本");
        app.board.items[0].kind = Kind::Note;
        app.board.items[0].w = 8;
        app.cursor = 1;
        modified_key(&mut app, KeyCode::Down, KeyModifiers::SHIFT);
        assert_eq!(app.selection(), Some(1..8));
        modified_key(&mut app, KeyCode::Right, KeyModifiers::SHIFT);
        modified_key(&mut app, KeyCode::Right, KeyModifiers::SHIFT);
        assert_eq!(app.selection(), Some(1..12));
        modified_key(&mut app, KeyCode::Up, KeyModifiers::SHIFT);
        assert_eq!(app.anchor, Some(1));
        modified_key(&mut app, KeyCode::Home, KeyModifiers::SHIFT);
        assert_eq!(app.selection(), Some(0..1));
        modified_key(&mut app, KeyCode::End, KeyModifiers::SHIFT);
        assert_eq!(app.selection(), Some(1..15));
        assert!(app.clipboard_outbox.is_empty());
        key(&mut app, KeyCode::Left);
        assert_eq!(app.selection(), None);
    }

    #[test]
    fn typing_paste_newline_and_deletes_replace_selection() {
        for (code, expected) in
            [(KeyCode::Char('X'), "aXb"), (KeyCode::Enter, "a\nb"), (KeyCode::Backspace, "ab"), (KeyCode::Delete, "ab")]
        {
            let mut app = editing("a日本b");
            app.anchor = Some(1);
            app.cursor = 7;
            key(&mut app, code);
            assert_eq!(app.board.items[0].text, expected);
            assert_eq!(app.selection(), None);
        }
        let mut app = editing("a日本b");
        app.anchor = Some(7);
        app.cursor = 1;
        app.handle(Event::Paste("x\r\ny".into()));
        assert_eq!(app.board.items[0].text, "ax\nyb");
        assert_eq!(app.cursor, 4);
        let mut app = editing("a");
        app.anchor = Some(1);
        app.cursor = 0;
        modified_key(&mut app, KeyCode::Char('r'), KeyModifiers::CONTROL);
        assert_eq!(app.selection(), Some(0..1)); // ignored keys do not discard source selection
        typ(&mut app, "a");
        assert_eq!(app.cursor, 1);
        assert_eq!(app.selection(), None);
    }

    #[test]
    fn raw_copy_outbox_and_yank_preserve_utf8() {
        let mut app = editing("日本");
        app.anchor = Some(0);
        app.format(Format::Copy);
        assert_eq!(app.cut_buffer, "日本");
        assert_eq!(app.clipboard_outbox, ["日本"]);
        key(&mut app, KeyCode::End); // clears selection
        modified_key(&mut app, KeyCode::Char('y'), KeyModifiers::CONTROL);
        assert_eq!(app.board.items[0].text, "日本日本");
    }

    #[test]
    fn inline_formatting_toggles_inside_and_outside_and_link_selects_url() {
        for (action, mark) in [(Format::Bold, "**"), (Format::Italic, "*"), (Format::Strike, "~~"), (Format::Code, "`")]
        {
            let mut app = editing("a日本z");
            app.anchor = Some(1);
            app.cursor = 7;
            app.format(action);
            assert_eq!(app.board.items[0].text, format!("a{mark}日本{mark}z"));
            let range = app.selection().unwrap();
            assert_eq!(&app.board.items[0].text[range], format!("{mark}日本{mark}"));
            app.format(action);
            assert_eq!(app.board.items[0].text, "a日本z");
            app.format(action);
            app.anchor = Some(1 + mark.len());
            app.cursor = 7 + mark.len();
            app.format(action);
            assert_eq!(app.board.items[0].text, "a日本z");
            assert_eq!(app.selection(), Some(1..7));
        }
        let mut app = editing("日本");
        app.anchor = Some(0);
        app.format(Format::Link);
        assert_eq!(app.board.items[0].text, "[日本](url)");
        assert_eq!(&app.board.items[0].text[app.selection().unwrap()], "url");
        app.anchor = Some(0);
        app.cursor = app.board.items[0].text.len();
        app.format(Format::Link);
        assert_eq!(app.board.items[0].text, "日本");
        app.format(Format::Link);
        app.anchor = Some(1);
        app.cursor = 7;
        app.format(Format::Link);
        assert_eq!(app.board.items[0].text, "日本");
        let mut app = editing("[a](url) and [b](url)");
        app.anchor = Some(0);
        app.format(Format::Link);
        assert_eq!(app.board.items[0].text, "[[a](url) and [b](url)](url)");
    }

    #[test]
    fn line_prefix_toggles_multiline_and_excludes_next_line_start() {
        for (action, prefix) in [(Format::Heading, "# "), (Format::Bullet, "- "), (Format::Checkbox, "- [ ] ")] {
            let mut app = editing("first\n日本\nlast");
            app.anchor = Some(2);
            app.cursor = 13;
            app.format(action);
            assert_eq!(app.board.items[0].text, format!("{prefix}first\n{prefix}日本\nlast"));
            app.format(action);
            assert_eq!(app.board.items[0].text, "first\n日本\nlast");
            assert_eq!(app.selection(), Some(0..12));
        }
        let mut app = editing("# first\nsecond");
        app.anchor = Some(0);
        app.format(Format::Heading);
        assert_eq!(app.board.items[0].text, "# first\n# second");
        app.format(Format::Heading);
        assert_eq!(app.board.items[0].text, "first\nsecond");
    }

    #[test]
    fn ctrl_t_dispatches_all_actions_and_escape_only_cancels_pending() {
        for (letter, expected) in [
            ('b', "**x**"),
            ('i', "*x*"),
            ('s', "~~x~~"),
            ('`', "`x`"),
            ('l', "[x](url)"),
            ('h', "# x"),
            ('-', "- x"),
            ('x', "- [ ] x"),
            ('c', "x"),
        ] {
            let mut app = editing("x");
            app.anchor = Some(0);
            modified_key(&mut app, KeyCode::Char('t'), KeyModifiers::CONTROL);
            assert!(app.format_pending);
            key(&mut app, KeyCode::Char(letter));
            assert_eq!(app.board.items[0].text, expected);
            assert!(!app.format_pending && app.editing && app.selection().is_some());
            assert_eq!(app.clipboard_outbox.len(), usize::from(letter == 'c'));
        }
        let mut app = editing("x");
        app.anchor = Some(0);
        modified_key(&mut app, KeyCode::Char('t'), KeyModifiers::CONTROL);
        key(&mut app, KeyCode::Esc);
        assert!(!app.format_pending && app.editing && app.selection().is_some());
    }

    #[test]
    fn note_wheel_pages_track_and_thumb_scroll_without_arrow_or_persistence() {
        let mut app = app();
        app.board.items.push(Item { text: "0\n1\n2\n3\n4\n5\n6\n7\n8\n9".into(), w: 8, h: 6, ..Item::note(2, 2, 0) });
        let json = serde_json::to_string(&app.board).unwrap();
        mouse(&mut app, MouseEventKind::ScrollDown, 3, 4);
        assert_eq!(app.board.items[0].scroll, 2);
        assert_eq!(app.cam, (0, 0));
        app.selected = Some(0);
        key(&mut app, KeyCode::PageDown);
        assert_eq!(app.board.items[0].scroll, 6);
        key(&mut app, KeyCode::PageUp);
        assert_eq!(app.board.items[0].scroll, 2);
        // Track at right border, then thumb at its new top.
        click(&mut app, 9, 7);
        assert_eq!(app.board.items[0].scroll, 6);
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 9, 7);
        assert!(!app.arrow_drag());
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 9, 4);
        mouse(&mut app, MouseEventKind::Up(MouseButton::Left), 9, 4);
        assert_eq!(app.board.items[0].scroll, 0);
        assert_eq!(serde_json::to_string(&app.board).unwrap(), json);
        assert!(!app.dirty);
        // Resize corner is never scrollbar track.
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 9, 8);
        assert!(matches!(app.drag, Some(Drag::Resize)));
        mouse(&mut app, MouseEventKind::ScrollUp, 50, 10);
        assert_eq!(app.cam, (0, -2));
    }

    #[test]
    fn editing_scroll_follows_cursor_and_click_mapping_while_height_is_capped() {
        let mut app = editing("0\n1\n2\n3\n4\n5");
        let item = &mut app.board.items[0];
        item.kind = Kind::Note;
        item.w = 8;
        item.h = 4;
        key(&mut app, KeyCode::End);
        assert_eq!(app.board.items[0].scroll, 4);
        click(&mut app, 1, 2);
        assert_eq!(app.cursor, 8);
        modified_key(&mut app, KeyCode::Up, KeyModifiers::SHIFT);
        assert_eq!(app.board.items[0].scroll, 3);
        assert_eq!(app.selection(), Some(6..8));
        let item = &app.board.items[0];
        assert!(item.cursor_cell(app.cursor).1 - item.scroll_offset() < item.inner_height());
        app.finish_edit();
        app.board.items[0].kind = Kind::Text;
        assert_eq!(app.board.items[0].max_scroll(), 0);
    }

    #[test]
    fn all_eight_color_keys_select_the_corresponding_swatch() {
        let mut app = app();
        app.board.items.push(Item::note(0, 0, 0));
        app.selected = Some(0);
        for c in '1'..='8' {
            key(&mut app, KeyCode::Char(c));
            assert_eq!(app.color, c as usize - '1' as usize);
            assert_eq!(app.board.items[0].color, app.color);
        }
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
    fn paste_and_ctrl_j_keep_line_breaks_at_the_cursor() {
        let mut app = app();
        app.spawn(Item { w: 10, h: 3, ..Item::note(0, 0, 0) });
        typ(&mut app, "ab");
        key(&mut app, KeyCode::Left);
        app.handle(Event::Paste("# h\r\n\r\n- x\ry\tz\x07".into()));
        assert_eq!(app.board.items[0].text, "a# h\n\n- x\ny  zb");
        assert_eq!(app.cursor, "a# h\n\n- x\ny  z".len());
        assert!(app.dirty && app.board.items[0].h as usize >= app.board.items[0].lines().len() + 2);
        modified_key(&mut app, KeyCode::Char('j'), KeyModifiers::CONTROL);
        assert_eq!(app.board.items[0].text, "a# h\n\n- x\ny  z\nb");

        // Outside editing a paste changes nothing.
        key(&mut app, KeyCode::Esc);
        app.handle(Event::Paste("ignored".into()));
        assert!(!app.board.items[0].text.contains("ignored"));
    }

    #[test]
    fn editing_click_places_raw_cursor_without_starting_a_move() {
        let mut app = app();
        app.board.items.push(Item { text: "**a日本**\nshort\nlast row".into(), ..Item::text(4, 2, 0) });
        app.selected = Some(0);
        app.begin_edit();
        assert!(app.board.items[0].editing);
        for (col, row, byte) in [(8, 3, 3), (9, 3, 6), (12, 4, 17), (6, 5, 20)] {
            click(&mut app, col, row);
            assert_eq!(app.cursor, byte);
            assert!(app.drag.is_none() && app.editing);
        }
        // Even a second press while editing places, rather than restarting at the end.
        click(&mut app, 4, 3);
        click(&mut app, 4, 3);
        assert_eq!(app.cursor, 0);
        mouse(&mut app, MouseEventKind::Drag(MouseButton::Left), 20, 9);
        assert_eq!((app.board.items[0].x, app.board.items[0].y), (4, 2));
        click(&mut app, 40, 20);
        assert!(!app.editing && !app.board.items[0].editing);
        assert_eq!(app.board.items[0].size(), (8, 3));
    }

    #[test]
    fn editing_note_click_uses_wrapped_rows_and_leaves_border_drags_alone() {
        let mut app = app();
        app.board.items.push(Item { w: 8, h: 7, text: "abcdef gh日本".into(), ..Item::note(2, 2, 0) });
        app.selected = Some(0);
        app.begin_edit();
        for (col, row, byte) in [(4, 4, 1), (6, 5, 9), (8, 5, 12), (5, 7, 15)] {
            click(&mut app, col, row);
            assert_eq!(app.cursor, byte);
            assert!(app.drag.is_none());
        }
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 2, 4);
        assert!(app.arrow_drag());
        mouse(&mut app, MouseEventKind::Up(MouseButton::Left), 2, 4);
        mouse(&mut app, MouseEventKind::Down(MouseButton::Left), 9, 9);
        assert!(matches!(app.drag, Some(Drag::Resize)));
        assert!(app.editing);
    }

    #[test]
    fn double_click_begins_at_raw_end_and_switches_text_geometry() {
        let mut app = app();
        app.board.items.push(Item { text: "**bold**".into(), ..Item::text(4, 2, 0) });
        assert_eq!(app.board.items[0].size(), (4, 1));
        click(&mut app, 5, 3);
        click(&mut app, 5, 3);
        assert_eq!(app.cursor, 8);
        assert!(app.editing && app.board.items[0].editing);
        assert_eq!(app.board.items[0].size(), (8, 1));
        key(&mut app, KeyCode::Esc);
        assert_eq!(app.board.items[0].size(), (4, 1));
    }

    #[test]
    fn toolbar_buttons_dispatch() {
        let mut app = app();
        app.buttons = vec![(Rect::new(0, 0, 5, 1), Button::Note), (Rect::new(6, 0, 3, 1), Button::Color(4))];
        click(&mut app, 7, 0);
        assert_eq!(app.color, 4);
        click(&mut app, 1, 0);
        assert_eq!(app.board.items[0], Item { id: 1, editing: true, ..Item::note(28, 8, 4) });
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
