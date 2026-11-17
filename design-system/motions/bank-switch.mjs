// The bank switch (T2): a block's lighting changes in vertical banks, left to right, each bank fading `fade` ms and
// starting `stagger` ms after the one on its left (four banks: 130 ms in all). Interruptible: a change during a switch
// restarts every bank from where it is. Pure; the host owns the clock and the change times.
import { resolveColor } from '../foundation/cells.mjs';
import { blendFill } from '../foundation/surface.mjs';
import { assertLines, assertMs, assertTime, joinCells, resolveOptions } from './frame.mjs';

export const BANK_SWITCH_DEFAULTS = Object.freeze({ banks: 4, stagger: 30, fade: 40, from: 0, to: 1 });

function check(name, options) {
  const o = resolveOptions(name, options, BANK_SWITCH_DEFAULTS);
  if (!Number.isInteger(o.banks) || o.banks < 1 || o.banks > 64) throw new RangeError('bankSwitch banks must be an integer 1–64');
  assertMs(o.stagger, 'bankSwitch stagger', { max: 1000 });
  assertMs(o.fade, 'bankSwitch fade', { min: 1, max: 1000 });
  const levels = Array.isArray(o.from) ? o.from : Array(o.banks).fill(o.from);
  if (levels.length !== o.banks || levels.some((v) => typeof v !== 'number' || !(v >= 0 && v <= 1))) throw new RangeError('bankSwitch from must be a level 0–1 or one per bank');
  if (typeof o.to !== 'number' || !(o.to >= 0 && o.to <= 1)) throw new RangeError('bankSwitch to must be a level 0–1');
  return { ...o, from: levels };
}

// Total ms until every bank has reached its level.
export function bankSwitchDuration(options = {}) {
  const o = check('bankSwitch', options);
  return o.fade + (o.banks - 1) * o.stagger;
}

// The bank a column of a `width`-cell block belongs to.
export function bankOf(col, width, banks = BANK_SWITCH_DEFAULTS.banks) {
  if (!Number.isInteger(col) || !Number.isInteger(width) || width < 1 || col < 0 || col >= width) throw new RangeError('bankOf needs a column inside its width');
  return Math.min(banks - 1, Math.floor((col * banks) / width));
}

// The banks of a `width`-cell block, for a host that animates natively: each bank's first column and width, and the
// delay and duration of its fade (an opacity transition on that bank's layer).
export function bankSchedule(width, options = {}) {
  const o = check('bankSwitch', options);
  if (!Number.isInteger(width) || width < 1) throw new RangeError('bankSchedule width must be a positive integer');
  const out = [];
  for (let b = 0; b < o.banks; b++) {
    const left = Math.ceil((b * width) / o.banks), right = Math.ceil(((b + 1) * width) / o.banks);
    if (right > left) out.push({ bank: b, left, cols: right - left, delay: b * o.stagger, duration: o.fade });
  }
  return out;
}

// Each bank's level at `time` ms after the change, from its own `from` level to `to`. Pass these as the next change's
// `from` to interrupt a switch.
export function bankLevels(options = {}) {
  const o = check('bankSwitch', options);
  assertTime(o, 'bankSwitch');
  return o.from.map((f, b) => (!o.animate ? o.to : f + (o.to - f) * Math.min(1, Math.max(0, (o.time - b * o.stagger) / o.fade))));
}

const cellsOf = (line) => line.flatMap((s) => [...s.text].map((ch) => ({ ch, style: s.style })));
const mix = (a, b, k, memo) => {
  if (a === undefined && b === undefined) return undefined;
  if (a === 'default' || b === 'default' || a === undefined || b === undefined) return k < 0.5 ? a : b;
  if (a === b) return a;
  const key = `${a}|${b}|${k}`;
  let v = memo.get(key);
  if (v === undefined) {
    v = resolveColor(a).toLowerCase() === resolveColor(b).toLowerCase() ? a : blendFill(b, a, k);
    memo.set(key, v);
  }
  return v;
};

// A terminal host's frame: `fromLines` (level 0) and `toLines` (level 1), the same size, composed cell by cell at
// each bank's level: colors mixed, and the glyph and weight of whichever is nearer. At the end, `toLines` at level 1
// (or `fromLines` at level 0).
export function bankSwitch(fromLines, toLines, options = {}) {
  assertLines(fromLines);
  assertLines(toLines);
  if (fromLines.length !== toLines.length) throw new RangeError('bankSwitch blocks must have the same rows');
  const levels = bankLevels(options), { banks } = check('bankSwitch', options), memo = new Map();
  return toLines.map((line, row) => {
    const a = cellsOf(fromLines[row]), b = cellsOf(line);
    if (a.length !== b.length) throw new RangeError('bankSwitch rows must have the same width');
    return joinCells(b.map((cell, col) => {
      const k = levels[bankOf(col, b.length, banks)], from = a[col];
      if (k >= 1) return cell;
      if (k <= 0) return from;
      const pick = k < 0.5 ? from : cell;
      const style = { ...pick.style };
      for (const key of ['fg', 'bg']) { const v = mix(from.style[key], cell.style[key], k, memo); if (v === undefined) delete style[key]; else style[key] = v; }
      return { ch: pick.ch, style };
    }));
  });
}
