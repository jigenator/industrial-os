import type { Line, Measure } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface CalloutEntranceOptions extends MotionOptions { mode?: 'plot-in' | 'register'; gutter?: Region; textRegion?: Region; readoutRegion?: Region; measure?: Measure; color?: boolean }
export const CALLOUT_ENTRANCE_DEFAULTS: Readonly<CalloutEntranceOptions>;
export function calloutEntranceDuration(lines: Line[], options?: CalloutEntranceOptions): number;
export function calloutEntrance(lines: Line[], options?: CalloutEntranceOptions): Line[];
