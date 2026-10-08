import type { Line } from '../../foundation/cells.mjs';
export interface RailActivity { working: boolean; units?: number | null }
export const RAIL_MARKS: 6;
export function unitMarks(units?: number | null, options?: { sides?: readonly (0 | 1)[] }): Line;
export function threadRailPieces(activity?: RailActivity | null, options?: { marks?: boolean }): Line[];
export function threadRailSpans(activity?: RailActivity | null, options?: { marks?: boolean }): Line;
export function threadRail(activity: RailActivity | null | undefined, options: { width: number; align?: 'left' | 'right' }): Line[];
