import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';
import { numberedPanel, panelInnerWidth } from './numbered-panel.mjs';

const text = (lines) => lines.map((l) => paint(l, 'none'));
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const spec = { number: 3, title: 'GAUGES', meta: '1/8-CELL FILL' };

test('full panel: numbered header, rails, corners, and meta at 40+ cells', () => {
  const lines = text(numberedPanel(spec, [[span('BODY')]], { width: 40 }));
  assert.equal(lines[0], '┌▐03▌ GAUGES ────────── 1/8-CELL FILL ─┐');
  assert.equal(lines[1], '│ BODY                                 │');
  assert.equal(lines[2], '└──────────────────────────────────────┘');
});

test('compact panel below 40 cells keeps only the numbered rule', () => {
  const lines = text(numberedPanel(spec, [[span('BODY')]], { width: 39 }));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^▐03▌ GAUGES ─+ 1\/8-CELL FILL ─$/);
  assert.equal(lines[1].trimEnd(), 'BODY');
  assert.equal(panelInnerWidth(39), 39);
  assert.equal(panelInnerWidth(40), 36);
});

test('every width from 1 to 160 renders exactly that many cells', () => {
  const body = [[span('A LONG BODY LINE THAT MUST BE CLIPPED TO THE PANEL')]];
  for (let width = 1; width <= 160; width++) {
    for (const line of numberedPanel({ ...spec, title: 'A VERY LONG PANEL TITLE' }, body, { width })) {
      assert.equal(lineWidth(line), width, `width ${width}`);
      assert.ok(allowed(paint(line, 'none')));
    }
  }
});

test('meta is dropped before the title is truncated', () => {
  const [top] = text(numberedPanel({ number: 1, title: 'LABEL PLATES', meta: 'INFORMATIONAL, NOT BUTTONS' }, [], { width: 42 }));
  assert.match(top, /LABEL PLATES ─+┐$/);
});

test('height pads or clips the body to align neighbours', () => {
  assert.equal(numberedPanel(spec, [[span('A')]], { width: 50, height: 6 }).length, 6);
  assert.equal(numberedPanel(spec, [[span('A')], [span('B')], [span('C')]], { width: 50, height: 3 }).length, 3);
  assert.throws(() => numberedPanel(spec, [], { width: 50, height: 1 }), RangeError);
});

test('invalid numbers, widths, and injected titles are handled', () => {
  assert.throws(() => numberedPanel({ ...spec, number: 100 }, [], { width: 50 }), RangeError);
  assert.throws(() => numberedPanel({ ...spec, number: 1.5 }, [], { width: 50 }), RangeError);
  assert.throws(() => numberedPanel(spec, [], { width: 0 }), RangeError);
  assert.throws(() => numberedPanel(spec, [], { width: Number.NaN }), RangeError);
  const [top] = text(numberedPanel({ ...spec, title: 'X\x1b[2J' }, [], { width: 50 }));
  assert.doesNotMatch(top, /\x1b/);
  assert.match(top, /X\?\[2J/);
});
