import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS } from './cells.mjs';
import { BARCODE_BARS } from './barcode.mjs';
import { GLYPH_SHAPES, glyphShape } from './glyph-shapes.mjs';

const area = (parts) => parts.reduce((n, p) => n + (p.rect ? p.rect[2] * p.rect[3] : 0), 0);

test('every shape is a curated one-cell glyph with parts inside the unit cell', () => {
  for (const [ch, parts] of Object.entries(GLYPH_SHAPES)) {
    assert.ok(GLYPHS.includes(ch), `${ch} is curated`);
    assert.ok(Object.isFrozen(parts) && parts.length > 0, ch);
    for (const part of parts) {
      const points = part.rect ? [[part.rect[0], part.rect[1]], [part.rect[0] + part.rect[2], part.rect[1] + part.rect[3]]] : part.polygon ?? [];
      for (const [x, y] of points) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${ch} inside the cell`);
      if (part.line) assert.ok(['h', 'v'].includes(part.line));
      if (part.polygon) assert.ok(part.polygon.length >= 3);
    }
  }
});

test('block elements fill their fraction of the cell, from the edge the glyph names', () => {
  assert.deepEqual(glyphShape('█'), [{ rect: [0, 0, 1, 1] }]);
  assert.deepEqual(glyphShape('▀'), [{ rect: [0, 0, 1, 0.5] }]);
  assert.deepEqual(glyphShape('▄'), [{ rect: [0, 0.5, 1, 0.5] }]);
  assert.deepEqual(glyphShape('▐'), [{ rect: [0.5, 0, 0.5, 1] }]);
  [...'▏▎▍▌▋▊▉'].forEach((ch, i) => assert.equal(area(glyphShape(ch)), (i + 1) / 8, ch));
  for (const [ch, eighths] of [['▁', 1], ['▄', 4], ['▆', 6]]) assert.equal(area(glyphShape(ch)), eighths / 8, ch);
  // Every barcode bar is a shape (or a space), so bars on two rows join as one bar.
  for (const bar of BARCODE_BARS) assert.ok(bar === ' ' || glyphShape(bar), bar);
});

test('the Powerline triangles are the geometric triangles they stand for', () => {
  for (const [powerline, geometric] of [['\u{e0b8}', '◣'], ['\u{e0ba}', '◢'], ['\u{e0bc}', '◤'], ['\u{e0be}', '◥']]) {
    assert.deepEqual(glyphShape(powerline), glyphShape(geometric));
  }
  // ◢ (U+E0BA) fills the lower right: its right edge and bottom edge are whole.
  assert.deepEqual(glyphShape('\u{e0ba}')[0].polygon, [[1, 0], [1, 1], [0, 1]]);
});

test('text glyphs have no shape; a non-string throws', () => {
  for (const ch of ['A', ' ', '+', '®', '⟁', '■', '●', '…']) assert.equal(glyphShape(ch), null, ch);
  assert.throws(() => glyphShape(1), TypeError);
});
