import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { aluminiumAt, blendFill, composeSurface, dotAt, surfaceAt } from './surface.mjs';
import { ALUMINIUM_GROUND, SURFACE_PALETTE as P } from './surface-palette.mjs';

const rows = (width, height, bg) => Array.from({ length: height }, () => Array.from({ length: width }, () => ({ text: ' ', style: bg ? { bg } : {} })));
const at = (bg, alpha, options = {}) => composeSurface(rows(12, 2, bg), { width: 12, height: 2, fills: { [bg]: { alpha } }, ...options });
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('surfaceAt matches the locked 66×79 formula, edge cases and adjacent-color steps', () => {
  const golden = [];
  for (let y = 0; y < 79; y++) for (let x = 0; x < 66; x++) {
    const l = Math.round(19 - 10 * y / 78 - 3 * ((x - 32.5) / 32.5) ** 2);
    const expected = '#' + [l, l + 1, l + 3].map((c) => c.toString(16).padStart(2, '0')).join('');
    const actual = surfaceAt(x, y, { width: 66, height: 79 });
    golden.push(actual);
    assert.equal(actual, expected);
    for (const [i, j] of [[x - 1, y], [x, y - 1]]) if (i >= 0 && j >= 0) {
      assert.ok(rgb(actual).every((c, n) => Math.abs(c - rgb(surfaceAt(i, j, { width: 66, height: 79 }))[n]) <= 1));
    }
  }
  assert.equal(new Set(golden).size, 14);
  assert.equal(surfaceAt(0, 0, { width: 1, height: 1 }), '#131416');
  assert.equal(surfaceAt(0, 78, { width: 1, height: 79 }), '#090a0c');
  assert.equal(surfaceAt(0, 0, { width: 66, height: 1 }), '#101113');
  assert.equal(surfaceAt(0, 78, { width: 66, height: 79 }), '#060709');
  assert.equal(createHash('sha256').update(golden.join('')).digest('hex'), '117e602a55fc9cbd0747cc2414b9655952a93ff1a329624bb19eee7d9ac3fc52');
});

test('dot lattice uses stable hashed minor inks and every fifth major intersection', () => {
  for (let y = 0; y < 79; y++) for (let x = 0; x < 160; x++) {
    const dot = dotAt(x, y);
    if (x < 2 || y < 1 || (x - 2) % 4 || (y - 1) % 2) assert.equal(dot, null);
    else if ((x - 2) % 20 === 0 && (y - 1) % 10 === 0) assert.equal(dot, '#383a3f');
    else {
      let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      assert.equal(dot, ['#24252a', '#27282d', '#2a2b30', '#2d2e33'][(h ^ (h >>> 16)) >>> 0 & 3]);
    }
  }
});

test('floor clearance uses occupied cells, preserves authored dots, and respects wide continuations', () => {
  const input = rows(26, 2);
  input[1][4].text = '·'; // authored separator, not a floor glyph
  input[1][11].text = '界';
  input[1][12] = { text: '', continuation: true };
  input[1][17].text = 'e\u0301';
  input[1][21].text = '👩‍💻';
  input[1][22] = { text: '', continuation: true };
  const before = structuredClone(input);
  const result = composeSurface(input, { width: 26, height: 2 });
  assert.deepEqual(input, before);
  assert.equal(result[1][4].text, '·');
  for (const x of [2, 6, 10, 14, 18, 22]) assert.equal(result[1][x].text, input[1][x].text);
  assert.equal(result[1][12].text, '');
  assert.equal(result[1][21].text, '👩‍💻');
});

test('every locked fill keeps exact alpha math and dot ink underneath; solid roles stay solid', () => {
  const locked = [
    [P.accent, 1], [P.yellow, 1], [P.critical, 1], [P.criticalHover, 1],
    ...[P.answered, P.wheat, P.wheatHi, P.bone, P.structural].map((c) => [c, 1 - 1.5 * (1 - .74)]),
    [P.orange, .80], [P.warning, .68], [P.plateGrey, .69], [P.declined, .72],
    [P.surface, .25], [P.tint, 1 - 1.5 * (1 - .55)], [P.tintHi, 1 - 1.5 * (1 - .55)],
    [P.selection, .25], [P.hover, 1 - 1.5 * (1 - .45)],
  ];
  for (const [fill, alpha] of locked) {
    const result = at(fill, alpha);
    const dot = result[1][2];
    assert.equal(dot.style.bg, blendFill(fill, surfaceAt(2, 1, { width: 12, height: 2 }), alpha));
    assert.equal(dot.text, alpha === 1 ? ' ' : '·');
    if (alpha < 1) assert.equal(dot.style.fg, blendFill(fill, '#383a3f', alpha));
    assert.equal(dot.style.bg, '#' + rgb(fill).map((c, i) => Math.round(c * alpha + [8, 9, 11][i] * (1 - alpha)).toString(16).padStart(2, '0')).join(''));
  }
  const solid = at(P.wheat, .1, { fills: { [P.wheat]: { alpha: .1, solid: true } } });
  assert.equal(solid[1][2].style.bg, P.wheat);
  assert.equal(solid[1][2].text, ' ');
  assert.equal(blendFill('#ffffff', '#000000', .5), '#808080');
});

