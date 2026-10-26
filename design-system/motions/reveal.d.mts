import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions } from './flash.mjs';
export interface RevealOptions extends MotionOptions { duration?: number; stagger?: number; veil?: 'dim' | 'blank' }
export const REVEAL_DEFAULTS: Readonly<{ duration: 600; stagger: 60; veil: 'dim' }>;
export function revealDuration(lineCount: number, options?: RevealOptions): number;
export function reveal(lines: Line[], options?: RevealOptions): Line[];
