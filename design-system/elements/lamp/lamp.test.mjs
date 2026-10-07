import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint, resolveColor } from '../../foundation/cells.mjs';
import { LAMP_BLINK, LAMP_DIM_STYLE, LAMP_STATES, lamp } from './lamp.mjs';

const text = (line) => paint(line, 'none');

test('each state is one cell with a distinct plain-text shape', () => {
  assert.equal(text(lamp('working')), '█');
  assert.equal(text(lamp('idle')), ' ');
  assert.equal(text(lamp('unknown')), '╱');
  for (const state of Object.keys(LAMP_STATES)) {
    assert.equal(lineWidth(lamp(state)), 1);
    assert.ok([...text(lamp(state))].every((c) => c === ' ' || GLYPHS.includes(c)));
  }
  assert.equal(new Set(Object.keys(LAMP_STATES).map((s) => text(lamp(s)))).size, 3);
});

test('colors render the footer cells: acid fill, surface fill, hatched surface', () => {
  // pi/status-bar/src/footer.ts lamp: working cell(' ', text, primary(acid)); idle bg surface; no activity
  // cell('╱', graphic, surface). Working draws `█` in acid on acid, the same color cell.
  const color = (state) => paint(lamp(state), 'truecolor');
  assert.equal(color('working'), '\x1b[0;38;2;192;254;4;48;2;192;254;4m█\x1b[0m');
  assert.equal(color('idle'), '\x1b[0;38;2;255;255;255;48;2;28;28;28m \x1b[0m');
  assert.equal(color('unknown'), '\x1b[0;38;2;113;113;113;48;2;28;28;28m╱\x1b[0m');
  for (const state of Object.keys(LAMP_STATES)) assert.equal(stripVTControlCharacters(color(state)), text(lamp(state)));
});

test('the blink cadence and dim frame mirror the extension', () => {
  // footer.ts lampOn: pulse % 16 < 10 on the 50 ms tick, i.e. 500 ms lit / 300 ms dim.
  assert.equal(LAMP_BLINK.onMs / LAMP_BLINK.tickMs, 10);
  assert.equal((LAMP_BLINK.onMs + LAMP_BLINK.offMs) / LAMP_BLINK.tickMs, 16);
  // The dim frame has the idle cell's color, so in color it matches the footer's dim lamp.
  assert.equal(resolveColor(LAMP_DIM_STYLE.bg), resolveColor(LAMP_STATES.idle.style.bg));
  assert.equal(resolveColor(LAMP_DIM_STYLE.fg), resolveColor(LAMP_DIM_STYLE.bg));
});

test('unknown is not idle- or working-shaped', () => {
  assert.notEqual(text(lamp('unknown')), text(lamp('idle')));
  assert.notEqual(text(lamp('unknown')), text(lamp('working')));
});

test('invalid states throw', () => {
  for (const state of ['busy', 'toString', '__proto__', '', undefined, null, true]) assert.throws(() => lamp(state), RangeError, String(state));
});
