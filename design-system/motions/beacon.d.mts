import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface BeaconOptions extends MotionOptions { period?: number; step?: number; region?: Region; stateCells?: boolean; programme?: 'up' | 'down'; }
export const BEACON_DEFAULTS: Readonly<BeaconOptions>;
export function beacon(lines: Line[], options?: BeaconOptions): Line[];
