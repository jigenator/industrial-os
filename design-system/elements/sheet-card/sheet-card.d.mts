import type { Color, Line, Measure, Span, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface ListOptions extends Options { columns?: { state?: number; updated?: number } }
export interface MeasuredListOptions extends ListOptions { measure: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export type SheetState = 'unread' | 'read' | 'waiting' | 'answered' | 'declined' | 'delivery-waiting' | 'withdrawn';
export interface SheetPresetEntry<T = string> { code: T; shape: string; tone: Color; hoverTone?: Color; headingTone?: Color; bold?: boolean; frameTone?: Color }
export type SheetPreset<T = string> = Readonly<Record<string, Readonly<SheetPresetEntry<T>>>>;
export const SHEET_STATES: Readonly<Record<SheetState, Readonly<{ code: string; shape: string; tone: Color }>>>;
export interface CardOptions<T = string> extends Options { preset?: SheetPreset<T> }
export interface MeasuredCardOptions extends CardOptions<TextValue> { measure: Measure }
export interface StateOptions<T = string> { maxWidth?: number; measure?: Measure; preset?: SheetPreset<T> }
export interface MeasuredStateOptions extends StateOptions<TextValue> { measure: Measure }
export interface StateInput<T = string, S extends string = SheetState> { state?: S; answer?: T }
export interface HeadingInput<T = string> extends StateInput<T, string> { mark?: string; kind?: T; number?: T; time?: T }
export interface SheetInput<T = string> { heading?: HeadingInput<T>; kind?: 'info' | 'question'; title?: T; gist?: readonly T[]; footer?: T | null; read?: boolean; hover?: boolean; button?: T | null; readouts?: readonly Span[] }
export interface RowInput<T = string> extends StateInput<T> { label?: T; title?: T; selected?: boolean; hover?: boolean; last?: boolean; updated?: T }
export interface StackInput<T = string> { heading?: T; rows?: readonly RowInput<T>[] }
export function cardState(input?: StateInput<string, string>, options?: StateOptions): Line;
export function cardState(input: StateInput<TextValue, string>, options: MeasuredStateOptions): Line;
export function cardHeading(input: HeadingInput<string>, options: CardOptions): Line;
export function cardHeading(input: HeadingInput<TextValue>, options: MeasuredCardOptions): Line;
export function sheetCard(input: SheetInput<string>, options: CardOptions): Line[];
export function sheetCard(input: SheetInput<TextValue>, options: MeasuredCardOptions): Line[];
export function stackRow(input: RowInput<string>, options: Options): Line;
export function stackRow(input: RowInput<TextValue>, options: MeasuredOptions): Line;
export function sheetListRow(input: RowInput<string>, options: ListOptions): Line;
export function sheetListRow(input: RowInput<TextValue>, options: MeasuredListOptions): Line;
export function stackCard(input: StackInput<string>, options: Options): Line[];
export function stackCard(input: StackInput<TextValue>, options: MeasuredOptions): Line[];
