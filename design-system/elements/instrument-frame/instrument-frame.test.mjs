import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint, span } from '../../foundation/cells.mjs';
import { labelPlate } from '../label-plate/label-plate.mjs';
import { COUNT_PLATES, countPlate } from '../count-plate/count-plate.mjs';
import { threadRailPieces } from '../thread-rail/thread-rail.mjs';
import { FRAME_MINIMAL_BELOW, frameGeometry, instrumentFrame, wrapLine } from './instrument-frame.mjs';

const text = (lines) => lines.map((l) => paint(l, 'none'));
const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const t = (s, style = {}) => [span(s, style)];
const slab = (s, tone) => labelPlate(s, { form: 'slab', tone });
const activity = { working: true, units: 3 };
// status-bar's framed lamp is a space on acid; the design-system lamp draws `█`. To compare plain text with the
// footer's snapshots the tests pass the footer's own lamp cell, which also shows that asides are caller pieces.
const footerRail = (marks = true) => [t(' ', { bg: 'accent' }), ...threadRailPieces(activity, { marks }).slice(1)];

// pi/status-bar/test/footer.test.ts fixture(): the same fields, rendered by the caller as plain content.
function fixture(width, { pr = true, gauge, scale } = {}) {
  return {
    header: { plate: countPlate(12, COUNT_PLATES.compactions), title: t(pr ? '■ owner/repo · PR #42' : '■ owner/repo'), aside: [footerRail(), footerRail(false)] },
    spacer: [t('cwd /launch unrelated')],
    rows: [
      { plate: slab('01 ACT', 'accent'), lines: [t('⑂ feature/ui modified')] },
      { plate: slab('02 CTX', 'accent'), lines: [t(gauge), ...(scale ? [t(scale)] : [])] },
      { plate: slab('03 MDL', 'bright'), lines: [t('provider/model · thinking high', { bg: 'surface' })], bg: 'surface' },
      { plate: slab('05 EXT'), lines: [t('Other status'), t('Ponytail: ready')] },
    ],
  };
}

test('72 columns: the footer snapshot, with marks, center mark and side stubs', () => {
  // footer.test.ts "responsive compact, narrow and minimal layouts", rows(f, 72) with no PR.
  const out = text(instrumentFrame(fixture(72, {
    pr: false,
    gauge: ' 32k/128k ██                    ┃         ┃',
    scale: '0                      50       70        90  100',
  }), { width: 72 }));
  assert.deepEqual(out, [
    '┏━ CMP×12  ■ owner/repo             ┼      ROOT  █·█·█·······  03 AU  ━┓',
    '┃          cwd /launch unrelated                                       ┃',
    '   01 ACT  ⑂ feature/ui modified                                        ',
    '   02 CTX   32k/128k ██                    ┃         ┃                  ',
    '           0                      50       70        90  100            ',
    '   03 MDL  provider/model · thinking high                               ',
    '┃  05 EXT  Other status                                                ┃',
    '┗━         Ponytail: ready                                            ━┛',
  ]);
});

test('48 columns: the aside moves to its own row when it cannot sit beside the whole title', () => {
  // footer.test.ts rows(f, 48).
  const out = text(instrumentFrame(fixture(48, { gauge: ' 32k/128k        ┃    ┃', scale: '0           50   70     100' }), { width: 48 }));
  assert.deepEqual(out, [
    '┏ CMP×12  ■ owner/repo · PR #42                ┓',
    '┃                   ROOT  █·█·█·······  03 AU  ┃',
    '          cwd /launch unrelated                 ',
    '  01 ACT  ⑂ feature/ui modified                 ',
    '  02 CTX   32k/128k        ┃    ┃               ',
    '          0           50   70     100           ',
    '  03 MDL  provider/model · thinking high        ',
    '┃ 05 EXT  Other status                         ┃',
    '┗         Ponytail: ready                      ┛',
  ]);
});

test('100 columns: wide content beside the rows, and an aside spaced as the anchored footer', () => {
  // footer.test.ts rows(f, 100). The footer anchors ROOT and the badge to its context numeral; the frame
  // right-aligns, so the caller adds the anchor's extra field cell after the marks to reproduce it.
  const pieces = threadRailPieces(activity);
  const aside = [[t(' ', { bg: 'accent' }), pieces[1], [...pieces[2], span(' ')], pieces[3]]];
  const input = fixture(100, {});
  input.header.aside = aside;
  input.rows[0].lines = [t('⑂ feature/ui modified                                          ▐ ▀▀█ █▀▀   █▀█ %')];
  input.rows[1].lines = [
    t(' 32k/128k ███                     ┃         ┃                  ▐ █▀▀ ▀▀█   █ █ USED'),
    t('0                       50        70        90  100            ▐ ▀▀▀ ▀▀▀ ▀ ▀▀▀ of 128k'),
  ];
  assert.deepEqual(text(instrumentFrame(input, { width: 100 })), [
    '┏━ CMP×12  ■ owner/repo · PR #42                  ┼                   ROOT  █·█·█·······   03 AU  ━┓',
    '┃          cwd /launch unrelated                                                                   ┃',
    '   01 ACT  ⑂ feature/ui modified                                          ▐ ▀▀█ █▀▀   █▀█ %         ',
    '   02 CTX   32k/128k ███                     ┃         ┃                  ▐ █▀▀ ▀▀█   █ █ USED      ',
    '           0                       50        70        90  100            ▐ ▀▀▀ ▀▀▀ ▀ ▀▀▀ of 128k   ',
    '   03 MDL  provider/model · thinking high                                                           ',
    '┃  05 EXT  Other status                                                                            ┃',
    '┗━         Ponytail: ready                                                                        ━┛',
  ]);
});

