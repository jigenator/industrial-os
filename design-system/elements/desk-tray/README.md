# Desk tray

`DESK_COLUMNS = {stripe:1,content:3,body:5}` is the single **zero-based** grid: stripe/notch at 1, labels at 3, body/footer at 5, last right-aligned cell at W−2. Widths too small to fit the grid clip to the supplied viewport. No extra body rows appear for animation.

- `deskStrip({state='clear',count='',hint=''}, options) -> Line`: full surface strip; clear has no notch, waiting/open have a steady round critical lamp in column 1. DESK is grey when clear, solid critical otherwise. Waiting count text is supplied; open says `open above`. Hint text is supplied, not an inferred keyboard action.
- `deskHeading({count,hint}, options) -> Line`: solid DESK plate + supplied count at column 3 and put-off hint at the right edge. No leader.
- `questionTitle({label,title,open=false,selected=false,meta=''}, options) -> Line`: critical stripe, solid critical open band with ▸, tint closed band, right meta. `selected` is keyboard focus on a closed title: an acid ▸ in the marker column on the tint band. `open` wins when both are set, so the solid band only ever means the expanded question.
- `questionBody({prompt=[],options=[]}, options) -> Line[]`: prewrapped prompts + one row per supplied option `{label?,body,selected=false,pick=false,hint?}`. ○/● carries selection; optional `pick:true` is the orange `◆ her pick` readout. Dim critical hairline hangs in column 1. A selected choice never submits anything. Native form/editor/read-only body content remains host-owned supplied text.
- `deskFooter({state='hint',text='',detail=''}, options) -> Line`: exactly one body-grid row. States are hint/saving/error/decline/readonly; saving has static ·, error ✕, decline a warning `▲ DECLINE?` plate. Error text and kept-choice notices are never hidden. The host supplies all recovery/confirmation wording and must explicitly activate Enter; this renderer never confirms a decline.

`options` is `{width,measure?}`. Text is prewrapped and clipped to the allotted row, not reflowed into additional rows. Reduced motion is these settled parts. The host may compose existing reveal on optional reserved option slots only, cycle on an isolated saving dot and flash on the warning plate; never animate the waiting notch or conceal validation/error text. Input/answer drafts, controls and budgets do not move into DS.

## Shared contract

Pure spans only; no I/O, clock, parser, state inference, hit targets or input handling. Block rows are exactly `width` cells (integer 1–1000); arrays of supplied rows are bounded to 1000. Inline budgets are 0–1000 or Infinity. Inputs are copied, never mutated. Invalid input types throw `TypeError`; invalid dimensions, states and ranges throw `RangeError`.

Every caller text field accepts a string (the historical printable-ASCII sanitization) or a [measured text slot](../../foundation/README.md#measured-text-slots), with a supplied `measure`. Slot styles, including italic/underline, survive; unsafe controls/bidi, forged widths and split graphemes are rejected. Rich styles must keep semantic cues readable. Default chrome backgrounds are explicitly transparent (`bg:'default'`), not implicit black. Explicit bands and plates are surface-compositor inputs; alpha policy stays in the host. Plain output keeps semantic words and shapes.

## Checks

Run `node --test` from `design-system/`; the colocated source-named tests cover states, widths 1–160, invalid inputs, measured wide/combining/emoji/ZWJ slots, plain/color geometry and immutability. Stories execute the actual public API calls printed below their specimens. Native evidence and limits are recorded in [Contributing](../../CONTRIBUTING.md#lunalee-ds-2b-content-verification-2026-10-27), not inferred from unit tests.
