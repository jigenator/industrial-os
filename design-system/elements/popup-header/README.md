# Popup header

`popupHeader({plate,title='',meta='',style?},{width,measure})` returns one exact-width line: one left margin, a slab, title two cells after the plate content, right-aligned meta with one right margin. Title yields first; meta drops if the essential plate cannot leave enough spacing. No ruler, leader, or outer frame. Default plate is solid wheat; callers supply canonical role styles for other popup kinds.

`popupFooter({escape='back to the desk',meta=''},{width,measure})` returns an exact-width surface strip with an Esc keycap and supplied action text. Esc has priority over meta in narrow layouts. Notice/loading/error rows remain separate; neither function owns the popup lifecycle or input.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
