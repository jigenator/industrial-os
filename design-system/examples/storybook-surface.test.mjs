import test from 'node:test';
import assert from 'node:assert/strict';
import { composeSurface } from '../foundation/surface.mjs';
import { lineWidth, paint } from '../foundation/cells.mjs';
import { SURFACE_STORY } from './storybook-surface.mjs';
import { STORIES } from './storybook-stories.mjs';

test('surface story uses executable public foundation calls for clear/fill/solid/NO_COLOR states', () => {
  assert.ok(STORIES.includes(SURFACE_STORY));
  for (const width of [1, 12, 24, 48, 66, 80, 160]) for (const variant of SURFACE_STORY.variants) for (const mode of ['TRUECOLOR', 'PLAIN']) {
    const specimen = SURFACE_STORY.specimen(variant, width, { mode });
    const source = specimen.calls.map((call, i) => i < 2 ? `const ${call};` : `return ${call};`).join('\n');
    const cells = new Function('composeSurface', source)(composeSurface);
    assert.deepEqual(cells, specimen.lines);
    assert.ok(specimen.lines.every((line) => lineWidth(line) === Math.min(66, width)));
    if (mode === 'PLAIN' || variant.name === 'NO_COLOR') {
      assert.ok(specimen.lines.flat().every((s) => s.style.fg === undefined && s.style.bg === undefined));
      assert.doesNotMatch(specimen.lines.map((l) => paint(l, 'none')).join('\n'), /·/);
    }
  }
});
