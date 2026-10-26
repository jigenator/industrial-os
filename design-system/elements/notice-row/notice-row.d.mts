import type { Line, TextValue, Measure, Style } from '../../foundation/cells.mjs';
export interface NoticeInput<T = string> { glyph?: string; plate?: T; text?: T; detail?: T[]; tone?: 'neutral' | 'warning' | 'critical' }
export function noticeRow(input: NoticeInput, options: { width: number; measure?: Measure }): Line[];
export function noticeRow(input: NoticeInput<TextValue>, options: { width: number; measure: Measure }): Line[];
