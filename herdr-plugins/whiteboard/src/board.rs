use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsString;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use std::{fs, io};
use unicode_width::UnicodeWidthChar;

pub const MIN_NOTE_W: u16 = 8;
pub const MIN_NOTE_H: u16 = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Note,
    Text,
}

/// A sticky note or a piece of free text, positioned in board (world) cells.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Item {
    #[serde(default)]
    pub id: u64,
    pub kind: Kind,
    pub x: i32,
    pub y: i32,
    /// Notes only; text items size themselves to their content.
    #[serde(default)]
    pub w: u16,
    #[serde(default)]
    pub h: u16,
    #[serde(default)]
    pub color: usize,
    #[serde(default)]
    pub text: String,
}

impl Item {
    pub fn note(x: i32, y: i32, color: usize) -> Self {
        Self { id: 0, kind: Kind::Note, x, y, w: 24, h: 7, color, text: String::new() }
    }

    pub fn text(x: i32, y: i32, color: usize) -> Self {
        Self { id: 0, kind: Kind::Text, x, y, w: 0, h: 0, color, text: String::new() }
    }

    pub fn size(&self) -> (i32, i32) {
        match self.kind {
            Kind::Note => (self.w as i32, self.h as i32),
            Kind::Text => {
                let lines = self.lines();
                let w = lines
                    .iter()
                    .map(|l| l.chars().map(|c| c.width().unwrap_or(0)).sum::<usize>())
                    .max()
                    .unwrap_or(0)
                    .max(1);
                (w as i32, lines.len() as i32)
            }
        }
    }

    pub fn contains(&self, x: i32, y: i32) -> bool {
        let (w, h) = self.size();
        x >= self.x && x < self.x + w && y >= self.y && y < self.y + h
    }

    pub fn is_resize_handle(&self, x: i32, y: i32) -> bool {
        self.kind == Kind::Note && x == self.x + self.w as i32 - 1 && y == self.y + self.h as i32 - 1
    }

    pub fn is_border(&self, x: i32, y: i32) -> bool {
        self.kind == Kind::Note
            && self.contains(x, y)
            && (x == self.x || y == self.y || x == self.x + self.w as i32 - 1 || y == self.y + self.h as i32 - 1)
    }

    pub fn rect(&self) -> (i32, i32, i32, i32) {
        let (w, h) = self.size();
        (self.x, self.y, self.x.saturating_add(w), self.y.saturating_add(h))
    }

    pub fn outer_box(&self) -> (i32, i32, i32, i32) {
        let (l, t, r, b) = self.rect();
        let shadow = i32::from(self.kind == Kind::Note);
        (l, t, r.saturating_add(shadow), b.saturating_add(shadow))
    }

    /// Resizes a note, never below the minimum size; text items ignore it.
    pub fn resize(&mut self, w: i32, h: i32) {
        if self.kind == Kind::Note {
            self.w = w.clamp(MIN_NOTE_W as i32, u16::MAX as i32) as u16;
            self.h = h.clamp(MIN_NOTE_H as i32, u16::MAX as i32) as u16;
        }
    }

    /// Byte ranges retain the spaces omitted at a wrap, without changing drawn text.
    pub fn line_ranges(&self) -> Vec<Range<usize>> {
        match self.kind {
            Kind::Note => wrap_ranges(&self.text, self.w.saturating_sub(2).max(1) as usize),
            Kind::Text => {
                let mut start = 0;
                self.text
                    .split('\n')
                    .map(|line| {
                        let range = start..start + line.len();
                        start = range.end + 1;
                        range
                    })
                    .collect()
            }
        }
    }

    pub fn lines(&self) -> Vec<String> {
        self.line_ranges().into_iter().map(|r| self.text[r].to_string()).collect()
    }

