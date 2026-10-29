import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, lineWidth, paint, span, textSlot } from '../../foundation/cells.mjs';
import { SURFACE_PALETTE as P } from '../../foundation/surface-palette.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';
import { cardHeading, cardState, sheetCard, SHEET_STATES } from './sheet-card.mjs';

const plain = line => paint(line, 'none');
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
const measure = text => [...segmenter.segment(text)].reduce((n, { segment }) => n + (/\p{Script=Han}|\p{Extended_Pictographic}/u.test(segment) ? 2 : 1), 0);
const rich = text => textSlot([span(text, { fg: 'accent', bg: 'default', italic: true })], measure(text), { measure });
const preset = Object.freeze({ working: Object.freeze({ code: 'WRK', shape: '◐', tone: 'accent', frameTone: P.bone, hoverTone: 'primary', headingTone: P.bone, bold: true }) });
const input = { heading: { mark: '▣', kind: 'PANE', number: '03', state: 'working' }, title: 'A long synthetic title', gist: ['Activity', 'Detail'], footer: null, button: 'jump' };
const find = (row, text) => row.find(s => s.text.includes(text));

test('sheet-card extension: neutral frame, custom word and independent hover/heading/bold inks', () => {
  const options = { width: 60, preset };
  const rows = sheetCard(input, options), hover = sheetCard({ ...input, hover: true }, options);
  assert.equal(rows.length, 4);
  assert.match(plain(rows[0]), /▣ PANE 03/);
  assert.ok(plain(rows[0]).endsWith('WRK ◐ '));
  for (const row of [rows[0], hover[0]]) {
    assert.equal(find(row, 'PANE').style.fg, P.bone);
    assert.equal(find(row, 'WRK').style.fg, 'accent');
    assert.equal(find(row, 'WRK').style.bold, true);
  }
  assert.equal(find(rows[1], '█').style.fg, P.bone);
  assert.equal(find(hover[1], '█').style.fg, 'primary');
  assert.equal(find(rows[1], 'jump').style.bg, P.bone);
  assert.equal(find(hover[1], 'jump').style.bg, 'primary');
  const quiet = sheetCard({ ...input, read: true, hover: true }, options);
  assert.equal(find(quiet[1], '█').style.fg, SIGNAL_COLORS.ghost);
  assert.equal(find(quiet[1], 'jump').style.fg, P.wheatHi);
  assert.ok(quiet.every(row => row.every(s => s.style.bg === 'default')));
  const word = cardState({ state: 'unread' }, { preset: { unread: { ...SHEET_STATES.unread, bold: false } } });
  assert.ok(word.every(s => !s.style.bold));
});

test('sheet-card extension: kind is safe text or a measured slot; empty omits its word and gap', () => {
  assert.match(plain(cardHeading({ kind: '', number: '03' }, { width: 50 })), /^ ▤ 03  /);
  assert.match(plain(cardHeading({ kind: '\x1bX', number: '03' }, { width: 50 })), /^ ▤ \?X 03/);
  const heading = cardHeading({ mark: '▣', kind: rich('日本 é 👩‍💻'), number: '03' }, { width: 60, measure });
  assert.match(plain(heading), /▣ 日本 é 👩‍💻 03/);
  assert.equal(find(heading, '日本').style.italic, true);
  const codePreset = { working: { ...preset.working, code: rich('◐ WRK'), shape: '' } };
  assert.equal(plain(cardState({ state: 'working' }, { preset: codePreset, measure })), '◐ WRK');
  for (const mark of GLYPHS) assert.equal(lineWidth(cardHeading({ mark }, { width: 20 })), 20);
});

test('sheet-card extension: title yields to readouts, explicit backgrounds survive, no action means no gap', () => {
  const readouts = Object.freeze([Object.freeze(span('2 AU', Object.freeze({ fg: 'accent', bold: true }))), Object.freeze(span(' ^] ', Object.freeze({ fg: P.bone, bg: 'surface' }))), Object.freeze(span(' tail', Object.freeze({ fg: 'secondary', bg: 'default', underline: true })))]);
  const options = { width: 44, preset };
  for (const hover of [false, true]) for (const read of [false, true]) {
    const rows = sheetCard({ ...input, readouts, hover, read }, options);
    const bg = read ? 'default' : hover ? P.tintHi : P.tint;
    assert.equal(find(rows[1], '2 AU').style.bg, bg);
    assert.equal(find(rows[1], '^]').style.bg, 'surface');
    assert.equal(find(rows[1], 'tail').style.bg, bg);
    assert.equal(find(rows[1], 'tail').style.underline, true);
    assert.match(plain(rows[1]), /2 AU.*\^\].*tail.*jump/);
  }
  const none = sheetCard({ title: 'abcdefghijklmnopqrstuvwxyz', button: null, footer: null }, { width: 20 });
  assert.equal(plain(none[1]), ' █ abcdefghijklmno… ');
  assert.equal(none.length, 4);
  assert.equal(sheetCard({ footer: '' }, { width: 20 }).length, 5);
  assert.equal(sheetCard({ footer: null, kind: 'question' }, { width: 20 }).length, 3);
  assert.match(plain(sheetCard({ title: 'x', readouts: [span('R')], button: null }, { width: 10 })[1]), /^ █ x    R $/);
});

