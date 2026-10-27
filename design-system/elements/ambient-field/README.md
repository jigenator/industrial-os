# Ambient Field

Pure background composition over existing lines. Empty black cells only, with two-column/one-row clearance from glyphs and caller-supplied nonnegative integer regions. Eight-by-four grid, staggered dots, registration marks, top-to-bottom surface gradient. enabled=false removes decoration but keeps the gradient. Nothing covers text or interactive regions. Host applies ambient-sweep and arrival-ping separately.

## Contract

`ambientField(input, { width })` returns foundation lines, exactly width (1–1000) cells. ambientField instead takes existing lines and an options object. It owns no I/O, interaction, clock, or motion; state and time are host-owned. Caller text is ASCII-sanitized; structural glyphs follow [foundation](../../foundation/README.md). Invalid dimensions/numbers throw RangeError; invalid text/styles throw TypeError. Truecolor/plain have identical cells. Narrow clipping is explicit, not a different data state.

## Checks

`node --test elements/ambient-field/ambient-field.test.mjs`, then the [full validation](../../CONTRIBUTING.md#full-validation-sequence). Widths 1–160, state and invalid-input checks are automated; native support is not inferred. Storybook fixtures are examples, never telemetry.
