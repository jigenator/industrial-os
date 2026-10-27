# Popup header

`popupHeader({plate,title='',meta='',style?},{width,measure})` returns one exact-width line: one left margin, a slab, title two cells after the plate content, right-aligned meta with one right margin. Title has priority: keep it complete whenever it fits alone; only an overlong title clips with an ellipsis. Meta uses the remaining space, clipping with an ellipsis only when at least eight cells remain; otherwise it drops. `popupHeader` draws no ruler, leader, or outer frame. Default plate is solid wheat; callers supply canonical role styles for other popup kinds.

`popupFooter({escape='back to the desk',meta=''},{width,measure})` returns an exact-width surface strip with an Esc keycap and supplied secondary-ink action text. Esc has priority over meta in narrow layouts. Notice/loading/error rows remain separate; neither function owns the popup lifecycle or input.

## Board popup

The automations monitor's run modal is a framed popup over a faded board. These three parts draw it; the host owns placement, content and Esc.

- `popupFrame({height},{width})` returns `height` lines of `width` cells filled with the field: a heavy primary `━` top rule, structural `│` sides with secondary blank cells between them, and a structural `─` floor. A one-line frame is the floor alone.
- `popupTitleBar({mark|band,title,word='',wordInk,detail='',meta=''},{width,measure,ellipsis})` returns one exact-width row. Exactly one of `mark` (a state color for a `█` cell at column 0) or `band` (`{fill, ink}`: the whole row is filled, every word in `ink`, gaps secondary on the fill) is required. From column 2: the bold title in primary, two cells later the bold `word` in `wordInk` (default primary), two cells later the `detail` in decorative; `meta` (the close action) is right-aligned in decorative. The close action keeps its place; the title, word and detail yield to it in that order, each ending at least two cells before it. Parts are placed by their measured width, so a host measurer's wide graphemes keep their cells; a close action wider than the row keeps its right end. Without a band, blank cells carry no style.
- `popupBackdrop(style)` returns what a cell behind the popup becomes: its foreground and background mixed to `POPUP_BACKDROP` (a quarter) over the field with [`mixOver`](../../foundation/README.md#signal-colors), and not bold. An omitted foreground is secondary and an omitted background the field; `'default'` throws `TypeError`.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
