import { ACID_BLACK } from './palette.mjs';

// Lunalee's survey-sheet colors (not new Acid / Black roles). Alpha policy belongs to its host.
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
