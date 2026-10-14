use crate::app::{App, Button, COLORS, Status};
use crate::board::{Item, Kind};
use crate::palette::{ACCENT, CRITICAL, DECORATIVE, FIELD, PRIMARY, SECONDARY, STRUCTURAL, SURFACE, WARNING};
use ratatui::Frame;
use ratatui::buffer::Buffer;
use ratatui::layout::{Constraint, Layout, Position, Rect};
use ratatui::style::{Color, Modifier, Style};
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

/// Note paper, and the ink of text items. These are labels a person chooses, not states:
/// a warning- or critical-colored note means nothing to the app.
pub const PAPER: [Color; COLORS] = [ACCENT, WARNING, CRITICAL, PRIMARY, SECONDARY];

pub fn render(frame: &mut Frame, app: &mut App) {
    let [top, canvas, bottom] =
        Layout::vertical([Constraint::Length(1), Constraint::Fill(1), Constraint::Length(1)])
            .areas(frame.area());
    app.canvas = canvas;
    let buf = frame.buffer_mut();
    app.buttons = toolbar(buf, top, app.color);
    board(buf, canvas, app);
    status(buf, bottom, app);
    if let Some(pos) = cursor(app) {
        frame.set_cursor_position(pos);
    }
}

/// Draws the toolbar and returns each button's clickable region.
fn toolbar(buf: &mut Buffer, area: Rect, color: usize) -> Vec<(Rect, Button)> {
    let bar = Style::new().fg(SECONDARY).bg(SURFACE);
    let key = Style::new().fg(PRIMARY).bg(STRUCTURAL);
    buf.set_style(area, bar);

    let mut parts = vec![
        (" WHITEBOARD ".to_string(), Style::new().fg(FIELD).bg(ACCENT).bold(), None),
        ("  ".into(), bar, None),
        (" + NOTE ".into(), key, Some(Button::Note)),
        (" ".into(), bar, None),
        (" + TEXT ".into(), key, Some(Button::Text)),
        ("  ".into(), bar, None),
    ];
    for (i, &paper) in PAPER.iter().enumerate() {
        let swatch = if i == color { "[■]" } else { " ■ " };
        parts.push((swatch.into(), bar.fg(paper), Some(Button::Color(i))));
    }
    for (label, button) in [(" DELETE ", Button::Delete), (" SAVE ", Button::Save), (" QUIT ", Button::Quit)] {
        parts.push(("  ".into(), bar, None));
        parts.push((label.into(), key, Some(button)));
    }

    let mut regions = Vec::new();
    let mut x = area.x;
    for (text, style, button) in parts {
        let w = text.width() as u16;
        if x + w > area.right() {
            break;
        }
        buf.set_string(x, area.y, &text, style);
        if let Some(button) = button {
            regions.push((Rect::new(x, area.y, w, 1), button));
        }
        x += w;
    }
    regions
}

fn board(buf: &mut Buffer, area: Rect, app: &App) {
    buf.set_style(area, Style::new().bg(FIELD));
    let (cx, cy) = app.cam;
    // A dot grid anchored to the board, so panning is visible.
    for row in 0..area.height {
        for col in 0..area.width {
            if (cx + col as i32).rem_euclid(6) == 0
                && (cy + row as i32).rem_euclid(3) == 0
                && let Some(cell) = buf.cell_mut((area.x + col, area.y + row))
            {
                cell.set_char('·').set_fg(STRUCTURAL);
            }
        }
    }
    if app.board.items.is_empty() {
        let hint = "empty board · double-click to write · n for a sticky note";
        let x = area.x as i32 + (area.width as i32 - hint.width() as i32).max(0) / 2;
        put(buf, area, x, area.y as i32 + area.height as i32 / 2, hint, Style::new().fg(SECONDARY).bg(FIELD));
    }
    for (i, item) in app.board.items.iter().enumerate() {
        let x = item.x - cx + area.x as i32;
        let y = item.y - cy + area.y as i32;
        let selected = app.selected == Some(i);
        match item.kind {
            Kind::Note => note(buf, area, x, y, item, selected),
            Kind::Text => text(buf, area, x, y, item, selected),
        }
    }
}

