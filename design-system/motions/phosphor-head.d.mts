import type { Line, Measure } from '../foundation/cells.mjs';
import type { MotionOptions } from './flash.mjs';
export interface PhosphorHeadOptions extends MotionOptions { head?: { row: number; col: number }; measure?: Measure; color?: boolean }
export const PHOSPHOR_HEAD_DEFAULTS: Readonly<PhosphorHeadOptions>;
export function phosphorHead(lines: Line[], options?: PhosphorHeadOptions): Line[];