test('sheet-card extension: widths 1–160, oversized tails/actions, measured graphemes and no mutation', () => {
  const readouts = [span('日本 é 👩‍💻', { fg: 'accent', bg: 'default' }), span(' ^] ', { fg: P.bone, bg: 'surface' })];
  const value = { ...input, heading: { ...input.heading, kind: rich('日本') }, title: rich('日本 title'), readouts };
  const before = JSON.stringify(value);
  for (let width = 1; width <= 160; width++) for (const button of [null, 'jump', 'a long action']) {
    const rows = sheetCard({ ...value, button }, { width, measure, preset });
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.equal(lineWidth(row, { measure }), width);
      assert.equal(paint(row, 'truecolor').replace(/\x1b\[[0-9;]*m/g, ''), plain(row));
      assert.ok(!plain(row).includes('?'));
    }
  }
  assert.equal(JSON.stringify(value), before);
});

test('sheet-card extension: invalid mark, kind, preset and readout boundaries reject unsafe inputs', () => {
  for (const mark of ['', 'xx', 'A', '🙂', '\x1b', null, 1]) assert.throws(() => cardHeading({ mark }, { width: 40 }), TypeError);
  for (const kind of [null, 1, [], {}]) assert.throws(() => cardHeading({ kind }, { width: 40 }), TypeError);
  assert.throws(() => cardHeading({ kind: rich('日本') }, { width: 40 }), TypeError);
  assert.throws(() => cardHeading({ kind: '\x1bX' }, { width: 40, measure }), TypeError);
  for (const preset of [null, [], {}, Object.create({ unread: SHEET_STATES.unread })]) {
    assert.throws(() => cardState({}, { preset }), RangeError);
    assert.throws(() => sheetCard({}, { width: 40, preset }), RangeError);
  }
  for (const entry of [null, 1, {}, { ...SHEET_STATES.unread, bold: 1 }, ...['tone','headingTone','hoverTone','frameTone'].map(key => ({ ...SHEET_STATES.unread, [key]: 'invalid' }))]) {
    assert.throws(() => cardState({}, { preset: { unread: entry } }), TypeError);
  }
  for (const readouts of [null, {}, [null], ['text'], [span('\x1b[31m')], [span('X', { fg: 'invalid' })], [span('日本')]]) {
    assert.throws(() => sheetCard({ readouts }, { width: 40 }), TypeError);
  }
  for (const style of [null, 'accent', [], { bold: 'yes' }, { italic: 1 }]) for (const hostMeasure of [undefined, measure]) {
    assert.throws(() => sheetCard({ readouts: [span('X', style)] }, { width: 40, measure: hostMeasure }), TypeError);
  }
  assert.throws(() => sheetCard({ readouts: [span('a'), span('\u0301')] }, { width: 40, measure }), RangeError);
  assert.throws(() => sheetCard({ readouts: [span('\u202eevil')] }, { width: 40, measure }), TypeError);
});

test('sheet-card extension: explicit defaults match omissions, own prototype-named custom states are safe', () => {
  const input = { heading: { state: 'unread' }, title: 'Fixture' };
  for (const width of [1, 12, 40, 80]) assert.deepEqual(
    sheetCard({ ...input, heading: { ...input.heading, mark: '▤', kind: 'SHEET' }, readouts: [], button: 'open', footer: '' }, { width, preset: SHEET_STATES }),
    sheetCard(input, { width }));
  for (const state of ['constructor', 'toString', '__proto__']) {
    const preset = { [state]: { code: 'SAFE', shape: '✓', tone: 'accent' } };
    const rows = sheetCard({ heading: { state }, hover: true, title: 'Fixture' }, { width: 40, preset });
    assert.equal(find(rows[1], '█').style.fg, 'accent');
    assert.match(plain(rows[0]), /SAFE ✓/);
    rows.forEach(row => paint(row, 'truecolor'));
  }
});