fn note(buf: &mut Buffer, clip: Rect, x: i32, y: i32, item: &Item, selected: bool) {
    let (w, h) = (item.w as i32, item.h as i32);
    let body = Style::new().fg(FIELD).bg(PAPER[item.color % COLORS]);
    let shadow = Style::new().bg(SURFACE);
    for r in 1..=h {
        put(buf, clip, x + w, y + r, " ", shadow);
    }
    put(buf, clip, x + 1, y + h, &" ".repeat(w as usize), shadow);

    let (edge, [tl, tr, bl, br, hz, vt]) = if selected {
        (body.add_modifier(Modifier::BOLD), ['┏', '┓', '┗', '◢', '━', '┃'])
    } else {
        (body.fg(STRUCTURAL), ['╭', '╮', '╰', '╯', '─', '│'])
    };
    let span = hz.to_string().repeat((w - 2).max(0) as usize);
    put(buf, clip, x, y, &format!("{tl}{span}{tr}"), edge);
    for r in 1..h - 1 {
        put(buf, clip, x, y + r, &vt.to_string(), edge);
        put(buf, clip, x + 1, y + r, &" ".repeat((w - 2).max(0) as usize), body);
        put(buf, clip, x + w - 1, y + r, &vt.to_string(), edge);
    }
    put(buf, clip, x, y + h - 1, &format!("{bl}{span}{br}"), edge);

    let inner = intersect(clip, x + 1, y + 1, w - 2, h - 2);
    for (r, line) in item.lines().iter().enumerate() {
        put(buf, inner, x + 1, y + 1 + r as i32, line, body);
    }
}

fn text(buf: &mut Buffer, clip: Rect, x: i32, y: i32, item: &Item, selected: bool) {
    let mut style = Style::new().fg(PAPER[item.color % COLORS]).bold();
    if selected {
        style = style.bg(SURFACE);
        let (w, h) = item.size();
        for r in 0..h {
            put(buf, clip, x, y + r, &" ".repeat(w as usize), style);
        }
    }
    for (r, line) in item.lines().iter().enumerate() {
        put(buf, clip, x, y + r as i32, line, style);
    }
}

fn status(buf: &mut Buffer, area: Rect, app: &App) {
    let bar = Style::new().fg(SECONDARY).bg(SURFACE);
    buf.set_style(area, bar);
    let (mode, hints) = if app.editing {
        (" EDIT ", " type · Enter new line · Esc or click away to finish")
    } else if app.selected.is_some() {
        (" MOVE ", " drag or arrows to move · drag ◢ or Shift+arrows to resize · Enter edit · Del · Esc")
    } else {
        (" BOARD ", " double-click: write · drag empty space, scroll or arrows to pan · Tab select · n t 1-5 q")
    };
    let plate = Style::new().fg(FIELD).bg(if app.editing { ACCENT } else { SECONDARY }).bold();
    buf.set_stringn(area.x, area.y, mode, area.width as usize, plate);
    let used = mode.width() as u16;
    buf.set_stringn(area.x + used, area.y, hints, area.width.saturating_sub(used) as usize, bar);

    // Saved state and errors are worded plates on the right, drawn over the hints.
    let right = match &app.status {
        Status::Error(message) => Some((format!(" ERROR {message} "), CRITICAL)),
        _ if app.dirty => Some((" UNSAVED ".to_string(), WARNING)),
        Status::Saved => Some((" SAVED ".to_string(), DECORATIVE)),
        Status::None => None,
    };
    if let Some((text, color)) = right {
        let w = (text.width() as u16).min(area.width);
        buf.set_stringn(area.right() - w, area.y, &text, w as usize, Style::new().fg(FIELD).bg(color).bold());
    }
}

fn cursor(app: &App) -> Option<Position> {
    let item = &app.board.items[app.selected.filter(|_| app.editing)?];
    let (dx, dy) = item.end_offset();
    let x = item.x + dx - app.cam.0 + app.canvas.x as i32;
    let y = item.y + dy - app.cam.1 + app.canvas.y as i32;
    let pos = Position::new(u16::try_from(x).ok()?, u16::try_from(y).ok()?);
    app.canvas.contains(pos).then_some(pos)
}

