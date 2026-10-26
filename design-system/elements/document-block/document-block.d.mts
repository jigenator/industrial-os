import type { Color, Line, Measure, Style, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export interface HeadingInput<T = string> { text?: T; level?: 1 | 2 | 3 | 4 | 5 | 6 }
export interface ListInput<T = string> { body?: T; marker?: T; checked?: boolean; indent?: number }
export interface QuoteInput<T = string> { body?: readonly T[] }
export interface LinkInput<T = string> { label?: T; url?: T }
export interface CodeInput<T = string> { language?: T; body?: readonly T[] }
export interface TableInput<T = string> { headings: readonly T[]; rows?: readonly (readonly T[])[]; align?: readonly ('left' | 'right' | 'center')[] }
export function documentHeading(input: HeadingInput<string>, options: Options): Line[];
export function documentHeading(input: HeadingInput<TextValue>, options: MeasuredOptions): Line[];
export function listRow(input: ListInput<string>, options: Options): Line;
export function listRow(input: ListInput<TextValue>, options: MeasuredOptions): Line;
export function quoteRows(input: QuoteInput<string>, options: Options): Line[];
export function quoteRows(input: QuoteInput<TextValue>, options: MeasuredOptions): Line[];
export function linkLines(input: LinkInput<string>, options: Options): Line[];
export function linkLines(input: LinkInput<TextValue>, options: MeasuredOptions): Line[];
export function codeBand(input: CodeInput<string>, options: Options): Line[];
export function codeBand(input: CodeInput<TextValue>, options: MeasuredOptions): Line[];
export function specTable(input: TableInput<string>, options: Options): Line[];
export function specTable(input: TableInput<TextValue>, options: MeasuredOptions): Line[];
export function inlineCode(value: string, options?: { maxWidth?: number; measure?: Measure }): Line;
export function inlineCode(value: TextValue, options: { maxWidth?: number; measure: Measure }): Line;
