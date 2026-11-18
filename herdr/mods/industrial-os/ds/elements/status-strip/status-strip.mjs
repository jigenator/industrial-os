// The status strip: the one frosted row under a pane plate. Segments (a status lamp or chip, key hints, fields, text
// and clocks) pack from the left margin with an even gap, and the keycap bay sits at the right on the plate's 16-column
// block (W − 18 … W − 3). The host supplies every segment and the clock text. Contract: README.md.
import { assertCells, fitText, span } from '../../foundation/cells.mjs';
import { blendFill, surfaceAt } from '../../foundation/surface.mjs';
import { FROST_ALPHA, PLATE_LIGHTING, SURFACE_PALETTE } from '../../foundation/surface-palette.mjs';
import { keycapBay } from '../action-label/action-label.mjs';

// The frost's gradient: the surface gradient's top row with a steep fall, so the strip lightens to its centre.
export const STRIP_FROST = Object.freeze({ top: 19, drop: 19, edge: 3 });
// [gap, clear cells before the bay], tried in order before a segment drops: 3/3, then 2/2, then 2/1.
export const STRIP_SPACING = Object.freeze([Object.freeze([3, 3]), Object.freeze([2, 2]), Object.freeze([2, 1])]);
const MARGIN = 2, BAY_WIDTH = 16, CLIP_MIN = 8;
const KINDS = ['status', 'chip', 'hint', 'field', 'text', 'clock'];
const TONES = ['accent', 'primary', 'ready'];

// The frost at column x of a `width`-cell strip: FROST_ALPHA of white over the gradient's top row.
export const frostAt = (x, width) => blendFill('primary', surfaceAt(x, 0, { width, height: 2, gradient: STRIP_FROST }), FROST_ALPHA);

// The frost of a whole strip, kept for the last few widths: a header redraws its strip every second a clock runs.
const FROSTS = new Map(), FROST_LIMIT = 12;
function frostRow(width) {
  let row = FROSTS.get(width);
  if (!row) {
    if (FROSTS.size >= FROST_LIMIT) FROSTS.delete(FROSTS.keys().next().value);
    row = Array.from({ length: width }, (_, x) => frostAt(x, width));
    FROSTS.set(width, row);
  }
  return row;
}
const printable = (text) => fitText(text, Infinity).map((s) => s.text).join('');
function check(segment) {
  if (!segment || typeof segment !== 'object' || !KINDS.includes(segment.kind)) throw new TypeError(`status strip segment kind must be one of ${KINDS.join(', ')}`);
  const strings = { status: ['glyph', 'word'], chip: ['glyph', 'word'], hint: ['key', 'action'], field: ['label', 'value'], text: ['text'], clock: ['text'] }[segment.kind];
  for (const name of strings) if (typeof segment[name] !== 'string' || !segment[name]) throw new TypeError(`status strip ${segment.kind} needs a non-empty ${name}`);
  if (segment.kind === 'status' && !TONES.includes(segment.tone)) throw new RangeError('status strip status tone must be accent, primary or ready');
  if (segment.drop !== undefined && !Number.isInteger(segment.drop)) throw new RangeError('status strip drop must be an integer priority');
  if (segment.clip !== undefined && typeof segment.clip !== 'boolean') throw new TypeError('status strip clip must be boolean');
}

// A segment's parts: [text, role, bold]. Roles map to lit inks here and to PLATE_LIGHTING when unlit.
function parts(segment) {
  switch (segment.kind) {
    case 'status': return [[`${segment.glyph} ${printable(segment.word)}`, `status-${segment.tone}`, true]];
    case 'chip': return [[` ${segment.glyph} ${printable(segment.word)} `, 'chip', true]];
    case 'hint': return [[printable(segment.key), 'key', true], [` ${printable(segment.action)}`, 'action', false]];
    case 'field': return [[`${printable(segment.label)} `, 'action', false], [printable(segment.value), 'detail', false]];
    case 'text': return [[printable(segment.text), 'detail', false]];
    case 'clock': return [[printable(segment.text), 'action', false]];
  }
}
const LIT = { key: SURFACE_PALETTE.primary, action: SURFACE_PALETTE.frostLamp, detail: SURFACE_PALETTE.primary, 'status-accent': 'accent', 'status-primary': 'primary', 'status-ready': SURFACE_PALETTE.frostLamp };
function inkOf(role, lighting) {
  if (lighting === 'lit' || role === 'status-accent' || role === 'status-primary') return LIT[role];
  const P = PLATE_LIGHTING[lighting];
  return role === 'status-ready' ? P.ready : P[role];
}

const widthOf = (segment) => segment.parts.reduce((n, [t]) => n + [...t].length, 0);

