import type { Color, Line, TextValue, Measure, Style } from '../../foundation/cells.mjs';
export interface NoticeCommand<T = string> { kind: 'command'; text: T; label?: T }
export interface NoticeInput<T = string> { glyph?: string; plate?: T; text?: T; detail?: (T | NoticeCommand<T>)[]; tone?: 'neutral' | 'warning' | 'critical'; plateFirst?: boolean; glyphInk?: Color; plateStyle?: Style }
export function noticeRow(input: NoticeInput, options: { width: number; measure?: Measure }): Line[];
export function noticeRow(input: NoticeInput<TextValue>, options: { width: number; measure: Measure }): Line[];
