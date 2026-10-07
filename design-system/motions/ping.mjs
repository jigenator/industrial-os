import { assertLines, assertMs, assertTime, copyLines, inRegion, resolveOptions, resolveRegion, restyleCells } from './frame.mjs';

export const PING_DEFAULTS = Object.freeze({ launch: 160, stagger: 40, ghostAt: 440, ghostFor: 120, repeatAfter: 720, repeats: 1, frame: 40, region: undefined });
function check(options) {
  const o = resolveOptions('ping', options, PING_DEFAULTS);
  for (const key of ['launch', 'stagger', 'ghostAt', 'repeatAfter']) assertMs(o[key], `ping ${key}`);
  for (const key of ['ghostFor', 'frame']) assertMs(o[key], `ping ${key}`, { min: 1 });
  if (o.ghostAt < o.launch || !Number.isInteger(o.repeats) || o.repeats < 0 || o.repeats > 100 || (o.repeats && !o.repeatAfter)) throw new RangeError('ping needs ghostAt >= launch, repeats 0–100 and a positive repeatAfter when repeating');
  o.region = resolveRegion('ping', o.region);
  return o;
}
function positions(lines, region) {
  return lines.map((line, row) => {
    const cols = []; let col = 0;
    for (const s of line) for (const ch of s.text) { if (ch !== ' ' && inRegion(region, col, row)) cols.push(col); col++; }
    return cols;
  });
}
export function pingDuration(lines, options = {}) {
  assertLines(lines); const o = check(options);
  const count = Math.max(0, ...positions(lines, o.region).map((p) => p.length));
  return count ? Math.ceil((o.ghostAt + (count - 1) * o.stagger + o.ghostFor + o.repeats * o.repeatAfter) / o.frame) * o.frame : 0;
}
// claude-interrupt/src/index.ts:67–71,113–120. Hosts remove the bar line on completion.
export function ping(lines, options = {}) {
  assertLines(lines); const o = check(options); assertTime(o, 'ping');
  if (!o.animate) return copyLines(lines);
  const indices = positions(lines, o.region).map((cols) => new Map(cols.map((col, i) => [col, i])));
  const repeat = o.repeatAfter ? Math.min(o.repeats, Math.max(0, Math.floor((o.time - o.launch) / o.repeatAfter))) : 0;
  const t = Math.floor((o.time - repeat * o.repeatAfter) / o.frame) * o.frame;
  return restyleCells(lines, (style, col, row) => {
    const i = indices[row].get(col);
    if (i === undefined) return undefined;
    const at = o.ghostAt + i * o.stagger;
    if (t < o.launch + i * o.stagger || t >= at + o.ghostFor) return { char: ' ' };
    return { style: { ...style, fg: t < at ? 'accent' : 'decorative', bold: true } };
  });
}
