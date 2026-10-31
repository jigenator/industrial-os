import type { Line } from '../../foundation/cells.mjs';
export interface UnitPlateInput {
  maker?: string; registered?: boolean;
  /** Pixel text: `FONT`, `HEX_FONT` and `LETTER_FONT` characters, such as `DRD-C0DE`; a `?` is an unknown digit. */
  unit: string; serial: string;
  title?: string; mark?: string | null; division?: readonly [string, string];
  /** Seeds the barcode. */
  seed?: number;
}
/** The cells `[start, end)` of `lines[row]` the peak's paint covers, for a motion's `paint` option. */
export interface UnitPlatePaint { row: number; start: number; end: number }
export const UNIT_PLATE_ROWS: 6;
export function unitPlate(input: UnitPlateInput, options: { width: number; titleBlock?: boolean }): { lines: Line[]; paint: UnitPlatePaint[] };
