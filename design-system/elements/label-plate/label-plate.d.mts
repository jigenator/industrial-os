import type { Line, Style, Measure, TextValue } from '../../foundation/cells.mjs';
export type PlateTone = 'accent' | 'neutral' | 'warning' | 'critical' | 'bright';
export const PLATE_TONES: Readonly<Record<PlateTone, Style>>;
export const PLATE_FORMS: readonly ['capped', 'slab'];
export interface LabelPlateOptions { tone?: PlateTone; form?: 'capped' | 'slab'; pad?: boolean; maxWidth?: number; style?: Style; measure?: Measure }
export function labelPlate(text: string, options?: LabelPlateOptions): Line;
export function labelPlate(text: TextValue, options: LabelPlateOptions & { measure: Measure }): Line;
