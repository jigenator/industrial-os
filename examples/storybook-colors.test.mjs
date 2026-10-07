import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { lineWidth, paint, span } from '../foundation/cells.mjs';
import { INDUSTRIALOS_COLORS, shadeRamp } from '../foundation/industrialos-colors.mjs';
import { composeStorybook, hitAction, initialState, press } from './storybook-layout.mjs';
import { HUE_GROUPS } from './storybook-colors.mjs';
import { STORIES, canPlay } from './storybook-stories.mjs';

const INDEX = STORIES.findIndex((s) => s.id === 'colors');
const STORY = STORIES[INDEX];
const at = (variant = 0, extra = {}) => ({ ...initialState(), story: INDEX, variant, ...extra });
const plain = (view) => view.lines.map((l) => paint(l, 'none'));
// The story pane alone: from 72 columns the index sidebar and its gap take the first 22 cells.
const pane = (view, columns) => plain(view).map((l) => (columns >= 72 ? [...l].slice(22).join('') : l));
const full = (variant, columns, mode = 'TRUECOLOR') => composeStorybook(at(variant), { columns, mode });
const isSwatch = (s) => /^█+$/.test(s.text);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';');

test('COLORS is story 8, a FOUNDATION view after the original seven, and never plays', () => {
  assert.deepEqual(STORIES.map((s) => s.id), ['numbered-panel', 'label-plate', 'gauge', 'status-row', 'scan', 'pulse', 'reveal', 'colors']);
  assert.deepEqual([STORY.kind, STORY.title, STORY.variants.map((v) => v.name)], ['foundation', 'COLORS', ['PALETTE', 'SHADES']]);
  const all = plain(composeStorybook(at(), { columns: 120, rows: 40 })).join('\n');
  assert.match(all, /COMPONENTS[\s\S]*MOTIONS[\s\S]*FOUNDATION\s+│[\s\S]*> 08 COLORS/);
  assert.match(all, /▐08▌ COLORS ─+ FOUNDATION 8\/8/);
  assert.match(all, /VIEW {2}\[PALETTE\] {2}SHADES/);
  assert.match(all, /1-8 JUMP/);
  assert.match(all, /REFERENCE VALUES, NOT A THEME OR LIVE DATA/);
  assert.doesNotMatch(all, /FIXTURE/);
  assert.doesNotMatch(all, /▐ DEMO ▌|P PLAY|R REPLAY|O OFF/);
  for (const variant of STORY.variants) for (const mode of ['PLAIN', 'TRUECOLOR']) assert.equal(canPlay(STORY, variant, mode), false);
  const s = at();
  for (const action of ['play-pause', 'replay', 'motion-off']) assert.equal(press(s, action, { now: 5, mode: 'TRUECOLOR' }), s, action);
});

test('the index needs 15 rows beside the panel; shorter frames name the story instead', () => {
  const tall = composeStorybook(at(), { columns: 72, rows: 15 });
  const lines = plain(tall);
  assert.ok(lines.some((l) => l.startsWith('> 08 COLORS')));
  const row = lines.findIndex((l) => l.startsWith('> 08 COLORS')) + 1;
  assert.equal(hitAction(tall, { column: 1, row }), 'story:7');
  assert.equal(hitAction(tall, { column: 3, row: lines.findIndex((l) => l.startsWith('  07 REVEAL')) + 1 }), 'story:6');
  const short = plain(composeStorybook(at(), { columns: 72, rows: 14 })).join('\n');
  assert.doesNotMatch(short, /FOUNDATION\s+│/);
  assert.match(short, /▐08▌ COLORS/);
  assert.deepEqual(plain(composeStorybook(at(), { columns: 1, rows: 1 })), ['0']);
  assert.deepEqual(plain(composeStorybook(at(1), { columns: 24, rows: 3 }))[0], '08 COLORS  [SHADES] 2/2 ');
});

test('every IndustrialOS color is in exactly one hue group, in hue order', () => {
  assert.deepEqual(HUE_GROUPS.map((g) => g.title), ['LIME', 'RED / ORANGE', 'MAGENTA', 'VIOLET / INDIGO', 'BLUE', 'MINT', 'YELLOW', 'NEUTRAL']);
  const shown = HUE_GROUPS.flatMap((g) => g.colors);
  assert.equal(shown.length, INDUSTRIALOS_COLORS.length);
  assert.deepEqual(new Set(shown), new Set(INDUSTRIALOS_COLORS));
  const families = Object.fromEntries(HUE_GROUPS.map((g) => [g.title, [...new Set(g.colors.map((c) => c.family))]]));
  assert.deepEqual(families['RED / ORANGE'], ['red-orange', 'orange']);
  assert.deepEqual(families['VIOLET / INDIGO'], ['violet', 'indigo']);
  assert.deepEqual(families.NEUTRAL, ['neutral']);
  assert.ok(Object.isFrozen(HUE_GROUPS) && HUE_GROUPS.every((g) => Object.isFrozen(g) && Object.isFrozen(g.colors)));
});

