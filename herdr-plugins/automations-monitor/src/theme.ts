// Every color the monitor draws, by meaning. Values are design-system colors or mixes of them over the
// black field; no color value is written here. Roles and states: ../docs/design.md#color.
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
import { mixOver } from '@industrial-os/design-system/foundation/signal-colors';
import { INDUSTRIALOS_COLORS } from '@industrial-os/design-system/foundation/industrialos-colors';
import { LAMP_BLINK } from '@industrial-os/design-system/elements/lamp';

export type Color = `#${string}`;

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
  // Mixes of white or acid over the field, for rules, history bars, hatching and selection.
  faint: mixOver('primary', 0.14),
  base: mixOver('primary', 0.2),
  hatch: mixOver('primary', 0.24),
  selection: mixOver('primary', 0.1),
  chip: mixOver('primary', 0.16),
  accentDim: mixOver('accent', 0.45),
} satisfies Record<string, Color>);

const ios = (id: string): Color => {
  const c = INDUSTRIALOS_COLORS.find((x) => x.id === id);
  if (!c) throw new Error(`design system has no IndustrialOS color ${id}`);
  return c.hex.toLowerCase() as Color;
};

// The seven pipeline category colors, IndustrialOS collection fills, each with the field or primary ink
// that reads on it. A pipeline's color is CATEGORIES[index % 7], where index is its place in name order.
export const CATEGORIES: ReadonlyArray<Readonly<{ fill: Color; ink: Color }>> = Object.freeze([
  { fill: ios('pale-blue'), ink: T.field },
  { fill: ios('magenta'), ink: T.field },
  { fill: ios('mint'), ink: T.field },
  { fill: ios('lavender'), ink: T.field },
  { fill: ios('yellow'), ink: T.field },
  { fill: ios('steel-blue'), ink: T.primary },
  { fill: ios('violet'), ink: T.primary },
]);

export type Tone = 'live' | 'crit' | 'warn' | 'idle' | 'off' | 'ok';

// A state's text ink and its solid cell color. Color always means state; words and shapes carry it too.
export const ink = (tone: Tone): Color =>
  ({ live: T.primary, crit: T.critical, warn: T.warning, idle: T.decorative, off: T.decorative, ok: T.secondary })[tone];
export const cell = (tone: Tone): Color =>
  ({ live: T.accent, crit: T.critical, warn: T.warning, idle: T.structural, off: T.faint, ok: T.structural })[tone];
// Chip fill and the ink on it.
export const chip = (tone: Tone): readonly [Color, Color] =>
  ({
    live: [T.field, T.accent],
    crit: [T.primary, T.critical],
    warn: [T.field, T.warning],
    off: [T.primary, T.structural],
    idle: [T.secondary, T.chip],
    ok: [T.secondary, T.chip],
  } as const)[tone];

// The working-lamp cadence from the design system: lit 500 ms, dim 300 ms. Motion off holds it lit.
const LAMP_PERIOD_MS = LAMP_BLINK.onMs + LAMP_BLINK.offMs;
export const lampOn = (t: number, motion: boolean): boolean => !motion || t % LAMP_PERIOD_MS < LAMP_BLINK.onMs;
// Milliseconds from motion time `t` to the lamp's next change.
export const toLampEdge = (t: number): number => {
  const phase = t % LAMP_PERIOD_MS;
  return phase < LAMP_BLINK.onMs ? LAMP_BLINK.onMs - phase : LAMP_PERIOD_MS - phase;
};
