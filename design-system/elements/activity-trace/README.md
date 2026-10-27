# Activity Trace

One row: LIVE, braille samples, IDLE/CHANGED/OFFLINE. Counts are actual observations supplied by the host, oldest first, max 1000; two samples per cell, clipped at three. Empty/zero samples give a flat bottom trace, not invented activity. No clock or simulated activity. connected=false explicitly says OFFLINE.

## Contract

`activityTrace(input, { width })` returns foundation lines, exactly width (1–1000) cells. ambientField instead takes existing lines and an options object. It owns no I/O, interaction, clock, or motion; state and time are host-owned. Caller text is ASCII-sanitized; structural glyphs follow [foundation](../../foundation/README.md). Invalid dimensions/numbers throw RangeError; invalid text/styles throw TypeError. Truecolor/plain have identical cells. Narrow clipping is explicit, not a different data state.

## Checks

`node --test elements/activity-trace/activity-trace.test.mjs`, then the [full validation](../../CONTRIBUTING.md#full-validation-sequence). Widths 1–160, state and invalid-input checks are automated; native support is not inferred. Storybook fixtures are examples, never telemetry.
