// A retro CRT boot over settled lines, a pure function of time: a power-on line, the grounds flickering in, every
// row typing left to right behind an acid cursor, one rolling refresh bar and six seeded glitches, then exactly the
// input. A declared exception to the shared motion rule: the typing hides cells it has not reached. Contract:
// README.md#crtbootlines-options-and-crtbootdurationlines-options.
import { lineWidth, resolveColor, textSlot } from '../foundation/cells.mjs';
import { hash } from '../foundation/seeded.mjs';
import { blendFill } from '../foundation/surface.mjs';
import { assertLines, assertTime, copyLines, isStateCell, resolveOptions } from './frame.mjs';

export const CRT_BOOT_DEFAULTS = Object.freeze({ seed: 0, paint: undefined, ground: undefined, late: undefined, measure: undefined });
// Phase times and rates in ms. Rows start `stagger` apart, but never spread over more than `spread` in all.
export const CRT_BOOT_TIMING = Object.freeze({
  power: 120, ground: 350, chunk: 50, stagger: 42, spread: 2100, jitter: 6, settle: 150,
  bar: Object.freeze([700, 1600]), garble: 2, phosphor: 10, rowLimit: 60,
});
const T = CRT_BOOT_TIMING;
const GARBLE = 'ABCDEF0123456789#%&*+=<>/\\?$';
const GLITCHES = ['tear', 'tear', 'flicker', 'tear', 'flicker', 'tear'];
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });

const rangeList = (name, value) => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`crt boot ${name} must be an array of { row, start, end }`);
  for (const r of value) {
    if (!r || typeof r !== 'object') throw new TypeError(`crt boot ${name} entries must be { row, start, end }`);
    for (const key of ['row', 'start', 'end']) if (!Number.isSafeInteger(r[key]) || r[key] < 0) throw new RangeError(`crt boot ${name} ${key} must be a non-negative integer`);
  }
  return value;
};
function check(options) {
  const o = resolveOptions('crtBoot', options, CRT_BOOT_DEFAULTS);
  if (!Number.isInteger(o.seed)) throw new RangeError('crt boot seed must be an integer');
  o.paint = rangeList('paint', o.paint);
  o.ground = rangeList('ground', o.ground);
  if (o.late !== undefined) {
    if (!o.late || typeof o.late !== 'object') throw new TypeError('crt boot late must be { row, time }');
    if (!Number.isSafeInteger(o.late.row) || o.late.row < 0) throw new RangeError('crt boot late row must be a non-negative integer');
    if (typeof o.late.time !== 'number' || !Number.isFinite(o.late.time) || o.late.time < 0) throw new RangeError('crt boot late time must be a finite number >= 0');
  }
  if (o.measure !== undefined && typeof o.measure !== 'function') throw new TypeError('crt boot measure must be a function');
  return o;
}

// Each line as cells { ch, style, w, kind }: w 1, or 2 for a wide grapheme followed by a w 0 continuation ''.
// kind: 'paint' (decoration painted on the ground), 'ground' (texture that is part of the ground) or null.
function cellsOf(lines, o) {
  const kinds = lines.map(() => new Map());
  for (const [kind, list] of [['paint', o.paint], ['ground', o.ground]]) for (const { row, start, end } of list) {
    for (let x = start; x < end; x++) kinds[row]?.set(x, kind);
  }
  return lines.map((line, y) => {
    const out = [];
    const spans = o.measure ? textSlot(line, lineWidth(line, { measure: o.measure }), { measure: o.measure }).spans : line;
    for (const s of spans) {
      const parts = o.measure ? [...segmenter.segment(s.text)].map((p) => p.segment) : [...s.text];
      for (const ch of parts) {
        const w = o.measure ? o.measure(ch) : 1;
        if (w < 1) continue;
        out.push({ ch, style: s.style, w, kind: kinds[y].get(out.length) ?? null });
        for (let i = 1; i < w; i++) out.push({ ch: '', style: s.style, w: 0, kind: kinds[y].get(out.length) ?? null });
      }
    }
    return out;
  });
}
const fgOf = (style) => style.fg ?? 'secondary', bgOf = (style) => style.bg ?? 'field';
const light = (color) => parseInt(resolveColor(color).slice(1, 3), 16) > 128;
// A line holding a warning or critical cell is exempt whole: it shows settled in every frame.
const exempt = (row) => row.some((c) => isStateCell(c.style));

