# Input frame

`inputFrame({state='idle',label='INPUT',scroll='',spread=false},{width,bodyRows=1,measure})` returns `bodyRows+4` exact-width chrome-only rows. States are `idle`, `hover`, `focused`, `form`. Label is bone when focused, solid critical for forms; scroll metadata is supplied and leaves one blank cell before the home right corner. No inferred editor state or cursor rendering.

Row 0 and the final row reserve diagonal gutters. Home top is row 1, body occupies rows 2 through `bodyRows+1`, home bottom is `bodyRows+2`. The native editor overlays these empty body rows at column 3 with its existing budgets. Every body cell has transparent `bg:'default'` in every state: **INPUT never owns a body fill**. Native code/completion/selection backgrounds remain the editor's property. Widths below 8 omit corner geometry and prioritize the label.

`spread:true` is an explicit host-selected pose. Prefer corner-snap over a home frame for the hover/focus event; with motion off always pass `spread:false`. Host retains cursor, IME, selection, completion, take-back label lifetime and all activation. Flash can decorate only the take-back label, never the body.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
