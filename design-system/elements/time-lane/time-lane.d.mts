import type { Color, Line, Measure, Span, Style } from '../../foundation/cells.mjs';
import type { RunOutcome } from '../board-marks/board-marks.mjs';
export interface LaneAxisInput { past: number; future: number }
export interface LanePiece { at: number; line: Line }
export function laneScale(input: LaneAxisInput, options: { width: number }): { col: (dt: number) => number; now: number };
export function laneAxis(input: LaneAxisInput, options: { width: number }): { ruler: Line; labels: LanePiece[] };
export function laneTrack(input: { now: number; since?: number | null; after?: 'dashed' | 'hatched' }, options: { width: number; origin?: number }): Line;
export interface LaneRunInput {
  from: number; to: number; verified?: number | null; verifying?: boolean; live?: boolean; outcome?: RunOutcome;
  label?: string; fill?: Color; ink?: Color; head?: boolean; lit?: boolean;
}
export function laneRun(run: LaneRunInput, options: { width: number; measure?: Measure }): { pieces: LanePiece[]; span: [number, number] | null } | null;
export function crossNow(cell: { text: string; style?: Style }, options?: { quiet?: boolean }): Span | null;