// The ground under a cell: its background with no ink. Ground texture is shown as it is; paint takes the ground of
// its nearest cell to the left that is not paint.
function groundOf(row, x) {
  const c = row[x];
  if (c.kind === 'ground') return c;
  let k = x;
  if (c.kind === 'paint') while (k > 0 && row[k].kind === 'paint') k--;
  return { ch: ' ', style: { fg: fgOf(c.style), bg: bgOf(row[k].style) }, w: 1, kind: null };
}

// When each row starts typing, and the cursor's position after each 50 ms chunk: a seeded pace of 4–11 cells a
// chunk, about one chunk in six a stall, blank cells a quarter of a cell. `done` is the chunk count to the end.
function schedules(rows, o) {
  const h = (a, b, c) => hash(a, b, (c + o.seed) | 0);
  const stagger = rows.length > 1 ? Math.min(T.stagger, T.spread / (rows.length - 1)) : T.stagger;
  return rows.map((row, y) => {
    let base = T.ground + y * stagger;
    if (o.late && y >= o.late.row) base = Math.max(base, o.late.time + (y - o.late.row) * stagger);
    const start = base + Math.floor(h(y, 1, 7) * T.jitter) * T.chunk;
    const cost = row.map((c) => (c.w === 0 ? 0 : c.ch === ' ' && c.kind !== 'paint' ? 0.25 : 1));
    const pos = [0];
    let x = 0, budget = 0;
    while (x < row.length && pos.length <= T.rowLimit) {
      const j = pos.length - 1;
      budget += h(y, j, 11) < 0.16 ? 0 : 4 + h(y, j, 13) * 7;
      while (x < row.length && budget >= cost[x]) budget -= cost[x++];
      pos.push(x);
    }
    return { start, pos, done: pos.length - 1 };
  });
}
// The cursor column at t: -1 before the row starts, the row's length once it is typed.
function typedAt(row, s, t) {
  if (t < s.start) return -1;
  const k = Math.floor((t - s.start) / T.chunk);
  return k >= s.done ? row.length : s.pos[k];
}

// The cells, typing plan, exempt lines and end of one set of lines and options.
function analyse(lines, o) {
  const rows = cellsOf(lines, o), plan = schedules(rows, o), keep = rows.map(exempt);
  const end = Math.max(T.ground, ...plan.filter((_, y) => !keep[y]).map((s) => s.start + s.done * T.chunk)) + T.settle;
  return { rows, plan, keep, end };
}

export function crtBootDuration(lines, options = {}) {
  assertLines(lines);
  return analyse(lines, check(options)).end;
}

// Six glitches between the grounds settling and the end: four tears (a band of 1–3 rows shifted 1–4 cells right)
// and two whole-screen flickers, each 50 or 100 ms.
function glitches(H, end, o) {
  const h = (a, b, c) => hash(a, b, (c + o.seed) | 0);
  return GLITCHES.map((kind, i) => ({
    kind,
    t: T.ground + Math.floor(h(i, 3, 5) * Math.max(0, (end - 200 - T.ground) / T.chunk)) * T.chunk,
    dur: h(i, 4, 5) < 0.6 ? T.chunk : 2 * T.chunk,
    y: Math.floor(h(i, 6, 5) * H), n: 1 + Math.floor(h(i, 7, 5) * 3), shift: 1 + Math.floor(h(i, 8, 5) * 4),
  }));
}

// Shift a row right, the ground filling in behind; a wide grapheme cut at the right edge becomes a space.
function tear(cells, ground, shift) {
  const out = cells.map((_, x) => (x < shift ? ground[x] : cells[x - shift]));
  const last = out.length - 1;
  if (last >= 0 && out[last].w === 2) out[last] = { ...out[last], ch: ' ', w: 1 };
  return out;
}

function spansOf(cells) {
  const out = [];
  for (const c of cells) {
    const last = out.at(-1);
    if (last && last.style === c.style) last.text += c.ch;
    else out.push({ text: c.ch, style: c.style });
  }
  return out;
}

