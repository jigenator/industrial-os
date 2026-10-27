import { SIGNAL_COLORS, mixOver } from './signal-colors.mjs';
import { SURFACE_PALETTE } from './surface-palette.mjs';
// Semantic dashboard aliases, not new hues or near-duplicate palette values. Bone and edge are the survey palette's.
export const DASHBOARD_INKS = Object.freeze({
  bone: SURFACE_PALETTE.bone,
  dim: mixOver(SURFACE_PALETTE.bone, 0.74),
  muted: SIGNAL_COLORS.checkMid,
  rule: SIGNAL_COLORS.ghost,
  edge: SURFACE_PALETTE.rule,
});
