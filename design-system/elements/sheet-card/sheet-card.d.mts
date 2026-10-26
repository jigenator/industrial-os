import type { Color, Line, Measure, Style, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export type SheetState = 'unread' | 'read' | 'waiting' | 'answered' | 'declined' | 'delivery-waiting';
export const SHEET_STATES: Readonly<Record<SheetState, Readonly<{ code: string; shape: string; tone: Color }>>>;
export interface StateInput<T = string> { state?: SheetState; answer?: T }
export interface HeadingInput<T = string> extends StateInput<T> { number?: T; time?: T }
export interface SheetInput<T = string> { heading?: HeadingInput<T>; kind?: 'info' | 'question'; title?: T; gist?: readonly T[]; footer?: T; read?: boolean; hover?: boolean; button?: T }
export interface RowInput<T = string> extends StateInput<T> { label?: T; title?: T; selected?: boolean; hover?: boolean; last?: boolean; updated?: T }
export interface StackInput<T = string> { heading?: T; rows?: readonly RowInput<T>[] }
export function cardState(input?: StateInput<string>, options?: { maxWidth?: number; measure?: Measure }): Line;
export function cardState(input: StateInput<TextValue>, options: { maxWidth?: number; measure: Measure }): Line;
export function cardHeading(input: HeadingInput<string>, options: Options): Line;
export function cardHeading(input: HeadingInput<TextValue>, options: MeasuredOptions): Line;
export function sheetCard(input: SheetInput<string>, options: Options): Line[];
export function sheetCard(input: SheetInput<TextValue>, options: MeasuredOptions): Line[];
export function stackRow(input: RowInput<string>, options: Options): Line;
export function stackRow(input: RowInput<TextValue>, options: MeasuredOptions): Line;
export function sheetListRow(input: RowInput<string>, options: Options): Line;
export function sheetListRow(input: RowInput<TextValue>, options: MeasuredOptions): Line;
export function stackCard(input: StackInput<string>, options: Options): Line[];
export function stackCard(input: StackInput<TextValue>, options: MeasuredOptions): Line[];