test('opaque backgrounds, image floor masks and highlight preservation are separate operations', () => {
  const input = rows(12, 2);
  input[1][6].style = { bg: 'field', fg: 'primary' };
  input[1][10].style = { bg: 'primary', fg: 'field' };
  const output = composeSurface(input, { width: 12, height: 2, exclude: [{ x: 2, y: 1, width: 1, height: 1, mode: 'floor' }, { x: 0, y: 0, width: 1, height: 1, mode: 'all' }] });
  assert.equal(output[1][2].text, ' ');
  assert.equal(output[1][2].style.bg, surfaceAt(2, 1, { width: 12, height: 2 }));
  assert.deepEqual(output[0][0], input[0][0]);
  assert.deepEqual(output[1][6], input[1][6]);
  assert.deepEqual(output[1][10], input[1][10]);
  const plain = composeSurface(input, { width: 12, height: 2, color: false });
  assert.deepEqual(plain.map((r) => r.map((c) => c.text)), input.map((r) => r.map((c) => c.text)));
  assert.ok(plain.flat().every((c) => c.style.fg === undefined && c.style.bg === undefined));
});

test('origins and resized/narrow/tall rectangles use absolute surface coordinates', () => {
  for (let width = 1; width <= 160; width++) for (const height of [1, 2, 79]) {
    const full = composeSurface(rows(width, height), { width, height });
    assert.equal(full.length, height);
    assert.ok(full.every((row) => row.length === width));
    const cropped = composeSurface(rows(1, 1), { width, height, origin: { x: width - 1, y: height - 1 } });
    assert.deepEqual(cropped[0][0], full[height - 1][width - 1]);
  }
});

test('surface boundaries reject invalid sizes, coordinates, fills, cells and injection', () => {
  for (const n of [0, -1, 1.5, 1001, NaN, Infinity, '1']) assert.throws(() => surfaceAt(0, 0, { width: n, height: 1 }), RangeError);
  for (const [x, y] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) assert.throws(() => surfaceAt(x, y, { width: 1, height: 1 }), RangeError);
  for (const alpha of [-1, 2, NaN, Infinity]) assert.throws(() => blendFill('accent', 'field', alpha), RangeError);
  assert.throws(() => blendFill('default', 'field', .5), TypeError);
  for (const text of ['', 'AB', '\x1b', '\u202e', '\n']) assert.throws(() => composeSurface([[{ text }]], { width: 1, height: 1 }));
  assert.throws(() => composeSurface([Array(1)], { width: 1, height: 1 }), TypeError);
  assert.throws(() => composeSurface([[{ text: '', continuation: true }]], { width: 1, height: 1 }), RangeError);
  assert.throws(() => composeSurface(rows(2, 2), { width: 1, height: 2 }), RangeError);
  assert.throws(() => composeSurface(rows(2, 2), { width: 2, height: 2, fills: { accent: { alpha: '1' } } }), TypeError);
  assert.throws(() => composeSurface(rows(2, 2), { width: 2, height: 2, color: 'false' }), TypeError);
  assert.throws(() => composeSurface(rows(2, 2), { width: 2, height: 2, exclude: [{ x: 0, y: 0, width: 1, height: 1, mode: 'bad' }] }), RangeError);
});

