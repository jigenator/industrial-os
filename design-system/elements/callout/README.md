# Callout

`callout({side='left',name='',first=true,body=[],readout='',reference?}, {width,measure?}) -> Line[]` draws a title corner row, supplied prewrapped body rows, an optional reference row, and a timestamp corner row. Left uses acid `┌╴/└╴`; right mirrors in bone `╶┐/╶┘`. Only continuations (`first:false`) omit the name. The host supplies literal receipt words/clock values and any rich warning/critical style; there is no receipt scheduler. Readout leaders occupy the existing last corner row, never an additional timestamp row. Names/body/readout clip within the viewport at whole graphemes with a measurer.

`timestampLeader({readout='',side='left',cells=2}, {width,measure?}) -> Line` composes the shared tab-rule leader and timestamp in either direction. `cells` is an integer 0–1000; available width limits the leader first.

`subtitle({body=[],marker='',ambient=false,aside=false}, {width,measure?}) -> Line[]` centers supplied prewrapped rows and an optional last marker row. Ambient strings use decorative ink, asides italic. To supply a structural marker such as ▼ without ASCII replacement, pass a measured string/slot; the host composes downward beacon on that narrow marker only. Retirement, grouping, wrapping, pacing and body/blank-row budgets remain host-owned. Settled callouts have no entrance marks; compose the separate callout-entrance motion on reserved gutters, and phosphor-head on already-revealed text.

## Shared contract

Pure spans only; no I/O, clock, parser, state inference, hit targets or input handling. Block rows are exactly `width` cells (integer 1–1000); arrays of supplied rows are bounded to 1000. Inline budgets are 0–1000 or Infinity. Inputs are copied, never mutated. Invalid input types throw `TypeError`; invalid dimensions, states and ranges throw `RangeError`.

Every caller text field accepts a string (the historical printable-ASCII sanitization) or a [measured text slot](../../foundation/README.md#measured-text-slots), with a supplied `measure`. Slot styles, including italic/underline, survive; unsafe controls/bidi, forged widths and split graphemes are rejected. Rich styles must keep semantic cues readable. Default chrome backgrounds are explicitly transparent (`bg:'default'`), not implicit black. Explicit bands and plates are surface-compositor inputs; alpha policy stays in the host. Plain output keeps semantic words and shapes.

## Checks

Run `node --test` from `design-system/`; the colocated source-named tests cover states, widths 1–160, invalid inputs, measured wide/combining/emoji/ZWJ slots, plain/color geometry and immutability. Stories execute the actual public API calls printed below their specimens. Native evidence and limits are recorded in [Contributing](../../CONTRIBUTING.md#lunalee-ds-2b-content-verification-2026-10-27), not inferred from unit tests.
