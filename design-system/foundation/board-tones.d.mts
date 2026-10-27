import type { Color } from './cells.mjs';
export type BoardToneName = 'live' | 'crit' | 'warn' | 'idle' | 'off' | 'ok';
export interface BoardTone { readonly ink: Color; readonly cell: Color; readonly chip: { readonly fg: Color; readonly bg: Color } }
export const BOARD_TONES: Readonly<Record<BoardToneName, BoardTone>>;
export function boardTone(name: BoardToneName): BoardTone;
export interface CategoryTone { readonly id: string; readonly fill: `#${string}`; readonly ink: Color }
export const CATEGORY_TONES: readonly CategoryTone[];
