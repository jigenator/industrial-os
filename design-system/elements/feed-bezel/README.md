# Feed bezel

`feedBezel({imageRect,callsign='',channel='',pose='',meter=[],lamp=[]},{width,height,measure})` returns exact-width, exact-height chrome-only lines. `imageRect={x,y,width,height}` is a positive rectangle inside the viewport. It is immutable: no allocation, scaling, clipping or image drawing. The hole stays empty. Reticle brackets have two-row arms and inward ghost-ink midpoint ticks; readouts yield first, then unavailable brackets are omitted. Callsign is decorative, its separator/channel ghost; empty readouts never overwrite brackets. Callsign/channel and meter occupy the free row above the hole. Pose and supplied lamp spans flank the final image row. Compose the bottom name rule separately, with join columns `imageRect.x-1` and `imageRect.x+imageRect.width` when visible.

`imageLabel({label,missing=false,unsupported=false,hover=false},{maxWidth=Infinity,measure})` draws a `▣` label. Hover adds the entire public open action only when available and it fits; otherwise it drops whole, never clipping the action token; missing/unsupported retain explanatory words, no invented action.

`imageInset(rect,{width,height})` draws crop corners and ten-column/five-row graticule ticks outside the same immutable hole. It never loads an image. PNG reads, Kitty placement, image admission, pointer routing and actual scaling remain host-owned.

`meter`/`lamp` are validated structural span lines; all other text accepts measured values. Apply feed-scan only to the explicit side-rail columns and image rows. Off has no scan. Plain keeps brackets, lamp words and available actions.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
