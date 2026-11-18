import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARK_BOX, MARK_PAD, SIDEBAR_ALPHA, SIDEBAR_COLORS, SIDEBAR_ICONS, STATE_MARKS, UNIT_KINDS, UNIT_STATUS, ZONE_STATUS,
  designation, gridReference, iconSvg, markFiles, markFrame, markSvg, spaceLetter, zoneStatus,
} from './sidebar-vocabulary.mjs';
import { ACID_BLACK } from './palette.mjs';

const CODES = ['QNS', 'BLK', 'WRK', 'SUB', 'RUN', 'DNE', 'IDL', 'UNK'];

test('colors are lowercase #rrggbb, opacities lie in (0, 1], and both are frozen', () => {
  for (const [name, hex] of Object.entries(SIDEBAR_COLORS)) assert.match(hex, /^#[0-9a-f]{6}$/, name);
  for (const [name, alpha] of Object.entries(SIDEBAR_ALPHA)) assert.ok(alpha > 0 && alpha <= 1, name);
  assert.ok(Object.isFrozen(SIDEBAR_COLORS) && Object.isFrozen(SIDEBAR_ALPHA));
});

test('the light on paper is paper times the accent, channel by channel', () => {
  const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const paper = channels(SIDEBAR_COLORS.paper), accent = channels(ACID_BLACK.accent);
  assert.deepEqual(channels(SIDEBAR_COLORS.light), paper.map((p, i) => Math.round((p * accent[i]) / 255)));
});

test('every state code has a status word and a mark; a zone takes the first status that applies', () => {
  assert.deepEqual(Object.keys(STATE_MARKS), CODES);
  assert.deepEqual(Object.keys(UNIT_STATUS).sort(), [...CODES].sort());
  assert.deepEqual(CODES.map((code) => UNIT_STATUS[code]), ['RFI', 'HOLD', 'ON TASK', 'ON TASK', 'EXEC', 'SITREP', 'STBY', 'NO COMMS']);
  assert.deepEqual(ZONE_STATUS, { halted: 'HALTED', active: 'ACTIVE', pending: 'PENDING', secure: 'SECURE' });
  assert.equal(zoneStatus([]), 'secure');
  assert.equal(zoneStatus(['BLK', 'BLK']), 'halted');
  assert.equal(zoneStatus(['BLK', 'WRK']), 'active');
  assert.equal(zoneStatus(['RUN', 'IDL']), 'active');
  assert.equal(zoneStatus(['BLK', 'IDL']), 'pending');
  assert.equal(zoneStatus(['QNS', 'DNE']), 'pending');
  assert.equal(zoneStatus(['DNE', 'IDL', 'UNK']), 'secure');
});

test('designations: a space letter, a two-digit tab from 01, a unit from 1', () => {
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(spaceLetter), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  assert.deepEqual([gridReference(0, 0), gridReference(1, 11), gridReference(2, 150)], ['A01', 'B12', 'C99']);
  assert.equal(designation('drd', 0, 0, 0), 'DRD-A01-1');
  assert.deepEqual(Object.keys(UNIT_KINDS).map((kind) => designation(kind, 3, 1, 2)), ['DRD-D02-3', 'AGT-D02-3', 'TRM-D02-3', 'MOD-D02-3']);
  assert.throws(() => spaceLetter(-1), RangeError);
  assert.throws(() => gridReference(0, 1.5), RangeError);
  assert.throws(() => designation('toString', 0, 0, 0), RangeError);
  assert.throws(() => designation('drd', 0, 0, -1), RangeError);
});

test('marks: moving marks step through their frames on any clock; still ones stay on frame 0', () => {
  assert.deepEqual(CODES.map((code) => [STATE_MARKS[code].frames.length, STATE_MARKS[code].stepMs, STATE_MARKS[code].lit]),
    [[2, 440, true], [1, 0, true], [8, 110, true], [4, 110, true], [4, 220, true], [1, 0, false], [1, 0, false], [1, 0, false]]);
  assert.deepEqual([0, 109, 110, 879, 880].map((ms) => markFrame('WRK', ms)), [0, 0, 1, 7, 0]);
  assert.deepEqual([markFrame('QNS', 440), markFrame('RUN', 660), markFrame('DNE', 99_999), markFrame('WRK', -5)], [1, 3, 0, 0]);
  assert.throws(() => markFrame('XYZ', 0), RangeError);
  assert.throws(() => markSvg('WRK', 8), RangeError);
  assert.throws(() => iconSvg('constructor'), RangeError);
});

test('drawn marks are one-color masks in a padded box; only lit ones carry a halo', () => {
  assert.equal(MARK_BOX, 9 + 2 * MARK_PAD);
  const files = markFiles();
  assert.equal(files.length, 22 + Object.keys(SIDEBAR_ICONS).length + 3);
  assert.equal(new Set(files.map(([name]) => name)).size, files.length);
  for (const [name, svg] of files) {
    assert.match(name, /^[a-z]+(-\d|-lit)?\.svg$/);
    assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${MARK_BOX}" height="${MARK_BOX}" viewBox="-${MARK_PAD} -${MARK_PAD} ${MARK_BOX} ${MARK_BOX}">`), name);
    // One color: every fill and stroke is the mask's black; the drawer tints it.
    for (const [, color] of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) assert.ok(color === '#000' || color === 'none', `${name}: ${color}`);
  }
  const has = (name) => files.find(([file]) => file === name)[1].includes('feGaussianBlur');
  assert.deepEqual(['wrk-0.svg', 'qns-1.svg', 'blk-0.svg', 'dne-0.svg', 'idl-0.svg', 'flag.svg', 'flag-lit.svg', 'droid.svg'].map(has), [true, true, true, false, false, false, true, false]);
  assert.equal(markSvg('SUB', 3), files.find(([file]) => file === 'sub-3.svg')[1]);
});
