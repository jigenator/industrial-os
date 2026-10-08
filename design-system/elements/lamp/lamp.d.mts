import type { Line, Style } from '../../foundation/cells.mjs';
export type LampState = 'working' | 'idle' | 'unknown';
export const LAMP_STATES: Readonly<Record<LampState, Readonly<{ char: string; style: Style }>>>;
export const LAMP_BLINK: Readonly<{ onMs: 500; offMs: 300; tickMs: 50 }>;
export const LAMP_DIM_STYLE: Readonly<Style>;
export function lamp(state: LampState, options?: { appearance?: 'glyph' | 'field' | 'solid'; lit?: boolean }): Line;
