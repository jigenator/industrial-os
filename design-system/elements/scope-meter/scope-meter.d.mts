import type { Line } from '../../foundation/cells.mjs';
export type ScopeState = 'connected' | 'reconnecting' | 'lost';
export function scopeMeter(input?: { state?: ScopeState }, options?: { maxWidth?: number }): Line;
