import type { Color, Line, Measure, Style, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export interface TimestampInput<T = string> { readout?: T; side?: 'left' | 'right'; cells?: number }
export interface CalloutInput<T = string> { side?: 'left' | 'right'; name?: T; first?: boolean; body?: readonly T[]; readout?: T; reference?: T }
export interface SubtitleInput<T = string> { body?: readonly T[]; marker?: T; ambient?: boolean; aside?: boolean; revealed?: number }
export function timestampLeader(input: TimestampInput<string>, options: Options): Line;
export function timestampLeader(input: TimestampInput<TextValue>, options: MeasuredOptions): Line;
export function callout(input: CalloutInput<string>, options: Options): Line[];
export function callout(input: CalloutInput<TextValue>, options: MeasuredOptions): Line[];
export function subtitle(input: SubtitleInput<string>, options: Options): Line[];
export function subtitle(input: SubtitleInput<TextValue>, options: MeasuredOptions): Line[];
export interface Region { top: number; left: number; rows: number; cols: number }
export interface CalloutGeometry { left: number; right: number; rows: number; textRegion: Region; readoutRegion: Region; timestampRegion: Region; plotGutter: Region; registerGutter: Region }
export function calloutGeometry(input: CalloutInput<string>, options: Options): CalloutGeometry;
export function calloutGeometry(input: CalloutInput<TextValue>, options: MeasuredOptions): CalloutGeometry;
export function subtitleGeometry(input: SubtitleInput<string>, options: Options): { head?: { row: number; col: number } };
export function subtitleGeometry(input: SubtitleInput<TextValue>, options: MeasuredOptions): { head?: { row: number; col: number } };
