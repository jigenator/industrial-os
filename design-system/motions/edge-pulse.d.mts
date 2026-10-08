import type { Color, Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface EdgePulseOptions extends MotionOptions { fraction?: number; period?: number; step?: number; lit?: Color; used?: Color; region?: Region; }
export const EDGE_PULSE_DEFAULTS: Readonly<EdgePulseOptions>;
export function edgePulse(lines: Line[], options?: EdgePulseOptions): Line[];
