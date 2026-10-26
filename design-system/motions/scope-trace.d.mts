import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface BlipPass { readonly index: number; readonly kind: 'walk' | 'hop' | 'flicker'; readonly dir: number; readonly start: number; readonly cells: readonly number[]; readonly key: string; readonly jitter: number }
export interface ScopeTraceOptions extends MotionOptions { mode?: 'carrier' | 'noise' | 'reacquire'; index?: number; previousKey?: string; region?: Region; stateCells?: boolean }
export const SCOPE_TRACE_DEFAULTS: Readonly<ScopeTraceOptions>;
export function blipPass(index: number, previousKey?: string): BlipPass;
export function blipRest(pass: BlipPass, everyMs: number): number;
export function scopeTraceDuration(options?: ScopeTraceOptions): number | null;
export function scopeTrace(lines: Line[], options?: ScopeTraceOptions): Line[];
