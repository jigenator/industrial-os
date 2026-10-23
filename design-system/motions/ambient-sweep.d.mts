import type { Line } from '../foundation/cells.mjs';
export interface AmbientSweepOptions { time?: number; animate?: boolean; region?: {top?: number; left?: number; rows?: number; cols?: number}; period?: number; run?: number }
export const AMBIENT_SWEEP_DEFAULTS: Readonly<AmbientSweepOptions>;
export function ambientSweep(lines: Line[], options?: AmbientSweepOptions): Line[];
