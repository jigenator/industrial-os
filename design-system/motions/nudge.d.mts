import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface NudgeOptions extends MotionOptions { glyph?: string; period?: number; tick?: number; region?: Region; }
export const NUDGE_DEFAULTS: Readonly<NudgeOptions>;
export function nudge(lines: Line[], options?: NudgeOptions): Line[];
export function nudgeOffset(time: number, options?: { period?: number; tick?: number }): number;
