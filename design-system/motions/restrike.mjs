import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';
import { random, pick } from '../foundation/seeded.mjs';

export const RESTRIKE_WAIT = Object.freeze([4000, 6000]);
export const RESTRIKE_DEFAULTS = Object.freeze({ seed: 0, tick: 50, programme: 'auto', treatment: 'plate', region: undefined });
const STRIKE = Object.freeze({ hard: Object.freeze(['heavy', 'void', 'flash', 'heavy', 'mid']), soft: Object.freeze(['light', 'worn', 'mid', 'light']) });
function check(options) {
  const o = resolveOptions('restrike', options, RESTRIKE_DEFAULTS);
  random(o.seed); assertMs(o.tick, 'restrike tick', { min: 1 });
  if (!['auto', 'hard', 'soft'].includes(o.programme)) throw new RangeError('restrike programme must be auto, hard or soft');
  if (!['plate', 'panel'].includes(o.treatment)) throw new RangeError('restrike treatment must be plate or panel');
  o.region = resolveRegion('restrike', o.region); return o;
}
// footer.ts:893–916: shared 2–5-step hit, pause, ragged drops, order and recovery tails.
function plan(lines, o) {
  const r = random(o.seed), items = new Map();
  const targets = [];
  restyleCells(lines, (style, col, row, ch) => {
    if (inRegion(o.region, col, row) && (o.treatment === 'panel' ? ch !== ' ' : (style.bg ?? 'field') !== 'field')) targets.push({ col, row });
  });
  if (!targets.length) return { items, duration: 0 };
  const hard = o.programme === 'auto' ? r() < 0.55 : o.programme === 'hard';
  const length = 2 + Math.floor(r() * 4), base = [];
  for (let k = 0; k < length; k++) {
    if (k > 0 && r() < 0.18) { base.push(null); continue; }
    base.push(pick(r, k === 0 ? (hard ? STRIKE.hard : STRIKE.soft) : r() < 0.35 ? STRIKE.hard : STRIKE.soft));
  }
  const left = Math.min(...targets.map((t) => t.col)), width = Math.max(...targets.map((t) => t.col)) - left + 1;
  const order = pick(r, ['ltr', 'rtl', 'mid', 'scatter']);
  const rank = (k) => order === 'ltr' ? k : order === 'rtl' ? width - 1 - k : order === 'mid' ? Math.abs(k - (width - 1) / 2) : Math.floor(r() * 3);
  const step = r() < 0.5 ? 0 : 1;
  let end = 0;
  targets.forEach((target, i) => {
    if (i !== 0 && targets.length > 2 && r() < 0.15) return;
    let frames = base.slice(0, Math.max(1, base.length - Math.floor(r() * 2)));
    if (r() < 0.25) frames = [...frames, null, pick(r, STRIKE.soft)];
    if (r() < 0.3) frames = frames.map((kind) => kind && r() < 0.4 ? pick(r, hard ? STRIKE.hard : STRIKE.soft) : kind);
    const start = Math.round(rank(target.col - left) * step);
    items.set(`${target.row}/${target.col}`, { start, frames });
    end = Math.max(end, start + frames.length);
  });
  return { items, duration: end * o.tick };
}
function plate(style, kind, ch) {
  const bg = style.bg ?? 'field', ink = ['structural', 'surface'].includes(bg) ? 'secondary' : bg;
  const wornBg = bg === 'surface' ? 'structural' : 'surface', flashBg = bg === 'primary' ? 'secondary' : 'primary';
  // Unlike strikeCell's padding textures, a space remains a space (frozen DS character contract).
  if (ch === ' ') return { fg: bg === 'surface' ? 'decorative' : bg, bg: ['heavy', 'mid', 'light', 'void'].includes(kind) ? 'field' : kind === 'flash' ? flashBg : wornBg, bold: false };
  if (kind === 'heavy' || kind === 'void') return { fg: ink, bg: 'field', bold: true };
  if (kind === 'mid' || kind === 'worn') return { fg: ink, bg: wornBg, bold: true };
  if (kind === 'flash') return { fg: 'field', bg: flashBg, bold: true };
  return { fg: bg === 'structural' ? 'primary' : 'field', bg: bg === 'structural' ? 'decorative' : 'secondary', bold: true };
}
function panel(style, kind, ch) {
  const ink = style.fg ?? 'primary';
  if ('█▀▄'.includes(ch)) {
    const fg = kind === 'heavy' || kind === 'void' ? 'structural' : kind === 'mid' ? (ink === 'decorative' ? 'secondary' : 'decorative') : kind === 'flash' ? (ink === 'primary' ? 'accent' : 'primary') : ink === 'secondary' ? 'primary' : 'secondary';
    return { fg, bg: 'field', bold: style.bold };
  }
  if (kind === 'heavy' || kind === 'void') return { fg: 'field', bg: ink, bold: true };
  if (kind === 'mid' || kind === 'worn') return { fg: ink, bg: 'surface', bold: style.bold };
  if (kind === 'flash') return { fg: 'field', bg: 'primary', bold: true };
  return { fg: 'primary', bg: 'structural', bold: style.bold };
}
export function restrikeDuration(lines, options = {}) { assertLines(lines); const o = check(options); return plan(lines, o).duration; }
// footer.ts:967–999: plate backgrounds and panel ink, never new characters.
export function restrike(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'restrike');
  if (!o.animate) return copyLines(lines);
  const p = plan(lines, o);
  if (o.time >= p.duration) return copyLines(lines);
  const k = Math.floor(o.time / o.tick);
  return restyleCells(lines, (style, col, row, ch) => {
    const item = p.items.get(`${row}/${col}`), kind = item?.frames[k - item.start];
    return kind ? { style: o.treatment === 'plate' ? plate(style, kind, ch) : panel(style, kind, ch) } : undefined;
  });
}
