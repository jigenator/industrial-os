// The unit plate: a unit's six-row brushed-aluminium maker's plate, with the maker over a pixel wordmark of the unit
// code and its serial set into the bottom hairline; optionally a title block (mark and title, a seeded barcode, the
// division) at the right margin and a hollow acid peak between the two. The host supplies every value and the seed.
// Contract: README.md.
import { assertCells, fitText, GLYPHS, lineWidth, span } from '../../foundation/cells.mjs';
import { barcode } from '../../foundation/barcode.mjs';
import { CellGrid } from '../../foundation/cell-grid.mjs';
import { INDUSTRIALOS_COLORS } from '../../foundation/industrialos-colors.mjs';
import { random } from '../../foundation/seeded.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { aluminiumAt } from '../../foundation/surface.mjs';
import { SURFACE_PALETTE } from '../../foundation/surface-palette.mjs';
import { numeralLines, textGrid } from '../pixel-numeral/pixel-numeral.mjs';

// Drawn on light paper with paper hairlines, then brushed: the aluminium ground replaces each paper cell, as in the
// crate banner.
const PAPER = INDUSTRIALOS_COLORS.find((c) => c.id === 'light-paper').hex;
const HAIR = SURFACE_PALETTE.paperHair;
const ink = (fg, bold = false) => (bold ? { fg, bg: PAPER, bold } : { fg, bg: PAPER });
const INK = ink('field'), BOLD = ink('field', true), LABEL = ink(SURFACE_PALETTE.aluminiumLabel), RULE = ink(HAIR);
const EDGE = { fg: 'accent', bg: PAPER }, PAINT = { fg: SIGNAL_COLORS.accent75, bg: 'accent' };

export const UNIT_PLATE_ROWS = 6;
const L = 2; // the left block's column; the serial's label starts one cell before it
const PEAK_STROKES = [3, 2, 1]; // solid cells per stroke, widest first

function read(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('unit plate input must be an object');
  const { maker = 'INDUSTRIAL-OS', registered = true, unit, serial, title = 'PI AGENT DROID', mark = '⟁', division = ['HALDENN', 'DYNAMICS'], seed = 0 } = input;
  for (const [name, value] of Object.entries({ maker, unit, serial, title })) if (typeof value !== 'string') throw new TypeError(`unit plate ${name} must be a string`);
  if (!unit || !serial) throw new RangeError('unit plate unit and serial must not be empty');
  // The wordmark is pixel text: it throws RangeError for a character the font lacks.
  textGrid(unit);
  if (typeof registered !== 'boolean') throw new TypeError('unit plate registered must be boolean');
  if (mark !== null && (typeof mark !== 'string' || [...mark].length !== 1 || !(/^[\x21-\x7e]$/.test(mark) || GLYPHS.includes(mark)))) {
    throw new TypeError('unit plate mark must be one printable ASCII or curated glyph, or null');
  }
  if (!Array.isArray(division) || division.length !== 2 || division.some((part) => typeof part !== 'string')) throw new TypeError('unit plate division must be two strings');
  if (!Number.isInteger(seed)) throw new RangeError('unit plate seed must be an integer');
  return { maker, registered, unit, serial, title: mark === null ? title : `${mark} ${title}`, division, seed };
}

// The wordmark's pixel rows as three lines of cells; a `?`, an unknown digit, is drawn in label grey.
function wordmark(unit) {
  const grid = textGrid(unit, { ink: 'field' });
  let x = 0;
  for (const ch of unit) {
    const w = textGrid(ch).w;
    if (ch === '?') for (const row of grid.g) for (let i = x; i < x + w; i++) if (row[i]) row[i] = SURFACE_PALETTE.aluminiumLabel;
    x += w + 1;
  }
  return numeralLines(grid, { width: grid.w });
}

