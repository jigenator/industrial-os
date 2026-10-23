import { DASHBOARD_INKS as D } from '../../foundation/dashboard-colors.mjs';
import { CellGrid } from '../../foundation/cell-grid.mjs';
import { typeColor } from '../../foundation/type-colors.mjs';
import { PI_CHROME } from '../../foundation/signal-colors.mjs';
import { integerNumeral } from '../pixel-numeral/pixel-numeral.mjs';

export const SOURCE_STATES = Object.freeze({ ok: '', stale: 'STALE DATA', auth: 'SIGN IN REQUIRED', error: 'FETCH FAILED', config_error: 'CONFIG ERROR', disabled: 'DISABLED', planned: 'WIP / NOT CONNECTED', loading: 'LOADING', unknown: 'UNKNOWN STATE' });
export function stalenessBar(remaining, { cells = 8 } = {}) {
  if (!Number.isInteger(cells) || cells < 1 || cells > 1000) throw new RangeError('bar cells must be 1–1000');
  if (remaining === null) return [{ text: '?'.repeat(cells), style: { fg: D.muted } }];
  if (typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining < 0 || remaining > 1) throw new RangeError('remaining must be 0–1 or null');
  const n = Math.ceil(remaining * cells);
  return [{ text: '━'.repeat(n), style: { fg: D.dim } }, { text: '─'.repeat(cells - n), style: { fg: D.edge } }];
}
export function typeUnit({ label, color, state = 'unknown', total = null, waiting = null, fresh = null, remaining = null, age = 'unknown', limit = '3d', key = '', active = false, hover = false, arriving = false }, { width, height = 7 } = {}) {
  if (!Object.hasOwn(SOURCE_STATES, state)) throw new RangeError('unknown source state');
  for (const n of [total, waiting, fresh]) if (n !== null && (!Number.isSafeInteger(n) || n < 0)) throw new RangeError('counts must be nonnegative integers or null');
  for (const flag of [active, hover, arriving]) if (typeof flag !== 'boolean') throw new TypeError('unit poses must be boolean');
  if (!Number.isInteger(height) || height < 3 || height > 1000) throw new RangeError('unit height must be 3–1000');
  const g = new CellGrid(width, height), ink = active || arriving ? PI_CHROME.bone : hover ? D.muted : D.edge;
  if (width < 12) { g.text(0, 0, label); const value = SOURCE_STATES[state] || (total === null ? '?' : String(total)); g.text(0, 1, value.length > width && !SOURCE_STATES[state] ? '#'.repeat(width) : value); return g.lines(); }
  g.put(0, 0, '┏', { fg: ink }); g.put(1, 0, '━', { fg: ink }); g.put(width - 2, 0, '━', { fg: ink }); g.put(width - 1, 0, '┓', { fg: ink });
  g.put(0, height - 1, '┗', { fg: ink }); g.put(1, height - 1, '━', { fg: ink }); g.put(width - 2, height - 1, '━', { fg: ink }); g.put(width - 1, height - 1, '┛', { fg: ink });
  for (let y = 1; y < height - 1; y++) { g.put(0, y, '┃', { fg: ink }); g.put(width - 1, y, '┃', { fg: ink }); }
  g.text(2, 0, ` ${label} `, { fg: active ? 'field' : typeColor(color), ...(active ? { bg: PI_CHROME.bone } : {}), bold: true }, width - 7);
  g.text(width - 4, 0, key, { fg: D.muted }, 1);
  const known = state === 'ok' || state === 'stale';
  if (height < 6) { const value = !known ? SOURCE_STATES[state] : `${state === 'stale' ? 'STALE DATA / ' : ''}${total === null ? '?' : total}`; g.text(3, 1, known && value.length > width-6 ? '#'.repeat(width-6) : value, {fg:D.dim}, width-6); return g.lines(); }
  if (!known) { g.text(3, 2, SOURCE_STATES[state], { fg: D.dim }, width - 6); return g.lines(); }
  const num = integerNumeral(total, { ink: total ? D.dim : D.edge, face: 'dashboard' }), nx = width - 3 - (num[0]?.reduce((a, s) => a + s.text.length, 0) ?? 1);
  if (nx > 12) g.place(nx, 2, num);
  else { const value=total === null ? '?' : String(total); g.text(3,3,value.length>width-6?'#'.repeat(width-6):value,{fg:D.dim},width-6); }
  const budget=nx>12?nx-4:width-6, natural=(waiting?String(waiting).length+8:0)+(fresh?String(fresh).length+4+(waiting?3:0):0);
  let x = 3;
  if(natural>budget)g.text(3,2,'counts overflow',{fg:D.muted},budget);
  else {
  if (waiting) { g.text(x, 2, String(waiting), { fg: 'critical', bold: true }); x += String(waiting).length; g.text(x, 2, ' waiting', { fg: D.muted }); x += 8; }
  if (fresh) { if (waiting) { g.put(x++, 2, ' '); g.put(x++, 2, '·', { fg: D.edge }); g.put(x++, 2, ' '); } g.text(x, 2, String(fresh), { fg: 'accent', bold: true }); x += String(fresh).length; g.text(x, 2, ' new', { fg: D.muted }); }
  if (!waiting && !fresh) g.text(3, 2, total === null ? 'count unknown' : total ? 'nothing new' : 'nothing open', { fg: D.muted }, Math.max(0, nx - 4));
  }
  if (height >= 6) {
    if (total !== 0 && !(height===6&&nx<=12)) g.place(3, height - 3, [stalenessBar(remaining, { cells: Math.min(8, width - 6) })]);
    g.text(3, height - 2, total === 0 ? 'no oldest item' : remaining === 0 ? 'stale' : `oldest ${age} of ${limit}`, { fg: D.muted }, width - 6);
  }
  if (state === 'stale') g.text(3, 1, SOURCE_STATES.stale, { fg: D.dim }, width - 6);
  return g.lines();
}

// Corner projection includes the brief outward hover/pick pose; host clips at its boundary.
export function unitCorners(width, height, spread = 0) {
  if (!Number.isInteger(width) || width < 4 || width > 1000 || !Number.isInteger(height) || height < 3 || height > 1000 || ![0,1].includes(spread)) throw new RangeError('invalid unit corner geometry');
  return [{x:-spread,y:-spread,text:'┏━'},{x:width-2+spread,y:-spread,text:'━┓'},{x:-spread,y:height-1+spread,text:'┗━'},{x:width-2+spread,y:height-1+spread,text:'━┛'}];
}
