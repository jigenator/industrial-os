# Design

A minimal static shell prompt in the shared [Acid / Black language](../../docs/design.md#acid--black):

```text
~/projects/demo  ⑂ main clean  ›
```

The full path is bold primary white; branch text is secondary grey. Double spaces separate path, Git segment and input mark. Every input mark has a trailing space; successful commands use an acid `›`.

## States

- **Clean:** bold acid `clean` only after successful status with no records.
- **Modified:** bold warning `modified` for any porcelain v1 record: staged or unstaged tracked changes, untracked files (`--untracked-files=normal`), and submodule changes (`--ignore-submodules=none`). This is the same dirty definition and status flags as `pi/signals-collector/src/workspace.ts`; fsmonitor is disabled there and here. Ignored files do not count.
- **Detached:** replace the branch name with `detached @<short sha>`; still show clean/modified from status.
- **Unavailable:** status failure shows regular primary-white `status unavailable`, retaining the branch when known. Branch/revision lookup failure also shows unavailable, without inventing a name or clean state.
- **Non-Git:** omit the entire Git segment. Home-prefixed paths use `~`; nested directories keep the full path, not the Git root.
- **Command failure:** preserve the repository state independently. Insert bold critical `✕ <code>` before a critical `›` (the mark remains bold). Successful commands add no exit segment.

## Narrow terminals and limits

Paths and long refs wrap naturally with input; no truncation or width parser. No animation, extra environment/host/version segments, ASCII fallback or 256-color adaptation.

Require a black background, truecolor and a font with `⑂`, `›`, `✕`. The state words/codes remain meaningful without color. Controls/bidi overrides become `?`, and prompt syntax in names is literal. Herdr glyph alignment, narrow resizing and color contrast have not been interactively verified; no accessibility certification is claimed.
