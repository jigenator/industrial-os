import { expect, test } from 'bun:test';
import { GLYPHS, span } from '@industrial-os/design-system/foundation/cells';
import { Canvas, cleanText, EXTRA_GLYPHS } from '../src/canvas.ts';
import { T } from '../src/theme.ts';

test('cleanText retains the base monitor glyph contract, not upstream survey glyph additions', () => {
  const base = '─│┌┐└┘╵╱▐▌█▏▎▍▋▊▉░○●▲✕…━┃┏┓┗┛┼▀▄▒▓▚▞■▪·•◆▴⌑⑂×';
  expect(cleanText('Monitor 42 ' + base + EXTRA_GLYPHS)).toBe('Monitor 42 ' + base + EXTRA_GLYPHS);
  const survey = '╴╶├┸▤▣▸▾▼›' + Array.from({ length: 256 }, (_, i) => String.fromCodePoint(0x2800 + i)).join('');
  expect(cleanText(survey)).toBe('?'.repeat([...survey].length));
  expect(cleanText('界e\u0301👩‍💻\x1b')).toBe('?e?????');
});

test('every monitor glyph is a design-system glyph', () => {
  for (const ch of EXTRA_GLYPHS) expect(GLYPHS.includes(ch)).toBe(true);
});

test('blit lays a design-system line in, keeping colours it leaves unset and skipping blank unstyled cells', () => {
  const c = new Canvas(6, 1);
  c.put(0, 0, 'x', { fg: T.accent, bg: T.selection, bold: true });
  c.put(3, 0, 'y', { fg: T.critical });
  expect(c.blit(0, 0, [span('─', { fg: 'structural' }), span('  '), span('■', { fg: 'primary', bold: true }), span(' ', { bg: 'warning' })])).toBe(5);
  expect(c.at(0, 0)).toEqual({ ch: '─', fg: T.structural, bg: T.selection, bold: false });
  expect(c.at(1, 0)?.ch).toBe(' ');
  expect(c.at(3, 0)).toEqual({ ch: '■', fg: T.primary, bg: T.field, bold: true });
  expect(c.at(4, 0)).toEqual({ ch: ' ', fg: T.secondary, bg: T.warning, bold: false });
  c.blit(5, 0, [span('▶', { fg: 'primary' })], { bg: T.selection });
  expect(c.at(5, 0)).toEqual({ ch: '▶', fg: T.primary, bg: T.selection, bold: false });
});
