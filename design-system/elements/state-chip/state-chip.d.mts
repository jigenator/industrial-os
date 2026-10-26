import type { Color, Line, Measure, TextValue } from '../../foundation/cells.mjs';
export type TatsuState = 'current' | 'behind' | 'repair' | 'local_changes' | 'missing' | 'not_runnable' | 'unavailable' | 'checking' | 'inactive';
export type StatePreset = Readonly<Record<string, Readonly<{ shape: string; code: string; tone: Color }>>>;
export const TATSU_STATES: Readonly<Record<TatsuState, Readonly<{ shape: string; code: string; tone: Color }>>>;
export type WordPreset = Readonly<Record<string, Readonly<{ shape: string; code: TextValue; tone: Color }>>>;
export interface WordChipInput { label?: TextValue; state: string }
export interface StateChipInput { label: string; state: string; commitsBehind?: number; localChanges?: boolean }
export interface StateChipParts { label: Line; labelGap: Line; shape: Line; stateGap: Line; code: Line }
export function stateChip(input: StateChipInput, options?: { form?: 'chip'; preset?: StatePreset; maxWidth?: number }): Line;
export function stateChip(input: WordChipInput, options: { form: 'word'; preset?: WordPreset; maxWidth?: number; measure?: Measure }): Line;
export function stateChips(inputs: StateChipInput[], options: { width: number; preset?: StatePreset }): Line[];
export function stateChipParts(input: StateChipInput, options?: { preset?: StatePreset; count?: number; countPolicy?: 'safe-integer' | 'number-text' }): StateChipParts;
