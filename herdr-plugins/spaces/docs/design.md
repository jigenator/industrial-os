# Design

The [shared visual language](../../../docs/design.md) applied to Herdr Spaces.
Values/geometry are canonical in the [token contract](token-contract.md);
styles belong to [herdr/spaces.toml](../../../herdr/spaces.toml).

```text
 ◐ 05PN · industrial-os
   03AG · 07AU ↓7
 × 01PN · tooling
   01AG · 02AU ↑2
 ○ 01PN · harness-engine… ·     2d
 ○ 02PN · general-purpose ·     3d
```

Acid / Black, 36 columns, 34-cell scrollbar geometry. Focused name is bold
primary white; other current names bold secondary; quiet names/ages decorative
grey. Zero counts use decorative grey, nonzero AU uses bold accent, `??AU`
remains explicitly unknown, not disguised as zero. State icons come from
Herdr and its theme keys, not a guessed plugin activity state. No branch name.

A quiet space sends only panes, stale name and age, collapsing to one row
**unless it is ahead or behind**: Herdr's built-in git_status retains a second
git-only row. Indented worktree children do not display git details. Quiet is
not a new Herdr status and does not fabricate a state icon.

Sorting preserves current units' relative order and moves quiet units below
them, oldest last, never the focused unit. Worktree families stay together;
manual drags are not continually fought. Number keys follow position. Disable
sort in plugin config if stable number targets matter more than quiet grouping.
Keyboard and mouse navigation remain Herdr's; no new keys/focus capture,
animation, notifications or attention writes.

Names freeze without TTL if the daemon stops; counts/age disappear after TTL.
Users must not read a frozen name as a fresh count. First-seen spaces start
with current activity rather than guessed historical ages. Terminal font,
Unicode widths, truecolor and live scrollbar alignment remain unverified.
