# Document block

Markdown **presentation**, never Markdown parsing or AST ownership. Strong/emphasis content is supplied in rich slots using foundation bold/italic styles; all other rich body styling is retained.

| Function | Output / inputs |
| --- | --- |
| `documentHeading({text,level=1}, options)` | `Line[]`; H1 has an acid heading + heavy underline, H2 yellow `▍`, H3 ice, H4–H6 primary. Case is supplied, never rewritten. |
| `listRow({body,marker='▪',checked?,indent=0}, options)` | `Line`; structural default bullet, caller marker or `[ ]`/`[x]` task. Indent 0–1000. |
| `quoteRows({body=[]}, options)` | `Line[]`; supplied prewrapped rows, lavender stripe and italic string text. |
| `linkLines({label,url}, options)` | `Line[]`; underlined link label, then dim visible URL, wrapped without losing characters. No OSC8/executable link is emitted. |
| `codeBand({language,body=[]}, options)` | `Line[]`; shared slab language plate and leader, then wrapped surface-band code. No source execution or language inference. |
| `inlineCode(text, {maxWidth=Infinity,measure?})` | Inline spans in canonical code ink on surface. |
| `specTable({headings,rows=[],align=[]}, options)` | `Line[]`; header + heavy rule, spaced open columns, no cage. Align is left/right/center per column. Max 100 columns, 1000 records, rectangular rows. |

`options` is `{width,measure?}`. Prewrapped list/quote/heading text clips. Links, fenced code and narrow table records wrap whole graphemes without ellipsizing values. A table that cannot fit natural column widths becomes stacked heading/value records; every value remains present, including at one column for ASCII. If one grapheme cannot fit an entire wrapping budget, throw `RangeError` rather than silently lose it (e.g. a two-cell Han character at width 1, or width 2 code with its one-cell gutter). The host keeps literal-source parse/error fallbacks and supplies allotted source rows; the renderer does not own incremental release.

## Shared contract

Pure spans only; no I/O, clock, parser, state inference, hit targets or input handling. Block rows are exactly `width` cells (integer 1–1000); arrays of supplied rows are bounded to 1000. Inline budgets are 0–1000 or Infinity. Inputs are copied, never mutated. Invalid input types throw `TypeError`; invalid dimensions, states and ranges throw `RangeError`.

Every caller text field accepts a string (the historical printable-ASCII sanitization) or a [measured text slot](../../foundation/README.md#measured-text-slots), with a supplied `measure`. Slot styles, including italic/underline, survive; unsafe controls/bidi, forged widths and split graphemes are rejected. Rich styles must keep semantic cues readable. Default chrome backgrounds are explicitly transparent (`bg:'default'`), not implicit black. Explicit bands and plates are surface-compositor inputs; alpha policy stays in the host. Plain output keeps semantic words and shapes.

## Checks

Run `node --test` from `design-system/`; the colocated source-named tests cover states, widths 1–160, invalid inputs, measured wide/combining/emoji/ZWJ slots, plain/color geometry and immutability. Stories execute the actual public API calls printed below their specimens. Native evidence and limits are recorded in [Contributing](../../CONTRIBUTING.md#lunalee-ds-2b-content-verification-2026-10-27), not inferred from unit tests.

Adapter note: link/code/table fallback wrapping is grapheme-based, not word-based, so it may break inside a word. At tiny budgets the adapter must handle the documented too-wide-grapheme `RangeError`; this review does not change that policy or discard values. Fill-alpha policy, including critical, card tint and selection roles, remains host-owned.
