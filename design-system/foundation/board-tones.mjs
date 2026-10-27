// The board's state tones: for each state, its text ink, its one-cell state color and its chip style. State colors are
// role names so motions recognise warning and critical cells; quiet cells use the board's white mixes. Contract: README.md.
import { INDUSTRIALOS_COLORS } from './industrialos-colors.mjs';
import { BOARD_INKS } from './signal-colors.mjs';

const tone = (ink, cell, fg, bg) => Object.freeze({ ink, cell, chip: Object.freeze({ fg, bg }) });

export const BOARD_TONES = Object.freeze({
  live: tone('primary', 'accent', 'field', 'accent'),
  crit: tone('critical', 'critical', 'primary', 'critical'),
  warn: tone('warning', 'warning', 'field', 'warning'),
  idle: tone('decorative', 'structural', 'secondary', BOARD_INKS.chip),
  off: tone('decorative', BOARD_INKS.faint, 'primary', 'structural'),
  ok: tone('secondary', 'structural', 'secondary', BOARD_INKS.chip),
});

export function boardTone(name) {
  if (typeof name !== 'string' || !Object.hasOwn(BOARD_TONES, name)) throw new RangeError(`unknown board tone: ${String(name)}`);
  return BOARD_TONES[name];
}

// Seven IndustrialOS fills for categories such as pipelines, in this order, each with the ink that reads on it.
const category = (id, ink) => Object.freeze({ id, fill: INDUSTRIALOS_COLORS.find((c) => c.id === id).hex.toLowerCase(), ink });
export const CATEGORY_TONES = Object.freeze([
  category('pale-blue', 'field'), category('magenta', 'field'), category('mint', 'field'), category('lavender', 'field'),
  category('yellow', 'field'), category('steel-blue', 'primary'), category('violet', 'primary'),
]);
