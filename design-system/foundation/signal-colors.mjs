// Signal colors: the source of the product colors the Pi extensions use beside the nine Acid / Black roles, and of
// the Herdr chrome colors.
// status-bar's `C` palette (../../pi/status-bar/src/footer.ts) mirrors every SIGNAL_COLORS value here until it imports them, as
// it mirrors palette.mjs for the roles. Contract: README.md#signal-colors.
import { ACID_BLACK } from './palette.mjs';
import { resolveColor } from './cells.mjs';

export const SIGNAL_COLORS = Object.freeze({
  // Count tiers and mode inks (status-bar CMP, USG plate and PNYTL).
  violet: '#5200ff', // C.violet: CMP 1-2, PNYTL FUL
  pink: '#ff15bd', // C.pink: CMP 3-4, USG plate, PNYTL activity light
  cobalt: '#004fe8', // C.cobalt: PNYTL LTE
  magenta: '#c00092', // C.magenta: PNYTL ULT
  teal: '#006e70', // C.teal: PNYTL REV
  // Gauge zone tracks, 20% of the state color over the field.
  warningZone: '#2b2010', // C.wz
  criticalZone: '#300e07', // C.hz
  // A lost segment at rest, the same grey for every provider.
  ghost: '#333333', // C.usageGhost
  // Checking fade, decorative grey lightening in four steps (C.checkLow..checkPeak).
  checkLow: '#7b7b7b',
  checkMid: '#868686',
  checkHigh: '#919191',
  checkPeak: '#9c9c9c',
  // Warm-up steps: 25/50/75% of a state color over the field (C.primary25.., C.warn25.., C.high25.., C.graphic50).
  accent25: '#304001',
  accent50: '#607f02',
  accent75: '#90be03',
  warning25: '#362814',
  warning50: '#6c4f29', // C.warnDim, also the attention beacon's dim ink
  warning75: '#a1763e',
  critical25: '#3c1209',
  critical50: '#792412',
  critical75: '#b6351a',
  decorative50: '#383838',
  // Usage providers: lit, used (20% over the field) and burn-out mid (50%).
  gpt: '#ffffff',
  gptUsed: '#333333',
  gptMid: '#808080',
  cld: '#ff5c00',
  cldUsed: '#331200',
  cldMid: '#802e00',
  kmi: '#2555fc',
  kmiUsed: '#071132',
  kmiMid: '#132b7e',
});

// Herdr chrome colors: product colors herdr/theme.toml restates, kept apart from SIGNAL_COLORS because status-bar
// maps every SIGNAL_COLORS value to a footer alias and does not use these. Contract: README.md#herdr-chrome-colors.
export const HERDR_CHROME = Object.freeze({
  // The Marathon signal orange: theme.custom overlay1. The same value as SIGNAL_COLORS.cld, a separate role.
  signalOrange: '#ff5c00',
  // mixOver(signalOrange, 0.3), 30% over the field: theme.custom surface1.
  signalOrange30: '#4d1c00',
});

// Mixes declared as signal colors, matching status-bar's current computed values. The extension computed some of
// them with a different tie rule, so mixOver returns these exactly rather than recomputing them.
const MIRRORED_MIXES = [
  ['accent', 0.25, 'accent25'], ['accent', 0.5, 'accent50'], ['accent', 0.75, 'accent75'],
  ['warning', 0.2, 'warningZone'], ['warning', 0.25, 'warning25'], ['warning', 0.5, 'warning50'], ['warning', 0.75, 'warning75'],
  ['critical', 0.2, 'criticalZone'], ['critical', 0.25, 'critical25'], ['critical', 0.5, 'critical50'], ['critical', 0.75, 'critical75'],
  ['decorative', 0.5, 'decorative50'],
  ['gpt', 0.2, 'gptUsed'], ['gpt', 0.5, 'gptMid'],
  ['cld', 0.2, 'cldUsed'], ['cld', 0.5, 'cldMid'],
  ['kmi', 0.2, 'kmiUsed'], ['kmi', 0.5, 'kmiMid'],
];
const hexOf = (name) => (Object.hasOwn(ACID_BLACK, name) ? ACID_BLACK[name] : SIGNAL_COLORS[name]);
const MIRRORED = new Map(MIRRORED_MIXES.map(([base, proportion, name]) => [`${hexOf(base)}@${proportion}`, SIGNAL_COLORS[name]]));

// `proportion` of a color over the black field: each 8-bit sRGB channel times proportion, rounded to nearest with
// ties up. Accepts an Acid / Black role or exact #RRGGBB; returns lowercase #rrggbb. Declared mixes win.
export function mixOver(color, proportion) {
  const hex = resolveColor(color).toLowerCase();
  if (typeof proportion !== 'number' || !Number.isFinite(proportion) || proportion < 0 || proportion > 1) {
    throw new RangeError(`mix proportion must be a number from 0 to 1, got ${proportion}`);
  }
  const mirrored = MIRRORED.get(`${hex}@${proportion}`);
  if (mirrored) return mirrored;
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * proportion).toString(16).padStart(2, '0')).join('');
}