    /// Drawn row and column for a byte boundary; shared by cursor drawing and vertical motion.
    pub fn cursor_cell(&self, cursor: usize) -> (usize, usize) {
        let ranges = self.line_ranges();
        let row = ranges.iter().rposition(|r| r.start <= cursor).unwrap_or(0);
        let range = &ranges[row];
        let col = self.text[range.start..cursor.min(range.end)].chars().map(|c| c.width().unwrap_or(0)).sum::<usize>();
        if self.kind == Kind::Note && col >= self.w.saturating_sub(2).max(1) as usize {
            (0, row + 1)
        } else {
            (col, row)
        }
    }

    pub fn cursor_offset(&self, cursor: usize) -> (i32, i32) {
        let (col, row) = self.cursor_cell(cursor);
        let inset = i32::from(self.kind == Kind::Note);
        (col as i32 + inset, row as i32 + inset)
    }

    pub fn vertical_cursor(&self, cursor: usize, direction: i32, col: usize) -> usize {
        let (_, row) = self.cursor_cell(cursor);
        let ranges = self.line_ranges();
        let target = row as i32 + direction;
        // A full final row has a virtual empty row for the insertion cursor.
        let last = self.cursor_cell(self.text.len()).1;
        if target < 0 || target as usize > last {
            return cursor;
        }
        let Some(range) = ranges.get(target as usize) else {
            return self.text.len();
        };
        let mut width = 0;
        for (offset, ch) in self.text[range.clone()].char_indices() {
            let next = width + ch.width().unwrap_or(0);
            if next > col {
                return range.start + offset;
            }
            width = next;
        }
        // At a hard wrap the end boundary belongs to the next row.
        let end = range.end;
        if self.cursor_cell(end).1 > target as usize {
            self.text[..end].char_indices().next_back().map_or(range.start, |(i, _)| i)
        } else {
            end
        }
    }

    /// Grows a note to fit the text and the insertion row after a full final line.
    pub fn fit_height(&mut self) {
        if self.kind == Kind::Note {
            self.h = self.h.max((self.cursor_cell(self.text.len()).1 + 3).min(u16::MAX as usize) as u16);
        }
    }
}

fn wrap_ranges(text: &str, width: usize) -> Vec<Range<usize>> {
    let mut out = Vec::new();
    let mut base = 0;
    for para in text.split('\n') {
        let mut start = base;
        let mut line_width = 0;
        let mut last_space = None;
        for (offset, ch) in para.char_indices() {
            let end = base + offset;
            let ch_width = ch.width().unwrap_or(0);
            if line_width + ch_width > width && start < end {
                if ch == ' ' {
                    out.push(start..end);
                    start = end + 1;
                    line_width = 0;
                    last_space = None;
                    continue;
                }
                let (split, prefix_width) = last_space.take().unwrap_or((end, line_width));
                out.push(start..split);
                start = split;
                line_width -= prefix_width;
            }
            line_width += ch_width;
            if ch == ' ' {
                last_space = Some((end + 1, line_width));
            }
        }
        out.push(start..base + para.len());
        base += para.len() + 1;
    }
    out
}

