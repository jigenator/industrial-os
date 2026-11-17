import { ACID_BLACK } from './palette.mjs';
import { SIGNAL_COLORS } from './signal-colors.mjs';

// Lunalee's survey-sheet colors (not new Acid / Black roles). Alpha policy for composeSurface fills belongs to its host;
// FROST_ALPHA below is the crate banner's own fixed strip blend, not a compositor default.
export const SURFACE_PALETTE = Object.freeze({
  ...ACID_BLACK,
  plateGrey: '#a8a8a8', rule: '#3a3f46', bone: '#e6e2d3', wheat: '#e3cfa0', wheatHi: '#f4e4bf',
  tint: '#1d1a12', tintHi: '#2b271c', yellow: '#ffd400', selection: '#24282c', hover: '#131313',
  code: '#00e5ff', floor: '#262626', orange: '#ec6a35', answered: '#d5ff60', criticalHover: '#ff694c', declined: '#a1a1a1',
  paperHair: '#dadada', // the crate banner's hairlines on IndustrialOS light-paper
  // The crate banner's labels on its aluminium plate, and its frosted strip's ready lamp, dividers and disabled labels.
  aluminiumLabel: '#4f5257', frostLamp: '#9c9c9c', frostRule: '#868686',
  dots: Object.freeze(['#24252a', '#27282d', '#2a2b30', '#2d2e33']), dotMajor: '#383a3f',
});

// The crate banner's brushed-aluminium plate: each cell's lightness is
// l = base + band·(1 − u²) − fall·t + Σ amplitude·sin(x·streak.x + y·streak.y), its color l plus `channels`, and its
// hairlines that color plus `hair` on each channel. The banner draws it itself; it is not a composeSurface fill.
export const ALUMINIUM_GROUND = Object.freeze({
  base: 214, band: 26, fall: 6,
  streaks: Object.freeze([Object.freeze({ amplitude: 3.2, x: 0.42, y: 2.3 }), Object.freeze({ amplitude: 1.6, x: 1.37, y: 5.1 })]),
  channels: Object.freeze([-3, 0, 4]), hair: -28,
});
// The share of white the crate banner's frosted strip lays over the host's background.
export const FROST_ALPHA = 0.1;

// The unlit plate ground: the aluminium formula re-based dark (graphite), for a plate whose pane does not have the
// keyboard. Two levels: `dark` (unfocused) and `standby` (the pointer over an unfocused plate, half lights). Each takes
// ALUMINIUM_GROUND's streaks scaled by `amp`, its color l plus `channels`, and its hairlines that color plus `hair`
// (lighter, where the aluminium's are darker). Drawn by graphiteAt in surface.mjs.
export const GRAPHITE_GROUND = Object.freeze({
  dark: Object.freeze({ base: 30, band: 8, fall: 2, amp: 0.35, channels: Object.freeze([-1, 0, 2]), hair: 18 }),
  standby: Object.freeze({ base: 44, band: 10, fall: 3, amp: 0.45, channels: Object.freeze([-1, 0, 2]), hair: 22 }),
});

// The plate's lighting levels: a lit plate is the aluminium; `dark` and `standby` draw the same cells on the graphite
// ground with these inks, by role. Every value is an existing Acid / Black or signal color. `strip` null keeps the lit
// frost. Status lamps (an attention status word, the needs-you chip) keep their lit inks at every level.
// word: the pixel wordmark; value: maker, title, serial and other text; label: label grey text; bars: the barcode;
// corner: the hairlines' `+` ends; peak: the acid peak's edges and paint; strip: the status strip's ground;
// key: a hint's key; action: a hint's action, a field label, a clock; detail: plain strip text and field values;
// ready: a status word that is not an attention state (READY).
export const PLATE_LIGHTING = Object.freeze({
  dark: Object.freeze({
    word: ACID_BLACK.decorative, value: SIGNAL_COLORS.checkHigh, label: ACID_BLACK.decorative, bars: ACID_BLACK.structural,
    corner: ACID_BLACK.structural, peak: SIGNAL_COLORS.accent25, strip: ACID_BLACK.surface, key: SIGNAL_COLORS.checkMid,
    action: ACID_BLACK.decorative, detail: SIGNAL_COLORS.checkMid, ready: ACID_BLACK.decorative,
  }),
  standby: Object.freeze({
    word: SIGNAL_COLORS.checkPeak, value: ACID_BLACK.secondary, label: SIGNAL_COLORS.checkMid, bars: ACID_BLACK.decorative,
    corner: ACID_BLACK.decorative, peak: SIGNAL_COLORS.accent50, strip: null, key: ACID_BLACK.secondary,
    action: SIGNAL_COLORS.checkMid, detail: ACID_BLACK.secondary, ready: SIGNAL_COLORS.checkMid,
  }),
});

// The keycap bay's inks per lighting level, and its pointer states. A key's edge is carried by the bay's ground,
// never by a glyph's ink. Hover and pressed fill one key's cells.
export const BAY_INKS = Object.freeze({
  lit: Object.freeze({ ground: ACID_BLACK.structural, bracket: SIGNAL_COLORS.checkHigh, glyph: ACID_BLACK.primary }),
  standby: Object.freeze({ ground: SIGNAL_COLORS.decorative50, bracket: ACID_BLACK.decorative, glyph: ACID_BLACK.secondary }),
  dark: Object.freeze({ ground: SIGNAL_COLORS.decorative50, bracket: ACID_BLACK.structural, glyph: SIGNAL_COLORS.checkHigh }),
  hover: Object.freeze({ ground: ACID_BLACK.primary, glyph: ACID_BLACK.field }),
  pressed: Object.freeze({ ground: ACID_BLACK.accent, glyph: ACID_BLACK.field }),
});
