import type { Line, Measure } from '../foundation/cells.mjs';
import type { MotionOptions } from './flash.mjs';
export interface CornerSnapOptions extends MotionOptions { measure?:Measure }
export const CORNER_SNAP_DEFAULTS:Readonly<CornerSnapOptions>;
export function cornerSnapSettling():number;
export function cornerSnap(lines:Line[],options?:CornerSnapOptions):Line[];
