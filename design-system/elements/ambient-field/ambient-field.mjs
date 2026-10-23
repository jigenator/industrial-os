import { CellGrid } from '../../foundation/cell-grid.mjs';
import { resolveColor, span } from '../../foundation/cells.mjs';
import { mixOver } from '../../foundation/signal-colors.mjs';
const lift = (bg, k) => '#' + [1,3,5].map(i => Math.round(parseInt(bg.slice(i,i+2),16)*(1-k)+255*k).toString(16).padStart(2,'0')).join('');

export function ambientField(lines, { enabled = true, regions = [] } = {}) {
  if (typeof enabled !== 'boolean' || !Array.isArray(regions)) throw new TypeError('invalid ambient options');
  if (!lines.length) return [];
  const width = lines[0].reduce((a, s) => a + [...s.text].length, 0), grid = new CellGrid(width, lines.length);
  grid.place(0, 0, lines);
  const held = Array.from({ length: grid.height }, () => Array(width).fill(false));
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < width; x++) if (grid.rows[y][x].text !== ' ' || resolveColor(grid.rows[y][x].style.bg ?? 'field') !== resolveColor('field')) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (held[y + dy]?.[x + dx] !== undefined) held[y + dy][x + dx] = true;
  }
  for (const r of regions) {
    if (['x', 'y', 'width', 'height'].some(k => !Number.isInteger(r[k]) || r[k] < 0)) throw new RangeError('ambient regions must be nonnegative integers');
    for (let y = r.y; y < Math.min(grid.height, r.y + r.height); y++) for (let x = r.x; x < Math.min(width, r.x + r.width); x++) held[y][x] = true;
  }
  const free = (x, y) => x >= 0 && x < width && y >= 0 && y < grid.height && !held[y][x];
  for (let y = 0; y < grid.height; y++) {
    const bg = mixOver('surface', 0.6 * (1 - y / Math.max(1, grid.height - 1)));
    for (let x = 0; x < width; x++) {
      let { text, style } = grid.rows[y][x];
      if (enabled && y > 0 && free(x, y)) {
        const gx = x >= 4 && (x - 4) % 8 === 0, gy = y >= 3 && (y - 3) % 4 === 0;
        if (gx || gy) { text = gx && gy ? '┼' : gx ? '│' : '─'; style = { fg: lift(bg, 0.045) }; }
        else if (y % 2 === 0 && (x + (y % 4 ? 2 : 0)) % 4 === 0) { text = '·'; style = { fg: lift(bg, 0.11) }; }
      }
      grid.rows[y][x] = span(text, { ...style, bg: resolveColor(style.bg ?? 'field') === resolveColor('field') ? bg : style.bg });
    }
  }
  if (enabled) for (const [gc, gr] of [[3, 11], [1, 12], [10, 9], [13, 6]]) {
    const x = 4 + gc * 8, y = 3 + gr * 4, label = `${'ABCDEFGHJKLMN'[gr]}${String(gc + 1).padStart(2, '0')}`;
    let clear = true; for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 6; dx++) if (!free(x + dx, y + dy)) clear = false;
    if (!clear) continue;
    const put = (xx, yy, ch) => grid.put(xx, yy, ch, { fg: lift(grid.rows[yy][xx].style.bg, 0.2), bg: grid.rows[yy][xx].style.bg });
    put(x, y, '┼'); for (const dx of [-2, -1, 1, 2]) put(x + dx, y, '─'); put(x, y - 1, '│'); put(x, y + 1, '│'); [...label].forEach((ch, i) => put(x + 2 + i, y + 1, ch));
  }
  return grid.lines();
}
