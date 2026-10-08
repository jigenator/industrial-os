# Mission

Give operators of many Herdr spaces a compact, truthful inventory: pane and
agent counts, Pi agent units, readable names and ages for spaces that have gone
quiet. Reduce navigation noise by moving quiet units below the user's current
work while preserving current order and worktree families.

## Non-goals

No agent control, transcript collection, signal collection, quota lookup,
branch reporting, live config editing, native UI implementation or attention
policy. Existing Pi reporters own their pane values; this plugin consumes AU
tokens through Herdr's API. It never imports or changes those extensions.

One plugin daemon per socket is the minimum owner for cross-pane reporting,
activity history and quiet ordering; the rationale is in the
[daemon decision](../../../docs/decisions/spaces-plugin-daemon.md).
