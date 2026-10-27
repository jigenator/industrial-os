# Type Unit

Bracket-corner source frame, 7 rows by default. label/color/key identify the source; active inverts its heading, hover brightens brackets only (never fills the background). ok/stale may show counts; planned/auth/error/config_error/disabled/loading/unknown never show numbers or a bar. null count is unknown. remaining is a finite 0–1 or null; eight-cell ceil bar is FULL when fresh and empty when stale, with the supplied age and limit below. total=0 says no oldest item. Counts use pixel-numeral's `textGrid` with its dashboard face, not another font. height may be 3–1000; under 6 rows the bar yields. Width below 12 becomes a two-row label/state readout.

## Contract

`typeUnit(input, { width })` returns foundation lines, exactly width (1–1000) cells. ambientField instead takes existing lines and an options object. It owns no I/O, interaction, clock, or motion; state and time are host-owned. Caller text is ASCII-sanitized; structural glyphs follow [foundation](../../foundation/README.md). Invalid dimensions/numbers throw RangeError; invalid text/styles throw TypeError. Truecolor/plain have identical cells. Narrow clipping is explicit, not a different data state.

## Checks

`node --test elements/type-unit/type-unit.test.mjs`, then the [full validation](../../CONTRIBUTING.md#full-validation-sequence). Widths 1–160, state and invalid-input checks are automated; native support is not inferred. Storybook fixtures are examples, never telemetry.

The hover/pick snap is the shared [corner-snap motion](../../motions/README.md#cornersnaplines-options-and-cornersnapsettling) with `corners: 'heavy'`. Give the unit input-frame's reserved gutters: one blank row above and below, one blank column left and two right; the host ends the pose (dispatch-feed after 180 ms) and passes `animate: false` with motion off. It does not change source content.

`arriving: true` brightens brackets without inverting the heading; the host supplies the real arrival window. No arrival is inferred by the element.

Under six rows the unit uses a small exact count/state instead of a clipped pixel numeral. Large status counts say counts overflow instead of overrunning the numeral or frame; a compact count that cannot fit shows #, never partial digits.
