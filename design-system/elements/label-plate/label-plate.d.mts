import type { Line, Style } from '../../foundation/cells.mjs';
export type PlateTone = 'accent' | 'neutral' | 'warning' | 'critical' | 'bright';
export const PLATE_TONES: Readonly<Record<PlateTone, Style>>;
export const PLATE_FORMS: readonly ['capped', 'slab'];
export function labelPlate(text: string, options?: { tone?: PlateTone; form?: 'capped' | 'slab'; pad?: boolean; maxWidth?: number; style?: Style }): Line;
