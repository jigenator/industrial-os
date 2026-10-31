// The crate banner: a crate pane's white maker's plate over a black tool strip, or one compact row. The host
// supplies the hold count, the clock and each tool's state, and hit-tests the returned tool spans. Contract: README.md.
import { assertCells, fitText, GLYPHS, lineWidth, span } from '../../foundation/cells.mjs';
import { CellGrid } from '../../foundation/cell-grid.mjs';
import { INDUSTRIALOS_COLORS } from '../../foundation/industrialos-colors.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { SURFACE_PALETTE } from '../../foundation/surface-palette.mjs';

const PAPER = INDUSTRIALOS_COLORS.find((c) => c.id === 'light-paper').hex;
const HAIR = SURFACE_PALETTE.paperHair;
const SHADE = SIGNAL_COLORS.accent75; // a hairline under the stroke's paint
const ink = (fg, bold = false) => (bold ? { fg, bg: PAPER, bold } : { fg, bg: PAPER });
const INK = ink('field'), BOLD = ink('field', true), LABEL = ink('decorative'), RULE = ink(HAIR);

const FULL_WIDTH = 40, WIDE_WIDTH = 56;
const FRAME = new Set([' ', '─', '│', '+']); // the cells a stroke edge may replace
const TOOL_STATES = new Set(['ready', 'open', 'disabled']);
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const glyph = (value, name) => {
  if (typeof value !== 'string' || [...value].length !== 1 || !(/^[\x21-\x7e]$/.test(value) || GLYPHS.includes(value))) {
    throw new TypeError(`crate banner ${name} must be one printable ASCII or curated glyph`);
  }
};

function read(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('crate banner input must be an object');
  const { maker = 'INDUSTRIAL-OS', registered = true, division = 'HALDENN DYNAMICS', unit = 'M-02', serial, hold = null, clock = null, mark = '⟁', tools = [] } = input;
  for (const [name, value] of Object.entries({ maker, division, unit, serial })) if (typeof value !== 'string') throw new TypeError(`crate banner ${name} must be a string`);
  if (!serial) throw new RangeError('crate banner serial must not be empty');
  if (typeof registered !== 'boolean') throw new TypeError('crate banner registered must be boolean');
  if (hold !== null && typeof hold !== 'number') throw new TypeError('crate banner hold must be a number or null');
  if (hold !== null && (!Number.isSafeInteger(hold) || hold < 0)) throw new RangeError('crate banner hold must be a non-negative integer');
  if (clock !== null && typeof clock !== 'string') throw new TypeError('crate banner clock must be a string or null');
  if (clock !== null && !CLOCK.test(clock)) throw new RangeError('crate banner clock must be HH:MM');
  if (mark !== null) glyph(mark, 'mark');
  if (!Array.isArray(tools)) throw new TypeError('crate banner tools must be an array');
  const ids = new Set();
  const list = tools.map((tool) => {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) throw new TypeError('crate banner tool must be an object');
    const { id, label, icon = null, state, hover = false } = tool;
    if (typeof id !== 'string' || typeof label !== 'string') throw new TypeError('crate banner tool id and label must be strings');
    if (ids.has(id)) throw new RangeError(`crate banner tool id ${id} is not unique`);
    ids.add(id);
    if (!TOOL_STATES.has(state)) throw new RangeError('crate banner tool state must be ready, open or disabled');
    if (typeof hover !== 'boolean') throw new TypeError('crate banner tool hover must be boolean');
    if (icon !== null) glyph(icon, 'tool icon');
    return { id, label, icon, state, hover: hover && state !== 'disabled' };
  });
  return {
    maker, registered, division, unit, serial, mark, tools: list,
    hold: hold === null ? ['?', LABEL] : [hold > 99 ? '99+' : String(hold), hold ? BOLD : LABEL],
    clock: clock === null ? ['--:--', LABEL] : [clock, BOLD],
  };
}

// Writes element glyphs cell by cell and caller text as measured lines, advancing along one row.
function pen(grid, y, x, measure) {
  return {
    get x() { return x; },
    glyphs(chars, style) { for (const ch of chars) grid.put(x++, y, ch, style); return this; },
    line(line) { grid.place(x, y, [line]); x += lineWidth(line, { measure }); return this; },
  };
}

// One tool on the strip: ` ▦ LABEL · ` (icon and the trailing space only with icons), then a divider that is
// not part of its span. Hover inks the whole item black on acid; a disabled tool has no lamp and no hover.
function toolItem(tool, icons, measure) {
  const off = tool.state === 'disabled';
  const base = tool.hover ? { fg: 'field', bg: 'accent' } : { fg: off ? 'structural' : 'primary', bg: 'field' };
  const name = { ...base, ...(off ? {} : { bold: true }) };
  const label = fitText(tool.label, Infinity, { measure, style: name });
  const icon = icons && tool.icon !== null ? `${tool.icon} ` : '';
  const lamp = off ? ' ' : tool.state === 'open' ? '●' : '·';
  const lampStyle = { ...base, ...(off || tool.hover ? {} : { fg: tool.state === 'open' ? 'accent' : 'decorative' }) };
  const tail = icons ? ' ' : '';
  return {
    id: tool.id,
    width: 1 + icon.length + lineWidth(label, { measure }) + 2 + tail.length,
    draw: (p) => p.glyphs(` ${icon}`, name).line(label).glyphs(' ', base).glyphs(lamp, lampStyle).glyphs(tail, base),
  };
}