#[cfg(test)]
pub fn wrap(text: &str, width: usize) -> Vec<String> {
    wrap_ranges(text, width).into_iter().map(|r| text[r].to_string()).collect()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Arrow {
    pub from: u64,
    pub to: u64,
}

pub type ArrowCell = (i32, i32, char);

/// Unions light line directions; arrowheads take precedence over lines.
pub fn merge_arrow_glyph(existing: char, incoming: char) -> char {
    // Bits are north, east, south, west.
    const LINES: [(char, u8); 11] = [
        ('─', 10),
        ('│', 5),
        ('╭', 6),
        ('╮', 12),
        ('╰', 3),
        ('╯', 9),
        ('├', 7),
        ('┤', 13),
        ('┬', 14),
        ('┴', 11),
        ('┼', 15),
    ];
    if matches!(incoming, '▶' | '◀' | '▲' | '▼') {
        return incoming;
    }
    if matches!(existing, '▶' | '◀' | '▲' | '▼') {
        return existing;
    }
    let directions = |glyph| LINES.iter().find(|&&(c, _)| c == glyph).map_or(0, |&(_, bits)| bits);
    let union = directions(existing) | directions(incoming);
    LINES.iter().find(|&&(_, bits)| bits == union).map_or(incoming, |&(glyph, _)| glyph)
}

/// Classifies and centres on real rects; outer boxes place the shadow-clearing endpoints.
pub fn route(
    from: (i32, i32, i32, i32),
    to: (i32, i32, i32, i32),
    from_outer: (i32, i32, i32, i32),
    to_outer: (i32, i32, i32, i32),
    heavy: bool,
    clip: (i32, i32, i32, i32),
) -> Vec<ArrowCell> {
    let widen = |(l, t, r, b): (i32, i32, i32, i32)| (i64::from(l), i64::from(t), i64::from(r), i64::from(b));
    let (l, t, r, b) = widen(from);
    let (ll, tt, rr, bb) = widen(to);
    let (ol, ot, or, ob) = widen(from_outer);
    let (oll, ott, orr, obb) = widen(to_outer);
    let (cl, ct, cr, cb) = widen(clip);
    if cl >= cr || ct >= cb {
        return Vec::new();
    }
    let xgap = r <= ll || rr <= l;
    let ygap = b <= tt || bb <= t;
    let (start, bend, end, head) = if xgap && !ygap {
        let y = (t.max(tt) + b.min(bb) - 1).div_euclid(2);
        let (x, xx, head) = if r <= ll { (or, oll - 1, '▶') } else { (ol - 1, orr, '◀') };
        ((x, y), (xx, y), (xx, y), head)
    } else if ygap && !xgap {
        let x = (l.max(ll) + r.min(rr) - 1).div_euclid(2);
        let (y, yy, head) = if b <= tt { (ob, ott - 1, '▼') } else { (ot - 1, obb, '▲') };
        ((x, y), (x, yy), (x, yy), head)
    } else if xgap && ygap {
        let y = (t + b - 1).div_euclid(2);
        let x = if r <= ll { or } else { ol - 1 };
        let xx = (ll + rr - 1).div_euclid(2);
        let (yy, head) = if b <= tt { (ott - 1, '▼') } else { (obb, '▲') };
        ((x, y), (xx, y), (xx, yy), head)
    } else {
        return Vec::new();
    };
    // If shadows leave no clear route, hide the whole arrow rather than a broken fragment.
    for (a, z) in [(start, bend), (bend, end)] {
        if [(ol, ot, or, ob), (oll, ott, orr, obb)]
            .iter()
            .any(|&(l, t, r, b)| a.0.min(z.0) < r && a.0.max(z.0) >= l && a.1.min(z.1) < b && a.1.max(z.1) >= t)
        {
            return Vec::new();
        }
    }
    let mut cells = Vec::new();
    // Clip the two segments before visiting cells, so distant endpoints cost no extra work.
    for (segment, (a, z)) in [(start, bend), (bend, end)].into_iter().enumerate() {
        let horizontal = a.1 == z.1;
        let (first, last, low, high, fixed) =
            if horizontal { (a.0, z.0, cl, cr - 1, a.1) } else { (a.1, z.1, ct, cb - 1, a.0) };
        if (horizontal && (fixed < ct || fixed >= cb)) || (!horizontal && (fixed < cl || fixed >= cr)) {
            continue;
        }
        let lo = first.min(last).max(low);
        let hi = first.max(last).min(high);
        if lo > hi {
            continue;
        }
        let forward = first <= last;
        let mut at = if forward { lo } else { hi };
        loop {
            let (x, y) = if horizontal { (at, fixed) } else { (fixed, at) };
            if !(segment == 1 && (x, y) == bend) {
                let glyph = if (x, y) == end {
                    head
                } else if (x, y) == bend && start.0 != bend.0 && end.1 != bend.1 {
                    match (start.0 < x, end.1 > y) {
                        (true, true) => '╮',
                        (true, false) => '╯',
                        (false, true) => '╭',
                        (false, false) => '╰',
                    }
                } else if horizontal {
                    '─'
                } else {
                    '│'
                };
                let glyph = if heavy {
                    match glyph {
                        '─' => '━',
                        '│' => '┃',
                        '╭' => '┏',
                        '╮' => '┓',
                        '╰' => '┗',
                        '╯' => '┛',
                        c => c,
                    }
                } else {
                    glyph
                };
                cells.push((x as i32, y as i32, glyph));
            }
            if at == if forward { hi } else { lo } {
                break;
            }
            at += if forward { 1 } else { -1 };
        }
    }
    cells
}

/// Items in back-to-front order; the last item is drawn on top.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Board {
    pub items: Vec<Item>,
    #[serde(default)]
    pub arrows: Vec<Arrow>,
}

