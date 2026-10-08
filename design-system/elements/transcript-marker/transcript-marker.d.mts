import type { Color, Line, Style } from '../../foundation/cells.mjs';
export type MarkerPlateState = 'live' | 'outline' | 'record';
export type MarkerBarState = 'lit' | 'ghost' | 'off';
export const MARKER_LABEL: 'DIRECTIVE UPDATED';
export const MARKER_BAR_OFFSETS: readonly number[];
export const MARKER_SPAN: 16;
export const MARKER_PLATES: Readonly<Record<MarkerPlateState, Readonly<Style>>>;
export const MARKER_BARS: Readonly<Record<MarkerBarState, Readonly<{ char: string; style: Readonly<Style> }>>>;
export const MARKER_TIMELINE: Readonly<{
  plateStep: 80; barFrame: 40; flashOff: 80; flashOn: 160; pingLaunch: 160; pingStagger: 40;
  ghostAt: 440; ghostFor: 120; pingRepeatAfter: 720; settleWipe: 2800; window: 3000;
}>;
export function markerPlate(state?: MarkerPlateState, options?: { outputPad?: 0 | 1; background?: Color }): Line;
export function markerBars(bars?: MarkerBarState | readonly MarkerBarState[], options?: { background?: Color }): Line;
export function transcriptMarker(input?: {
  plate?: MarkerPlateState; bars?: MarkerBarState | readonly MarkerBarState[]; outputPad?: 0 | 1;
  background?: Color; padToWidth?: boolean;
}, options?: { width: number }): Line[];
