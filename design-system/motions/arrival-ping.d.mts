import type { Line } from '../foundation/cells.mjs';
export interface ArrivalPingOptions { time?: number; animate?: boolean; region?: {top?: number; left?: number; rows?: number; cols?: number}; duration?: number; x?: number; y?: number; radius?: number }
export const ARRIVAL_PING_DEFAULTS: Readonly<ArrivalPingOptions>;
export function arrivalPing(lines: Line[], options?: ArrivalPingOptions): Line[];
export function arrivalPingDuration(options?: ArrivalPingOptions): number;
