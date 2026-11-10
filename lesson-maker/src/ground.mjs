// The background: a soft gradient with a faint dot texture, composed under every frame by the host.
import { resolveColor } from '@industrial-os/design-system/foundation/cells';
import { blendFill, composeSurface } from '@industrial-os/design-system/foundation/surface';
import { FROST_ALPHA } from '@industrial-os/design-system/foundation/surface-palette';

// The ground under everything: a soft top-to-bottom gradient with a faint dot lattice in empty space, as in Lunalee's
// chat pane (its gradient numbers), instead of flat black. Cells on the plain field take the gradient; plates, keycaps
// and other explicit backgrounds stay as drawn; quiet areas (typing boxes, the slide, popups, pictures) get no dots.
export const GROUND = { top: 34, drop: 26, edge: 8 };
export function surfaced(lines, quiet = [], color = true) {
  const height = lines.length,
    width = lines[0]?.length || 0;
  if (!width || !height) return lines;
  const rows = lines.map((row) =>
    row.map((cell) => {
      const bg = cell.style?.bg;
      // The surface strips (the header) are frosted over the ground, like the Pi header's strip under its plate.
      if (bg === 'surface') return { text: ' ', style: { bg: 'default' }, frost: cell };
      return bg === undefined || bg === 'field' ? { ...cell, style: { ...cell.style, bg: 'default' } } : cell;
    }),
  );
  const out = composeSurface(rows, {
    width,
    height,
    gradient: GROUND,
    exclude: quiet.map((rect) => ({ ...rect, mode: 'floor' })),
    color,
  });
  // A hovered row brightens its own ground a step, so the lift follows the gradient.
  if (color)
    for (const row of out)
      for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        if (cell.frost)
          row[x] = {
            ...cell.frost,
            style: { ...cell.frost.style, bg: blendFill('primary', cell.style.bg, FROST_ALPHA) },
          };
        if (row[x].lift) row[x].style = { ...row[x].style, bg: lift(row[x].style?.bg) };
      }
  return out;
}
const lift = (bg) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.min(255, parseInt(resolveColor(bg).slice(i, i + 2), 16) + 18)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
