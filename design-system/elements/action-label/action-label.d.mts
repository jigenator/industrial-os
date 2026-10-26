import type { Line, TextValue, Measure, Style } from '../../foundation/cells.mjs';
export interface ActionInput<T = string> { label?: T; kind?: 'open' | 'keycap'; state?: 'ready' | 'read' | 'hover' }
export interface ActionOptions { maxWidth?: number; style?: Style; measure?: Measure }
export function actionLabel(input?: ActionInput, options?: ActionOptions): Line;
export function actionLabel(input: ActionInput<TextValue>, options: ActionOptions & { measure: Measure }): Line;
export function keyHints(tokens: { key?: string; label: string }[], options: { width: number; measure?: Measure }): Line;
export function keyHints(tokens: { key?: TextValue; label: TextValue }[], options: { width: number; measure: Measure }): Line;
