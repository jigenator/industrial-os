import type { Line, Span, Style } from './cells.mjs';
export class CellGrid { constructor(width: number, height: number); width: number; height: number; rows: Span[][]; put(x: number, y: number, glyph: string, style?: Style): void; text(x: number, y: number, text: string, style?: Style, max?: number): void; place(x: number, y: number, lines: Line[]): void; lines(): Line[]; }