test('30 columns: the minimal fallback with inline plates and wrapped values', () => {
  // footer.test.ts rows(f, 30): no frame, the narrowest aside on its own line, the cwd line, then rows.
  const input = fixture(30, { gauge: ' 32k/128k ' });
  input.header.aside = [threadRailPieces(activity), threadRailPieces(activity, { marks: false })];
  input.rows[2].lines = [t('provider/model · thinking high')];
  assert.deepEqual(text(instrumentFrame(input, { width: 30 })), [
    ' CMP×12  ■ owner/repo · PR #42',
    '█  ROOT   03 AU               ',
    'cwd /launch unrelated         ',
    ' 01 ACT  ⑂ feature/ui modified',
    ' 02 CTX   32k/128k            ',
    ' 03 MDL  provider/model ·     ',
    'thinking high                 ',
    ' 05 EXT  Other status         ',
    'Ponytail: ready               ',
  ]);
});

test('geometry: gutter, plate column and content column by width', () => {
  assert.deepEqual({ ...frameGeometry(39) }, { minimal: true, gutter: 0, plateWidth: 8, contentColumn: 0, contentWidth: 39 });
  assert.deepEqual({ ...frameGeometry(40) }, { minimal: false, gutter: 1, plateWidth: 8, contentColumn: 10, contentWidth: 29 });
  assert.deepEqual({ ...frameGeometry(59) }, { minimal: false, gutter: 1, plateWidth: 8, contentColumn: 10, contentWidth: 48 });
  assert.deepEqual({ ...frameGeometry(60) }, { minimal: false, gutter: 2, plateWidth: 8, contentColumn: 11, contentWidth: 47 });
  assert.equal(FRAME_MINIMAL_BELOW, 40);
});

test('content wraps at the content column; continuations leave the plate column plain', () => {
  const lines = instrumentFrame({ rows: [{ plate: slab('01 ACT', 'accent'), lines: [t('alpha beta gamma delta epsilon zeta eta theta')] }] }, { width: 40 });
  // Inner rows: the blank spacer (first, side stubs), the plate row (next to last, side stubs), the last (corners).
  assert.deepEqual(text(lines), [
    '┏                   ┼                  ┓',
    '┃                                      ┃',
    '┃ 01 ACT  alpha beta gamma delta       ┃',
    '┗         epsilon zeta eta theta       ┛',
  ]);
  // The plate column of the continuation is field, with no plate color below the plate.
  const continuation = lines[3];
  assert.ok(continuation.every((s) => !s.style.bg || s.style.bg === 'field'));
});

test('a row bg fills the gap cell and the padding after the content (the model band)', () => {
  const [, , row] = instrumentFrame({ rows: [{ plate: slab('03 MDL', 'bright'), lines: [t('model', { bg: 'surface' })], bg: 'surface' }] }, { width: 60 });
  const cells = row.flatMap((s) => [...s.text].map(() => s.style.bg ?? 'field'));
  assert.deepEqual(cells.slice(2, 10), Array(8).fill('primary'));
  assert.ok(cells.slice(10, 58).every((bg) => bg === 'surface'));
  assert.deepEqual(cells.slice(58), ['field', 'field']);
});

test('the title wraps beside the aside, and the center mark only shows with clear space', () => {
  // footer.ts: titleWidth is the room before the aside, or before the corner clearance when the aside has its own
  // row; continuations start on the content column; the own row follows them, right-aligned with clearance.
  const title = t('■ owner/repo · PR unavailable (rate limited by the remote host)');
  const aside = [threadRailPieces(activity), threadRailPieces(activity, { marks: false })];
  assert.deepEqual(text(instrumentFrame({ header: { plate: countPlate(4), title, aside } }, { width: 72 })), [
    '┏━ CMP×04  ■ owner/repo · PR unavailable (rate limited by the remote  ━┓',
    '┃          host)                                                       ┃',
    '┃                                       █  ROOT  █·█·█·······  03 AU   ┃',
    '┗━                                                                    ━┛',
  ]);
  // A shorter title keeps the aside on the header row; marks yield before the aside leaves it (footer `tight`).
  const tight = text(instrumentFrame({ header: { plate: countPlate(12), title: t('■ owner/' + 'r'.repeat(26)), aside } }, { width: 72 }))[0];
  assert.match(tight, /^┏━ CMP×12  ■ owner\/r{26} +█  ROOT   03 AU  ━┓$/);
  assert.match(text(instrumentFrame({ header: { title: t('x') } }, { width: 72 }))[0], /^┏━ {9}x {24}┼ {33}━┓$/);
  assert.doesNotMatch(text(instrumentFrame({ header: { title: t('x') } }, { width: 72, centerMark: false }))[0], /┼/);
});