// The tools that fit whole from `x`, each followed by a divider; returns their spans.
function drawTools(grid, y, x, items, measure) {
  const p = pen(grid, y, x, measure).glyphs(' ', { fg: 'primary', bg: 'field' });
  return items.map((item) => {
    const start = p.x;
    item.draw(p);
    const end = p.x;
    p.glyphs('│', { fg: 'structural', bg: 'field' });
    return { id: item.id, row: y, start, end };
  });
}
// prefixWidths(items)[k] is the width of the first k items on the strip (a leading cell, then each item and its
// separator), built in one pass so shedding tools stays linear.
function prefixWidths(items) {
  const widths = [0];
  for (const item of items) widths.push((widths.at(-1) || 1) + item.width + 1);
  return widths;
}

// The serial's barcode as the approved mockup draws it: a string-seeded generator picks bars between guard bars.
// Its arithmetic is kept exactly, double rounding in the multiply included, so the bars match the mockup's.
const BARS = ['▏', '▎', '▍', '▌', '▐', '█', ' ', '▏', '▍', ' '];
function barcode(seed, n) {
  let h = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const bars = Array.from({ length: n - 2 }, () => BARS[((h = (h * 1103515245 + 12345) >>> 0) >>> 16) % BARS.length]);
  return `▌${bars.join('')}▐`;
}

function full(v, width, measure) {
  // Wide: a 17-cell right column and a 6-cell stroke 13 cells left of the column line. Narrow: 16 cells, a 3-cell stroke
  // whose top edge sits on the column line.
  const wide = width >= WIDE_WIDTH, L = 2, R = width - 1, sep = width - (wide ? 18 : 17), cell = R - sep - 3;
  const strokeWidth = wide ? 6 : 3, top = wide ? sep - 13 : sep, edge = (y) => top - y; // the stroke's left edge on row y
  const grid = new CellGrid(width, 7, { measure });
  const text = (value, room, style) => fitText(value, Math.max(0, room), { measure, style });
  const at = (x, y) => pen(grid, y, x, measure);

  for (let y = 0; y < 6; y++) at(0, y).glyphs('  ', { fg: 'field', bg: 'accent' }).glyphs(' '.repeat(width - 2), INK);
  for (const y of [0, 5]) at(L, y).glyphs('─'.repeat(R - L + 1), RULE);
  at(sep, 2).glyphs('─'.repeat(R - sep + 1), RULE);
  for (let y = 1; y < 5; y++) for (const x of [L, sep, R]) grid.put(x, y, '│', RULE);
  for (const [x, y] of [[L, 0], [sep, 0], [R, 0], [sep, 2], [R, 2], [L, 5], [sep, 5], [R, 5]]) grid.put(x, y, '+', BOLD);

  // The slanted stroke: triangle edges replace frame cells; between them the paint fills the background and darkens
  // any hairline under it. Text is placed after it, always clear of it.
  for (let y = 0; y < 6; y++) {
    for (let x = edge(y); x < edge(y) + strokeWidth; x++) {
      const { text: ch, style } = grid.rows[y][x];
      const corner = x === edge(y) ? '◢' : x === edge(y) + strokeWidth - 1 ? '◤' : null;
      if (corner && FRAME.has(ch)) grid.put(x, y, corner, { fg: 'accent', bg: PAPER });
      else grid.put(x, y, ch, { ...style, bg: 'accent', fg: style.fg === HAIR ? SHADE : style.fg });
    }
  }

  // Name cell. The mark and its blank spill cell sit three cells left of the column line; the maker stops before
  // the stroke and one cell before the mark, losing ® before it is cut.
  const markX = sep - 3;
  const room = Math.min(edge(1), v.mark === null ? sep - 1 : markX - 1) - (L + 2);
  const maker = text(v.maker, Infinity, BOLD);
  const registered = v.registered && lineWidth(maker, { measure }) + 2 <= room;
  const name = at(L + 2, 1).line(registered ? maker : text(v.maker, room, BOLD));
  if (registered) name.glyphs(' ', INK).glyphs('®', INK);
  if (v.mark !== null) at(markX, 1).glyphs(v.mark, BOLD).glyphs(' ', BOLD);
  at(L + 2, 3).line(text(v.division, edge(3) - (L + 2), LABEL));
  // The serial breaks the bottom rule, aligned with the maker; it is cut before it would reach the stroke.
  at(L + 1, 5).glyphs(' S/N ', LABEL).line(text(v.serial, edge(5) - (L + 1) - 6, LABEL)).glyphs(' ', LABEL);

  // Right column: HOLD and the clock, which is left out when both do not fit with a gap; then UNIT and the barcode.
  const [count, countStyle] = v.hold, [clock, clockStyle] = v.clock;
  at(sep + 2, 1).glyphs('HOLD ', LABEL).glyphs(count, countStyle);
  if (5 + count.length + 1 + clock.length <= cell) at(sep + 2 + cell - clock.length, 1).glyphs(clock, clockStyle);
  at(sep + 2, 3).glyphs('UNIT', LABEL);
  const unit = text(v.unit, cell - 5, BOLD);
  at(sep + 2 + cell - lineWidth(unit, { measure }), 3).line(unit);
  at(sep + 2, 4).glyphs(barcode(`S/N ${v.serial}`, cell), INK);

  // The black strip: icons only in wide geometry; tools that do not fit whole are left out.
  at(0, 6).glyphs(' '.repeat(width), { fg: 'primary', bg: 'field' });
  const all = v.tools.map((tool) => toolItem(tool, wide, measure)), widths = prefixWidths(all);
  let fit = 0;
  while (fit < all.length && widths[fit + 1] <= width) fit++;
  return { grid, tools: drawTools(grid, 6, 0, all.slice(0, fit), measure) };
}

