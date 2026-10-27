# Architecture

## Modules and direction

`bin/dispatch-feed.ts` → `terminal.ts` → `app.ts`, `render.ts`, `input.ts`.
App → `transport.ts`, `snapshot.ts`; renderer → App's supplied state, Snapshot
and exported design-system primitives. Transport → Node net only and the small
object boundary decoder. No code is imported from another project except the
design-system package. The [runtime decision](../../../docs/decisions/dispatch-feed-runtime.md)
records Bun without Effect; commands are in [contributing](../CONTRIBUTING.md).

- `snapshot.ts`: independently maintained defensive decoder for the consumed v1
  fields. Unknown fields ignored; unknown source states map to unknown and force
  null counts. Unique source/item ids, finite counts, remaining 0–1, 21 ordered
  week blocks; bad required data rejects the snapshot, never partial success.
- `transport.ts`: one bounded NDJSON JSON-RPC connection per request; only get,
  act and refresh exist. Three-second deadline, 16 MiB response ceiling, two
  simultaneous requests maximum. Close aborts every pending connection. Errors
  expose fixed codes only, including Effect 4.0.6's Cause-array typed failures.
  A void refresh reply may omit result. Mutation transport failures are outcome
  unknown, never replayed. Read-only rejects mutations before opening a socket.
- `app.ts`: server snapshots, connection state and reconciliation; local selection,
  filter/sort, one-line draft, motion/ambient toggles and focus freshness hold.
  Polling coalesces concurrent reads and requests one immediate follow-up after
  an acknowledged action. No optimistic domain update. Done to-dos are snapshot
  items with doneAt; the pane keeps no completed records. A draft keeps the list
  chosen when it opened and sends it as todo.add source. Mark, arrival and
  activity memory is bounded/pruned; snapshot limits are 256 sources and 20,000 items.
- `text.ts`: the terminal measure (`Bun.stringWidth`), display sanitising that
  turns controls and bidi characters into `?`, and grapheme-safe draft tail/Backspace.
- `render.ts`: pure geometry, component composition through a measured design-system
  CellGrid, hit regions, plain and grapheme-aware cell diff serialization. Receives time; never reads a clock or mutates App. Background
  decoration is separated from semantic content before sweep/load-in/ping.
- `input.ts`: bounded incremental CSI/SGR parser; fragmented and coalesced input,
  keyboard, mouse hover/left press, focus and bounded literal bracketed paste. Unsupported/modifier/release/wheel
  reports are consumed, never converted into keys.
- `terminal.ts`: raw/alternate-screen and bracketed-paste lifecycle, any-motion SGR tracking, focus
  reporting, disabled autowrap while painting, resize, signals, polling, animation
  scheduling, macOS URL subprocesses (five-second bound). One animation timeout
  only with motion on (25 ms during short events, 67 ms for continuous detail); one poll timeout, one escape timeout. All stop on cleanup.
  Render failure keeps a plain failure line until quit; socket failure stays in
  the pane and retries. Terminal modes and original raw state restore on exit.
- `herdr-plugin.toml`, `bin/dispatch-feed.sh`: install/build and split/tab actions.

## Flows and boundaries

Get every five seconds, including while a draft is active. A newer snapshot
replaces the previous one only after full validation. Polls cannot race out of
order; an action's revision acknowledgement refetches rather than constructing
its own server state. Losing the reply never retries the action. The engine may
continue an already-sent action after pane shutdown; cancellation is not rollback.

URL opening validates http/https and uses argv with no shell. UI text is untrusted:
it is sanitised in `text.ts`, then measured and clipped by the design system's
measured text slots, so one bad title cannot stop a frame. Protocol keys and URLs
retain source bytes. No analytics,
network browser service, cache files, account configuration or persistent client
state are introduced. There is no automatic deployment or install migration.

## Evolution and limits

The engine owns done to-dos: it returns each with doneAt until the local midnight
after it was done, so the pane shows nothing it was not given. Focus fallback
cannot observe blur on hosts that do not report it. A global last-look cursor is shared by other
clients; this pane freezes only its own initially fresh markers. Data ceilings
produce an explicit read failure rather than silent truncation. Broader terminal,
font, accessibility and large-source performance support need separate evidence.
