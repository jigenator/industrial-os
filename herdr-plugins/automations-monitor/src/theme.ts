// Every color the monitor draws, by meaning, all from the design system: the Acid / Black roles, the board's
// white mixes over the field, its state tones and its category fills. No color value is written here.
// Roles and states: ../docs/design.md#color.
import { resolveColor, type Color as DsColor } from '@industrial-os/design-system/foundation/cells';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { BOARD_INKS } from '@industrial-os/design-system/foundation/signal-colors';
import { boardTone, CATEGORY_TONES, type BoardToneName } from '@industrial-os/design-system/foundation/board-tones';
import { LAMP_BLINK } from '@industrial-os/design-system/elements/lamp';

export type Color = `#${string}`;

// The canvas keeps exact colors, so role names resolve once here.
export const hex = (color: DsColor): Color => resolveColor(color);

const P = ACID_BLACK;

export const T = Object.freeze({
  field: P.field,
  primary: P.primary,
  secondary: P.secondary,
  decorative: P.decorative,
  structural: P.structural,
  accent: P.accent,
  warning: P.warning,
  critical: P.critical,
  ...BOARD_INKS,
} satisfies Record<string, Color>);

// The seven pipeline category colors, each with the ink that reads on it. A pipeline's color is
// CATEGORIES[index % 7], where index is its place in name order.
export const CATEGORIES: ReadonlyArray<Readonly<{ fill: Color; ink: Color }>> = Object.freeze(CATEGORY_TONES.map((c) => Object.freeze({ fill: hex(c.fill), ink: hex(c.ink) })));

export type Tone = BoardToneName;

// A state's text ink and its solid cell color. Color always means state; words and shapes carry it too.
export const ink = (tone: Tone): Color => hex(boardTone(tone).ink);
export const cell = (tone: Tone): Color => hex(boardTone(tone).cell);

// The working-lamp cadence from the design system: lit 500 ms, dim 300 ms. Motion off holds it lit.
const LAMP_PERIOD_MS = LAMP_BLINK.onMs + LAMP_BLINK.offMs;
export const lampOn = (t: number, motion: boolean): boolean => !motion || t % LAMP_PERIOD_MS < LAMP_BLINK.onMs;
// Milliseconds from motion time `t` to the lamp's next change.
export const toLampEdge = (t: number): number => {
  const phase = t % LAMP_PERIOD_MS;
  return phase < LAMP_BLINK.onMs ? LAMP_BLINK.onMs - phase : LAMP_PERIOD_MS - phase;
};
