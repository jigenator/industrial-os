//! A line-local Markdown subset. Styles are semantic; terminal colors belong to the UI.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Style {
    pub bold: bool,
    pub italic: bool,
    pub code: bool,
    pub strike: bool,
    pub link: bool,
    pub heading: bool,
    pub quote: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Span {
    pub text: String,
    pub style: Style,
}

pub type Line = Vec<Span>;

pub fn push(line: &mut Line, text: &str, style: Style) {
    if text.is_empty() {
        return;
    }
    if let Some(last) = line.last_mut().filter(|last| last.style == style) {
        last.text.push_str(text);
    } else {
        line.push(Span { text: text.into(), style });
    }
}

pub fn parse(text: &str) -> Vec<Line> {
    text.split('\n').map(block).collect()
}

fn block(mut text: &str) -> Line {
    let mut line = Line::new();
    let mut style = Style::default();
    let hashes = text.bytes().take_while(|&c| c == b'#').count();
    if (1..=6).contains(&hashes) && text.as_bytes().get(hashes) == Some(&b' ') {
        style.heading = true;
        text = &text[hashes + 1..];
    } else if let Some(rest) = text.strip_prefix("> ") {
        push(&mut line, "│ ", Style { quote: true, ..style });
        text = rest;
    } else {
        let indent = text.len() - text.trim_start_matches([' ', '\t']).len();
        let body = &text[indent..];
        let task = ["- [ ] ", "- [x] ", "- [X] "].iter().position(|prefix| body.starts_with(prefix));
        let bullet = ["- ", "* ", "+ "].iter().any(|prefix| body.starts_with(prefix));
        let digits = body.bytes().take_while(u8::is_ascii_digit).count();
        let ordered = digits > 0 && (body[digits..].starts_with(". ") || body[digits..].starts_with(") "));
        if task.is_some() || bullet || ordered {
            push(&mut line, &text[..indent], style);
            if let Some(task) = task {
                push(&mut line, if task == 0 { "☐ " } else { "☑ " }, style);
                text = &body[6..];
            } else if bullet {
                push(&mut line, "• ", style);
                text = &body[2..];
            } else {
                push(&mut line, &body[..digits + 2], style);
                text = &body[digits + 2..];
            }
        }
    }
    inline(text, style, &mut line);
    line
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mark {
    Bold,
    Italic,
    Strike,
    Link,
    Code,
}

/// Pair markers before emitting, so unmatched markers stay literal without rescanning suffixes.
fn inline(text: &str, base: Style, line: &mut Line) {
    let chars: Vec<char> = text.chars().collect();
    let n = chars.len();
    let mut escaped = vec![false; n];
    let mut hidden = vec![false; n];
    let mut starts = vec![None; n];
    let mut ends = vec![None; n];
    let mut i = 0;
    while i + 1 < n {
        if chars[i] == '\\' && chars[i + 1].is_ascii_punctuation() {
            hidden[i] = true;
            escaped[i + 1] = true;
            i += 2;
        } else {
            i += 1;
        }
    }
    // A destination ends at the next unescaped ')'; nested destinations are outside this subset.
    let mut next_close = vec![None; n + 1];
    let mut next_space = vec![n; n + 1];
    for i in (0..n).rev() {
        next_close[i] = if chars[i] == ')' && !escaped[i] { Some(i) } else { next_close[i + 1] };
        next_space[i] = if chars[i].is_whitespace() { i } else { next_space[i + 1] };
    }
    let mut stacks: [Vec<usize>; 5] = Default::default();
    let mut brackets = Vec::new();
    i = 0;
    while i < n {
        if escaped[i] || hidden[i] {
            i += 1;
            continue;
        }
        if chars[i] == '`'
            && let Some(end) = (i + 1..n).find(|&j| chars[j] == '`').filter(|&end| end > i + 1)
        {
            hidden[i] = true;
            hidden[end] = true;
            // Backslashes and all other markers inside code are literal.
            hidden[i + 1..end].fill(false);
            starts[i] = Some(Mark::Code);
            ends[end] = Some(Mark::Code);
            i = end + 1;
            continue;
        }
        if chars[i] == '[' {
            brackets.push(i);
        } else if chars[i] == ']' {
            if let Some(start) = brackets.pop()
                && chars.get(i + 1) == Some(&'(')
                && let Some(end) = next_close[(i + 2).min(n)]
                && next_space[(i + 2).min(n)] >= end
            {
                hidden[start] = true;
                hidden[i..=end].fill(true);
                starts[start] = Some(Mark::Link);
                ends[i] = Some(Mark::Link);
                i = end + 1;
                continue;
            }
        } else if matches!(chars[i], '*' | '_' | '~') {
            let ch = chars[i];
            let double = chars.get(i + 1) == Some(&ch) && !escaped[i + 1];
            let len = if double { 2 } else { 1 };
            if ch == '~' && !double {
                i += 1;
                continue;
            }
            let prev = i.checked_sub(1).map(|j| chars[j]);
            let next = chars.get(i + len).copied();
            // An underscore run inside a word stays literal as a whole; checking only at its
            // first underscore keeps long runs linear.
            if ch == '_' && prev.is_some_and(char::is_alphanumeric) {
                let end = (i..n).find(|&j| chars[j] != '_' || escaped[j]).unwrap_or(n);
                if chars.get(end).is_some_and(|c| c.is_alphanumeric()) {
                    i = end;
                    continue;
                }
            }
            let intraword =
                ch == '_' && prev.is_some_and(char::is_alphanumeric) && next.is_some_and(char::is_alphanumeric);
            let open = !intraword && next.is_some_and(|c| !c.is_whitespace());
            let close = !intraword && prev.is_some_and(|c| !c.is_whitespace());
            let slot = match (ch, double) {
                ('*', true) => 0,
                ('*', false) => 1,
                ('_', true) => 2,
                ('_', false) => 3,
                _ => 4,
            };
            let mark = if ch == '~' {
                Mark::Strike
            } else if double {
                Mark::Bold
            } else {
                Mark::Italic
            };
            // Empty pairs such as `____` stay literal.
            if close && let Some(start) = stacks[slot].pop_if(|start| *start + len < i) {
                hidden[start..start + len].fill(true);
                hidden[i..i + len].fill(true);
                starts[start] = Some(mark);
                ends[i] = Some(mark);
            } else if open {
                stacks[slot].push(i);
            }
            i += len;
            continue;
        }
        i += 1;
    }
    let mut active = [0usize; 5];
    let slot = |mark| match mark {
        Mark::Bold => 0,
        Mark::Italic => 1,
        Mark::Strike => 2,
        Mark::Link => 3,
        Mark::Code => 4,
    };
    for i in 0..n {
        if let Some(mark) = ends[i] {
            active[slot(mark)] -= 1;
        }
        if let Some(mark) = starts[i] {
            active[slot(mark)] += 1;
        }
        if !hidden[i] {
            let code = active[4] > 0;
            let style = Style {
                bold: base.bold || (!code && active[0] > 0),
                italic: !code && active[1] > 0,
                strike: !code && active[2] > 0,
                link: !code && active[3] > 0,
                code,
                ..base
            };
            push(line, chars[i].encode_utf8(&mut [0; 4]), style);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use unicode_width::UnicodeWidthChar;

    fn plain(line: &Line) -> String {
        line.iter().map(|s| s.text.as_str()).collect()
    }

    #[test]
    fn inline_constructs_and_nested_styles() {
        for (raw, flag) in [
            ("**日**", "bold"),
            ("__日__", "bold"),
            ("*日*", "italic"),
            ("_日_", "italic"),
            ("~~日~~", "strike"),
            ("`日`", "code"),
            ("[日](url)", "link"),
        ] {
            let lines = parse(raw);
            assert_eq!(plain(&lines[0]), "日");
            let s = lines[0][0].style;
            assert!(match flag {
                "bold" => s.bold,
                "italic" => s.italic,
                "strike" => s.strike,
                "code" => s.code,
                _ => s.link,
            });
        }
        let lines = parse("[**bold**](url) **a _b_ c**");
        assert_eq!(plain(&lines[0]), "bold a b c");
        assert!(lines[0][0].style.bold && lines[0][0].style.link);
        assert!(lines[0].iter().any(|s| s.text == "b" && s.style.bold && s.style.italic));
    }

    #[test]
    fn literals_escapes_and_code() {
        for raw in [
            "snake_case",
            "snake__case",
            "foo___bar___baz",
            "a_____b",
            "____",
            "****",
            "~~~~",
            "``",
            "*unmatched",
            "**unmatched",
            "_unmatched",
            "a ~~b",
            "a `code",
            "[no](end",
            "a * b",
            "#nospace",
            "####### seven",
        ] {
            assert_eq!(plain(&parse(raw)[0]), raw);
        }
        assert_eq!(plain(&parse(r"\*literal\* \[x\]\(u\) \\ \_x\_")[0]), "*literal* [x](u) \\ _x_");
        let line = &parse(r"`**x** \* _y_ [z](u)`")[0];
        assert_eq!(plain(line), r"**x** \* _y_ [z](u)");
        assert!(line.iter().all(|s| s.style.code && !s.style.bold && !s.style.link));
    }

    #[test]
    fn block_constructs_and_width_budget() {
        for (raw, expected) in [
            ("# title", "title"),
            ("###### six", "six"),
            ("- a", "• a"),
            ("  * b", "  • b"),
            ("\t- b", "\t• b"),
            ("+ c", "• c"),
            ("12. x", "12. x"),
            ("2) y", "2) y"),
            ("  - [ ] todo", "  ☐ todo"),
            ("- [x] done", "☑ done"),
            ("- [X] done", "☑ done"),
            ("> quote", "│ quote"),
            ("**日本** [語](url)", "日本 語"),
        ] {
            let line = &parse(raw)[0];
            assert_eq!(plain(line), expected);
            let width = |s: &str| s.chars().map(|c| c.width().unwrap_or(0)).sum::<usize>();
            assert!(width(&plain(line)) <= width(raw));
        }
        assert!(parse("## heading")[0][0].style.heading);
        assert!(parse("> quote")[0][0].style.quote);
        assert_eq!(parse("\n").len(), 2);
        for level in 1..=6 {
            assert!(parse(&format!("{} title", "#".repeat(level)))[0][0].style.heading);
        }
        assert_eq!(parse("**a\nb**").iter().map(plain).collect::<Vec<_>>(), ["**a", "b**"]);
    }

    #[test]
    fn long_unmatched_input_stays_linear() {
        let raw = "[x]( *a ".repeat(15_000);
        let start = std::time::Instant::now();
        let lines = parse(&raw);
        assert!(!lines[0].is_empty());
        assert!(start.elapsed() < std::time::Duration::from_secs(1));
    }
}
