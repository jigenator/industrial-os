# Scope meter

`scopeMeter({state='connected'},{maxWidth=4})` returns up to four cells. States: `connected` joined `────` in accent; `reconnecting` stable jagged braille in warning; `lost` `✕⣀⣀⣀` in critical. No percentage, SNR or invented numeric strength. A smaller budget clips decoration. Infinity is accepted but never adds cells.

This is the reduced-motion/static pose. Compose scope-trace over the isolated structural meter before placing it in a measured name/feed row. The host owns connection semantics, pass epochs, rest timers and disposal. Adjacent words carry state alongside shapes; NO_COLOR retains the distinct shapes.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
