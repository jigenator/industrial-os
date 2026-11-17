// Seeded randomness for decorations that vary: the same seed always draws the same plan. Pure; no clock or
// Math.random. Ported from status-bar's footer so plans drawn here behave like the extension's.

// A generator of numbers in [0, 1) from a 32-bit seed (mulberry32). Each call advances `cursor`.
export function random(seed) {
  if (!Number.isInteger(seed)) throw new RangeError(`seed must be an integer, got ${seed}`);
  const next = () => {
    next.cursor = (next.cursor + 0x6d2b79f5) | 0;
    let t = Math.imul(next.cursor ^ (next.cursor >>> 15), 1 | next.cursor);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.cursor = seed | 0;
  return next;
}

// A stateless number in [0, 1) for three integers, such as a cell's column, row and a seed.
export function hash(a, b, c) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1013904223)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Integer in [low, high], inclusive.
export const between = (r, [low, high]) => low + Math.floor(r() * (high - low + 1));
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export function shuffle(r, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const seedFrom = (r) => Math.floor(r() * 2 ** 31);