test('each hue group holds hex values of that hue; neutrals have no chroma', () => {
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d === 0) return null;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const ranges = { LIME: [60, 90], 'RED / ORANGE': [0, 30], MAGENTA: [300, 330], 'VIOLET / INDIGO': [245, 265], BLUE: [200, 245], MINT: [135, 160], YELLOW: [50, 65] };
  for (const group of HUE_GROUPS) for (const color of group.colors) {
    if (group.title === 'NEUTRAL') assert.equal(hue(color.hex), null, color.id);
    else {
      const [lo, hi] = ranges[group.title];
      assert.ok(hue(color.hex) >= lo && hue(color.hex) <= hi, `${color.id} ${hue(color.hex)}`);
    }
  }
});

test('palette rows pair each real swatch with its hex, name, and role', () => {
  for (const columns of [120, 60, 40]) {
    const view = full(0, columns);
    const text = pane(view, columns);
    const prose = text.join(' ').replace(/[│\s]+/g, ' ');
    const compact = text.join('').replace(/[│\s]/g, ''); // narrow wrapping may split long words
    for (const color of INDUSTRIALOS_COLORS) {
      const i = text.findIndex((l) => l.includes(`  ${color.hex}`) && l.includes('██'));
      assert.ok(i >= 0, `${columns}: ${color.id}`);
      const swatches = view.lines[i].filter(isSwatch);
      assert.equal(swatches.length, 1);
      assert.deepEqual(swatches[0].style, { fg: color.hex, bg: color.hex });
      assert.ok(paint(view.lines[i], 'truecolor').includes(`\x1b[0;38;2;${rgb(color.hex)};48;2;${rgb(color.hex)}m██████`), `${color.id} SGR`);
      assert.ok(text.slice(i, i + 2).join(' ').includes(color.name), `${columns}: ${color.id} name`);
      assert.ok(compact.includes(color.role.replace(/\s/g, '')), `${columns}: ${color.id} role`);
    }
    assert.match(prose, /22 COLORS IN 8 HUE GROUPS\./);
    assert.match(prose, /A reference page, not a theme: Acid \/ Black stays the default palette/);
  }
});

test('shade ramps come from shadeRamp(): exact base, four DERIVED steps, in columns or stacked', () => {
  const wide = full(1, 120);
  const wideText = pane(wide, 120);
  const narrow = full(1, 40);
  const narrowText = plain(narrow);
  for (const color of INDUSTRIALOS_COLORS) {
    const ramp = shadeRamp(color.hex);
    assert.equal(ramp[2].hex, color.hex, 'center is the exact listed value');
    const head = wideText.findIndex((l) => l.includes(`${color.name}  ${color.hex}`));
    assert.ok(head >= 0, color.id);
    const left = wideText[head + 2].indexOf(ramp[0].hex);
    const cells = (row) => ramp.map((_, i) => wideText[head + row].slice(left + i * 11, left + i * 11 + 9).trim());
    assert.deepEqual(wide.lines[head + 1].filter(isSwatch).map((s) => s.style), ramp.map((s) => ({ fg: s.hex, bg: s.hex })));
    assert.deepEqual(cells(2), ramp.map((s) => s.hex));
    assert.deepEqual(cells(3), ['BLACK 75%', 'BLACK 40%', 'BASE', 'WHITE 40%', 'WHITE 75%']);
    assert.deepEqual(cells(4), ['DERIVED', 'DERIVED', '', 'DERIVED', 'DERIVED']);
    const start = narrowText.findIndex((l) => l.includes(color.name) && l.includes(color.hex));
    assert.ok(start >= 0, `narrow ${color.id}`);
    const after = narrowText.slice(start);
    ramp.forEach((step, j) => {
      const k = after.findIndex((l) => l.includes(`████  ${step.hex}  ${step.label}${j === 2 ? ' ' : '  DERIVED'}`));
      assert.ok(k >= 0 && k <= 7, `narrow ${color.id} ${step.id}`);
      assert.doesNotMatch(after[k], j === 2 ? /DERIVED/ : /BASE/);
      assert.deepEqual(narrow.lines[start + k].filter(isSwatch)[0].style, { fg: step.hex, bg: step.hex });
    });
  }
  const prose = wideText.join(' ').replace(/[│\s]+/g, ' ');
  assert.match(prose, /110 STEPS: 22 EXACT BASES AND 88 DERIVED/);
  assert.match(prose, /generated here, not part of the collection, and not perceptually uniform/);
});