impl Board {
    /// Loads a board, or starts an empty one when the file does not exist yet.
    pub fn load(path: &Path) -> io::Result<Self> {
        match fs::read_to_string(path) {
            Ok(json) => {
                let mut board: Self = serde_json::from_str(&json)?;
                board.normalize()?;
                Ok(board)
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e),
        }
    }

    pub fn next_id(&self) -> io::Result<u64> {
        self.items
            .iter()
            .map(|i| i.id)
            .max()
            .unwrap_or(0)
            .checked_add(1)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "item ids exhausted"))
    }

    pub fn normalize(&mut self) -> io::Result<()> {
        let mut seen = HashSet::new();
        for i in 0..self.items.len() {
            if self.items[i].id == 0 || !seen.insert(self.items[i].id) {
                self.items[i].id = self.next_id()?;
                seen.insert(self.items[i].id);
            }
        }
        let mut pairs = HashSet::new();
        self.arrows.retain(|a| a.from != a.to && seen.contains(&a.from) && seen.contains(&a.to) && pairs.insert(*a));
        Ok(())
    }

    pub fn remove(&mut self, i: usize) {
        let id = self.items.remove(i).id;
        self.arrows.retain(|a| a.from != id && a.to != id);
    }

    pub fn arrow_cells(&self, arrow: Arrow, heavy: bool, clip: (i32, i32, i32, i32)) -> Vec<ArrowCell> {
        let from = self.items.iter().find(|i| i.id == arrow.from);
        let to = self.items.iter().find(|i| i.id == arrow.to);
        match (from, to) {
            (Some(from), Some(to)) => route(from.rect(), to.rect(), from.outer_box(), to.outer_box(), heavy, clip),
            _ => Vec::new(),
        }
    }

    pub fn hit_arrow(&self, x: i32, y: i32) -> Option<usize> {
        if self.items.iter().any(|i| {
            let (l, t, r, b) = i.outer_box();
            x >= l && x < r && y >= t && y < b
        }) {
            return None;
        }
        let clip = (x, y, x.saturating_add(1), y.saturating_add(1));
        self.arrows.iter().rposition(|a| !self.arrow_cells(*a, false, clip).is_empty())
    }

    /// Writes through a temporary file so a failed save never truncates the board.
    pub fn save(&self, path: &Path) -> io::Result<()> {
        if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
            fs::create_dir_all(dir)?;
        }
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(self)?)?;
        fs::rename(tmp, path)
    }

    pub fn hit(&self, x: i32, y: i32) -> Option<usize> {
        self.items.iter().rposition(|i| i.contains(x, y))
    }

    /// Moves an item to the top and returns its new index.
    pub fn raise(&mut self, i: usize) -> usize {
        let item = self.items.remove(i);
        self.items.push(item);
        self.items.len() - 1
    }
}

/// The board file's modification time, or `None` when it does not exist.
pub fn modified(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).and_then(|m| m.modified()).ok()
}

/// Where the board lives: an explicit path argument; inside Herdr, one file per workspace in the
/// plugin's state directory, partitioned by socket because that directory is shared by every
/// Herdr session; otherwise `whiteboard.json` in the current directory.
pub fn board_path(arg: Option<OsString>, env: impl Fn(&str) -> Option<String>) -> PathBuf {
    if let Some(arg) = arg {
        return arg.into();
    }
    let Some(state) = env("HERDR_PLUGIN_STATE_DIR").filter(|s| !s.is_empty()) else {
        return PathBuf::from("whiteboard.json");
    };
    let session = env("HERDR_SOCKET_PATH").map_or_else(|| "default".into(), |s| format!("{:016x}", fnv1a(&s)));
    let workspace = env("HERDR_WORKSPACE_ID").filter(|w| !w.is_empty()).unwrap_or_else(|| "default".into());
    let file: String =
        workspace.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    Path::new(&state).join("boards").join(session).join(format!("{file}.json"))
}

