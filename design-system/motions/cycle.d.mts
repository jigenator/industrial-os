import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface CycleOptions extends MotionOptions { glyphs?: readonly string[]; step?: number; region?: Region; }
export const CYCLE_DEFAULTS: Readonly<CycleOptions>;
export function cycle(lines: Line[], options?: CycleOptions): Line[];
