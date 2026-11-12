# Alert Ticker

One calm row, striped four-cell caps (each a Powerline triangle U+E0BA, the shape of `◢`, a block and U+E0BC, the shape of `◤`, which terminals with Powerline shapes draw across the whole cell; elsewhere they show as empty boxes), NO ALERTS, separator and no alerts. v1 accepts only [] and rejects nonempty alerts rather than simulating a rotating feed.

## Contract

`alertTicker(input, { width })` returns foundation lines, exactly width (1–1000) cells. ambientField instead takes existing lines and an options object. It owns no I/O, interaction, clock, or motion; state and time are host-owned. Caller text is ASCII-sanitized; structural glyphs follow [foundation](../../foundation/README.md). Invalid dimensions/numbers throw RangeError; invalid text/styles throw TypeError. Truecolor/plain have identical cells. Narrow clipping is explicit, not a different data state.

## Checks

`node --test elements/alert-ticker/alert-ticker.test.mjs`, then the [full validation](../../CONTRIBUTING.md#full-validation-sequence). Widths 1–160, state and invalid-input checks are automated; native support is not inferred. Storybook fixtures are examples, never telemetry.
