use crate::app::{App, Button, COLORS, Status};
use crate::board::{Item, Kind, merge_arrow_glyph};
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

    // In a narrow pane the title plate goes first, so the buttons stay clickable.
    let full: usize = parts.iter().map(|(text, _, _)| text.width()).sum();
    let skip = if full > area.width as usize { 2 } else { 0 };
    let mut regions = Vec::new();
    let mut x = area.x;
    for (text, style, button) in parts.into_iter().skip(skip) {
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
    let style = Style::new().fg(SECONDARY).bg(FIELD);
    let arrows = app
        .board
        .arrows
        .iter()
        .enumerate()
        .filter(|(i, _)| app.selected_arrow != Some(*i))
        .flat_map(|(_, arrow)| app.board.arrow_cells(*arrow, false, app.world_clip()))
        .chain(app.preview());
    for (x, y, glyph) in arrows {
        let (x, y) = (x - cx + area.x as i32, y - cy + area.y as i32);
        let existing = buf[(x as u16, y as u16)].symbol().chars().next().unwrap_or(' ');
        let glyph = merge_arrow_glyph(existing, glyph);
        put(buf, area, x, y, &glyph.to_string(), style);
    }
    if let Some(i) = app.selected_arrow {
        for (x, y, glyph) in app.board.arrow_cells(app.board.arrows[i], true, app.world_clip()) {
            put(buf, area, x - cx + area.x as i32, y - cy + area.y as i32, &glyph.to_string(), style);
        }
    }
    for (i, item) in app.board.items.iter().enumerate() {
        let x = item.x - cx + area.x as i32;
        let y = item.y - cy + area.y as i32;
        let selected = app.selected == Some(i) || app.arrow_target() == Some(i);
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
    styled_lines(buf, inner, x + 1, y + 1, item, body);
}

fn text(buf: &mut Buffer, clip: Rect, x: i32, y: i32, item: &Item, selected: bool) {
    let mut style = Style::new().fg(PAPER[item.color % COLORS]).bg(FIELD);
    if selected {
        style = style.bg(SURFACE);
        let (w, h) = item.size();
        for r in 0..h {
            put(buf, clip, x, y + r, &" ".repeat(w as usize), style);
        }
    }
    styled_lines(buf, clip, x, y, item, style);
}

fn styled_lines(buf: &mut Buffer, clip: Rect, x: i32, y: i32, item: &Item, base: Style) {
    for (r, line) in item.display_lines().iter().enumerate() {
        let mut col = x;
        for span in line {
            let flags = span.style;
            let mut style = base;
            for (enabled, modifier) in [
                (flags.bold || flags.heading, Modifier::BOLD),
                (flags.italic, Modifier::ITALIC),
                (flags.strike, Modifier::CROSSED_OUT),
                (flags.link || flags.heading, Modifier::UNDERLINED),
                (flags.code, Modifier::REVERSED),
                (flags.quote, Modifier::DIM),
            ] {
                if enabled {
                    style = style.add_modifier(modifier);
                }
            }
            put(buf, clip, col, y + r as i32, &span.text, style);
            col += span.text.chars().map(|c| c.width().unwrap_or(0) as i32).sum::<i32>();
        }
    }
}

fn status(buf: &mut Buffer, area: Rect, app: &App) {
    let bar = Style::new().fg(SECONDARY).bg(SURFACE);
    buf.set_style(area, bar);
    let (mode, hints) = if app.arrow_drag() {
        (" ARROW ", " release on an item to connect · elsewhere cancels")
    } else if app.editing {
        (" EDIT ", " type · Enter new line · Esc or click away to finish")
    } else if app.connecting {
        (" ARROW ", " Tab choose target · Enter connect/remove · Esc cancel")
    } else if app.selected_arrow.is_some() {
        (" ARROW ", " Del remove · Tab next · Esc")
    } else if app.selected.is_some() {
        (
            " MOVE ",
            " drag or arrows to move · drag border or a to connect · drag ◢ or Shift+arrows to resize · Enter edit · Del · Esc",
        )
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
    let (dx, dy) = item.cursor_offset(app.cursor);
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
    use crate::board::{Arrow, Board};
    use ratatui::crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
    use ratatui::{
        Terminal,
        backend::{Backend, TestBackend},
    };

    fn screen(app: &mut App) -> Vec<String> {
        let mut term = Terminal::new(TestBackend::new(60, 12)).unwrap();
        term.draw(|f| render(f, app)).unwrap();
        let buf = term.backend().buffer().clone();
        (0..buf.area.height)
            .map(|y| (0..buf.area.width).map(|x| buf[(x, y)].symbol().to_string()).collect())
            .collect()
    }

    #[test]
    fn markdown_glyphs_modifiers_and_raw_editing_match_the_drawn_cells() {
        let mut app = App::new(Board {
            items: vec![Item { text: "# Head\n**b** *i* `c` ~~s~~ [l](url) plain\n- [x] done\n> quote".into(), ..Item::text(2, 0, 0) }],
            ..Board::default()
        }, "wb.json".into());
        let mut term = Terminal::new(TestBackend::new(60, 12)).unwrap();
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        assert_eq!(buf[(2, 1)].symbol(), "H");
        assert!(buf[(2, 1)].modifier.contains(Modifier::BOLD | Modifier::UNDERLINED));
        for (x, glyph, modifier) in [(2, "b", Modifier::BOLD), (4, "i", Modifier::ITALIC), (6, "c", Modifier::REVERSED), (8, "s", Modifier::CROSSED_OUT), (10, "l", Modifier::UNDERLINED)] {
            assert_eq!(buf[(x, 2)].symbol(), glyph);
            assert!(buf[(x, 2)].modifier.contains(modifier));
            assert_eq!(buf[(x, 2)].fg, ACCENT);
        }
        assert_eq!(buf[(12, 2)].symbol(), "p");
        assert!(buf[(12, 2)].modifier.is_empty(), "free text is regular weight");
        assert_eq!(buf[(2, 3)].symbol(), "☑");
        assert_eq!(buf[(2, 4)].symbol(), "│");
        assert!(buf[(2, 4)].modifier.contains(Modifier::DIM));

        app.selected = Some(0);
        app.handle(Event::Key(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE)));
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        assert_eq!(buf[(2, 1)].symbol(), "#");
        assert_eq!(buf[(2, 2)].symbol(), "*");
        assert!(buf[(2, 2)].modifier.is_empty());
        assert_eq!(buf[(2, 3)].symbol(), "-");
        assert_eq!(buf[(2, 2)].bg, SURFACE);
    }

    #[test]
    fn note_markdown_wrap_preserves_ink_and_styles_then_edit_shows_source() {
        let mut app = App::new(Board {
            items: vec![Item { w: 8, text: "**日本語** ab\n- [ ] x".into(), ..Item::note(2, 0, 1) }],
            ..Board::default()
        }, "wb.json".into());
        let mut term = Terminal::new(TestBackend::new(60, 12)).unwrap();
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        for (x, glyph) in [(3, "日"), (5, "本"), (7, "語")] {
            assert_eq!(buf[(x, 2)].symbol(), glyph);
            assert!(buf[(x, 2)].modifier.contains(Modifier::BOLD));
            assert_eq!(buf[(x, 2)].fg, FIELD);
            assert_eq!(buf[(x, 2)].bg, WARNING);
        }
        assert_eq!(buf[(3, 3)].symbol(), "a");
        assert!(!buf[(3, 3)].modifier.contains(Modifier::BOLD));
        assert_eq!(buf[(3, 4)].symbol(), "☐");
        app.selected = Some(0);
        app.handle(Event::Key(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE)));
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        assert_eq!(buf[(3, 2)].symbol(), "*");
        assert_eq!(buf[(5, 2)].symbol(), "日");
        assert!(!buf[(5, 2)].modifier.contains(Modifier::BOLD));
    }

    #[test]
    fn draws_toolbar_notes_and_clipped_text() {
        let mut note = Item::note(2, 1, 0);
        note.w = 12;
        note.h = 4;
        note.text = "buy milk and eggs".into();
        let mut label = Item::text(52, 5, 1);
        label.text = "offscreen tail".into();
        let mut app = App::new(Board { items: vec![note, label], ..Board::default() }, "wb.json".into());

        let rows = screen(&mut app);
        // At 60 columns every button fits only without the title plate.
        assert!(rows[0].starts_with(" + NOTE   + TEXT ") && rows[0].ends_with(" QUIT "));
        assert_eq!(&rows[2][2..], "╭──────────╮                                              ");
        assert!(rows[3].contains("│buy milk  │"));
        assert!(rows[4].contains("│and eggs  │"));
        assert!(rows[6].ends_with("offscree"));
        assert_eq!(app.canvas, Rect::new(0, 1, 60, 10));
        assert!(app.buttons.contains(&(Rect::new(0, 0, 8, 1), Button::Note)));
        assert!(app.buttons.contains(&(Rect::new(54, 0, 6, 1), Button::Quit)));
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
    fn narrow_toolbar_drops_the_title_before_buttons() {
        let mut app = App::new(Board::default(), "wb.json".into());
        let mut term = Terminal::new(TestBackend::new(20, 5)).unwrap();
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        let top: String = (0..20).map(|x| buf[(x, 0)].symbol().to_string()).collect();
        assert_eq!(top, " + NOTE   + TEXT    ");
        assert_eq!(app.buttons, [(Rect::new(0, 0, 8, 1), Button::Note), (Rect::new(9, 0, 8, 1), Button::Text)]);

        let mut term = Terminal::new(TestBackend::new(90, 5)).unwrap();
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        let top: String = (0..22).map(|x| buf[(x, 0)].symbol().to_string()).collect();
        assert_eq!(top, " WHITEBOARD    + NOTE ", "the title returns when everything fits");
    }

    #[test]
    fn tiny_terminals_render_without_panicking() {
        let mut note = Item::note(-2, -1, 3);
        note.text = "日本語 text".into();
        let mut app = App::new(
            Board {
                arrows: vec![Arrow { from: 1, to: 2 }, Arrow { from: 3, to: 2 }],
                items: vec![
                    Item { id: 1, ..note },
                    Item { id: 2, ..Item::note(30, 3, 0) },
                    Item { id: 3, text: "x".into(), ..Item::text(-4, 0, 0) },
                ],
            },
            "wb.json".into(),
        );
        app.selected = Some(0);
        app.editing = true;
        for (w, h) in [(1, 1), (3, 2), (10, 3), (5, 10)] {
            let mut term = Terminal::new(TestBackend::new(w, h)).unwrap();
            term.draw(|f| render(f, &mut app)).unwrap();
        }
    }

    #[test]
    fn panned_note_is_clipped_at_the_canvas_edge() {
        let mut app = App::new(Board { items: vec![Item::note(0, 0, 0)], ..Board::default() }, "wb.json".into());
        app.cam = (5, 0);
        let rows = screen(&mut app);
        assert!(rows[1].starts_with("───"));
    }

    #[test]
    fn arrows_draw_below_notes_use_heavy_selection_and_show_connect_state() {
        let mut board = Board {
            items: vec![
                Item { w: 8, h: 3, ..Item::note(0, 0, 0) },
                Item { w: 8, h: 3, ..Item::note(25, 0, 0) },
                Item { w: 8, h: 3, ..Item::note(14, 0, 0) },
            ],
            ..Board::default()
        };
        board.normalize().unwrap();
        board.arrows.push(Arrow { from: 1, to: 2 });
        let mut app = App::new(board, "wb.json".into());
        let mut term = Terminal::new(TestBackend::new(60, 12)).unwrap();
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        assert_eq!(buf[(9, 2)].symbol(), "─");
        assert_eq!(buf[(24, 2)].symbol(), "▶");
        assert_eq!(buf[(14, 2)].symbol(), "│");
        assert_eq!(buf[(15, 2)].symbol(), " ");
        assert_eq!(buf[(9, 2)].fg, SECONDARY);
        assert_eq!(buf[(9, 2)].bg, FIELD);
        app.selected_arrow = Some(0);
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(9, 2)].symbol(), "━");
        assert!(screen(&mut app)[11].starts_with(" ARROW "));
        app.selected_arrow = None;
        app.selected = Some(0);
        app.connect_target = Some(1);
        app.connecting = true;
        assert!(screen(&mut app)[1].contains("┏━━━━━━┓"));
        assert!(screen(&mut app)[11].contains("Tab choose target"));
        app.board.items[1].y = 6;
        app.selected_arrow = Some(0);
        app.selected = None;
        app.connect_target = None;
        app.connecting = false;
        // The middle note blocks the usual bend, so the arrow drops first, then turns right.
        let cells = app.board.arrow_cells(app.board.arrows[0], true, app.world_clip());
        assert!(cells.contains(&(3, 7, '┗')) && cells.last() == Some(&(24, 7, '▶')));
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(3, 8)].symbol(), "┗");
    }

    #[test]
    fn edit_cursor_uses_wrapped_byte_position_and_wide_character_cells() {
        let mut item = Item::note(2, 1, 0);
        item.w = 8;
        item.text = "abcdef gh日本".into();
        let mut app = App::new(Board { items: vec![item], ..Board::default() }, "wb.json".into());
        app.canvas = Rect::new(0, 1, 60, 10);
        app.selected = Some(0);
        app.editing = true;
        for (byte, pos) in [(5, (8, 3)), (6, (3, 4)), (7, (3, 4)), (12, (7, 4)), (15, (3, 5))] {
            app.cursor = byte;
            assert_eq!(cursor(&app), Some(Position::new(pos.0, pos.1)));
            let mut term = Terminal::new(TestBackend::new(60, 12)).unwrap();
            term.draw(|f| render(f, &mut app)).unwrap();
            assert_eq!(term.backend_mut().get_cursor_position().unwrap(), Position::new(pos.0, pos.1));
        }
    }

    #[test]
    fn distant_endpoints_render_and_hit_test_only_visible_cells() {
        let mut board = Board {
            items: vec![Item::note(-1_000_000_000, 0, 0), Item::note(1_000_000_000, 0, 0)],
            ..Board::default()
        };
        board.normalize().unwrap();
        board.arrows.push(Arrow { from: 1, to: 2 });
        assert_eq!(board.hit_arrow(0, 3), Some(0));
        assert_eq!(board.hit_arrow(0, 4), None);
        let mut app = App::new(board, "wb.json".into());
        let rows = screen(&mut app);
        assert_eq!(rows[4], "─".repeat(60));
        app.selected_arrow = Some(0);
        assert_eq!(screen(&mut app)[4], "━".repeat(60));
        for (w, h) in [(1, 1), (3, 2), (5, 5)] {
            let mut term = Terminal::new(TestBackend::new(w, h)).unwrap();
            term.draw(|f| render(f, &mut app)).unwrap();
        }
    }

    #[test]
    fn repro_scene_merges_shared_runs_crossings_and_draws_selected_arrow_last() {
        let board = Board {
            items: vec![
                Item { id: 1, w: 16, h: 4, text: "plan the thing".into(), ..Item::note(2, 1, 0) },
                Item { id: 2, w: 16, h: 4, text: "ship".into(), ..Item::note(30, 8, 0) },
                Item { id: 3, w: 14, h: 4, text: "review".into(), ..Item::note(50, 1, 0) },
                Item { id: 4, text: "free text".into(), ..Item::text(4, 12, 0) },
            ],
            arrows: vec![Arrow { from: 1, to: 2 }, Arrow { from: 1, to: 3 }, Arrow { from: 2, to: 4 }],
        };
        let mut app = App::new(board, "wb.json".into());
        let mut term = Terminal::new(TestBackend::new(80, 18)).unwrap();
        term.draw(|f| render(f, &mut app)).unwrap();
        let buf = term.backend().buffer();
        assert_eq!(buf[(37, 3)].symbol(), "┬");
        assert_eq!(buf[(37, 4)].symbol(), "│");
        assert_eq!(buf[(37, 8)].symbol(), "▼");
        assert_eq!(buf[(8, 10)].symbol(), "╭");
        assert_eq!(buf[(8, 11)].symbol(), "│");
        assert_eq!(buf[(8, 12)].symbol(), "▼");

        // Extend the exact repro with a straight run crossing the downward branch.
        app.board.items.push(Item { id: 5, text: "x".into(), ..Item::text(20, 5, 0) });
        app.board.items.push(Item { id: 6, text: "x".into(), ..Item::text(45, 5, 0) });
        app.board.arrows.push(Arrow { from: 5, to: 6 });
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(37, 6)].symbol(), "┼");
        app.selected_arrow = Some(0);
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(37, 3)].symbol(), "┓");
        assert_eq!(term.backend().buffer()[(37, 6)].symbol(), "┃");
        app.selected_arrow = Some(3);
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(37, 6)].symbol(), "━");

        // A normal head still wins when a later normal run crosses it.
        app.selected_arrow = None;
        app.board.items[4].y = 7;
        app.board.items[5].y = 7;
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(37, 8)].symbol(), "▼");
        app.board.arrows.reverse();
        term.draw(|f| render(f, &mut app)).unwrap();
        assert_eq!(term.backend().buffer()[(37, 8)].symbol(), "▼");
    }
}
