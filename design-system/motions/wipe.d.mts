import type { Line, Style } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface WipeOptions extends MotionOptions {
  direction?: 'ltr' | 'rtl'; times?: readonly number[]; fractions?: readonly number[];
  fromStyle?: Style; region?: Region;
}
export const WIPE_DEFAULTS: Readonly<WipeOptions>;
export function wipeDuration(options?: WipeOptions): number;
export function wipe(lines: Line[], options?: WipeOptions): Line[];
