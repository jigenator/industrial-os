import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface FillInOptions extends MotionOptions { tick?: number; window?: number; region?: Region; }
export const FILL_IN_DEFAULTS: Readonly<FillInOptions>;
export function fillIn(lines: Line[], options?: FillInOptions): Line[];
export function fillInDuration(lines: Line[], options?: FillInOptions): number;
