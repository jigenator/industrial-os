# Engineering conventions

The [root conventions](../../../docs/conventions.md) and
[plugin group rules](../../AGENTS.md) apply.

## Rules

- `.mjs`, Node 22 standard library only. Pure model functions receive clocks,
  authoritative records and history explicitly; adapters own all I/O.
- Wire and persisted data are untrusted shapes: validate, bound, reject, never
  turn missing AU into zero. Reject torn pane/workspace reads.
- Request failures use local enumerable codes (`timeout`, `connection_failed`,
  `connection_closed`, `invalid_reply`, `request_rejected`); no internal server
  error payload is surfaced. Diagnostics contain fixed codes/counters only.
- Each test supplies a temporary socket/state/config environment. No test may
  inherit the live Herdr target. Daemon tests always stop their owned process
  before removing the temp directory; assert hook pipe EOF separately.
- Keep values in [the token contract](token-contract.md), styles in the Herdr
  fragment and constants in the source module that owns behavior. The contract
  key list is read by the Herdr check and checked against model keys.
- Atomic rename is the persistence boundary, not a claim of power-loss or
  cross-store transactions. Log size and history retention/ceilings are part
  of the public operations contract.

## Known gaps

No license has been selected, no Windows support, no CI, no live rendering or
load/latency benchmark. Node's Unicode segmentation and our width approximation
are not a terminal-width oracle. These are limits, not passes.
