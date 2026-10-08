import { span } from '../../foundation/cells.mjs';

// The Thread Rail root lamp (pi/status-bar/src/footer.ts renderFooter, `lamp`): one cell. Working is a bright
// filled acid cell, idle a dark surface cell, unknown a static hatched cell. Working and idle differ by luminance
// in color and by shape in plain text (`█` against a space). The blink is a host's motion, not the element's.
export const LAMP_STATES = Object.freeze({
  working: Object.freeze({ char: '█', style: Object.freeze({ fg: 'accent', bg: 'accent' }) }),
  idle: Object.freeze({ char: ' ', style: Object.freeze({ fg: 'primary', bg: 'surface' }) }),
  unknown: Object.freeze({ char: '╱', style: Object.freeze({ fg: 'decorative', bg: 'surface' }) }),
});

// status-bar's working cadence: lit for 500 ms, then dim for 300 ms, on its 50 ms decoration tick from the motion
// epoch (lampOn: tick % 16 < 10). Exported so a host can drive a blink motion with the extension's exact timing.
export const LAMP_BLINK = Object.freeze({ onMs: 500, offMs: 300, tickMs: 50 });

// The dim frame of a working blink: the working glyph in the idle cell's color, so plain text still reads `█`.
export const LAMP_DIM_STYLE = Object.freeze({ fg: 'surface', bg: 'surface' });

// One span of exactly one cell.
export function lamp(state, { appearance = 'glyph', lit = true } = {}) {
  if (typeof state !== 'string' || !Object.hasOwn(LAMP_STATES, state)) throw new RangeError(`unknown lamp state: ${state}`);
  if (!['glyph', 'field', 'solid'].includes(appearance)) throw new RangeError('unknown lamp appearance');
  if (typeof lit !== 'boolean') throw new TypeError('lit must be boolean');
  if (state !== 'unknown' && appearance !== 'glyph') {
    const bg = state === 'working' && lit ? 'accent' : 'surface';
    return [span(appearance === 'field' ? ' ' : '█', { fg: appearance === 'field' ? 'primary' : bg, bg })];
  }
  if (state === 'working' && !lit) return [span('█', LAMP_DIM_STYLE)];
  const { char, style } = LAMP_STATES[state];
  return [span(char, style)];
}
