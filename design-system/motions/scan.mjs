import { MIN_PERIOD_MS, assertLines, assertMs, assertTime, blockWidth, copyLines, phase, resolveOptions, restyleCells } from './frame.mjs';

export const SCAN_DEFAULTS = Object.freeze({ period: 2400, band: 3, axis: 'x' });

// A highlight band sweeping across already-rendered lines. Text never changes; only the foreground of
// cells inside the band: accent, or white over accent cells, with the leading cell bold. Warning and
// critical cells keep their color. Frame at time 0 equals the input, so a scan can rest anywhere.
export function scan(lines, options = {}) {
  const o = resolveOptions('scan', options, SCAN_DEFAULTS);
  assertLines(lines);
  assertMs(o.period, 'scan period', { min: MIN_PERIOD_MS });
  if (!Number.isInteger(o.band) || o.band < 1 || o.band > 1000) throw new RangeError(`scan band must be an integer from 1 to 1000, got ${o.band}`);
  if (o.axis !== 'x' && o.axis !== 'y') throw new RangeError(`scan axis must be 'x' or 'y', got ${o.axis}`);
  assertTime(o, 'scan');
  if (!o.animate) return copyLines(lines);

  const extent = o.axis === 'x' ? blockWidth(lines) : lines.length;
  // The band enters before the first cell and leaves past the last, so the sweep starts and ends dark.
  const head = Math.floor(phase(o.time, o.period) * (extent + o.band));
  return restyleCells(lines, (style, col, row, ch) => {
    const at = o.axis === 'x' ? col : row;
    if (ch === ' ' || at >= head || at < head - o.band) return undefined;
    return { style: { ...style, fg: style.fg === 'accent' ? 'primary' : 'accent', bold: style.bold || at === head - 1 } };
  });
}
