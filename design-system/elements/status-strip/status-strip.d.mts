import type { Line } from '../../foundation/cells.mjs';
import type { BayKey, BayKeyCells } from '../action-label/action-label.mjs';
export type StripSegment =
  | { kind: 'status'; glyph: string; word: string; tone: 'accent' | 'primary' | 'ready'; drop?: number }
  | { kind: 'chip'; glyph: string; word: string; drop?: number }
  | { kind: 'hint'; key: string; action: string; drop?: number }
  | { kind: 'field'; label: string; value: string; drop?: number }
  | { kind: 'text'; text: string; clip?: boolean; drop?: number }
  | { kind: 'clock'; text: string; drop?: number };
export const STRIP_FROST: Readonly<{ top: number; drop: number; edge: number }>;
export const STRIP_SPACING: readonly (readonly [number, number])[];
export function frostAt(x: number, width: number): `#${string}`;
export function statusStrip(segments: readonly StripSegment[], options: { width: number; keys?: readonly BayKey[]; lighting?: 'lit' | 'standby' | 'dark'; hover?: number | null; pressed?: number | null }): {
  line: Line; keys: BayKeyCells[]; status: { col: number; len: number } | null; shown: number[]; dropped: number; gap: number; clear: number;
};
export function hintSegments(hints: readonly (readonly [string, string])[]): StripSegment[];
