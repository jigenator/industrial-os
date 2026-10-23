import type { Line } from '../foundation/cells.mjs';
export interface DecodeOptions { time?: number; animate?: boolean; region?: {top?: number; left?: number; rows?: number; cols?: number}; duration?: number; seed?: number; scramble?: boolean }
export const DECODE_DEFAULTS: Readonly<DecodeOptions>;
export function decode(lines: Line[], options?: DecodeOptions): Line[];
export function decodeDuration(options?: DecodeOptions): number;
