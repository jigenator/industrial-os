// Approved 22,416-case default corpus, against the frozen pre-extension renderers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as real from './fixtures/sheet-card-82d8534.mjs';
import * as ext from './sheet-card.mjs';
import { paint, textSlot, span } from '../../foundation/cells.mjs';
const measure = s => [...s].length;
test('sheet-card: all 22,416 legacy calls retain identical spans, plain text, ANSI and error classes', t => {
  let cases = 0;
  const same = (label, a, b) => {
    cases++;
    assert.equal(JSON.stringify(a), JSON.stringify(b), label);
    for (const mode of ['none', 'truecolor']) assert.equal(a.map(l => paint(l, mode)).join('\n'), b.map(l => paint(l, mode)).join('\n'), `${label} ${mode}`);
  };
  const throwsSame = (label, f, g) => {
    cases++;
    const errorClass = fn => { try { fn(); } catch (error) { return error.constructor.name; } };
    assert.equal(errorClass(f), errorClass(g), label);
  };
  const titles = ['Pick the migration order', '', 'A very long sheet title that will certainly need clipping at narrow widths of the card'];
  const slot = textSlot([span('rich ', { fg: 'accent' }), span('title', { fg: 'primary', italic: true })], 10, { measure });
  const widths = Array.from({ length: 160 }, (_, i) => i + 1);
  const cardWidths = [...Array.from({ length: 24 }, (_, i) => i + 1), 28, 32, 36, 40, 44, 48, 52, 56, 60, 62, 64, 72, 80, 100, 120, 160];
  for (const state of Object.keys(real.SHEET_STATES)) for (const width of widths) {
    for (const answer of ['', 'yes']) {
      same(`cardState ${state} ${width} ${answer}`, [ext.cardState({ state, answer }, { maxWidth: width, measure })], [real.cardState({ state, answer }, { maxWidth: width, measure })]);
      same(`cardHeading ${state} ${width} ${answer}`, [ext.cardHeading({ number: '03', time: '14:10', state, answer }, { width, measure })], [real.cardHeading({ number: '03', time: '14:10', state, answer }, { width, measure })]);
    }
    if (cardWidths.includes(width)) for (const kind of ['info', 'question']) for (const read of [false, true]) for (const hover of [false, true]) for (const title of [...titles, slot]) for (const button of ['open', 'jump']) {
      const input = { heading: { number: '07', time: '09:41', state }, kind, title, gist: ['first gist row', 'second gist row'], footer: '12 rows · ^O open', read, hover, button };
      same(`sheetCard ${state} ${kind} r${read} h${hover} ${width} ${button}`, ext.sheetCard(input, { width, measure }), real.sheetCard(input, { width, measure }));
    }
  }
  for (const read of [false, true]) for (const width of [1, 40, 62]) {
    same(`sheetCard default state r${read} ${width}`, ext.sheetCard({ read, title: 'x' }, { width, measure }), real.sheetCard({ read, title: 'x' }, { width, measure }));
    same(`sheetCard no measure ${width}`, ext.sheetCard({ title: 'ascii title', gist: ['g'] }, { width }), real.sheetCard({ title: 'ascii title', gist: ['g'] }, { width }));
  }
  throwsSame('unknown state', () => ext.sheetCard({ heading: { state: 'nope' } }, { width: 40 }), () => real.sheetCard({ heading: { state: 'nope' } }, { width: 40 }));
  throwsSame('bad width', () => ext.sheetCard({}, { width: 0 }), () => real.sheetCard({}, { width: 0 }));
  throwsSame('bad gist', () => ext.sheetCard({ gist: [1, 2, 3] }, { width: 40 }), () => real.sheetCard({ gist: [1, 2, 3] }, { width: 40 }));
  throwsSame('bad flag', () => ext.sheetCard({ read: 1 }, { width: 40 }), () => real.sheetCard({ read: 1 }, { width: 40 }));
  assert.equal(cases, 22416);
  t.diagnostic(`sheet-card extension identity: ${cases}/${cases} cases identical`);
});
