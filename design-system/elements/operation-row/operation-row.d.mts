import type { Color, Line, Measure, Style, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export type OperationState = 'running' | 'done' | 'failed' | 'neutral' | 'waiting';
export interface HeadingInput<T = string> { label?: T; code?: T; focused?: boolean; count?: T }
export interface RowInput<T = string> { state?: OperationState; time?: T; category?: T; detail?: T; duration?: T; selected?: boolean; hover?: boolean }
/** Fixed gutter: stripe at 0, marker at 1, gap at 2, time from 3 in every state. */
export interface RowOptions extends Options { columns?: { time?: number; category?: number; duration?: number }; styles?: Partial<Record<'time' | 'category' | 'detail' | 'duration', Style>>; color?: boolean }
export interface DetailInput<T = string> { label?: T; value?: T }
export interface DetailOptions extends Options { labelWidth?: number; style?: Style }
export function operationHeading(input: HeadingInput<string>, options: Options): Line;
export function operationHeading(input: HeadingInput<TextValue>, options: MeasuredOptions): Line;
export function operationRow(input: RowInput<string>, options: RowOptions): Line;
export function operationRow(input: RowInput<TextValue>, options: RowOptions & { measure: Measure }): Line;
export function operationDetail(input: DetailInput<string>, options: DetailOptions): Line;
export function operationDetail(input: DetailInput<TextValue>, options: DetailOptions & { measure: Measure }): Line;
