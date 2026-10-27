import type { Color, Line } from '../../foundation/cells.mjs';
export type NumeralTone = 'ok' | 'warn' | 'high' | 'unknown';
export interface NumeralGrid { w: number; g: (Color | null)[][] }
export const FONT: Readonly<Record<string, readonly string[]>>;
export const HEX_FONT: Readonly<Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', readonly string[]>>;
export const NUMERAL_TONES: Readonly<Record<NumeralTone, Color>>;
export function numeralGrid(value?: number | null, options?: { tone?: NumeralTone }): NumeralGrid | undefined;
export const DASHBOARD_FONT: Readonly<Record<string, readonly string[]>>;
export function textGrid(text: string, options?: { ink?: Color; face?: 'instrument' | 'dashboard' }): NumeralGrid;
export function numeralAt(target: NumeralGrid, from: NumeralGrid, progress: number, seed: number): NumeralGrid;
export function numeralLines(grid: NumeralGrid, options: { width: number }): Line[];
export function pixelNumeral(input: { value?: number | null; tone?: NumeralTone }, options: { width: number }): Line[];
