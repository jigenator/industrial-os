# Segment meter

The status-bar USG quota slot and provider column, including declared windows, countdowns, stale data and unavailable states. Supplied values only; no clock, account lookup, polling or motion.

## Usage

```js
import { segmentMeter, providerColumn, providerColumnWidth, countdown, staleAge } from './segment-meter.mjs';
segmentMeter({ remaining: 87.5, ink: 'primary' });
providerColumn({ provider: 'claude' }, { width: 30, now: 0 });
providerColumn({
  provider: 'codex',
  data: { windows: { wk: { usedPercent: 25, resetsAt: 2460000 } }, updatedAt: 0, fetchedAt: 0 },
}, { width: 30, now: 0 });
```

```text
CLD ········ ········
    pending
GPT ■■■■■■■■
    41m
```

**Lit means some quota remains in that slice.** With eight segments, each is 12.5%. `litSegments(remaining, segments)` is zero only at zero, otherwise `max(1, ceil(remaining / (100 / segments) - 1e-6))`. This intentionally lights a whole square for any remaining portion of its slice, unlike the DS gauge's floored fill. Every settled square is `■`: lit ink is the provider/caller's, lost ink is `SIGNAL_COLORS.ghost`. Plain output cannot distinguish lit from lost squares; the extension's appearance is preserved, and a host needing an accessible numeric quota must compose a separate exact reading.

## Contract

| Input/API | Contract | Default |
| --- | --- | --- |
| `segmentMeter({ remaining, state, ink }, { segments, maxWidth })` | inline spans, natural width segments, bounded by maxWidth | see states |
| `remaining` | finite 0–100; null/undefined unknown | unknown |
| `state` | known/pending/failure/none/unknown/absent | unknown if remaining absent, otherwise known |
| `ink` | palette role or valid literal RGB | primary |
| `segments` | integer 1–1000 | 8 |
| `maxWidth` | integer 0–1000 or Infinity | Infinity |
| `providerColumn(input, { width, now, segments })` | paired top/text lines, every line exactly width (1–1000) | width required; now unknown |
| `providerColumnWidth(input, { now, segments })` | natural column width, same validated contract | no clipping |
| `provider` | codex/claude/kimi, selects `USAGE_PROVIDERS` preset | or generic fields below |
| Generic fields | omit provider; supply three-cell `tag`, valid `ink`, nonempty unique `declared` array of `5h`/`wk` | required for generic |
| `data` | `{ windows, updatedAt?, fetchedAt? }`; absence pending unless failure | absent |
| `windows` | own `5h`/`wk` keys → `{ usedPercent, resetsAt? }`; usedPercent finite 0–100 or null (unknown) | empty means none |
| `updatedAt`, `fetchedAt`, `resetsAt`, `now` | finite milliseconds or null/undefined (unknown) | explicit, no clock |
| `failure` | `timeout` or `failed`, never raw error prose | absent |
| `countdown(resetsAt, now)` | pure exact format below | unknown → `?` |
| `staleAge(ms)` | non-negative finite age duration → three-cell age below | explicit |
| `litSegments(remaining, segments)` | pure lit count, not a rounded percentage | segments 8 |
| `USAGE_PROVIDERS` | frozen tag/ink/declared layout preset | exported reference |

Invalid numbers, percentages, states, dimensions, window declarations/keys or failure codes throw `RangeError`, never clamp. Invalid text/colors/data shapes throw `TypeError`. A sample later than supplied now or an overflowing timestamp difference throws `RangeError`. Samples need not supply timestamps; without them age is unknown, not invented. Caller tags go through `safeText`; they must remain exactly three display cells.

## States and fixed columns

| State | Slot | Text row |
| --- | --- | --- |
| Known remaining | N squares, lit provider ink, lost ghost | countdown under slot |
| Zero quota | all ghost squares, not unknown | countdown |
| Pending | decorative `········` | secondary `pending` under first slot |
| Failed without data | decorative `????????` | warning `timeout`/`failed` under first slot |
| Unknown window | decorative `????????` | secondary `?` under that slot |
| Declared window absent from sample | blank slot | blank |
| Successful sample with no windows | secondary `none` in first slot area | blank |
| Failure with earlier data / age >15 minutes | last good windows retained; tag decorative, nonbold | warning age under tag plus current countdowns |
| Reset passed / unknown reset | squares unaffected | `reset` / `?` |

