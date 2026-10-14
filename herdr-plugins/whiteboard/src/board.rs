use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use std::{fs, io};
use unicode_width::{UnicodeWidthChar, UnicodeWidthStr};

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
        Self { kind: Kind::Note, x, y, w: 24, h: 7, color, text: String::new() }
    }

    pub fn text(x: i32, y: i32, color: usize) -> Self {
        Self { kind: Kind::Text, x, y, w: 0, h: 0, color, text: String::new() }
    }

    pub fn size(&self) -> (i32, i32) {
        match self.kind {
            Kind::Note => (self.w as i32, self.h as i32),
            Kind::Text => {
                let lines = self.lines();
                let w = lines.iter().map(|l| l.width()).max().unwrap_or(0).max(1);
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

    /// Resizes a note, never below the minimum size; text items ignore it.
    pub fn resize(&mut self, w: i32, h: i32) {
        if self.kind == Kind::Note {
            self.w = w.clamp(MIN_NOTE_W as i32, u16::MAX as i32) as u16;
            self.h = h.clamp(MIN_NOTE_H as i32, u16::MAX as i32) as u16;
        }
    }

    /// Lines as drawn: notes wrap inside their border, text keeps its own line breaks.
    pub fn lines(&self) -> Vec<String> {
        match self.kind {
            Kind::Note => wrap(&self.text, self.w.saturating_sub(2).max(1) as usize),
            Kind::Text => self.text.split('\n').map(String::from).collect(),
        }
    }

    /// Grows a note so its wrapped text fits.
    pub fn fit_height(&mut self) {
        if self.kind == Kind::Note {
            self.h = self.h.max(self.lines().len() as u16 + 2);
        }
    }

    /// Where the end of the text sits, relative to the item's top-left corner.
    pub fn end_offset(&self) -> (i32, i32) {
        let lines = self.lines();
        let last = lines.last().map_or(0, |l| l.width()) as i32;
        let row = lines.len() as i32 - 1;
        match self.kind {
            Kind::Note if last >= self.w as i32 - 2 => (1, row + 2),
            Kind::Note => (1 + last, 1 + row),
            Kind::Text => (last, row),
        }
    }
}

/// Word-wraps `text` to `width` cells. Spaces are kept so text can be edited at its end.
pub fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    for para in text.split('\n') {
        let mut line = String::new();
        for ch in para.chars() {
            if line.width() + ch.width().unwrap_or(0) > width && !line.is_empty() {
                if ch == ' ' {
                    out.push(std::mem::take(&mut line));
                    continue;
                }
                // Break after the last space so the word moves down whole.
                match line.rfind(' ') {
                    Some(i) => {
                        let tail = line.split_off(i + 1);
                        out.push(std::mem::replace(&mut line, tail));
                    }
                    None => out.push(std::mem::take(&mut line)),
                }
            }
            line.push(ch);
        }
        out.push(line);
    }
    out
}

/// Items in back-to-front order; the last item is drawn on top.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Board {
    pub items: Vec<Item>,
}

impl Board {
    /// Loads a board, or starts an empty one when the file does not exist yet.
    pub fn load(path: &Path) -> io::Result<Self> {
        match fs::read_to_string(path) {
            Ok(json) => Ok(serde_json::from_str(&json)?),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e),
        }
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
        assert_eq!(t.end_offset(), (5, 1));
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
        assert_eq!(n.end_offset(), (6, 3));
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
        let mut b = Board { items: vec![Item::note(0, 0, 0), Item::note(5, 2, 1)] };
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
        let b = Board { items: vec![note, Item::text(1, 1, 0)] };
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
}