test('every color and ramp step stays reachable by paging at narrow, short sizes', () => {
  for (const [columns, rows] of [[120, 24], [60, 12], [40, 9], [30, 6], [24, 5], [12, 4]]) {
    for (const variant of [0, 1]) {
      let state = at(variant);
      let view = composeStorybook(state, { columns, rows });
      const seen = new Set(plain(view));
      for (let guard = 0; guard < 2000 && state.offset < view.maxOffset; guard++) {
        state = press(state, 'page-down', view);
        view = composeStorybook(state, { columns, rows });
        plain(view).forEach((l) => seen.add(l));
      }
      assert.equal(state.offset, view.maxOffset, `${columns}x${rows} reached the end`);
      const text = [...seen].join('\n');
      const hexes = variant ? INDUSTRIALOS_COLORS.flatMap((c) => shadeRamp(c.hex).map((s) => s.hex)) : INDUSTRIALOS_COLORS.map((c) => c.hex);
      for (const hex of hexes) assert.ok(text.includes(hex), `${columns}x${rows} ${variant} ${hex}`);
      if (columns >= 40) for (const c of INDUSTRIALOS_COLORS) assert.ok(text.includes(c.name), `${columns}x${rows} ${c.name}`);
      if (variant) assert.ok(text.includes('DERIVED') && text.includes('BASE'));
    }
  }
});

test('both views fit every width from 1 to 160 in plain mode, at short and unbounded heights', () => {
  for (const variant of [0, 1]) for (let columns = 1; columns <= 160; columns++) for (const rows of [1, 2, 4, 9, 15, 24, undefined]) {
    const view = composeStorybook(at(variant), { columns, rows, mode: 'PLAIN' });
    if (rows !== undefined) assert.ok(view.lines.length <= rows, `${columns}x${rows}`);
    for (const line of view.lines) assert.equal(lineWidth(line), columns, `${variant} ${columns}x${rows}`);
  }
});

test('plain output has the same cells as color, says swatches need color, and never escapes', () => {
  for (const variant of [0, 1]) {
    for (const [columns, rows] of [[120, 40], [60, 20], [24, 6], [1, 1]]) {
      const color = composeStorybook(at(variant), { columns, rows, mode: 'TRUECOLOR' });
      for (const line of color.lines) {
        assert.equal(lineWidth(line), columns);
        assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
      }
    }
    const shown = (mode) => plain(composeStorybook(at(variant), { columns: 120, mode })).join('\n');
    assert.match(shown('PLAIN'), /PLAIN OUTPUT: swatches show position only; the hex values carry each color\./);
    assert.doesNotMatch(shown('TRUECOLOR'), /PLAIN OUTPUT/);
    assert.doesNotMatch(plain(composeStorybook(at(variant), { columns: 120, mode: 'PLAIN' })).join(''), /\x1b/);
  }
});

test('usage text executes and returns exactly the swatches drawn (the page shows them in hue order)', () => {
  const order = (spans) => spans.map((s) => JSON.stringify(s)).sort();
  for (const variant of STORY.variants) {
    for (const width of [1, 4, 24, 40, 53, 60, 94]) {
      const specimen = STORY.specimen(variant, width);
      const statements = specimen.calls.map((c) => c.replace(/^(\w+) = /, 'const $1 = ')).join('\n');
      // Execute only our trusted, generated example source; no user input is evaluated.
      const run = new Function('INDUSTRIALOS_COLORS', 'shadeRamp', 'span', `${statements}\nreturn swatches;`);
      const drawn = specimen.lines.flatMap((l) => l.filter(isSwatch));
      const made = run(INDUSTRIALOS_COLORS, shadeRamp, span).flat();
      assert.deepEqual(order(made), order(drawn), `${variant.name}/${width}`);
      for (const line of specimen.lines) assert.equal(lineWidth(line), Math.min(width, 76));
    }
  }
});