Preset columns: GPT (codex) `[wk]` in signal gpt white; CLD (claude) `[5h,wk]` in signal cld; KMI (kimi) `[5h,wk]` in signal kmi. Current tags are bold in lit ink. Stale means a failure with data, or age strictly older than 15 minutes; exactly 15 minutes remains current. Age uses updatedAt, else fetchedAt. A failure with no supplied now/time reads `?` age and retains last-good data.

At default eight segments, natural width is `3 + 1 + 8*N + (N-1)`: GPT 12, CLD/KMI 21 in pending, failed, known, partial, stale and none alike. Reported undeclared windows remain visible in 5h/wk order and widen the column. A countdown wider than its slot widens it rather than overlapping. Those are explicit exceptions, matching the footer. With fewer than seven segments, each provider slot reserves seven cells in **every** state so pending/timeout text cannot shift it. A standalone meter remains exactly segments cells.

## Time formats

Countdowns round positive spans **up** to whole minutes first; formats use those rounded minutes, so just below 1h becomes `1h00m`, not `60m`.

| Remaining time | Format | Example |
| --- | --- | --- |
| <1h | `Nm` | `41m` |
| <10h | `HhMMm` | `4h03m` |
| <24h | `HHh` | `12h` |
| <10d | `DdHh` | `5d15h` |
| >=10d | `DDd` (uncapped) | `12d` |
| Reset passed | `reset` | `reset` |
| Reset or now unknown | `?` | `?` |

| Stale age | Format | Example |
| --- | --- | --- |
| Zero | `0m` | `0m` |
| Up to 59min | minutes, ceil | `16m` |
| >59min to <24h | hours, floor, at least 1 | `5h` |
| <100d | days, floor | `2d` |
| >=100d | cap | `99+` |

## Width behavior and assumptions

`segmentMeter` clips to maxWidth without padding; at 1 cell pending is `·`, unknown/failure `?`, known `■`, none `n`, absent blank. `providerColumn` keeps each tag/slot together when it fits; otherwise splits between parts, then wraps an oversized slot in paired top/text slices. Even at width 1 no square or state-word character is clipped. It always returns the paired text row (blank for none), allowing stable composition; the host may omit an entirely blank text row.

[Foundation](../../foundation/README.md) owns curated one-cell glyphs, roles/signal colors and truecolor/plain painting. All structural glyphs are allowlisted. Failure/stale inks are `warning` roles for motion protection. Lit versus lost is a color/luminance-only distinction inherited from USG; KMI has the weakest contrast, and plain output has no lit-count cue. No additional compliance claim is made.

## Differences from status-bar

The default slot semantics, provider declarations, glyphs/inks, fixed widths and time formats model `footer.ts:211–267,1230–1268`. This kit rejects invalid/out-of-range input instead of clamping used percentages. Callers explicitly supply unknown. It has no CodexBar detection/poller, row label, multi-provider layout, pulse, burn-out or timer. Pair rows are always returned, even when the text row is blank. Custom N and generic three-cell tags are supported; short-N provider slots reserve state-word space. Renderers reject invalid reset timestamps rather than silently treating them as missing; use null for unknown. The caller owns clock corrections (a sample later than now is invalid here).

## Checks

[segment-meter.test.mjs](segment-meter.test.mjs): exact provider/state snapshots and inks, quota boundaries/tolerance, unknown vs zero, declared/partial/undeclared shapes, stale threshold/last-good retention, format tables, countdown overflow, invalid input, widths 1–160, one-cell no-clipping, glyph allowlist and plain/color equivalence. From `design-system/`: `node --test elements/segment-meter/segment-meter.test.mjs`, then `node --test`. Automated checks only; native Herdr glyph/contrast/readability verification not run.
