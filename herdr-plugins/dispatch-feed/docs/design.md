# Design

The approved stats-column composition in the [shared terminal language](../../../docs/design.md):
118×54 cells, no rail, portrait or tape. Row 0 is the calm empty alert ticker.
A 40-column stats area holds plan counts at row 2, week at row 5, and five bracket
units at rows 11/19/27/35/43. LIVE is at row 51. The queue begins at column 41,
with sort/all at row 2, header at row 4, and three footer rows. Five source units
use snapshot order and color tokens, not hard-coded source ids. Unknown tokens
resolve neutral. Under height pressure units compact, while the list retains
keyboard source filtering. Below 85 columns stats yield to the list; below 24
columns or 8 rows show a resize/quit diagnostic. Long titles truncate with an
ellipsis; exact counts must not become partial numbers.

## Data and states

Red numbers/marks mean waiting on you; acid means new. No legend or fake activity.
Priority sorts waiting, then pinned, then normal: the snapshot has no standalone
priority field. Type sort follows source order; age sorts newest first. Planned
sources say WIP / NOT CONNECTED without numbers or a bar. Auth says SIGN IN
REQUIRED; fetch failure FETCH FAILED; config failure CONFIG ERROR; disabled
DISABLED; initial loading LOADING; stale STALE DATA; future unknown UNKNOWN STATE.
Health/error messages remain complete outside decode. Null counts show unknown,
never zero. Total-all becomes unknown when any source count is null.

Staleness is the oldest open item's supplied derived.remaining: full at fresh,
empty at stale, with age and the snapshot's stale limit below (normally 3d).
No item says no oldest item. Source staleness and item staleness are separate.
Week maps exactly 21 civil eight-hour blocks, future dots, independent row-relative
intensities and total versus lastWeekSoFar. The current block breathes; it is a
time position, not an inferred tool-call stream. LIVE records observed revision
changes only; empty observations are flat. Arrival effects require a newly observed
identity with seenAt newer than the preceding snapshot, never a startup fixture.

Offline retains last-good data dimmed with a persistent ENGINE OFFLINE diagnostic
and retries. Empty with failed sources also says sources unavailable. Failed
mutations preserve state and drafts; outcome unknown is explicit and never
blindly retried. Handled rows remain selectable for undo. Acknowledged done rows
stay in place dimmed with `[done]`, **session-only**, so x can reopen; no completed
todo history is available across restarts. See the [key contract](../README.md#keys).

## Motion exception and palette

Dispatch-feed declares the narrow bounded decode exception in the shared rule:
labels and values scramble-and-settle on load/change, **450 ms for values, 600 ms
for headings**, then true text. Glyph steps are 70 ms (14.3/s). Warning/critical
cells and complete health/error messages never scramble. Waiting status rows stay
readable, including their words. `DECODE_SCRAMBLE` in App is the one implementation
switch. Motion-off immediately shows every true value, with no animation timer;
new data is still immediate. m toggles motion; `--motion-off`/NO_MOTION start off.

The existing pixel-numeral supplies v20's dashboard integer face. Numeral ink
re-strikes every 70 ms for 420 ms; selection style wipes ltr over 160 ms. Bar/block
fill-in changes ink only (25–50 ms steps), not readings. Hover/pick corners spread
one cell for 180 ms, returning home; no hover background fill. Arrival dot rings
last 2 s, with an acid edge for 2.4 s then a diamond until 9 s. Ambient grid/dots
and registration marks use exact independent reach/fade/arm/decode load clocks, then sweep 4 s of each 16 s, only in
clear space. Current week block breathes over 4 s. Hosts sample active load/change/arrival steps at 25 ms, continuous motion
at 67 ms; fast decode/re-strike rates are not a photosensitivity certification.

All color values come from the design system. Four distinct approved type inks
are new: PR violet, Linear indigo, messages teal and email sand. To-do uses existing
bone. Near-match substitutions: prototype bone→PI_CHROME.bone; muted→checkMid;
edge→decorative50; quiet rule→ghost; dim bone→DERIVED 74% existing bone. Field,
surface, primary, critical and acid reuse their existing roles. No duplicate
neutral hue is added. No contrast certification is claimed, particularly for
muted decoration and the saturated PR/Linear labels on black.

## Focus, input and accessibility

Terminal focus reporting is requested; first key/click is the fallback. On focus,
freeze currently fresh markers and send look; clear the hold on blur. Without
host blur events the hold lasts until exit; do not infer focus from idle time.
Keys mirror every clickable sort/filter/row operation. Help exposes all actions;
selection, pin, handled and done have text/shape cues. ASCII replacement is an
explicit multilingual limitation. Input, resize and restoration require native
PTY/isolated Herdr evidence, not only browser screenshots.
