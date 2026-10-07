import { assertCells, fitLine, span } from '../../foundation/cells.mjs';

// claude-interrupt's DIRECTIVE UPDATED marker (pi/claude-interrupt/src/index.ts renderMarker) as static pieces.
export const MARKER_LABEL = 'DIRECTIVE UPDATED';
export const MARKER_BAR_OFFSETS = Object.freeze([0, 1, 3, 5, 8, 11, 15]);
export const MARKER_SPAN = 16;

// livePlate, the unfilled flash frame (`outline`) and recordPlate. The extension leaves unfilled cells on the
// terminal's default background; the design system's line model has none, so they sit on the field.
export const MARKER_PLATES = Object.freeze({
  live: Object.freeze({ fg: 'field', bg: 'accent', bold: true }),
  outline: Object.freeze({ fg: 'accent', bg: 'field', bold: true }),
  record: Object.freeze({ fg: 'primary', bg: 'structural', bold: true }),
});
// A ping bar appears acid (`lit`), turns grey in its own cell (`ghost`), then disappears (`off`).
export const MARKER_BARS = Object.freeze({
  lit: Object.freeze({ char: '│', style: Object.freeze({ fg: 'accent', bold: true }) }),
  ghost: Object.freeze({ char: '│', style: Object.freeze({ fg: 'decorative', bold: true }) }),
  off: Object.freeze({ char: ' ', style: Object.freeze({}) }),
});

// The extension's timeline in ms after the continuation starts (index.ts constants), for hosts and motions.
export const MARKER_TIMELINE = Object.freeze({
  plateStep: 80, barFrame: 40, flashOff: 80, flashOn: 160, pingLaunch: 160, pingStagger: 40, ghostAt: 440,
  ghostFor: 120, pingRepeatAfter: 720, settleWipe: 2800, window: 3000,
});

function checkPad(outputPad) {
  if (outputPad !== 0 && outputPad !== 1) throw new RangeError(`outputPad must be 0 or 1, got ${outputPad}`);
}

// The plate: `DIRECTIVE UPDATED ` after `outputPad` filled cells, one span in the state's style (19 or 18 cells).
export function markerPlate(state = 'record', { outputPad = 1 } = {}) {
  if (typeof state !== 'string' || !Object.hasOwn(MARKER_PLATES, state)) throw new RangeError(`unknown marker plate state: ${state}`);
  checkPad(outputPad);
  return [span(`${outputPad ? ' ' : ''}${MARKER_LABEL} `, MARKER_PLATES[state])];
}

function barStates(bars) {
  if (typeof bars === 'string') {
    if (!Object.hasOwn(MARKER_BARS, bars)) throw new RangeError(`unknown marker bar state: ${bars}`);
    return MARKER_BAR_OFFSETS.map(() => bars);
  }
  if (!Array.isArray(bars) || bars.length !== MARKER_BAR_OFFSETS.length) throw new TypeError('marker bars must be a state or an array of seven states');
  for (const b of bars) if (typeof b !== 'string' || !Object.hasOwn(MARKER_BARS, b)) throw new RangeError(`unknown marker bar state: ${b}`);
  return bars;
}

// The 16-cell bar span: seven stationary `│` bars at fixed offsets, one state each (or one state for all).
export function markerBars(bars = 'lit') {
  const states = barStates(bars);
  return Array.from({ length: MARKER_SPAN }, (_, x) => {
    const i = MARKER_BAR_OFFSETS.indexOf(x);
    const { char, style } = MARKER_BARS[i < 0 ? 'off' : states[i]];
    return span(char, style);
  });
}

// One marker row of exactly `width` cells: plate, one blank cell, the bar span, then field. As in the extension,
// the content is clipped to `width - outputPad`; the last `outputPad` cells are blank. Defaults are the settled
// record: record plate, no bars.
export function transcriptMarker({ plate = 'record', bars = 'off', outputPad = 1 } = {}, { width } = {}) {
  assertCells(width, 'marker width');
  const row = [...markerPlate(plate, { outputPad }), span(' '), ...markerBars(bars)];
  return [fitLine(fitLine(row, Math.max(0, width - outputPad)), width)];
}
