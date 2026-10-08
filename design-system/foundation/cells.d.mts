import type { PaletteRole } from './palette.mjs';
/** RGB strings are checked at runtime for exactly six hexadecimal digits. */
export type Color = PaletteRole | `#${string}` | 'default';
export type ResolvedColor = `#${string}` | 'default';
export interface Style { fg?: Color; bg?: Color; bold?: boolean }
export interface Span { text: string; style: Style }
export type Line = Span[];
export const GLYPHS: string;
export function safeText(value: string): string;
export function cells(text: string): number;
export function fit(text: string, n: number): string;
export function span(text: string, style?: Style): Span;
export function lineWidth(line: readonly Span[]): number;
export function fitLine(line: readonly Span[], n: number, padStyle?: Style): Line;
export function blank(n: number): Line;
export function assertCells(n: number, name: string): void;
export function isTerminalDefault(value: unknown): value is 'default';
export function resolveColor(value: Color): `#${string}`;
export function resolveStyle(style?: Style): { fg: ResolvedColor; bg: ResolvedColor; bold: boolean };
export function paint(line: readonly Span[], color: string): string;