/// The part of a board-space rectangle that lies inside `clip`.
fn intersect(clip: Rect, x: i32, y: i32, w: i32, h: i32) -> Rect {
    let left = x.max(clip.x as i32);
    let top = y.max(clip.y as i32);
    let right = (x + w).min(clip.right() as i32);
    let bottom = (y + h).min(clip.bottom() as i32);
    if right <= left || bottom <= top {
        return Rect::default();
    }
    Rect::new(left as u16, top as u16, (right - left) as u16, (bottom - top) as u16)
}

/// Writes `text` from screen cell (x, y), dropping characters that fall outside `clip`.
fn put(buf: &mut Buffer, clip: Rect, x: i32, y: i32, text: &str, style: Style) {
    if y < clip.y as i32 || y >= clip.bottom() as i32 {
        return;
    }
    let mut x = x;
    for ch in text.chars() {
        let w = ch.width().unwrap_or(0) as i32;
        if w > 0 && x >= clip.x as i32 && x + w <= clip.right() as i32 {
            buf.set_string(x as u16, y as u16, ch.encode_utf8(&mut [0; 4]), style);
        }
        x += w;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board::Board;
    use ratatui::{Terminal, backend::TestBackend};

    fn screen(app: &mut App) -> Vec<String> {
        let mut term = Terminal::new(TestBackend::new(60, 12)).unwrap();
        term.draw(|f| render(f, app)).unwrap();
        let buf = term.backend().buffer().clone();
        (0..buf.area.height)
            .map(|y| (0..buf.area.width).map(|x| buf[(x, y)].symbol().to_string()).collect())
            .collect()
    }

    #[test]
    fn draws_toolbar_notes_and_clipped_text() {
        let mut note = Item::note(2, 1, 0);
        note.w = 12;
        note.h = 4;
        note.text = "buy milk and eggs".into();
        let mut label = Item::text(52, 5, 1);
        label.text = "offscreen tail".into();
        let mut app = App::new(Board { items: vec![note, label] }, "wb.json".into());

        let rows = screen(&mut app);
        assert!(rows[0].starts_with(" WHITEBOARD    + NOTE "));
        assert_eq!(&rows[2][2..], "╭──────────╮                                              ");
        assert!(rows[3].contains("│buy milk  │"));
        assert!(rows[4].contains("│and eggs  │"));
        assert!(rows[6].ends_with("offscree"));
        assert_eq!(app.canvas, Rect::new(0, 1, 60, 10));
        // At 60 columns the toolbar drops buttons that do not fit rather than overlapping.
        assert!(!app.buttons.iter().any(|(_, b)| *b == Button::Quit));
        assert!(app.buttons.contains(&(Rect::new(14, 0, 8, 1), Button::Note)));
    }

    #[test]
    fn empty_board_says_so_and_status_states_are_worded() {
        let mut app = App::new(Board::default(), "wb.json".into());
        let rows = screen(&mut app);
        assert!(rows[6].contains("empty board"));
        assert!(rows[11].starts_with(" BOARD "));

        app.dirty = true;
        assert!(screen(&mut app)[11].ends_with(" UNSAVED "));
        app.status = Status::Error("save failed: permission denied".into());
        assert!(screen(&mut app)[11].ends_with(" ERROR save failed: permission denied "));
        app.status = Status::Saved;
        app.dirty = false;
        assert!(screen(&mut app)[11].ends_with(" SAVED "));
    }

    #[test]
    fn tiny_terminals_render_without_panicking() {
        let mut note = Item::note(-2, -1, 3);
        note.text = "日本語 text".into();
        let mut app = App::new(Board { items: vec![note] }, "wb.json".into());
        app.selected = Some(0);
        app.editing = true;
        for (w, h) in [(1, 1), (3, 2), (10, 3), (5, 10)] {
            let mut term = Terminal::new(TestBackend::new(w, h)).unwrap();
            term.draw(|f| render(f, &mut app)).unwrap();
        }
    }

    #[test]
    fn panned_note_is_clipped_at_the_canvas_edge() {
        let mut app = App::new(Board { items: vec![Item::note(0, 0, 0)] }, "wb.json".into());
        app.cam = (5, 0);
        let rows = screen(&mut app);
        assert!(rows[1].starts_with("───"));
    }
}
