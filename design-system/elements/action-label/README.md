# Action label

`actionLabel({label='open',kind='open',state='ready'},{maxWidth=Infinity,style,measure})` returns inline spans. `kind` is `open` or `keycap`; states are `ready`, `read`, `hover`. Open adds `▸`; read uses `[open ▸]`, ready is padded solid wheat and hover uses wheat highlight (`wheatHi`, the info tone’s high ink). Read is not bold. There is no invented focused-button pose; focus remains host-owned. Style is a validated explicit override, including other tones and their hover ink. Tiny widths clip the affordance, never create a hit target. This is not an informational label plate.

`keyHints([{key?,label}],{width,measure})` returns one exact-width row, starting at column 1. Keys are bone on surface; labels are decorative. Tokens drop whole at the first one that cannot fit; no clipped chord. No action, focus ownership, input listener or hit rectangle lives here. Host owns keyboard and mouse activation.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