test('locked plate fixtures retain 4.5:1 black/white text contrast at both gradient extrema', () => {
  const luminance = (color) => rgb(color).map((c) => c / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const plates = [[P.accent, 1], [P.yellow, 1], [P.critical, 1], [P.criticalHover, 1],
    ...[P.answered, P.wheat, P.wheatHi, P.bone].map((fill) => [fill, 1 - 1.5 * (1 - .74)]),
    [P.orange, .8], [P.warning, .68], [P.plateGrey, .69], [P.declined, .72]];
  for (const under of ['#131416', '#060709']) {
    for (const [fill, alpha] of plates) assert.ok(contrast(P.field, blendFill(fill, under, alpha)) >= 4.5, `${fill}/${under}`);
    assert.ok(contrast(P.primary, blendFill(P.structural, under, 1 - 1.5 * (1 - .74))) >= 4.5);
  }
});

test('duplicate fill keys are rejected after role resolution and RGB case normalisation', () => {
  for (const fills of [
    { accent: { alpha: .2 }, '#c0fe04': { alpha: .7 } },
    { '#C0FE04': { alpha: .7 }, accent: { alpha: .2 } },
    { '#1C1C1C': { alpha: .2 }, '#1c1c1c': { alpha: .7 } },
  ]) assert.throws(() => composeSurface(rows(1, 1), { width: 1, height: 1, fills }), RangeError);
});

test('surface preserves opaque host metadata on decorated and plain cells without mutating input', () => {
  const input = rows(12, 2).map((row, y) => row.map((cell, x) => ({ ...cell, raw: `cell-${x}-${y}`, link: { id: `link-${x}` } })));
  const original = structuredClone(input);
  for (const color of [true, false]) {
    const output = composeSurface(input, { width: 12, height: 2, color });
    for (let y = 0; y < 2; y++) for (let x = 0; x < 12; x++) {
      assert.equal(output[y][x].raw, input[y][x].raw);
      assert.equal(output[y][x].link, input[y][x].link);
      assert.notEqual(output[y][x], input[y][x]);
    }
    assert.equal(output[1][2].text, color ? '·' : ' ');
  }
  assert.deepEqual(input, original);
});

test('surface gradient is configurable; defaults are unchanged', () => {
  const size = { width: 66, height: 79 };
  for (const [x, y] of [[0, 0], [33, 0], [65, 78], [10, 40]]) assert.equal(surfaceAt(x, y, { ...size, gradient: {} }), surfaceAt(x, y, size));
  assert.equal(surfaceAt(32, 0, { ...size, gradient: { top: 40 } }), '#28292b');
  assert.equal(surfaceAt(0, 78, { ...size, gradient: { top: 10, drop: 20, edge: 20 } }), '#000103');
  assert.throws(() => surfaceAt(0, 0, { ...size, gradient: { top: 300 } }), RangeError);
  assert.throws(() => surfaceAt(0, 0, { ...size, gradient: { drop: -1 } }), RangeError);
  assert.throws(() => surfaceAt(0, 0, { ...size, gradient: { edge: 'x' } }), TypeError);
  const row = [[{ text: ' ' }, { text: 'a' }]];
  const strong = composeSurface(row, { width: 2, height: 1, gradient: { top: 40 } })[0];
  assert.equal(strong[1].style.bg, surfaceAt(1, 0, { width: 2, height: 1, gradient: { top: 40 } }));
  assert.equal(composeSurface(row, { width: 2, height: 1 })[0][1].style.bg, surfaceAt(1, 0, { width: 2, height: 1 }));
});

test('dot clearance and floor are opt-in; the defaults are unchanged', () => {
  // One inked cell at x 8: the default keeps dots two cells away, clearance 1 only one.
  const input = rows(20, 2);
  input[1][8].text = 'x';
  const ink = (o) => composeSurface(input, { width: 20, height: 2, ...o })[1].map((c) => c.text).join('');
  assert.equal(ink({}), ink({ dotClearance: 2, dotFloor: 0 }));
  assert.equal(ink({}), '  ·     x     ·   · ');
  assert.equal(ink({ dotClearance: 1 }), '  ·     x     ·   · '.replace(/^(.{6}) /, '$1·').replace(/^(.{10}) /, '$1·'));
  const tight = rows(20, 2);
  tight[1][4].text = 'x';
  assert.deepEqual([2, 6].map((x) => composeSurface(tight, { width: 20, height: 2 })[1][x].text), [' ', ' ']);
  assert.deepEqual([2, 6].map((x) => composeSurface(tight, { width: 20, height: 2, dotClearance: 1 })[1][x].text), ['·', '·']);
  // The floor: no dot where the gradient's lightness is below dotFloor; the ground itself is unchanged.
  const fade = { top: 19, drop: 19, edge: 3 };
  const tall = composeSurface(rows(30, 20), { width: 30, height: 20, gradient: fade, dotFloor: 9 });
  tall.forEach((row, y) => row.forEach((c, x) => {
    const l = parseInt(surfaceAt(x, y, { width: 30, height: 20, gradient: fade }).slice(1, 3), 16);
    assert.equal(c.style.bg, surfaceAt(x, y, { width: 30, height: 20, gradient: fade }));
    if (c.text === '·') assert.ok(l >= 9, `${x},${y}`);
    else if (dotAt(x, y) && l >= 9) assert.fail(`missing dot at ${x},${y}`);
  }));
  for (const bad of [0, 3, '1', 1.5]) assert.throws(() => composeSurface(rows(2, 1), { width: 2, height: 1, dotClearance: bad }), RangeError);
  for (const bad of [-1, 256, 1.5, '9']) assert.throws(() => composeSurface(rows(2, 1), { width: 2, height: 1, dotFloor: bad }), RangeError);
});

test('aluminiumAt is the plate ground formula and its hairline, inside 8-bit RGB', () => {
  const { base, band, fall, streaks, channels, hair } = ALUMINIUM_GROUND;
  const hex = (v) => '#' + v.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
  for (const width of [1, 2, 40, 60, 104, 1000]) for (let y = 0; y < 6; y++) for (const x of [0, 1, Math.floor(width / 2), width - 1].filter((x) => x < width)) {
    const u = width === 1 ? 0 : 2 * x / (width - 1) - 1;
    const l = base + band * (1 - u * u) - fall * (y / 5) + streaks.reduce((s, k) => s + k.amplitude * Math.sin(x * k.x + y * k.y), 0);
    const ground = channels.map((d) => Math.max(0, Math.min(255, Math.round(l + d))));
    assert.deepEqual(aluminiumAt(x, y, { width }), { ground: hex(ground), hair: hex(ground.map((c) => c + hair)) });
  }
  for (const [x, y, width] of [[0, 6, 10], [10, 0, 10], [-1, 0, 10], [0, 0, 0], [0.5, 0, 10]]) assert.throws(() => aluminiumAt(x, y, { width }), RangeError);
});
