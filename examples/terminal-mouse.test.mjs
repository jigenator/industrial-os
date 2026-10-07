import test from 'node:test';
import assert from 'node:assert/strict';
import { emitKeypressEvents } from 'node:readline';
import { PassThrough } from 'node:stream';
import { mouseDecoder } from './terminal-mouse.mjs';

function decoder() {
  const stream = new PassThrough();
  const clicks = [];
  const keys = [];
  const consume = mouseDecoder((p) => clicks.push(p), () => keys.push('\x1b'));
  emitKeypressEvents(stream);
  stream.on('keypress', (_text, { sequence }) => {
    if (!consume(sequence)) keys.push(sequence);
  });
  return { clicks, keys, stream, write: (s) => stream.write(Buffer.from(s)) };
}

const report = (button, column = 12, row = 6, final = 'M') => `\x1b[<${button};${column};${row}${final}`;

test('installed Node decoder: coalesced and every byte-fragmented SGR packet produces one click', () => {
  for (const fragmented of [false, true]) {
    const d = decoder();
    const bytes = report(0) + report(0, 12, 6, 'm') + report(0, 1000, 1000) + '\x1b[Aq';
    for (const part of fragmented ? [...bytes] : [bytes]) d.write(part);
    assert.deepEqual(d.clicks, [{ column: 12, row: 6 }, { column: 1000, row: 1000 }]);
    assert.deepEqual(d.keys, ['\x1b[A', 'q']);
    d.stream.destroy();
  }
});

test('Esc before a mouse report is delivered separately without leaking its payload', () => {
  for (const fragmented of [false, true]) {
    const d = decoder();
    const bytes = '\x1b' + report(2, 3, 4) + '\x1b' + report(0, 12, 6) + '\x1b' + report(0, 12, 6, 'm') + '\x1b\x1b[Mq12';
    for (const part of fragmented ? [...bytes] : [bytes]) d.write(part);
    assert.deepEqual(d.clicks, [{ column: 12, row: 6 }]);
    assert.deepEqual(d.keys, ['\x1b', '\x1b', '\x1b', '\x1b']);
    d.stream.destroy();
  }
});

test('release, other buttons, modifiers, motion and wheels are consumed without shortcut leakage', () => {
  const d = decoder();
  for (const button of [1, 2, 3, 4, 8, 16, 32, 33, 64, 65, 128]) {
    d.write(report(button, 123, 456));
    d.write(report(button, 123, 456, 'm'));
  }
  d.write(report(0, 7, 1, 'm'));
  assert.deepEqual(d.clicks, []);
  assert.deepEqual(d.keys, []);
  d.stream.destroy();
});

test('malformed/overlong reports are bounded and swallowed; a final byte or new escape recovers', () => {
  const d = decoder();
  for (const packet of ['0;0;1', '0;1;0', '0;-1;2', '0;1;1001', '0;1;99999', '0;;3', '0;1;2;3', '00;1;2', '0;01;2', '0;' + '7'.repeat(10_000) + ';1']) d.write(`\x1b[<${packet}M`);
  assert.deepEqual(d.clicks, []);
  assert.deepEqual(d.keys, []);
  d.write('\x1b[<0;12;'); // unfinished, then a fragmented arrow and keyboard action
  for (const byte of ['\x1b', '[', 'B', 'q']) d.write(byte);
  assert.deepEqual(d.keys, ['\x1b[B', 'q']);
  d.write('\x1b[<0;12;\x1b[<0;2;3M'); // a new report supersedes the unfinished one
  assert.deepEqual(d.clicks, [{ column: 2, row: 3 }]);
  d.stream.destroy();
});

test('unfinished report never traps Ctrl-C or standalone Esc', async () => {
  const d = decoder();
  d.write('\x1b[<0;12;\x03');
  assert.deepEqual(d.keys, ['\x03']);
  d.write('\x1b[<0;12;\x1b');
  await new Promise((resolve) => d.stream.once('keypress', resolve));
  assert.deepEqual(d.keys, ['\x03', '\x1b']);
  d.write('q');
  assert.equal(d.keys.at(-1), 'q');
  d.stream.destroy();
});

test('non-SGR legacy reports are discarded, not interpreted as keyboard controls', () => {
  const d = decoder();
  d.write('\x1b[Mq12\x1b[M \x37\x37q');
  assert.deepEqual(d.clicks, []);
  assert.deepEqual(d.keys, ['q']);
  d.stream.destroy();
});
