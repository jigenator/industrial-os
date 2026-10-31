import type { Line, Measure } from '../foundation/cells.mjs';
/** Cells `[start, end)` of line `row`. */
export interface CrtBootCells { row: number; start: number; end: number }
export interface CrtBootOptions {
  time?: number; animate?: boolean; seed?: number;
  /** Decoration painted on the ground, such as a plate's stroke: hidden under the ground to its left until typed, never garbled. */
  paint?: readonly CrtBootCells[];
  /** Texture that is part of the ground, such as floor dots: shown from the start, never garbled or lit. */
  ground?: readonly CrtBootCells[];
  /** Lines from `row` down arrived at `time`: they start typing from then. */
  late?: { row: number; time: number };
  measure?: Measure;
}
export const CRT_BOOT_DEFAULTS: Readonly<CrtBootOptions>;
export const CRT_BOOT_TIMING: Readonly<{
  power: number; ground: number; chunk: number; stagger: number; spread: number; jitter: number; settle: number;
  bar: readonly [number, number]; garble: number; phosphor: number; rowLimit: number;
}>;
export function crtBoot(lines: Line[], options?: CrtBootOptions): Line[];
export function crtBootDuration(lines: Line[], options?: CrtBootOptions): number;
