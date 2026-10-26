import type { Line, Style, Measure, TextValue } from '../../foundation/cells.mjs';
export type PlateTone = 'accent' | 'neutral' | 'warning' | 'critical' | 'bright';
export const PLATE_TONES: Readonly<Record<PlateTone, Style>>;
export const PLATE_FORMS: readonly ['capped', 'slab'];
export function labelPlate(text: TextValue, options?: { tone?: PlateTone; form?: 'capped' | 'slab'; pad?: boolean; maxWidth?: number; style?: Style; measure?: Measure }): Line;
