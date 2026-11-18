# Design

A static shell prompt in the shared [Acid / Black language](../../docs/design.md#acid--black):

```text
~/projects/demo  ⑂ main ↑1 modified ~1 ?1 staged +1  ›                 12:04:31
```

The full path is bold primary white; Git text is secondary grey. Double spaces separate segments and the input mark. Every input mark has a trailing space; successful commands use an acid `›`.

## Left prompt

- **Remote:** in an SSH session only, a Nerd Font SSH icon and grey `user@host` lead the line.
- **Root:** bold critical `⚡ root` when the shell runs as root.
- **Path:** full path, home-prefixed with `~`; nested directories keep the full path, not the Git root.
- **Git:** omitted outside a repository. In order: the upstream host's Nerd Font icon (linked to the remote), `⑂`, the branch, then ahead/behind (`↑n ↓n`) when an upstream differs. Detached HEAD reads `detached at <short sha>`.
- **Clean:** bold acid `clean` when status has no records.
- **Modified:** bold warning `modified` for any record, followed by working-tree counts (`~` modified, `?` untracked, `-` deleted, `+` added, `x` unmerged) and `staged` with staged counts. Untracked files use `--untracked-files=normal`, submodules `--ignore-submodules=none`; ignored files do not count.
- **Unavailable:** when `git status` fails, regular primary-white `status unavailable` replaces the whole Git segment; it never claims `clean`.
- **Command failure:** bold critical `✕ <code> ›`. Successful commands add no exit segment.

## Right prompt, past prompts and continuation

The right prompt is grey: a Node, Go or Python Nerd Font icon when the folder has their project files (Node not in the home directory), then the clock `HH:MM:SS`. After a command runs, its prompt shrinks to the bold folder name and an acid `›`. Multi-line input continues after a grey `››`.

## Narrow terminals and limits

Paths and long refs wrap naturally with input; no truncation or width parser. No animation, ASCII fallback or 256-color adaptation.

Require a black background, truecolor, a Nerd Font, and glyphs `⑂`, `›`, `✕`, `⚡`. The state words/codes remain meaningful without color. Prompt syntax in names is literal. Herdr glyph alignment, narrow resizing and color contrast have not been interactively verified; no accessibility certification is claimed.
