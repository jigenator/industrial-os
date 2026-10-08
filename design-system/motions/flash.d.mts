import type { Color, Line, Style } from '../foundation/cells.mjs';
export interface MotionOptions { time?: number; animate?: boolean }
export interface Region { top?: number; left?: number; rows?: number; cols?: number }
export type FlashKind = 'fill' | 'outline' | 'invert' | 'white';
export interface FlashOptions extends MotionOptions {
  step?: number; pattern?: readonly FlashKind[]; region?: Region; stateCells?: boolean; outlineBackground?: Color; solidBackground?: boolean; invertStyle?: Style;
}
export const FLASH_DEFAULTS: Readonly<FlashOptions>;
export const FLASH_PRESETS: Readonly<Record<'interrupt' | 'threshold' | 'polarity' | 'tag', Readonly<FlashOptions>>>;
export function flashDuration(options?: FlashOptions): number;
export function flash(lines: Line[], options?: FlashOptions): Line[];
