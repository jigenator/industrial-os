import { ACID_BLACK } from './palette.mjs';

// Lunalee's survey-sheet colors (not new Acid / Black roles). Alpha policy belongs to its host.
export const SURFACE_PALETTE = Object.freeze({
  ...ACID_BLACK,
  plateGrey: '#a8a8a8', rule: '#3a3f46', bone: '#e6e2d3', wheat: '#e3cfa0', wheatHi: '#f4e4bf',
  tint: '#1d1a12', tintHi: '#2b271c', yellow: '#ffd400', selection: '#24282c', hover: '#131313',
  code: '#00e5ff', floor: '#262626', orange: '#ec6a35', answered: '#d5ff60', criticalHover: '#ff694c', declined: '#a1a1a1',
  dots: Object.freeze(['#24252a', '#27282d', '#2a2b30', '#2d2e33']), dotMajor: '#383a3f',
});
