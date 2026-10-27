import type { Color, Line, TextValue, Measure, Style } from '../../foundation/cells.mjs';
export interface RuleOptions { width: number; measure?: Measure }
export function leader(input?: { glyph?: '┄' | '·' }, options?: { maxWidth?: number }): Line;
export function tabRule(input: { tabCells?: number; focused?: boolean; inks?: { tab?: Color; rule?: Color } }, options: { width: number; lead?: boolean }): Line;
export function verticalRule(input: { ink?: Color }, options: { height: number }): Line[];
export function neatline(input: { label?: string }, options: RuleOptions): Line;
export function neatline(input: { label?: TextValue }, options: RuleOptions & { measure: Measure }): Line;
export interface NameRuleInput<T = string> { plate?: T; label?: T; time?: T; meter?: Line; joins?: number[] }
export function nameRule(input: NameRuleInput, options: RuleOptions): Line;
export function nameRule(input: NameRuleInput<TextValue>, options: RuleOptions & { measure: Measure }): Line;
