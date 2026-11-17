import type { Color, Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export type SerialRollSlot = { kind: 'text'; row: number; col: number; lock: number } | { kind: 'pixel'; row: number; col: number; lock: number; ink?: Color };
export interface SerialRollOptions extends MotionOptions {
  seed?: number; tick?: number; start?: number; step?: number; slots?: readonly SerialRollSlot[];
  /** Three rows of three cells for each hex digit 0–F, for pixel slots. */
  glyphs?: Readonly<Record<string, readonly string[]>>;
  /** Cells shown from these lines until the roll ends. */
  hold?: { region: Region; lines: Line[] };
}
export const SERIAL_ROLL_DEFAULTS: Readonly<{ seed: 0; tick: 40; start: 120; step: 50; slots: readonly never[]; glyphs: undefined; hold: undefined }>;
export function serialRollDuration(options?: SerialRollOptions): number;
export function serialRoll(lines: Line[], options?: SerialRollOptions): Line[];
