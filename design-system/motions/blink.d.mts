import type { Line, Style } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface BlinkOptions extends MotionOptions { on?: number; off?: number; offStyle?: Style; offGlyph?: string | null; region?: Region; }
export const BLINK_DEFAULTS: Readonly<BlinkOptions>;
export function blink(lines: Line[], options?: BlinkOptions): Line[];
export const BLINK_PRESETS: Readonly<Record<'lamp' | 'activityLight', Readonly<BlinkOptions>>>;
export function blinkOn(time: number, options?: { on?: number; off?: number }): boolean;
