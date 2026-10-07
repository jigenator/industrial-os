import { GLYPHS, assertCells, fitLine, lineWidth, resolveColor, safeText, span } from '../../foundation/cells.mjs';

// footer.ts:24-37: the complete Tatsu component vocabulary, not a check or a success inference.
export const TATSU_STATES = Object.freeze(Object.fromEntries(Object.entries({
  current: { shape: '•', code: 'OK', tone: 'accent' }, behind: { shape: '▲', code: 'UP', tone: 'warning' },
  repair: { shape: '▲', code: 'FIX', tone: 'warning' }, local_changes: { shape: '◆', code: 'EDIT', tone: 'warning' },
  missing: { shape: '✕', code: 'MISS', tone: 'critical' }, not_runnable: { shape: '✕', code: 'NRUN', tone: 'critical' },
  unavailable: { shape: '✕', code: 'UNAV', tone: 'critical' }, checking: { shape: '·', code: 'CHK', tone: 'decorative' },
  inactive: { shape: '·', code: 'OFF', tone: 'decorative' },
}).map(([key, value]) => [key, Object.freeze(value)])));

export function stateChip({ label, state, commitsBehind, localChanges = false }, { preset = TATSU_STATES, maxWidth = Infinity } = {}) {
  if (!preset || !Object.hasOwn(preset, state)) throw new RangeError('unknown chip state');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('maxWidth must be 0–1000 or Infinity');
  if (commitsBehind !== undefined && (!Number.isSafeInteger(commitsBehind) || commitsBehind < 0)) throw new RangeError('commitsBehind must be a non-negative safe integer');
  if (typeof localChanges !== 'boolean') throw new TypeError('localChanges must be boolean');
  const look = preset[state];
  if (typeof look?.shape !== 'string' || [...look.shape].length !== 1 || !(GLYPHS.includes(look.shape) || /^[\x20-\x7e]$/.test(look.shape))) throw new TypeError('shape must be one curated glyph or ASCII cell');
  resolveColor(look.tone);
  let code = safeText(look.code);
  // Preset-specific count and edit grammar; custom presets keep their supplied safe code.
  if (preset === TATSU_STATES && state === 'behind' && commitsBehind !== undefined) code += '×' + commitsBehind;
  if (preset === TATSU_STATES && ['behind', 'repair'].includes(state) && localChanges) code += ' ◆ EDIT';
  const line = [span(safeText(label), { fg: 'decorative' }), span(' '), span(`${look.shape} ${code}`, { fg: look.tone, bold: true })];
  return fitLine(line, Math.min(maxWidth, lineWidth(line)));
}

// footer.ts:1167-1180: three-cell gaps, whole parts wrap; only an oversized part splits at inner spaces.
export function stateChips(inputs, { width, preset = TATSU_STATES } = {}) {
  assertCells(width, 'state chips width');
  if (!Array.isArray(inputs)) throw new TypeError('inputs must be an array');
  const lines = [], run = [];
  const flush = () => { if (run.length) { lines.push(fitLine(run.splice(0), width)); } };
  for (const input of inputs) {
    const part = stateChip(input, { preset }), n = lineWidth(part);
    if (lineWidth(run) + (run.length ? 3 : 0) + n > width) flush();
    if (n <= width) { if (run.length) run.push(span('   ')); run.push(...part); continue; }
    const cells = part.flatMap((s) => [...s.text].map((text) => span(text, s.style)));
    while (cells.length) {
      let end = Math.min(width, cells.length);
      if (cells.length > width) {
        const space = cells.slice(0, width + 1).findLastIndex((s) => s.text === ' ');
        if (space > 0) end = space;
      }
      lines.push(fitLine(cells.splice(0, end), width));
      if (cells[0]?.text === ' ') cells.shift();
    }
  }
  flush();
  return lines;
}