function draw(v, width, titleBlock) {
  const R = width - 3, grid = new CellGrid(width, UNIT_PLATE_ROWS);
  const put = (x, y, text, style) => { [...text].forEach((ch, i) => grid.put(x + i, y, ch, style)); return x + [...text].length; };
  const fitted = (text, room) => fitText(text, Math.max(0, room)).map((s) => s.text).join('');
  for (let y = 0; y < UNIT_PLATE_ROWS; y++) put(0, y, ' '.repeat(width), INK);
  for (const y of [0, UNIT_PLATE_ROWS - 1]) {
    put(0, y, '─'.repeat(width), RULE);
    grid.put(0, y, '+', BOLD);
    grid.put(width - 1, y, '+', BOLD);
  }

  // The left block: the maker, then the wordmark when it fits whole before the right margin, else the unit as text.
  const mark = wordmark(v.unit), markWidth = lineWidth(mark[0]), pixels = L + markWidth <= width - 1;
  // The title block hugs the right margin, exactly as wide as its title line, and only with two cells clear of the left.
  const blockWidth = Math.max([...v.title].length, [...v.division[0]].length + 1 + [...v.division[1]].length);
  const makerWidth = [...v.maker].length + (v.registered ? 2 : 0);
  const leftEnd = L + Math.max(pixels ? markWidth : [...v.unit].length, makerWidth) - 1;
  const bx = R - blockWidth + 1, block = titleBlock && bx >= leftEnd + 3;
  const room = (block ? bx - 2 : width - 1) - L;
  if (v.registered && makerWidth <= room) put(put(L, 1, v.maker, BOLD), 1, ' ®', INK);
  else put(L, 1, fitted(v.maker, room), BOLD);
  if (pixels) mark.forEach((line, i) => grid.place(L, 2 + i, [line.map((s) => span(s.text, { ...s.style, bg: PAPER }))]));
  else put(L, 2, fitted(v.unit, room), BOLD);
  // The serial interrupts the bottom hairline, with one blank cell either side.
  const serial = fitted(v.serial, width - 1 - (L - 1) - 6);
  put(put(put(L - 1, 5, ' S/N ', LABEL), 5, serial, INK), 5, ' ', RULE);
  if (!block) return { grid, paint: [] };

  put(bx, 1, v.title, BOLD);
  const r = random(v.seed), code = barcode(blockWidth, (count) => Math.floor(r() * count));
  for (const y of [2, 3]) put(bx, y, code, INK);
  put(bx, 4, v.division[0], LABEL);
  put(R - [...v.division[1]].length + 1, 4, v.division[1], LABEL);

  // The peak: the slash `◢██◤` and its mirror meeting at the top as a hollow `/\`, across all six rows and centred
  // between the blocks. Each stroke moves out a cell per row; the widest that keeps two cells clear of the left block
  // (its maker, wordmark or unit text, whichever is longest) and three of the right wins, or there is none. The
  // hairlines run on under the paint in the darker accent.
  const left = leftEnd, mid = Math.floor((left + bx + 1) / 2);
  const half = (b) => b + 2 + UNIT_PLATE_ROWS - 1;
  const b = PEAK_STROKES.find((t) => mid - half(t) >= left + 3 && mid + half(t) <= bx - 3);
  const paint = [];
  if (b !== undefined) for (let k = 0; k < UNIT_PLATE_ROWS; k++) {
    const x0 = mid - (b + 2) - k, frame = k === 0 || k === UNIT_PLATE_ROWS - 1;
    const strokes = [[x0, '◢', '◤'], [x0 + b + 2 + 2 * k, '◥', '◣']];
    for (const [x, open, close] of strokes) {
      grid.put(x, k, open, EDGE);
      for (let i = 1; i <= b; i++) grid.put(x + i, k, frame ? '─' : ' ', PAINT);
      grid.put(x + b + 1, k, close, EDGE);
      paint.push({ row: k, start: x, end: x + b + 2 });
    }
  }
  return { grid, paint };
}

// Every paper cell takes the aluminium ground, and a paper hairline the ground's hairline. One span per cell in.
function brush(line, y) {
  return line.map((s, x) => {
    if (s.style.bg !== PAPER) return s;
    const { ground, hair } = aluminiumAt(x, y, { width: line.length });
    return span(s.text, { ...s.style, bg: ground, ...(s.style.fg === HAIR ? { fg: hair } : {}) });
  });
}

const same = (a, b) => a.fg === b.fg && a.bg === b.bg && a.bold === b.bold;
function joined(line) {
  const out = [];
  for (const s of line) {
    const last = out.at(-1);
    if (last && same(last.style, s.style)) last.text += s.text;
    else out.push(span(s.text, { ...s.style }));
  }
  return out;
}

export function unitPlate(input, { width, titleBlock = true } = {}) {
  const v = read(input);
  assertCells(width, 'unit plate width');
  if (typeof titleBlock !== 'boolean') throw new TypeError('unit plate titleBlock must be boolean');
  const { grid, paint } = draw(v, width, titleBlock);
  return { lines: grid.lines().map((line, y) => joined(brush(line, y))), paint };
}