// One paper row: stripe, maker and ®, then, at least two cells on, HOLD, the clock and the tools at the right edge.
// Parts are shed as the width shrinks: tool icons, ®, the clock, HOLD, then tools from the last; the maker is cut
// last of all.
function compact(v, width, measure) {
  const grid = new CellGrid(width, 1, { measure });
  pen(grid, 0, 0, measure).glyphs(' '.repeat(width), INK);
  const lead = width >= 6 ? 3 : 0;
  const maker = fitText(v.maker, Infinity, { measure, style: BOLD });
  const makerWidth = lineWidth(maker, { measure });
  const [count, countStyle] = v.hold, [clock, clockStyle] = v.clock;
  // Richest first; each level sheds one more part.
  const all = v.tools.length;
  const levels = [
    { icons: true, registered: true, hold: true, clock: true, tools: all },
    { registered: true, hold: true, clock: true, tools: all },
    { hold: true, clock: true, tools: all },
    { hold: true, tools: all },
    ...Array.from({ length: all + 1 }, (_, i) => ({ tools: all - i })),
  ];
  // Tool items are built once per icon mode; levels only read prefix widths, and planning stops at the first fit.
  const modes = [false, true].map((icons) => {
    const items = v.tools.map((tool) => toolItem(tool, icons, measure));
    return { items, widths: prefixWidths(items) };
  });
  const plan = (level) => {
    const mode = modes[level.icons ? 1 : 0];
    const indicators = (level.hold ? 5 + count.length : 0) + (level.hold && level.clock ? 2 : 0) + (level.clock ? clock.length : 0);
    const right = (indicators ? indicators + 1 : 0) + mode.widths[level.tools];
    const registered = v.registered && !!level.registered;
    const fits = lead + makerWidth + (registered ? 2 : 0) + (right ? 2 + right : 0) <= width;
    return fits && { ...level, items: mode.items.slice(0, level.tools), right, registered };
  };
  let chosen;
  for (const level of levels) if ((chosen = plan(level))) break;
  if (lead) pen(grid, 0, 0, measure).glyphs('  ', { fg: 'field', bg: 'accent' });
  const name = pen(grid, 0, lead, measure).line(chosen ? maker : fitText(v.maker, width - lead, { measure, style: BOLD }));
  if (!chosen) return { grid, tools: [] };
  if (chosen.registered) name.glyphs(' ', INK).glyphs('®', INK);
  const right = pen(grid, 0, width - chosen.right, measure);
  if (chosen.hold) right.glyphs('HOLD ', LABEL).glyphs(count, countStyle);
  if (chosen.hold && chosen.clock) right.glyphs('  ', INK);
  if (chosen.clock) right.glyphs(clock, clockStyle);
  if (chosen.hold || chosen.clock) right.glyphs(' ', INK);
  return { grid, tools: drawTools(grid, 0, right.x, chosen.items, measure) };
}

// CellGrid lines hold one span per cell; adjacent cells with the same style join.
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

export function crateBanner(input, { width, form = 'full', measure } = {}) {
  const v = read(input);
  assertCells(width, 'crate banner width');
  if (form !== 'full' && form !== 'compact') throw new RangeError('crate banner form must be full or compact');
  const { grid, tools } = form === 'full' && width >= FULL_WIDTH ? full(v, width, measure) : compact(v, width, measure);
  return { lines: grid.lines().map(joined), tools };
}
