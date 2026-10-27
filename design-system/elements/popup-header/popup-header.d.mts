import type { Color, Ellipsis, Line, TextValue, Measure, Style } from '../../foundation/cells.mjs';
export interface PopupOptions { width: number; measure?: Measure }
export interface HeaderInput<T = string> { plate: T; title?: T; meta?: T; style?: Style }
export interface FooterInput<T = string> { escape?: T; meta?: T }
export function popupHeader(input: HeaderInput, options: PopupOptions): Line;
export function popupHeader(input: HeaderInput<TextValue>, options: PopupOptions & { measure: Measure }): Line;
export function popupFooter(input: FooterInput, options: PopupOptions): Line;
export function popupFooter(input: FooterInput<TextValue>, options: PopupOptions & { measure: Measure }): Line;
export function popupFrame(input: { height: number }, options: { width: number }): Line[];
export interface PopupTitleBarInput { mark?: Color; band?: { fill: Color; ink: Color }; title: string; word?: string; wordInk?: Color; detail?: string; meta?: string }
export function popupTitleBar(input: PopupTitleBarInput, options: { width: number; measure?: Measure; ellipsis?: Ellipsis }): Line;
export const POPUP_BACKDROP: 0.25;
export function popupBackdrop(style: { fg?: Color; bg?: Color; bold?: boolean }): { fg: `#${string}`; bg: `#${string}`; bold: false };
