import { assertLines, assertMs, assertTime, copyLines, inRegion, isStateCell, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { between, pick, random, shuffle } from '../foundation/seeded.mjs';

const config = (wait, frames, runs, len, glyphs) => Object.freeze({ wait: Object.freeze(wait), frames: Object.freeze(frames), runs: Object.freeze(runs), len: Object.freeze(len), glyphs: Object.freeze(glyphs) });
export const GHOST_GLITCH = Object.freeze({
  1: config([5500, 10000], [2, 3], [1, 1], [1, 3], ['▓', '▒']),
  2: config([2600, 5200], [3, 4], [1, 2], [2, 4], ['▓', '▒', '▚', '▞']),
  3: config([1200, 2800], [4, 6], [2, 3], [2, 6], ['▓', '▒', '░', '▚', '▞', '▀', '▄']),
});
export const GHOST_WAIT = Object.freeze([2200, 4200]);
export const GHOST_DEFAULTS = Object.freeze({ seed: 0, tick: 50, level: 1, mode: 'fill', region: undefined });
function check(options) {
  const o = resolveOptions('ghost', options, GHOST_DEFAULTS);
  random(o.seed); assertMs(o.tick, 'ghost tick', { min: 1 });
  if (![1, 2, 3].includes(o.level)) throw new RangeError('ghost level must be 1, 2 or 3');
  if (!['fill', 'registration'].includes(o.mode)) throw new RangeError('ghost mode must be fill or registration');
  if (o.region === undefined) throw new TypeError('ghost requires an explicit decoration-only region');
  o.region = resolveRegion('ghost', o.region); return o;
}
function cells(lines) { return lines.map((line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style })))); }
// footer.ts:847–889: the four geometry-only registration groups; no inferred plate identities.
function registration(lines, o) {
  const grid = cells(lines), r = random(o.seed), items = [], region = o.region;
  const height = Math.max(0, Math.min(region.rows, grid.length - region.top));
  const width = Math.max(0, Math.min(region.cols, ...grid.slice(region.top, region.top + height).map((row) => row.length - region.left)));
  if (!height || !width) return { items, duration: 0 };
  const top = (col, right = false) => ({ row: 0, col: right ? width - 1 - col : col });
  const bottom = (row, col, right = false) => ({ row: height - 1 - row, col: right ? width - 1 - col : col });
  const echo = (at, ch) => ({ at, frames: [{ ch, fg: 'secondary' }, { ch, fg: 'decorative' }, { ch, fg: 'decorative' }] });
  const lift = (at) => ({ at, frames: [null, { hide: true }] });
  const groups = [
    () => {
      const [anchor, near, ch] = pick(r, [[top(0), { row: 1, col: 1 }, '┏'], [top(0, true), { row: 1, col: width - 2 }, '┓'], [bottom(0, 0), bottom(1, 1), '┗'], [bottom(0, 0, true), bottom(1, 1, true), '┛']]);
      return [echo(near, ch), lift(anchor)];
    },
    () => [echo(pick(r, [{ row: 2, col: 0 }, { row: 2, col: width - 1 }, bottom(2, 0), bottom(2, 0, true)]), '┃')],
    () => {
      const [anchor, targets] = pick(r, [[top(0, true), [[top(2, true), '━'], [top(1, true), '┓']]], [bottom(0, 0, true), [[bottom(0, 2, true), '━'], [bottom(0, 1, true), '┛']]], [top(0), [[{ row: 1, col: 0 }, '┏'], [{ row: 1, col: 1 }, '━']]], [bottom(0, 0), [[bottom(1, 0), '┗'], [bottom(1, 1), '━']]]]);
      return [...targets.map(([at, ch]) => echo(at, ch)), lift(anchor)];
    },
    () => [echo({ row: 1, col: Math.floor(width / 2) + 1 }, '┼')],
  ];
  let start = 0;
  for (const group of shuffle(r, groups).slice(0, 2)) {
    for (const item of group()) items.push({ ...item, start });
    start += 2 + Math.floor(r() * 4);
  }
  return { items, duration: Math.max(...items.map((item) => item.start + item.frames.length)) * o.tick, grid };
}
export function ghostDuration(lines, options = {}) {
  assertLines(lines); const o = check(options);
  return o.mode === 'fill' ? between(random(o.seed), GHOST_GLITCH[o.level].frames) * o.tick : registration(lines, o).duration;
}
// footer.ts:1441–1456: seeded runs stay fixed during the event; readout and edge are excluded by targeting.
export function ghost(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'ghost');
  if (!o.animate || o.time >= ghostDuration(lines, options)) return copyLines(lines);
  const changes = new Map(), k = Math.floor(o.time / o.tick);
  if (o.mode === 'fill') {
    const cfg = GHOST_GLITCH[o.level], r = random(o.seed), rows = [];
    restyleCells(lines, (style, col, row, ch) => {
      if (inRegion(o.region, col, row) && '█▀▄▏▎▍▋▊▉▓▒░▚▞■'.includes(ch)) (rows[row] ??= []).push({ col, style });
    });
    for (let row = 0; row < rows.length; row++) {
      if (!rows[row]?.length) continue;
      const eligible = rows[row].length === 1 ? rows[row] : rows[row].slice(0, -1);
      const runs = between(r, cfg.runs);
      for (let q = 0; q < runs; q++) {
        const length = between(r, cfg.len), start = Math.floor(r() * eligible.length);
        for (let j = 0; j < length && start + j < eligible.length; j++) {
          const cell = eligible[start + j], ch = rows[row].length === 1 ? '▓' : pick(r, cfg.glyphs);
          const fg = o.level === 3 && r() < 0.12 ? 'primary' : cell.style.fg;
          changes.set(`${row}/${cell.col}`, { char: ch, style: { ...cell.style, fg } });
        }
      }
    }
  } else {
    const p = registration(lines, o);
    for (const item of p.items) {
      const spec = item.frames[k - item.start];
      if (!spec) continue;
      const row = o.region.top + item.at.row, col = o.region.left + item.at.col, cur = p.grid[row]?.[col];
      if (!cur || isStateCell(cur.style) || !inRegion(o.region, col, row)) continue;
      // Source lifts only a frame anchor, never text. Echoes are allowed only on blank neighbours here.
      if (spec.hide) {
        if ('┏┓┗┛┃━'.includes(cur.ch)) changes.set(`${row}/${col}`, { char: ' ', style: { bg: cur.style.bg } });
      } else if (cur.ch === ' ') changes.set(`${row}/${col}`, { char: spec.ch, style: { fg: spec.fg, bg: cur.style.bg } });
    }
  }
  return restyleCells(lines, (style, col, row) => changes.get(`${row}/${col}`));
}
