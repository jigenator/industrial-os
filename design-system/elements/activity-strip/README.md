# Activity Strip

Five rows: heading, seven civil-day initials, YOU and AGENTS, comparison. Exactly 21 start/you/agents/future blocks, in supplied order. Each non-future block is ▆, row-relative intensity with zero faint; future is a dot. The host supplies timestamps and totals, not this element. Three touching cells per day separated by one gap. Small widths clip the strip, never invent blocks.

## Contract

`activityStrip(input, { width })` returns foundation lines, exactly width (1–1000) cells. ambientField instead takes existing lines and an options object. It owns no I/O, interaction, clock, or motion; state and time are host-owned. Caller text is ASCII-sanitized; structural glyphs follow [foundation](../../foundation/README.md). Invalid dimensions/numbers throw RangeError; invalid text/styles throw TypeError. Truecolor/plain have identical cells. Narrow clipping is explicit, not a different data state.

## Checks

`node --test elements/activity-strip/activity-strip.test.mjs`, then the [full validation](../../CONTRIBUTING.md#full-validation-sequence). Widths 1–160, state and invalid-input checks are automated; native support is not inferred. Storybook fixtures are examples, never telemetry.
