// The glyphs a terminal draws as built-in shapes rather than from its font (block elements, the light box-drawing
// lines, the Powerline and geometric triangles), as geometry in one cell, for a host that places shapes on a pixel
// grid instead of setting text (a Herdr mod). Drawn this way they fill their cells exactly, as a terminal draws them,
// whatever font the host has. Every other glyph is text, from the terminal's font. Data only.
//
// A glyph's parts, in a unit cell (x right, y down, 0–1):
//   { rect: [x, y, w, h] }        a filled rectangle
//   { line: 'h' | 'v' }           a light stroke through the cell's middle; the host picks its thickness, as a
//                                 terminal does (one device pixel or more)
//   { polygon: [[x, y], …] }      a filled polygon, corners in order
const rect = (x, y, w, h) => Object.freeze({ rect: Object.freeze([x, y, w, h]) });
const polygon = (...points) => Object.freeze({ polygon: Object.freeze(points.map((p) => Object.freeze(p))) });
const shape = (...parts) => Object.freeze(parts);

const LOWER_LEFT = polygon([0, 0], [0, 1], [1, 1]);
const LOWER_RIGHT = polygon([1, 0], [1, 1], [0, 1]);
const UPPER_LEFT = polygon([0, 0], [1, 0], [0, 1]);
const UPPER_RIGHT = polygon([0, 0], [1, 0], [1, 1]);

export const GLYPH_SHAPES = Object.freeze({
  // Block elements: halves, the full block, and the eighths the design system draws.
  '▀': shape(rect(0, 0, 1, 1 / 2)),
  '▁': shape(rect(0, 7 / 8, 1, 1 / 8)),
  '▄': shape(rect(0, 1 / 2, 1, 1 / 2)),
  '▆': shape(rect(0, 2 / 8, 1, 6 / 8)),
  '█': shape(rect(0, 0, 1, 1)),
  '▉': shape(rect(0, 0, 7 / 8, 1)),
  '▊': shape(rect(0, 0, 6 / 8, 1)),
  '▋': shape(rect(0, 0, 5 / 8, 1)),
  '▌': shape(rect(0, 0, 1 / 2, 1)),
  '▍': shape(rect(0, 0, 3 / 8, 1)),
  '▎': shape(rect(0, 0, 2 / 8, 1)),
  '▏': shape(rect(0, 0, 1 / 8, 1)),
  '▐': shape(rect(1 / 2, 0, 1 / 2, 1)),
  // Light box-drawing lines.
  '─': shape(Object.freeze({ line: 'h' })),
  '│': shape(Object.freeze({ line: 'v' })),
  // Powerline full-cell triangles (the unit plate's peak, the crate banner's stroke) and the geometric triangles
  // they stand for.
  '\u{e0b8}': shape(LOWER_LEFT),
  '\u{e0ba}': shape(LOWER_RIGHT),
  '\u{e0bc}': shape(UPPER_LEFT),
  '\u{e0be}': shape(UPPER_RIGHT),
  '◣': shape(LOWER_LEFT),
  '◢': shape(LOWER_RIGHT),
  '◤': shape(UPPER_LEFT),
  '◥': shape(UPPER_RIGHT),
});

// The shape of one glyph, or null when it is text.
export function glyphShape(ch) {
  if (typeof ch !== 'string') throw new TypeError('glyph must be a string');
  return Object.hasOwn(GLYPH_SHAPES, ch) ? GLYPH_SHAPES[ch] : null;
}