/// A stable 64-bit FNV-1a hash, so a session's directory name survives restarts.
fn fnv1a(s: &str) -> u64 {
    s.bytes().fold(0xcbf29ce484222325, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CLIP: (i32, i32, i32, i32) = (-100, -100, 100, 100);
    fn route(from: (i32, i32, i32, i32), to: (i32, i32, i32, i32), heavy: bool) -> Vec<ArrowCell> {
        super::route(from, to, from, to, heavy, CLIP)
    }

    #[test]
    fn wraps_on_words_and_hard_breaks_long_words() {
        assert_eq!(wrap("hello big world", 9), ["hello big", "world"]);
        assert_eq!(wrap("hello big world", 8), ["hello ", "big ", "world"]);
        assert_eq!(wrap("abcdefghij", 4), ["abcd", "efgh", "ij"]);
        assert_eq!(wrap("a\n\nb", 4), ["a", "", "b"]);
        assert_eq!(wrap("", 4), [""]);
        assert_eq!(wrap("abcd ", 4), ["abcd", ""]);
    }

    #[test]
    fn wide_characters_wrap_by_cell_width() {
        assert_eq!(wrap("日本語です", 4), ["日本", "語で", "す"]);
        let mut t = Item::text(0, 0, 0);
        t.text = "日本".into();
        assert_eq!(t.size(), (4, 1));
    }

    #[test]
    fn text_items_size_to_content() {
        let mut t = Item::text(0, 0, 0);
        assert_eq!(t.size(), (1, 1));
        t.text = "hi\nthere".into();
        assert_eq!(t.size(), (5, 2));
        assert_eq!(t.cursor_offset(t.text.len()), (5, 1));
        t.text = "日\n\ne\u{301}\n".into();
        assert_eq!(t.line_ranges(), [0..3, 4..4, 5..8, 9..9]);
        assert_eq!(t.lines(), ["日", "", "e\u{301}", ""]);
        assert_eq!(t.cursor_offset(t.text.len()), (0, 3));
    }

    #[test]
    fn note_grows_and_cursor_follows_wrap() {
        let mut n = Item::note(0, 0, 0);
        n.w = 8;
        n.h = 3;
        n.text = "one two three".into();
        n.fit_height();
        assert_eq!(n.lines(), ["one ", "two ", "three"]);
        assert_eq!(n.h, 5);
        assert_eq!(n.cursor_offset(n.text.len()), (6, 3));
    }

    #[test]
    fn resize_clamps_notes_and_ignores_text() {
        let mut n = Item::note(0, 0, 0);
        n.resize(2, -5);
        assert_eq!((n.w, n.h), (MIN_NOTE_W, MIN_NOTE_H));
        let mut t = Item::text(0, 0, 0);
        t.resize(30, 30);
        assert_eq!((t.w, t.h), (0, 0));
    }

    #[test]
    fn hit_prefers_topmost_and_raise_reorders() {
        let mut b = Board { items: vec![Item::note(0, 0, 0), Item::note(5, 2, 1)], ..Board::default() };
        assert_eq!(b.hit(6, 3), Some(1));
        assert_eq!(b.hit(1, 1), Some(0));
        assert_eq!(b.hit(100, 100), None);
        assert_eq!(b.raise(0), 1);
        assert_eq!(b.items[1].color, 0);
    }

    #[test]
    fn save_creates_directories_and_round_trips() {
        let dir = std::env::temp_dir().join(format!("wb-test-{}", std::process::id()));
        let path = dir.join("boards/x/ws.json");
        let mut note = Item::note(-3, 4, 2);
        note.text = "ünïcode ✓".into();
        let mut b = Board { items: vec![note, Item::text(1, 1, 0)], ..Board::default() };
        b.normalize().unwrap();
        assert_eq!(modified(&path), None);
        b.save(&path).unwrap();
        assert!(modified(&path).is_some());
        let loaded = Board::load(&path).unwrap();
        assert_eq!(loaded.items, b.items);
        fs::remove_dir_all(&dir).unwrap();
        assert!(Board::load(&path).unwrap().items.is_empty());
    }

    #[test]
    fn corrupt_board_is_an_error_not_an_empty_board() {
        let path = std::env::temp_dir().join(format!("wb-corrupt-{}.json", std::process::id()));
        fs::write(&path, "{not json").unwrap();
        let result = Board::load(&path);
        fs::remove_file(&path).unwrap();
        assert!(result.is_err());
    }

    #[test]
    fn board_path_prefers_argument_then_herdr_state_then_cwd() {
        let none = |_: &str| None;
        assert_eq!(board_path(Some("a.json".into()), none), PathBuf::from("a.json"));
        assert_eq!(board_path(None, none), PathBuf::from("whiteboard.json"));

        let herdr = |k: &str| match k {
            "HERDR_PLUGIN_STATE_DIR" => Some("/state".to_string()),
            "HERDR_SOCKET_PATH" => Some("/run/herdr.sock".to_string()),
            "HERDR_WORKSPACE_ID" => Some("w:1/../x".to_string()),
            _ => None,
        };
        let path = board_path(None, herdr);
        let session = format!("{:016x}", fnv1a("/run/herdr.sock"));
        assert_eq!(path, Path::new("/state/boards").join(session).join("w_1____x.json"));

        let bare = |k: &str| (k == "HERDR_PLUGIN_STATE_DIR").then(|| "/state".to_string());
        assert_eq!(board_path(None, bare), PathBuf::from("/state/boards/default/default.json"));
    }

    #[test]
    fn legacy_load_normalizes_ids_and_drops_invalid_arrows() {
        let path = std::env::temp_dir().join(format!("wb-legacy-{}.json", std::process::id()));
        fs::write(&path, r#"{"items":[{"kind":"note","x":0,"y":0},{"kind":"text","x":30,"y":0}]}"#).unwrap();
        let legacy = Board::load(&path).unwrap();
        assert_eq!(legacy.items.iter().map(|i| i.id).collect::<Vec<_>>(), [1, 2]);
        assert!(legacy.arrows.is_empty());
        fs::write(&path, r#"{"items":[{"id":4,"kind":"note","x":0,"y":0},{"id":4,"kind":"text","x":30,"y":0},{"kind":"note","x":50,"y":0}],"arrows":[{"from":4,"to":5},{"from":4,"to":5},{"from":4,"to":4},{"from":4,"to":99},{"from":0,"to":4}]}"#).unwrap();
        let board = Board::load(&path).unwrap();
        fs::remove_file(path).unwrap();
        assert_eq!(board.items.iter().map(|i| i.id).collect::<Vec<_>>(), [4, 5, 6]);
        assert_eq!(board.arrows, [Arrow { from: 4, to: 5 }]);
        assert_eq!(board.next_id().unwrap(), 7);
    }

    #[test]
    fn route_horizontal_vertical_elbows_and_overlap_exact_cells() {
        let source = (0, 0, 3, 3);
        assert_eq!(route(source, (6, 0, 9, 3), false), [(3, 1, '─'), (4, 1, '─'), (5, 1, '▶')]);
        assert_eq!(route((6, 0, 9, 3), source, false), [(5, 1, '─'), (4, 1, '─'), (3, 1, '◀')]);
        assert_eq!(route(source, (0, 6, 3, 9), false), [(1, 3, '│'), (1, 4, '│'), (1, 5, '▼')]);
        assert_eq!(route((0, 6, 3, 9), source, false), [(1, 5, '│'), (1, 4, '│'), (1, 3, '▲')]);
        assert_eq!(
            route(source, (6, 6, 9, 9), false),
            [
                (3, 1, '─'),
                (4, 1, '─'),
                (5, 1, '─'),
                (6, 1, '─'),
                (7, 1, '╮'),
                (7, 2, '│'),
                (7, 3, '│'),
                (7, 4, '│'),
                (7, 5, '▼')
            ]
        );
        for (target, corner) in [((6, -6, 9, -3), '┛'), ((-6, 6, -3, 9), '┏'), ((-6, -6, -3, -3), '┗')] {
            assert!(route(source, target, true).iter().any(|c| c.2 == corner));
        }
        assert!(route(source, (2, 2, 5, 5), false).is_empty());
        assert!(route(source, (3, 0, 6, 3), false).is_empty());
    }

    #[test]
    fn arrow_routes_follow_note_shadows_moves_and_resizes() {
        let mut board = Board { items: vec![Item::note(0, 0, 0), Item::note(35, 0, 0)], ..Board::default() };
        board.normalize().unwrap();
        let arrow = Arrow { from: 1, to: 2 };
        let cells = board.arrow_cells(arrow, false, CLIP);
        assert_eq!(cells.first(), Some(&(25, 3, '─')));
        assert_eq!(cells.last(), Some(&(34, 3, '▶')));
        board.items[0].resize(26, 9);
        board.items[1].x = 40;
        let cells = board.arrow_cells(arrow, false, CLIP);
        assert_eq!(cells.first(), Some(&(27, 3, '─')));
        assert_eq!(cells.last(), Some(&(39, 3, '▶')));
        board.items[1].x = 3;
        assert!(board.arrow_cells(arrow, false, CLIP).is_empty());
    }

    #[test]
    fn cursor_mapping_keeps_wrap_output_and_utf8_boundaries() {
        let mut note = Item::note(0, 0, 0);
        note.w = 8;
        note.text = "abcdef gh日本".into();
        assert_eq!(note.lines(), ["abcdef", "gh日本"]);
        assert_eq!(note.line_ranges(), [0..6, 7..15]);
        for (byte, cell) in
            [(0, (0, 0)), (5, (5, 0)), (6, (0, 1)), (7, (0, 1)), (9, (2, 1)), (12, (4, 1)), (15, (0, 2))]
        {
            assert_eq!(note.cursor_cell(byte), cell, "byte {byte}");
        }
        note.text = "hello big world".into();
        note.w = 10;
        assert_eq!(note.lines(), ["hello ", "big ", "world"]);
        assert_eq!(note.cursor_cell(6), (0, 1));
        assert_eq!(note.cursor_cell(10), (0, 2));
        note.text = "日本語です".into();
        note.w = 6;
        assert_eq!(note.cursor_cell(6), (0, 1));
        assert_eq!(note.vertical_cursor(3, 1, 2), 9);
    }

    #[test]
    fn route_clips_far_coordinates_without_walking_the_gap() {
        assert_eq!(
            super::route(
                (-2_000_000_000, 0, -1_999_999_997, 3),
                (2_000_000_000, 0, 2_000_000_003, 3),
                (-2_000_000_000, 0, -1_999_999_997, 3),
                (2_000_000_000, 0, 2_000_000_003, 3),
                false,
                (-2, 0, 3, 3)
            ),
            [(-2, 1, '─'), (-1, 1, '─'), (0, 1, '─'), (1, 1, '─'), (2, 1, '─')]
        );
        assert_eq!(route((-9, -9, -6, -6), (-3, -9, 0, -6), false), [(-6, -8, '─'), (-5, -8, '─'), (-4, -8, '▶')]);
    }

    #[test]
    fn route_uses_real_rects_for_middles_and_shadow_only_for_clearance() {
        let mut board = Board {
            items: vec![
                Item { id: 1, w: 16, h: 4, ..Item::note(30, 8, 0) },
                Item { id: 2, text: "free text".into(), ..Item::text(4, 12, 0) },
            ],
            ..Board::default()
        };
        let arrow = Arrow { from: 1, to: 2 };
        let expected: Vec<_> =
            (9..=29).rev().map(|x| (x, 9, '─')).chain([(8, 9, '╭'), (8, 10, '│'), (8, 11, '▼')]).collect();
        assert_eq!(board.arrow_cells(arrow, false, CLIP), expected);
        board.arrows.push(arrow);
        assert_eq!(board.hit_arrow(8, 10), Some(0));
        assert_eq!(board.hit_arrow(29, 12), None);

        board.items[0] = Item { id: 1, w: 8, h: 4, ..Item::note(0, 0, 0) };
        board.items[1] = Item { id: 2, ..Item::text(9, 1, 0) };
        assert!(board.arrow_cells(arrow, false, CLIP).is_empty(), "horizontal gap consumed by shadow");
        board.items[1] = Item { id: 2, ..Item::text(1, 5, 0) };
        assert!(board.arrow_cells(arrow, false, CLIP).is_empty(), "vertical gap consumed by shadow");
        board.items[1] = Item { id: 2, w: 8, h: 4, ..Item::note(20, 0, 0) };
        let cells = board.arrow_cells(arrow, false, CLIP);
        assert_eq!(cells.first(), Some(&(9, 1, '─')));
        assert_eq!(cells.last(), Some(&(19, 1, '▶')));
    }

    #[test]
    fn merge_arrow_glyph_unions_directions_and_keeps_heads() {
        for (a, b, expected) in [
            ('─', '╮', '┬'),
            ('─', '│', '┼'),
            ('│', '╭', '├'),
            ('│', '╯', '┤'),
            ('─', '╰', '┴'),
            ('├', '┤', '┼'),
            ('┬', '┴', '┼'),
            ('┼', '─', '┼'),
        ] {
            assert_eq!(merge_arrow_glyph(a, b), expected);
            assert_eq!(merge_arrow_glyph(b, a), expected);
        }
        for glyph in ['─', '│', '╭', '╮', '╰', '╯', '├', '┤', '┬', '┴', '┼'] {
            assert_eq!(merge_arrow_glyph(glyph, glyph), glyph);
            assert_eq!(merge_arrow_glyph('·', glyph), glyph);
            for head in ['▶', '◀', '▲', '▼'] {
                assert_eq!(merge_arrow_glyph(head, glyph), head);
                assert_eq!(merge_arrow_glyph(glyph, head), head);
            }
        }
    }

    #[test]
    fn long_text_and_note_lines_and_cursors_stay_linear() {
        for (kind, text) in
            [(Kind::Text, "x".repeat(100_000)), (Kind::Note, "x".repeat(100_000)), (Kind::Note, "word ".repeat(20_000))]
        {
            let mut item = Item::note(0, 0, 0);
            item.kind = kind;
            item.w = u16::MAX;
            item.text = text.clone();
            let started = std::time::Instant::now();
            let lines = item.lines();
            let cursor = item.cursor_offset(item.text.len());
            let elapsed = started.elapsed();
            assert!(elapsed < std::time::Duration::from_millis(200), "{kind:?}: {elapsed:?}");
            assert_eq!(item.text, text);
            assert_eq!(lines.concat(), text);
            match kind {
                Kind::Text => {
                    assert_eq!(lines.len(), 1);
                    assert_eq!(cursor, (100_000, 0));
                }
                Kind::Note => {
                    assert_eq!(lines.len(), 2);
                    assert_eq!(cursor, (lines[1].len() as i32 + 1, 2));
                }
            }
        }
    }

    #[test]
    fn wrapping_and_cursor_width_match_per_character_drawing() {
        let mut note = Item::note(0, 0, 0);
        note.w = 6;
        note.text = "👩\u{200d}💻x".into();
        assert_eq!(note.lines(), ["👩\u{200d}💻", "x"]);
        assert_eq!(note.cursor_offset(note.text.len()), (2, 2));
        let text = Item { kind: Kind::Text, ..note };
        assert_eq!(text.size(), (5, 1));
        assert_eq!(text.cursor_offset(text.text.len()), (5, 0));
        assert_eq!(wrap("e\u{301}日 e\u{301}日", 4), ["e\u{301}日 ", "e\u{301}日"]);
    }
}
