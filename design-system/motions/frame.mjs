// Shared seam for the motion primitives: option and time validation, plus per-cell restyling.
// Pure and I/O-free. See motions/README.md for the contract every motion shares.
import { lineWidth, span } from '../foundation/cells.mjs';

// Fastest allowed cycle. One cycle is at most one flash, so 400 ms keeps every motion at or below 2.5 Hz.
export const MIN_PERIOD_MS = 400;
export const MAX_MS = 60_000;

// Warning and critical cells are never recolored, dimmed, or hidden by any motion.
const STATE_ROLES = ['warning', 'critical'];
const isStateCell = (style) => STATE_ROLES.includes(style.fg) || STATE_ROLES.includes(style.bg);

export function assertLines(lines) {
  if (!Array.isArray(lines)) throw new TypeError(`motion input must be an array of lines, got ${typeof lines}`);
  for (const line of lines) {
    if (!Array.isArray(line)) throw new TypeError('each motion input line must be an array of spans');
    for (const s of line) {
      if (s === null || typeof s !== 'object' || typeof s.text !== 'string') throw new TypeError('each span must be { text, style } with string text');
    }
  }
}

// Merge caller options over defaults. Unknown names throw so a typo cannot silently change nothing;
// undefined means "use the default". `time` and `animate` are accepted by every motion.
export function resolveOptions(name, options, defaults) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError(`${name} options must be an object`);
  const allowed = [...Object.keys(defaults), 'time', 'animate'];
  const resolved = { ...defaults, animate: true, time: undefined };
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) throw new TypeError(`${name} has no option '${key}'`);
    if (options[key] !== undefined) resolved[key] = options[key];
  }
  if (typeof resolved.animate !== 'boolean') throw new TypeError(`${name} animate must be a boolean, got ${typeof resolved.animate}`);
  return resolved;
}

export function assertMs(value, name, { min = 0, max = MAX_MS } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number of milliseconds from ${min} to ${max}, got ${value}`);
  }
}

// Time is required exactly when the motion is animating; motion-off ignores it.
export function assertTime(o, name) {
  if (o.animate && (typeof o.time !== 'number' || !Number.isFinite(o.time) || o.time < 0)) {
    throw new RangeError(`${name} time must be a finite number of milliseconds >= 0, got ${o.time}`);
  }
}

// Position within a repeating cycle, in [0, 1).
export const phase = (time, period) => (time % period) / period;

export const copyLines = (lines) => lines.map((line) => line.slice());

export const blockWidth = (lines) => lines.reduce((max, line) => Math.max(max, lineWidth(line)), 0);

const norm = (s) => `${s.fg ?? 'secondary'}|${s.bg ?? 'field'}|${s.bold ?? false}`;

// Rebuild every line cell by cell. fn(style, col, row, char) returns undefined to keep the cell, or
// { style?, char? } to restyle it or swap its single character. Cell count and order never change, so
// every line keeps its exact width. Adjacent cells with the same style are merged into one span.
export function restyleCells(lines, fn) {
  return lines.map((line, row) => {
    const out = [];
    let col = 0;
    for (const s of line) {
      for (const ch of s.text) {
        const change = isStateCell(s.style) ? undefined : fn(s.style, col, row, ch);
        const style = change?.style ?? s.style;
        const char = change?.char ?? ch;
        const prev = out[out.length - 1];
        if (prev && norm(prev.style) === norm(style)) prev.text += char;
        else out.push(span(char, style));
        col += 1;
      }
    }
    return out;
  });
}
