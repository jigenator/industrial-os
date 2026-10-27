import { assertCells, resolveColor, resolveStyle, cells } from './cells.mjs';
import { SURFACE_PALETTE } from './surface-palette.mjs';

const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });
const hex = (channels) => '#' + channels.map((v) => v.toString(16).padStart(2, '0')).join('');
const rgb = (value) => [1, 3, 5].map((i) => parseInt(resolveColor(value).slice(i, i + 2), 16));
const mix = (fill, under, alpha) => hex(fill.map((v, i) => Math.round(v * alpha + under[i] * (1 - alpha))));
const integer = (n, name) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
};
const coordinate = (x, y) => { integer(x, 'x'); integer(y, 'y'); };

// The current gradient: top-centre lightness, its drop to the bottom and its extra drop to the sides.
export const SURFACE_GRADIENT = Object.freeze({ top: 19, drop: 10, edge: 3 });
const gradientOf = (gradient) => {
  if (gradient === undefined) return SURFACE_GRADIENT;
  if (!gradient || typeof gradient !== 'object' || Array.isArray(gradient)) throw new TypeError('gradient must be an object');
  const g = { ...SURFACE_GRADIENT, ...gradient };
  for (const key of ['top', 'drop', 'edge']) if (typeof g[key] !== 'number' || !Number.isFinite(g[key])) throw new TypeError(`gradient ${key} must be a finite number`);
  if (g.top < 0 || g.top > 252) throw new RangeError('gradient top must be 0–252');
  if (g.drop < 0 || g.edge < 0) throw new RangeError('gradient drop and edge must be nonnegative');
  return g;
};

// The gradient in absolute pane/popup cells. A one-cell axis samples its top/center. Lightness clamps at 0.
export function surfaceAt(x, y, { width, height, gradient } = {}) {
  assertCells(width, 'surface width');
  assertCells(height, 'surface height');
  coordinate(x, y);
  if (x >= width || y >= height) throw new RangeError('surface coordinate is outside its size');
  const { top, drop, edge } = gradientOf(gradient);
  const t = height === 1 ? 0 : y / (height - 1);
  const u = width === 1 ? 0 : 2 * x / (width - 1) - 1;
  const l = Math.max(0, Math.round(top - drop * t - edge * u * u));
  return hex([l, l + 1, l + 3]);
}

// Stable unsigned integer hash; deliberately independent of time, seed, and viewport size.
function dotHash(x, y) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function dotAt(x, y) {
  coordinate(x, y);
  if (x < 2 || y < 1 || (x - 2) % 4 || (y - 1) % 2) return null;
  return (x - 2) / 4 % 5 === 0 && (y - 1) / 2 % 5 === 0
    ? SURFACE_PALETTE.dotMajor : SURFACE_PALETTE.dots[dotHash(x, y) % SURFACE_PALETTE.dots.length];
}

export function blendFill(fill, under, alpha) {
  if (typeof alpha !== 'number') throw new TypeError('alpha must be a number');
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new RangeError('alpha must be 0–1');
  return mix(rgb(fill), rgb(under), alpha);
}

// Cell rows are already parsed by the host. No ANSI parsing, environment lookup or token interpretation happens here.
export function composeSurface(rows, { width, height, origin = { x: 0, y: 0 }, fills = {}, exclude = [], color = true, gradient } = {}) {
  assertCells(width, 'surface width');
  assertCells(height, 'surface height');
  coordinate(origin.x, origin.y);
  if (typeof color !== 'boolean') throw new TypeError('color must be boolean');
  gradient = gradientOf(gradient);
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(rows[0]) || !rows[0].length) throw new TypeError('surface needs nonempty cell rows');
  const columns = rows[0].length;
  if (origin.x + columns > width || origin.y + rows.length > height) throw new RangeError('cell rows exceed surface size');
  if (!fills || typeof fills !== 'object' || Array.isArray(fills)) throw new TypeError('fills must be a color-to-fill map');
  const fillMap = new Map();
  for (const [color, fill] of Object.entries(fills)) {
    const key = resolveColor(color).toLowerCase();
    if (fillMap.has(key)) throw new RangeError('duplicate resolved fill color');
    if (!fill || typeof fill !== 'object') throw new TypeError('fill must have alpha');
    blendFill(key, key, fill.alpha);
    if (fill.solid !== undefined && typeof fill.solid !== 'boolean') throw new TypeError('solid must be boolean');
    fillMap.set(key, fill.solid ? 1 : fill.alpha);
  }
  if (!Array.isArray(exclude)) throw new TypeError('exclude must be an array');
  const masks = Array.from(rows, () => new Uint8Array(columns));
  for (const { x, y, width: w, height: h, mode = 'floor' } of exclude) {
    coordinate(x, y);
    assertCells(w, 'exclusion width');
    assertCells(h, 'exclusion height');
    if (!['floor', 'all'].includes(mode)) throw new RangeError('unknown exclusion mode');
    if (x + w > width || y + h > height) throw new RangeError('exclusion exceeds surface size');
    for (let j = Math.max(y, origin.y); j < Math.min(y + h, origin.y + rows.length); j++) {
      const row = masks[j - origin.y];
      for (let i = Math.max(x, origin.x); i < Math.min(x + w, origin.x + columns); i++) {
        row[i - origin.x] = Math.max(row[i - origin.x], mode === 'all' ? 2 : 1);
      }
    }
  }
  return Array.from(rows, (row, y) => {
    if (!Array.isArray(row) || row.length !== columns) throw new RangeError('surface rows must have equal cell counts');
    const busy = new Uint8Array(columns);
    const copy = Array.from(row, (cell, x) => {
      if (!cell || typeof cell !== 'object' || typeof cell.text !== 'string') throw new TypeError('surface cell needs text');
      if (cell.continuation !== undefined && typeof cell.continuation !== 'boolean') throw new TypeError('continuation must be boolean');
      if (cell.continuation) {
        if (cell.text !== '' || !x || row[x - 1].continuation) throw new RangeError('continuation must follow a leading cell and have empty text');
      } else {
        // Measurement here only validates one safe grapheme; the host supplies its cell geometry.
        if (cells(cell.text, { measure: (text) => [...graphemes.segment(text)].length }) !== 1) throw new RangeError('cell text must be one grapheme');
      }
      resolveStyle(cell.style);
      if (cell.text !== ' ' || cell.continuation) {
        for (let i = Math.max(0, x - 2); i <= Math.min(columns - 1, x + 2); i++) busy[i] = 1;
      }
      return { ...cell, style: { ...cell.style } };
    });
    return copy.map((cell, x) => {
      if (!color) {
        const { fg, bg, ...style } = cell.style;
        return { ...cell, style };
      }
      if (masks[y][x] === 2) return cell;
      const absoluteX = origin.x + x, absoluteY = origin.y + y;
      const under = surfaceAt(absoluteX, absoluteY, { width, height, gradient });
      const own = cell.style.bg === undefined || cell.style.bg === 'default' ? null : resolveColor(cell.style.bg).toLowerCase();
      const alpha = own === null ? 0 : fillMap.get(own);
      // Explicit unconfigured backgrounds (including white locks and black) remain opaque.
      if (alpha === undefined) return cell;
      cell.style.bg = own === null ? under : blendFill(own, under, alpha);
      if (cell.text !== ' ' || cell.continuation || busy[x] || masks[y][x] || alpha === 1) return cell;
      const dot = dotAt(absoluteX, absoluteY);
      if (dot) {
        cell.text = '·';
        cell.style.fg = own === null ? dot : blendFill(own, dot, alpha);
      }
      return cell;
    });
  });
}
