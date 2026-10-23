# Design

This service renders no interface. It supplies truthful values to screens that
follow the [shared design](../../docs/design.md).

## States and truthfulness

- ok is a validated successful observation; empty items then means zero.
- stale keeps last-known items after a failure or restart. checkedAt and okAt
  distinguish the latest attempt from the latest success.
- auth clears items and carries a sign-in message.
- planned never runs; config_error refuses only the affected source.
- loading means no observation yet; disabled is the explicit local overlay.
- error is reserved for callers that need a distinct unsupported/unavailable
  source state; collection failures in v1 use stale, including initial failure.
- Counts are null for all states other than ok/stale. Unknown must never be drawn
  as zero. Handled items remain in the snapshot but do not count.

## Shared values

Ages use since and calendar elapsed time; weekends count. remaining is clamped
from one to zero using the shared staleLimit. fresh means since is after the
shared look cursor; before any look it is false. waiting uses item, then source,
then false. The engine preserves original values; a screen sanitizes terminal
text rather than altering source data.

Week blocks cover today and the preceding six local dates, aligned at 00:00,
08:00 and 16:00. Future portions of today are flagged, events after now are not
counted, and previous-week comparison ends at the same local time seven dates
ago. DST changes can make a civil block differ from eight elapsed hours.
D5 is deliberately provisional: checklist shipments count as you whatever
their recorded actor. Other shipments count as agents when their item kind is
pr_merge or the source declared actor agent, and as you when it declared you.
Shipments with no declared actor and no known kind do not contribute.

rev tracks stored changes, not a repaint clock. at, ages and future flags are
computed on every get, even when rev is unchanged. Polling never waits for a
fresh fetch. Colors are design-system name strings passed through, never hex
values. alerts is always an empty reserved array.
