// A cell grid the views draw into, finished as design-system lines of exactly the grid width. Text keeps
// printable ASCII, the fixed base design-system glyph set and the few extra one-cell glyphs the approved
// monitor design uses (EXTRA_GLYPHS); every other code point becomes `?`, so each code point is one cell.
// Hit regions map a click back to what was drawn there.
import { fitLine, span, type Line } from '@industrial-os/design-system/foundation/cells';
import { FONT } from '@industrial-os/design-system/elements/pixel-numeral';
import { T, type Color } from './theme.ts';

// Box-drawing ticks, a dashed rule, hollow and half-filled squares, a hollow diamond, a low bar, the
// selection pointer, arrows and en and em dashes. These retain the approved monitor glyph contract.
export const EXTRA_GLYPHS = '┬┴┄□◩◇▁▶↑↓–—';
// Keep upstream GLYPHS additions from widening what external Tatsu text can display.
const BASE_GLYPHS = '─│┌┐└┘╵╱▐▌█▏▎▍▋▊▉░○●▲✕…━┃┏┓┗┛┼▀▄▒▓▚▞■▪·•◆▴⌑⑂×';
const ALLOWED = new Set([...BASE_GLYPHS, ...EXTRA_GLYPHS]);
export const cleanText = (value: string): string =>
  [...value].map((ch) => ((ch >= ' ' && ch <= '~') || ALLOWED.has(ch) ? ch : '?')).join('');

export interface Style { readonly fg?: Color; readonly bg?: Color; readonly bold?: boolean }
interface Cell { ch: string; fg: Color; bg: Color; bold: boolean }

export type Hit =
  | { readonly kind: 'screen'; readonly screen: Screen }
  // `run` is the index of a clicked live run in its pipeline's live list.
  | { readonly kind: 'select'; readonly key: string; readonly run?: number }
  | { readonly kind: 'modal-run'; readonly index: number }
  | { readonly kind: 'modal-inside' }
  | { readonly kind: 'modal-close' };
export type Screen = 'pipelines' | 'schedules';

