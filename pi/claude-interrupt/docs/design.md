# Design

## Experience

For Pi users redirecting an active response, the interaction is submit queued text, then press `Esc`. Normal submits queue steering text; `Alt+Enter` queues follow-ups. The active response aborts and the captured text continues in steering-before-follow-up order. An unsent draft stays in the editor. This is feedback about a confirmed continuation, not a progress display or a new input mode.

The extension's palette values in [src/index.ts](../src/index.ts) are authoritative for this marker. The [repository-wide design](../../../docs/design.md) follows these values, not the reverse. This package does not import design-system code or change the user's theme.

## Interaction and visual language

### DIRECTIVE UPDATED marker

The marker is a bold `DIRECTIVE UPDATED` plate followed, after one blank cell, by seven stationary `│` bars. It lasts three seconds. The plate changes on an 80 ms grid and the bars on a 40 ms grid:

- 0–79 ms: the whole plate is filled acid (`#c0fe04`) with black (`#000000`) bold lettering.
- 80–159 ms: the plate is unfilled, so the lettering shows in acid on the terminal background and stays readable.
- From 160 ms: the plate is filled acid again and held. These are abrupt whole-plate flashes, not a wipe.
- From 160 ms, one acid bar appears every 40 ms, the last at 400 ms. They sit at fixed offsets `0, 1, 3, 5, 8, 11, 15` in a 16-cell span, whatever the terminal width, so the gaps between them grow. Nothing moves, and the bars are not a progress indicator.
- From 440 ms, each bar turns grey (`#717171`) in its own cell, again one every 40 ms, stays grey for 120 ms and then disappears. Every bar of the first ping is gone by 800 ms, so each ping lasts 640 ms from its launch.
- After an 80 ms blank gap, the ping plays once more from 880–1520 ms at the same speed. Only the ping repeats; the plate does not flash again.
- 2800–3000 ms: the plate wipes to grey from right to left, in 80 ms steps: the rightmost 8 cells at 2800 ms, 16 at 2880 ms, then all of it at 2960 ms. At `outputPad` 0 the shorter plate wipes in the same proportions.

The marker then settles as a `#555555` grey plate with white (`#ffffff`) lettering. Only the plate has a filled background. The gap, bars and the rest of the row use the terminal's default background, preserving its transparency. On light themes, transparent acid lettering and bars use Pi's accent color for legibility. Pi converts those colors for truecolor or 256-color terminals and does not change your theme or footer. The label starts on Pi's configured `outputPad` column (0 or 1), aligned with the native abort notice. The row is always one row and is clipped, never wrapped, on narrow terminals. The animation never blocks streaming, input or focus; it redraws every 40 ms for those three seconds and runs no timers once settled. It also stops early at a new `Esc` press, session shutdown, reload or session switch. The marker stays in transcript history and scrolls upward naturally with new text and tool actions. Saved-session markers render settled without replaying the animation. This feedback is excluded from model context: ordinary starts and failed preflight do not show it, and Pi's native “Operation aborted” notice remains unchanged.

## Accessibility and platform behavior

The readable label, persistent history, native abort notice and explicit attachment warning carry meaning independently of color or animation. The extension adds no focusable control. There is no accessibility certification or real-terminal color-fidelity claim.

- **Physical Escape only:** the extension listens for Escape presses. Kitty key releases never act; held-key repeats are consumed only when the initiating press belonged to this extension, including during restart and animation. A fresh press still recovers failed preflight or interrupts again; no-queue/native presses and their repeats remain native. Legacy terminals cannot distinguish held-key repeats from fresh presses. Remapping `app.interrupt` does not remap this extension.
- **Reduced motion:** Pi has no reduced-motion setting, so the marker always plays its three-second animation, including two full-plate flashes in its first 160 ms. The animation is short and stops on its own.

## UI states

| State | What the user sees or can do |
| --- | --- |
| No submitted queue, including an unsent draft alone | Native Escape behavior; no continuation marker |
| Abort settling | No marker yet; another press is consumed without another abort |
| Continuation preflight | No marker until `agent_start`; a fresh Escape restores captured text to the editor |
| Confirmed continuation | The marker plays in history while normal streaming and input continue |
| Settled, stopped early, or saved-session marker | The completed record plate remains in history |
| Observed queued attachment | Native Escape behavior instead of lossy replay |
| Attachment submitted during abort settlement | Warning that it was not queued; its text returns to the editor; the earlier text batch continues |
| Non-TUI session | No terminal Escape listener or live marker widget |

Slow preflight can still start after recovery; check the transcript before resubmitting restored text. The engineering limits are in [architecture](architecture.md#evolution-and-known-limits).

## Verification and open questions

Automated frame, width, color, input and persistence coverage is documented once in [Contributing](../CONTRIBUTING.md#test-coverage), with [verification records](../CONTRIBUTING.md#verification-records). Interactive Pi/Herdr verification has not run for this move. Real-terminal timing, glyph appearance and subjective readability remain unverified here.

A motion-off control is not implemented. Revisit that accessibility gap if a host reduced-motion signal or an approved extension control is required; do not imply the bounded animation already satisfies motion-off guidance.
