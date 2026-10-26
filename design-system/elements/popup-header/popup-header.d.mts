import type { Line, TextValue, Measure, Style } from '../../foundation/cells.mjs';
export interface PopupOptions { width: number; measure?: Measure }
export interface HeaderInput<T = string> { plate: T; title?: T; meta?: T; style?: Style }
export interface FooterInput<T = string> { escape?: T; meta?: T }
export function popupHeader(input: HeaderInput, options: PopupOptions): Line;
export function popupHeader(input: HeaderInput<TextValue>, options: PopupOptions & { measure: Measure }): Line;
export function popupFooter(input: FooterInput, options: PopupOptions): Line;
export function popupFooter(input: FooterInput<TextValue>, options: PopupOptions & { measure: Measure }): Line;
