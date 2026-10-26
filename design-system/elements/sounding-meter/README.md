# Sounding meter

`soundingMeter({},{maxWidth=6})` returns six braille cells: a dotted baseline with the head resting left. Smaller budgets clip decoration; Infinity never grows it. It is a working-state decoration, not a numeric reading. The caller supplies actual working state and does not show it for idle work.

Compose sounding-sweep on the isolated meter before placing it in a measured row. Motion off is this left-resting pose. Plain output retains braille shape; the host owns scheduling and reduced-motion policy.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
