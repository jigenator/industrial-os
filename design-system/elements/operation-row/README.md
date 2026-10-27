# Operation row

`operationHeading({label='OPERATIONS LOG',code='',focused=false,count=''}, {width,measure?}) -> Line` draws a yellow label, a solid yellow plate when focused and explicit `· focused`, and a right code. No heading leader/ruler; compose tab-rule separately above it. Existing latch can decorate only the label plate.

`operationRow({state='neutral',time='',category='',detail='',duration='',selected=false,hover=false}, {width,columns={},styles={},measure?,color=true}) -> Line` owns one fixed-column row: stripe at cell 0, marker (`▸` when selected, otherwise blank) at cell 1, a blank gap at cell 2, and time starting at cell 3 in every state. Time/category/duration cell budgets default to 5/4/(15 at widths ≥40, otherwise 5); overrides are integer 0–1000. The duration reservation is made **before** long detail or optional fixed columns, so detail never displaces it. At tiny widths the strip/selection gutter wins; the rest clips. Category and tool case remain exactly supplied. Rich detail slots support separately colored tool names; `styles` accepts validated styles for time/category/detail/duration. There is no category hash, redaction, duration formatter or clock here.

States running/done/failed/neutral/waiting use role inks; `color:false` switches the strip to **▒/█/✕/·/▲**. `paint(...,'none')` alone does not select glyphs: the host passes its color flag here. Selection adds immediate ▸ and a selection band, hover a hover band. A shared dot leader fills the detail-to-duration gap. Running pulse is an existing fade on the **strip only**, with caller-configured eight levels/1280-ms period; the host ends it at 10 seconds, while the truthful duration keeps updating separately.

`operationDetail({label,value}, {width,labelWidth=14,measure?,style={},align='left',leaderInk}) -> Line` is a label + shared dot leader + value row. LabelWidth is 0–1000; long values clip or are prewrapped by the host. `align: 'right'` puts the value against the right edge, cut to `width − label − 2`, with the leader between the label and the value one cell clear of each (`labelWidth` is unused); this is the automations monitor's key-value row. `leaderInk` colors the leader in either alignment. The defaults leave existing output unchanged. Detail section headings, table records and popup chrome compose the existing document-block/popup families.

## Shared contract

Pure spans only; no I/O, clock, parser, state inference, hit targets or input handling. Block rows are exactly `width` cells (integer 1–1000); arrays of supplied rows are bounded to 1000. Inline budgets are 0–1000 or Infinity. Inputs are copied, never mutated. Invalid input types throw `TypeError`; invalid dimensions, states and ranges throw `RangeError`.

Every caller text field accepts a string (the historical printable-ASCII sanitization) or a [measured text slot](../../foundation/README.md#measured-text-slots), with a supplied `measure`. Slot styles, including italic/underline, survive; unsafe controls/bidi, forged widths and split graphemes are rejected. Rich styles must keep semantic cues readable. Default chrome backgrounds are explicitly transparent (`bg:'default'`), not implicit black. Explicit bands and plates are surface-compositor inputs; alpha policy stays in the host. Plain output keeps semantic words and shapes.

## Checks

Run `node --test` from `design-system/`; the colocated source-named tests cover states, widths 1–160, invalid inputs, measured wide/combining/emoji/ZWJ slots, plain/color geometry and immutability. Stories execute the actual public API calls printed below their specimens. Native evidence and limits are recorded in [Contributing](../../CONTRIBUTING.md#lunalee-ds-2b-content-verification-2026-10-27), not inferred from unit tests.
