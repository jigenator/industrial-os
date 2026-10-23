import type { Line } from '../foundation/cells.mjs';
export interface BreatheOptions { time?: number; animate?: boolean; region?: {top?: number; left?: number; rows?: number; cols?: number}; period?: number }
export const BREATHE_DEFAULTS: Readonly<BreatheOptions>;
export function breathe(lines: Line[], options?: BreatheOptions): Line[];