// Packs `segments` and draws the strip at `lighting`. `keys` are the bay's keys ([] for none); `hover` and `pressed`
// are bay key indexes. Returns the line, the bay keys' cells and hit areas in strip columns, the first segment's cells
// when it is a status or chip (for a latch), and how the segments were fitted.
export function statusStrip(segments, { width, keys = [], lighting = 'lit', hover = null, pressed = null } = {}) {
  if (!Array.isArray(segments)) throw new TypeError('status strip segments must be an array');
  segments.forEach(check);
  assertCells(width, 'status strip width');
  if (!['lit', 'standby', 'dark'].includes(lighting)) throw new RangeError('status strip lighting must be lit, standby or dark');
  if (!Array.isArray(keys)) throw new TypeError('status strip keys must be an array');
  const bayLeft = width - 3 - BAY_WIDTH + 1, withBay = keys.length > 0 && bayLeft >= MARGIN;
  const limit = (clear) => (withBay ? bayLeft - clear : width - MARGIN); // the first column text may not reach

  let list = segments.map((segment, index) => ({ ...segment, index, parts: parts(segment).map((p) => [...p]) }));
  const total = (gap) => MARGIN + list.reduce((n, s) => n + widthOf(s), 0) + gap * Math.max(0, list.length - 1);
  let spacing;
  for (;;) {
    // An empty list always fits: a strip narrower than its margin shows no segment.
    spacing = list.length === 0 ? STRIP_SPACING[0] : STRIP_SPACING.find(([gap, clear]) => total(gap) <= limit(withBay ? clear : 0));
    if (spacing) break;
    // Nothing fits: drop the lowest-priority droppable segment, else cut a clippable one at the tightest spacing,
    // else drop the last.
    const droppable = list.filter((s) => s.drop !== undefined).sort((a, b) => a.drop - b.drop)[0];
    const [gap, clear] = STRIP_SPACING.at(-1), over = total(gap) - limit(withBay ? clear : 0);
    const clip = list.find((s) => s.clip && widthOf(s) > CLIP_MIN);
    if (droppable) list = list.filter((s) => s !== droppable);
    else if (clip) {
      const last = clip.parts.at(-1), chars = [...last[0]], keep = Math.max(1, chars.length - over - 1);
      if (keep >= chars.length - 1 && chars.at(-1) === '…') list = list.filter((s) => s !== clip);
      else last[0] = chars.slice(0, keep).join('') + '…';
    } else list = list.slice(0, -1);
  }
  const [gap, clear] = spacing;

  const frost = lighting === 'dark' ? null : frostRow(width);
  const cells = Array.from({ length: width }, (_, x) => ({ ch: ' ', fg: SURFACE_PALETTE.frostLamp, bg: frost ? frost[x] : PLATE_LIGHTING.dark.strip, bold: false }));
  let x = MARGIN, status = null;
  list.forEach((s, i) => {
    const start = x;
    for (const [text, role, bold] of s.parts) for (const ch of text) {
      if (x < width) cells[x] = role === 'chip' ? { ch, fg: 'field', bg: 'critical', bold } : { ch, fg: inkOf(role, lighting), bg: cells[x].bg, bold };
      x++;
    }
    if (i === 0 && (s.kind === 'status' || s.kind === 'chip')) status = { col: start, len: x - start };
    x += gap;
  });
  let bayKeys = [];
  if (withBay) {
    const bay = keycapBay(keys, { width: BAY_WIDTH, lighting, hover, pressed });
    let c = bayLeft;
    for (const s of bay.line) for (const ch of s.text) cells[c++] = { ch, fg: s.style.fg, bg: s.style.bg, bold: s.style.bold ?? false };
    bayKeys = bay.keys.map((k) => ({ ...k, col: bayLeft + k.col, hitCol: bayLeft + k.hitCol }));
  }
  const line = [];
  for (const c of cells) {
    const last = line.at(-1), style = { fg: c.fg, bg: c.bg, ...(c.bold ? { bold: true } : {}) };
    if (last && last.style.fg === style.fg && last.style.bg === style.bg && !!last.style.bold === !!style.bold) last.text += c.ch;
    else line.push(span(c.ch, style));
  }
  return { line, keys: bayKeys, status, shown: list.map((s) => s.index), dropped: segments.length - list.length, gap, clear: withBay ? clear : 0 };
}

// The key hints of a strip, in order, each droppable from the right.
export function hintSegments(hints) {
  if (!Array.isArray(hints)) throw new TypeError('hints must be an array');
  return hints.map(([key, action], i) => ({ kind: 'hint', key, action, drop: 100 - i }));
}