test('wrapLine follows Pi word wrapping: spaces break, long words split, blanks drop, styles kept', () => {
  const style = { fg: 'accent' };
  assert.deepEqual(text(wrapLine([span('one two', style), span(' three', {})], 7)), ['one two', 'three']);
  assert.deepEqual(text(wrapLine(t('abcdefghij kl'), 4)), ['abcd', 'efgh', 'ij', 'kl']);
  assert.deepEqual(text(wrapLine(t('a      '), 3)), ['a']);
  assert.deepEqual(text(wrapLine(t('      '), 3)), ['']);
  assert.deepEqual(text(wrapLine(t('fits  '), 6)), ['fits  '], 'a line that fits is unchanged');
  const [first] = wrapLine([span('one two', style), span(' three', {})], 7);
  assert.deepEqual(first, [span('one two', style)]);
});

test('every width from 1 to 160 is exact, curated, plain-equals-color, and keeps every value', () => {
  const words = ['ALPHA', 'cwd/launch', 'provider/model', 'Ponytail:ready', 'CMP×12', '03AU'];
  for (let width = 1; width <= 160; width++) {
    const input = fixture(width, { gauge: ' 32k/128k ██', scale: '0 50 70 90 100' });
    input.header.aside = [threadRailPieces(activity), threadRailPieces(activity, { marks: false })];
    input.rows[0].lines = [t('ALPHA beta gamma')];
    const lines = instrumentFrame(input, { width });
    for (const line of lines) {
      assert.equal(lineWidth(line), width, `${width}`);
      assert.ok(allowed(paint(line, 'none')), `${width}`);
      assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
    }
    if (width >= 9) {
      const all = text(lines).join('\n');
      for (const word of words) assert.ok(all.replace(/\s/g, '').includes(word), `${width}: ${word} kept, not clipped`);
    }
  }
});

test('invalid input throws', () => {
  assert.throws(() => instrumentFrame({}, { width: 0 }), RangeError);
  assert.throws(() => instrumentFrame({}, { width: 1001 }), RangeError);
  assert.throws(() => instrumentFrame(null, { width: 40 }), TypeError);
  assert.throws(() => instrumentFrame({ rows: [{ plate: t('123456789') }] }, { width: 40 }), RangeError);
  assert.throws(() => instrumentFrame({ header: { plate: t('123456789') } }, { width: 40 }), RangeError);
  assert.throws(() => instrumentFrame({ rows: [{ lines: ['text'] }] }, { width: 40 }), TypeError);
  assert.throws(() => instrumentFrame({ rows: [{ lines: [], bg: 'band' }] }, { width: 40 }), TypeError);
  assert.throws(() => instrumentFrame({ header: { aside: [[]] } }, { width: 40 }), TypeError);
  assert.throws(() => instrumentFrame({ header: { title: 'x' } }, { width: 40 }), TypeError);
  assert.throws(() => instrumentFrame({ spacer: 'cwd' }, { width: 40 }), TypeError);
  assert.throws(() => instrumentFrame({}, { width: 40, centerMark: 'yes' }), TypeError);
  assert.throws(() => wrapLine(t('x'), 0), RangeError);
});

import { frameStubs, frameCenter } from './instrument-frame.mjs';
test('frameGeometry uncapped opt-in leaves defaults bounded and frameStubs own exact heavy geometry', () => {
  assert.throws(() => frameGeometry(1001), RangeError);
  assert.equal(frameGeometry(1200, { maxWidth: Infinity }).contentWidth, 1187);
  for (const gutter of [1, 2]) {
    const rows = Array.from({ length: 6 }, (_, row) => frameStubs({ gutter, row, innerRows: 5 }));
    assert.deepEqual(rows.map((p) => [paint(p.left, 'none'), paint(p.right, 'none')]), gutter === 1 ? [['┏', '┓'], ['┃', '┃'], [' ', ' '], [' ', ' '], ['┃', '┃'], ['┗', '┛']] : [['┏━', '━┓'], ['┃ ', ' ┃'], ['  ', '  '], ['  ', '  '], ['┃ ', ' ┃'], ['┗━', '━┛']]);
  }
  assert.throws(() => frameStubs({ gutter: 3, row: 1, innerRows: 5 }), RangeError);
});
test('frameCenter owns five-cell reservation and clearance without owning admission or time', () => {
  assert.equal(frameCenter({ width: 80, titleEnd: 38, asideStart: 70 }), undefined);
  const p = frameCenter({ width: 80, titleEnd: 37, asideStart: 70, offset: -1 });
  assert.equal(p.start, 38);
  assert.equal(paint(p.spans, 'none'), ' ┼   ');
  assert.equal(p.spans[1].style.fg, 'accent');
  assert.equal(paint(frameCenter({ width: 80, titleEnd: 10, asideStart: 70 }).spans, 'none'), '  ┼  ');
  assert.throws(() => frameCenter({ width: 80, titleEnd: 10, asideStart: 70, offset: 0.5 }), RangeError);
});
