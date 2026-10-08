import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface LatchOptions extends MotionOptions { lock?: number; invert?: number; region?: Region; stateCells?: boolean; }
export const LATCH_DEFAULTS: Readonly<LatchOptions>;
export function latch(lines: Line[], options?: LatchOptions): Line[];
export function latchDuration(options?: LatchOptions): number;
