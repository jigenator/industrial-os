# Sheet card

One shared supplied-state contract for cards, STACK and ^P list rows. Frozen `SHEET_STATES` presets feed the existing state-chip **word form**, not Tatsu state inference: `unread ◆`, `read`, `waiting on you ●`, `answered`, `declined`, `delivery waiting ●`, `withdrawn ↷`. `cardState({state='unread',answer=''}, {maxWidth=Infinity,measure?}) -> Line` adds an optional ` · answer` after answered. Withdrawal is a settled state for a question no longer awaiting an answer, with decorative state/heading ink and a trailing `↷` cue. Delivery state, read state and answer-time copy are all host decisions. Use `heading.state:'withdrawn'`, `kind:'question'` and `read:true` for a withdrawn question card; the host supplies the read flag rather than the renderer inferring it.

- `cardHeading({number,time,state,answer?}, {width,measure?}) -> Line`: `▤ SHEET number  time` left, common state right; no leader. Number is a supplied text slot, including any zero padding.
- `sheetCard({heading={},kind='info',title,gist=[],footer,read=false,hover=false,button='open'}, options) -> Line[]`: info is five rows (heading/title/two prewrapped gist rows/footer), question three (heading/title/one gist). Gist admits at most two supplied rows. Read removes the tint band and brackets the real action-label. Hover changes ink/band, never row count; a hovered read card keeps no band but brightens its title to primary and its `[open ▸]` to `wheatHi`, so a clickable read card still answers the pointer. Host supplies explicit matching heading state and read flag.
- `stackRow({label,title,state,answer?,selected=false,hover=false,last=false}, options) -> Line`: tree in columns 1–2, stripe column 3, immediate ▸ column 4, then label/title/state. Selected state-ink fill is immediate; host may compose wipe with stateCells opt-in on a separately reserved structural/style region. Read STACK rows retain the tint.
- `stackCard({heading,rows=[]}, options) -> Line[]`: one `▤ STACK` row and caller rows. Only final tree join is derived; membership, pinning, count/time wording, focus and navigation are not inferred.
- `sheetListRow({...row,updated?}, options) -> Line`: ^P row pieces without tree leaders, with fixed left-aligned state/updated columns and a title-to-state dot leader. Filter, sort, paging and narrow stacked-record routing remain host-owned; use document-block's table/record fallback when values must be preserved instead of clipping a one-row list.

`options` is `{width,measure?}`. State yields no invented status. At narrow widths optional title/metadata clip before the reserved right state; at extremely small widths only the leading structural cells fit. No click/activation behavior is returned.

## Shared contract

Pure spans only; no I/O, clock, parser, state inference, hit targets or input handling. Block rows are exactly `width` cells (integer 1–1000); arrays of supplied rows are bounded to 1000. Inline budgets are 0–1000 or Infinity. Inputs are copied, never mutated. Invalid input types throw `TypeError`; invalid dimensions, states and ranges throw `RangeError`.

Every caller text field accepts a string (the historical printable-ASCII sanitization) or a [measured text slot](../../foundation/README.md#measured-text-slots), with a supplied `measure`. Slot styles, including italic/underline, survive; unsafe controls/bidi, forged widths and split graphemes are rejected. Rich styles must keep semantic cues readable. Default chrome backgrounds are explicitly transparent (`bg:'default'`), not implicit black. Explicit bands and plates are surface-compositor inputs; alpha policy stays in the host. Plain output keeps semantic words and shapes.

## Checks

Run `node --test` from `design-system/`; the colocated source-named tests cover states, widths 1–160, invalid inputs, measured wide/combining/emoji/ZWJ slots, plain/color geometry and immutability. Stories execute the actual public API calls printed below their specimens. Native evidence and limits are recorded in [Contributing](../../CONTRIBUTING.md#lunalee-ds-2b-content-verification-2026-10-27), not inferred from unit tests.

## Review refinements

`sheetListRow` additionally accepts `columns:{state,updated}` in options: zero-based left-aligned cell positions, defaulting to W−30/W−8 (with the selection gutter taking priority at tiny widths). Updated must follow state; positions are integers 0–1000 and clip at the viewport. Use these same positions for the host's STATE/UPDATED headers. An unselected list row has no tint and uses the canonical floor dot leader from title to state. A selected read list row fills wheat, not grey. STACK read rows, unlike read standalone cards and list rows, retain their tint. Card footers use decorative ink, read titles secondary, unread state words bold, and read card/list stripes ghost.