export class Canvas {
  readonly w: number;
  readonly h: number;
  readonly cells: Cell[][];
  readonly hits: Array<{ x: number; y: number; w: number; h: number; hit: Hit }> = [];
  // Rows a scrolling region may draw into; null draws anywhere.
  clipY: readonly [number, number] | null = null;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ch: ' ', fg: T.secondary, bg: T.field, bold: false })));
  }

  private visible(x: number, y: number): boolean {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return false;
    return !this.clipY || (y >= this.clipY[0] && y <= this.clipY[1]);
  }

  put(x: number, y: number, ch: string, st: Style = {}): void {
    if (!this.visible(x, y)) return;
    const c = this.cells[y]![x]!;
    c.ch = ch;
    if (st.fg) c.fg = st.fg;
    if (st.bg) c.bg = st.bg;
    c.bold = st.bold ?? false;
  }

  at(x: number, y: number): Readonly<Cell> | undefined {
    return this.cells[y]?.[x];
  }

  // Text at (x, y), cut with … to `max` cells. Returns the column after it.
  text(x: number, y: number, value: string, st: Style = {}, max = Infinity): number {
    const chars = [...cleanText(value)];
    const n = Math.max(0, Math.min(max, this.w * 2));
    const cut = chars.length > n ? [...chars.slice(0, Math.max(0, n - 1)), ...(n > 0 ? ['…'] : [])] : chars;
    cut.forEach((ch, i) => this.put(x + i, y, ch, st));
    return x + cut.length;
  }

  // Right-aligned text ending at column x. Returns its first column.
  rtext(x: number, y: number, value: string, st: Style = {}): number {
    const n = [...cleanText(value)].length;
    this.text(x - n + 1, y, value, st);
    return x - n + 1;
  }

  fill(x: number, y: number, w: number, h: number, bg: Color, ch = ' ', fg: Color = T.secondary): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, ch, { bg, fg });
  }

  hline(x: number, y: number, w: number, ch: string, fg: Color): void {
    for (let i = 0; i < w; i++) this.put(x + i, y, ch, { fg });
  }

  vline(x: number, y: number, h: number, ch: string, fg: Color): void {
    for (let j = 0; j < h; j++) this.put(x, y + j, ch, { fg });
  }

  hit(x: number, y: number, w: number, h: number, hit: Hit): void {
    if (this.clipY) {
      const y0 = Math.max(y, this.clipY[0]);
      const y1 = Math.min(y + h - 1, this.clipY[1]);
      if (y1 < y0) return;
      y = y0;
      h = y1 - y0 + 1;
    }
    this.hits.push({ x, y, w, h, hit });
  }

  hitAt(x: number, y: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const r = this.hits[i]!;
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.hit;
    }
    return null;
  }

  // Pixel glyphs packed two pixel rows per cell with half blocks, keeping each cell's background.
  private pixels(x: number, y: number, rows: number, cols: ReadonlyArray<ReadonlyArray<boolean> | null>, inkColor: Color): void {
    cols.forEach((col, i) => {
      for (let r = 0; r < rows; r++) {
        const top = col?.[r * 2] ?? false;
        const bottom = col?.[r * 2 + 1] ?? false;
        if (top || bottom) this.put(x + i, y + r, top && bottom ? '█' : top ? '▀' : '▄', { fg: inkColor, bg: this.at(x + i, y + r)?.bg ?? T.field });
      }
    });
  }

  // The design system's 3×5 pixel numeral, three rows tall. Returns its width in cells.
  numeral(x: number, y: number, value: string, inkColor: Color): number {
    const cols = glyphColumns(value, (ch) => FONT[ch] ?? FONT['?']!, '1');
    this.pixels(x, y, 3, cols, inkColor);
    return cols.length;
  }

  // Tall condensed numerals, five rows tall, for the readouts. Returns the width in cells.
  tall(x: number, y: number, value: string, inkColor: Color): number {
    const cols = glyphColumns(value, (ch) => TALL[ch] ?? TALL['?']!, '#');
    this.pixels(x, y, 5, cols, inkColor);
    return cols.length;
  }

  lines(): Line[] {
    return this.cells.map((row) => {
      const out: Line = [];
      for (const c of row) {
        const last = out[out.length - 1];
        if (last && last.style.fg === c.fg && last.style.bg === c.bg && last.style.bold === c.bold) last.text += c.ch;
        else out.push(span(c.ch, { fg: c.fg, bg: c.bg, bold: c.bold }));
      }
      return fitLine(out, this.w);
    });
  }
}

function glyphColumns(value: string, glyph: (ch: string) => readonly string[], on: string): Array<boolean[] | null> {
  const cols: Array<boolean[] | null> = [];
  [...value].forEach((ch, k) => {
    const g = glyph(ch);
    if (k) cols.push(null);
    for (let i = 0; i < g[0]!.length; i++) cols.push(g.map((row) => row[i] === on));
  });
  return cols;
}

// A condensed 4×9 face with one-pixel strokes, from the approved monitor design. Nine pixel rows fill five
// cells; the colon and minus are narrower.
const TALL: Readonly<Record<string, readonly string[]>> = {
  0: ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  1: ['..#.', '.##.', '..#.', '..#.', '..#.', '..#.', '..#.', '..#.', '..#.'],
  2: ['.##.', '#..#', '...#', '...#', '..#.', '.#..', '#...', '#...', '####'],
  3: ['###.', '...#', '...#', '...#', '.##.', '...#', '...#', '...#', '###.'],
  4: ['#..#', '#..#', '#..#', '#..#', '####', '...#', '...#', '...#', '...#'],
  5: ['####', '#...', '#...', '#...', '###.', '...#', '...#', '...#', '###.'],
  6: ['.##.', '#...', '#...', '#...', '###.', '#..#', '#..#', '#..#', '.##.'],
  7: ['####', '...#', '...#', '..#.', '..#.', '..#.', '.#..', '.#..', '.#..'],
  8: ['.##.', '#..#', '#..#', '#..#', '.##.', '#..#', '#..#', '#..#', '.##.'],
  9: ['.##.', '#..#', '#..#', '#..#', '.###', '...#', '...#', '...#', '.##.'],
  ':': ['.', '.', '#', '.', '.', '.', '#', '.', '.'],
  '-': ['...', '...', '...', '...', '###', '...', '...', '...', '...'],
  '?': ['.##.', '#..#', '...#', '...#', '..#.', '.#..', '.#..', '....', '.#..'],
};
