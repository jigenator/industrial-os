import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions } from './flash.mjs';
export interface DrawInOptions extends MotionOptions { tick?: number; cells?: number; lag?: number }
export const DRAW_IN_DEFAULTS: Readonly<{ tick: 50; cells: 3; lag: 50 }>;
export function drawInDuration(lines: Line[], options?: DrawInOptions): number;
export function drawIn(lines: Line[], options?: DrawInOptions): Line[];
