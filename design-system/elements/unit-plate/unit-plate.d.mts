import type { Line } from '../../foundation/cells.mjs';
export interface UnitPlateInput {
  maker?: string; registered?: boolean;
  /** Pixel text: `FONT`, `HEX_FONT` and `LETTER_FONT` characters, such as `DRD-C0DE`; a `?` is an unknown digit. */
  unit: string; serial: string;
  /** The serial's label in the bottom hairline: 1–8 printable ASCII characters, no spaces. Default `S/N`. */
  serialLabel?: string;
  title?: string; mark?: string | null; division?: readonly [string, string];
  /** Seeds the barcode. */
  seed?: number;
}
/** The cells `[start, end)` of `lines[row]` the peak's paint covers, for a motion's `paint` option. */
export interface UnitPlatePaint { row: number; start: number; end: number }
export interface UnitPlateRegion { top: number; left: number; rows: number; cols: number }
export interface UnitPlateRegions {
  /** The pixel wordmark, with each unit character's first column; null when the unit is drawn as text. */
  wordmark: (UnitPlateRegion & { glyphs: number[] }) | null;
  /** The serial's text in the bottom hairline. */
  serial: UnitPlateRegion;
  /** The title block, and its barcode rows; null when not drawn. */
  block: UnitPlateRegion | null;
  barcode: UnitPlateRegion | null;
}
export interface UnitPlateOptions {
  width: number; titleBlock?: boolean;
  /** The title block's minimum width (0: as wide as its widest line). */
  blockWidth?: number;
  /** Draw the barcode (default true) and the peak (default true). */
  barcode?: boolean; peak?: boolean;
  /** `lit` aluminium (default), or the graphite `standby` and `dark` levels. */
  lighting?: 'lit' | 'standby' | 'dark';
  /** The first column the peak may paint, an integer 0–1000; null (default) centres it between the blocks. */
  peakFrom?: number | null;
}
export const UNIT_PLATE_ROWS: 6;
export function unitPlate(input: UnitPlateInput, options: UnitPlateOptions): { lines: Line[]; paint: UnitPlatePaint[]; regions: UnitPlateRegions };
/** `<prefix>-<code>` when it is pixel text whose wordmark fits whole, else the bare prefix. */
export function fitUnitCode(prefix: string, code: string, options: { width: number; titleBlock?: boolean; blockWidth?: number }): string;
/** A Pi droid's unit, serial and barcode seed from its session ID; null with fewer than twelve hex digits. */
export function sessionUnit(sessionId: string | null | undefined): { unit: `DRD-${string}`; serial: string; seed: number } | null;
