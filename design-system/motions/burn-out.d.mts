import type { Color, Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface BurnOutOptions extends MotionOptions { lit?: Color; mid?: Color; used?: Color; times?: readonly number[]; region?: Region; }
export const BURN_OUT_DEFAULTS: Readonly<BurnOutOptions>;
export function burnOut(lines: Line[], options?: BurnOutOptions): Line[];
export const BURN_OUT_PRESETS: Readonly<Record<'gpt' | 'cld' | 'kmi', Readonly<BurnOutOptions>>>;
export function burnOutDuration(options?: BurnOutOptions): number;
