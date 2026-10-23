import { PI_CHROME, SIGNAL_COLORS, mixOver } from './signal-colors.mjs';
// Semantic dashboard aliases, not new hues or near-duplicate palette values.
export const DASHBOARD_INKS = Object.freeze({
  bone: PI_CHROME.bone,
  dim: mixOver(PI_CHROME.bone, 0.74),
  muted: SIGNAL_COLORS.checkMid,
  rule: SIGNAL_COLORS.ghost,
  edge: SIGNAL_COLORS.decorative50,
});
