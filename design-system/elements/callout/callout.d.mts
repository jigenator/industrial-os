import type { Color, Line, Measure, Style, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export interface TimestampInput<T = string> { readout?: T; side?: 'left' | 'right'; cells?: number }
export interface CalloutInput<T = string> { side?: 'left' | 'right'; name?: T; first?: boolean; body?: readonly T[]; readout?: T; reference?: T }
export interface SubtitleInput<T = string> { body?: readonly T[]; marker?: T; ambient?: boolean; aside?: boolean }
export function timestampLeader(input: TimestampInput<string>, options: Options): Line;
export function timestampLeader(input: TimestampInput<TextValue>, options: MeasuredOptions): Line;
export function callout(input: CalloutInput<string>, options: Options): Line[];
export function callout(input: CalloutInput<TextValue>, options: MeasuredOptions): Line[];
export function subtitle(input: SubtitleInput<string>, options: Options): Line[];
export function subtitle(input: SubtitleInput<TextValue>, options: MeasuredOptions): Line[];
