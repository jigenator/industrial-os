// Readouts: a numbered block with a tall numeral, the same reading as one line, and the strips that sit under a
// numeral (busy slots, an outcome split and phase steps). Supplied values only. Contract: README.md.
import { assertCells, fitLine, fitText, lineWidth, resolveColor, span } from '../../foundation/cells.mjs';
import { BOARD_INKS } from '../../foundation/signal-colors.mjs';
import { numeralLines, textGrid } from '../pixel-numeral/pixel-numeral.mjs';
import { tabRule } from '../tab-rule/tab-rule.mjs';

const pad2 = (n) => String(n).padStart(2, '0');
const caption = (ink) => resolveColor(ink) === resolveColor('decorative');
// A value part is bold unless it is a decorative caption.
const partStyle = (ink) => (caption(ink) ? { fg: ink } : { fg: ink, bold: true });

function object(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function parts(list, name) {
  if (!Array.isArray(list)) throw new TypeError(`${name} must be an array`);
  for (const p of list) {
    object(p, `${name} part`);
    if (typeof p.text !== 'string') throw new TypeError(`${name} part text must be a string`);
    resolveColor(p.ink);
  }
  return list;
}
// Appends `spans` so that they start at column `at` (never before the line's current end).
function placeAt(line, at, spans, measure) {
  const end = lineWidth(line, { measure });
  if (at > end) line.push(span(' '.repeat(at - end)));
  line.push(...spans);
}

export function readoutBlock(input, { width, measure, ellipsis } = {}) {
  const { number, label, value, ink, unit = [], sub = null, strip = null } = object(input, 'readout');
  assertCells(width, 'readout width');
  if (!Number.isInteger(number) || number < 0 || number > 99) throw new RangeError('readout number must be 0–99');
  if (typeof value !== 'string') throw new TypeError('readout value must be a string');
  resolveColor(ink);
  parts(unit, 'readout unit');
  if (sub !== null) parts([sub], 'readout sub-line');
  if (strip !== null && !Array.isArray(strip)) throw new TypeError('readout strip must be a line');
  const head = [span(pad2(number), { fg: 'decorative' }), span(' '), ...fitText(label, Math.max(0, width - 3), { measure, ellipsis, style: { fg: 'primary', bold: true } })];
  const rule = tabRule({ tabCells: 3, inks: { tab: 'primary', rule: BOARD_INKS.faint } }, { width, lead: false });
  const grid = textGrid(value, { ink, face: 'tall' });
  const big = grid.w <= width ? numeralLines(grid, { width: grid.w })
    : [[span(value, { fg: ink, bold: true })], [], [], [], []];
  const numeralWidth = grid.w <= width ? grid.w : [...value].length;
  const units = [...big[4]];
  let x = numeralWidth + 2;
  for (const part of unit) {
    if (!part.text) continue;
    const text = fitText(part.text, Math.max(0, Math.min(1000, width - x)), { measure, ellipsis, style: partStyle(part.ink) });
    if (text.length) placeAt(units, x, text, measure);
    x += lineWidth(text, { measure }) + 1;
  }
  const last = strip ?? (sub ? fitText(sub.text, width, { measure, ellipsis, style: { fg: sub.ink } }) : []);
  return [head, rule, ...big.slice(0, 4), units, last].map((line) => fitLine(line, width, {}, { measure }));
}

// The same readings as one line: each readout's parts a cell apart, readouts separated by a structural dot.
export function readoutLine(readouts, { width, measure, ellipsis } = {}) {
  assertCells(width, 'readout line width');
  if (!Array.isArray(readouts)) throw new TypeError('readouts must be an array');
  const line = [];
  let x = 0;
  const put = (text, style, gap) => {
    const room = Math.max(0, Math.min(1000, width - x));
    const shown = text === '·' ? (room ? [span(text, style)] : []) : fitText(text, room, { measure, ellipsis, style });
    if (shown.length) placeAt(line, x, shown, measure);
    x += lineWidth(shown, { measure }) + gap;
  };
  readouts.forEach((readout, i) => {
    parts(readout, 'readout line');
    if (i) put('·', { fg: 'structural' }, 2);
    for (const part of readout) put(part.text, partStyle(part.ink), 1);
    x += 1;
  });
  return fitLine(line, width, {}, { measure });
}

// One cell per busy slot in its supplied color (hatched decorative while the source is not reporting), then the
// free slots as a structural floor. Inline: no padding.
export function slotStrip({ busy, slots = null, reporting = true } = {}, { maxWidth = Infinity } = {}) {
  if (!Array.isArray(busy)) throw new TypeError('slot strip busy must be an array of colors');
  for (const color of busy) resolveColor(color);
  if (slots !== null && (!Number.isInteger(slots) || slots < 0 || slots > 1000)) throw new RangeError('slots must be 0–1000 or null');
  if (typeof reporting !== 'boolean') throw new TypeError('reporting must be boolean');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('maxWidth must be 0–1000 or Infinity');
  const n = Math.min(busy.length, maxWidth);
  const cells = busy.slice(0, n).map((color) => (reporting ? span('█', { fg: color }) : span('▒', { fg: 'decorative' })));
  const free = Math.max(0, Math.min(slots ?? 0, maxWidth) - busy.length);
  const out = [];
  for (const cell of [...cells, ...(free ? [span('▁'.repeat(free), { fg: 'structural' })] : [])]) {
    const prev = out.at(-1);
    if (prev && prev.style.fg === cell.style.fg) prev.text += cell.text;
    else out.push({ ...cell });
  }
  return out;
}

// A bar of upper half blocks split by rounded share: ok in primary, warnings in amber, failures in red; faint when empty.
export function splitBar({ ok, warn, fail } = {}, { width } = {}) {
  for (const [name, n] of [['ok', ok], ['warn', warn], ['fail', fail]]) if (!Number.isInteger(n) || n < 0) throw new RangeError(`split bar ${name} must be a non-negative integer`);
  assertCells(width, 'split bar width');
  const total = ok + warn + fail;
  if (!total) return [span('▀'.repeat(width), { fg: BOARD_INKS.faint })];
  const okCells = Math.round((ok / total) * width), warnCells = Math.round((warn / total) * width);
  return [
    [okCells, 'primary'], [Math.min(width - okCells, warnCells), 'warning'], [width - Math.min(width, okCells + warnCells), 'critical'],
  ].filter(([n]) => n > 0).map(([n, fg]) => span('▀'.repeat(n), { fg }));
}

// Equal steps a cell apart: a lower-half bar per step (done in `ink`, the current one in `ink` only while `lit`,
// later ones faint), its label (bold when current) and a detail line.
export function phaseSteps({ steps, current, ink, lit = true } = {}, { width, measure } = {}) {
  assertCells(width, 'phase steps width');
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 100) throw new TypeError('phase steps must be 1–100 steps');
  for (const step of steps) {
    object(step, 'phase step');
    if (typeof step.label !== 'string' || typeof step.detail !== 'string') throw new TypeError('phase step label and detail must be strings');
  }
  if (!Number.isInteger(current) || current < 0 || current >= steps.length) throw new RangeError('current must index a step');
  resolveColor(ink);
  if (typeof lit !== 'boolean') throw new TypeError('lit must be boolean');
  const stepWidth = Math.max(0, Math.floor((width - (steps.length - 1)) / steps.length));
  const rows = [[], [], []];
  steps.forEach((step, i) => {
    const at = i * (stepWidth + 1);
    const on = i < current || (i === current && lit);
    if (stepWidth) placeAt(rows[0], at, [span('▄'.repeat(stepWidth), { fg: on ? ink : BOARD_INKS.faint })], measure);
    const labelStyle = i === current ? { fg: 'primary', bold: true } : { fg: i < current ? 'primary' : 'decorative' };
    const label = fitText(step.label, stepWidth, { measure, style: labelStyle });
    if (label.length) placeAt(rows[1], at, label, measure);
    const detail = fitText(step.detail, stepWidth, { measure, style: { fg: 'decorative' } });
    if (detail.length) placeAt(rows[2], at, detail, measure);
  });
  return rows.map((line) => fitLine(line, width, {}, { measure }));
}
