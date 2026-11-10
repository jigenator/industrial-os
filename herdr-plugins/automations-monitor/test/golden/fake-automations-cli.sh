#!/bin/sh
# The fake automations CLI under the golden harness's frozen clock. golden.ts sets GOLDEN_BUN (the Bun executable) and
# GOLDEN_FAKE (the fake of the checkout being drawn), and points the monitor's command override here.
exec "$GOLDEN_BUN" --preload "$(dirname "$0")/freeze.ts" "$GOLDEN_FAKE" "$@"
