import { expect, test } from 'bun:test';
import { cleanText, EXTRA_GLYPHS } from '../src/canvas.ts';

test('cleanText retains the base monitor glyph contract, not upstream survey glyph additions', () => {
  const base = '─│┌┐└┘╵╱▐▌█▏▎▍▋▊▉░○●▲✕…━┃┏┓┗┛┼▀▄▒▓▚▞■▪·•◆▴⌑⑂×';
  expect(cleanText('Monitor 42 ' + base + EXTRA_GLYPHS)).toBe('Monitor 42 ' + base + EXTRA_GLYPHS);
  const survey = '╴╶├┸▤▣▸▾▼›' + Array.from({ length: 256 }, (_, i) => String.fromCodePoint(0x2800 + i)).join('');
  expect(cleanText(survey)).toBe('?'.repeat([...survey].length));
  expect(cleanText('界e\u0301👩‍💻\x1b')).toBe('?e?????');
});