export function crtBoot(lines, options = {}) {
  assertLines(lines);
  const o = check(options);
  assertTime(o, 'crtBoot');
  if (!o.animate) return copyLines(lines);
  const { rows, plan, keep, end } = analyse(lines, o), H = rows.length, t = o.time;
  if (t >= end) return copyLines(lines);
  const h = (a, b, c) => hash(a, b, (c + o.seed) | 0);
  const mid = Math.floor(H / 2);
  const style = (cache) => (fg, bg, bold = false) => {
    const key = `${fg}|${bg}|${bold}`;
    if (!cache.has(key)) cache.set(key, { fg, bg, ...(bold ? { bold } : {}) });
    return cache.get(key);
  };
  const styled = style(new Map());
  const blank = (bg) => ({ ch: ' ', style: styled('field', bg), w: 1, kind: null });
  const out = (frame) => frame.map((cells, y) => (keep[y] ? lines[y].slice() : spansOf(cells)));

  // Power-on: one bright line across the middle row, a dim glow either side, black elsewhere.
  if (t < T.power) {
    const glow = [blendFill('primary', 'field', 0.85), blendFill('primary', 'field', 0.12)];
    return out(rows.map((row, y) => row.map(() => blank(y === mid ? glow[0] : Math.abs(y - mid) === 1 ? glow[1] : 'field'))));
  }

  const grounds = rows.map((row) => row.map((_, x) => groundOf(row, x)));
  const chunk = Math.floor(t / T.chunk);
  let frame = rows.map((row, y) => {
    const pos = t < T.ground ? -1 : typedAt(row, plan[y], t);
    if (pos >= row.length) return row; // a finished row is settled
    const cells = row.map((c, x) => (pos < 0 || x > pos ? grounds[y][x] : c));
    if (pos < 0) return cells;
    // Behind the cursor: two cells of garble, then about ten of fresh phosphor on dark grounds. A wide grapheme is
    // decided on its first cell; its continuation follows it.
    for (let x = 0; x < pos; x++) {
      const c = row[x];
      if (c.w === 0 || c.ch === ' ' || c.kind !== null) continue;
      if (x >= pos - T.garble) {
        cells[x] = { ...c, ch: GARBLE[Math.floor(h(x, y, chunk) * GARBLE.length)], w: 1, style: { ...c.style, fg: light(bgOf(c.style)) ? 'field' : 'primary', bold: true } };
        if (c.w === 2) cells[x + 1] = { ...cells[x], ch: ' ' };
      } else if (x >= pos - T.phosphor && !light(bgOf(c.style))) {
        cells[x] = { ...c, style: { ...c.style, fg: 'primary', bold: true } };
        if (c.w === 2) cells[x + 1] = { ...row[x + 1], style: cells[x].style };
      }
    }
    const under = grounds[y][pos];
    cells[pos] = { ch: '█', style: styled('accent', bgOf(under.style)), w: 1, kind: null };
    if (row[pos].w === 2) cells[pos + 1] = blank(bgOf(under.style));
    return cells;
  });

  // The rolling refresh bar: three rows lifted toward white, crossing the header once.
  const [barFrom, barTo] = T.bar;
  if (t > barFrom && t < barTo) {
    const bar = Math.floor(((t - barFrom) / (barTo - barFrom)) * (H + 4)) - 2;
    frame = frame.map((cells, y) => (Math.abs(y - bar) > 1 ? cells : cells.map((c) => {
      const bg = bgOf(c.style);
      return { ...c, style: { ...c.style, bg: blendFill('primary', bg, light(bg) ? 0.5 : 0.07) } };
    })));
  }
  // Until the typing starts every other frame dims; after it, the seeded glitches.
  let flicker = t < T.ground && chunk % 2 === 1;
  for (const g of glitches(H, end, o)) {
    if (t < g.t || t >= g.t + g.dur) continue;
    if (g.kind === 'flicker') flicker = true;
    else for (let y = g.y; y < Math.min(H, g.y + g.n); y++) frame[y] = tear(frame[y], grounds[y], g.shift);
  }
  if (flicker) frame = frame.map((cells) => cells.map((c) => {
    const fg = fgOf(c.style), bg = bgOf(c.style);
    return { ...c, style: { ...c.style, fg: blendFill(fg, bg, 0.45), bg: blendFill(bg, 'field', 0.7) } };
  }));
  return out(frame);
}
