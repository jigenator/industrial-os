import { DASHBOARD_INKS as D } from '../../foundation/dashboard-colors.mjs';
import { CellGrid } from '../../foundation/cell-grid.mjs';
import { mixOver } from '../../foundation/signal-colors.mjs';

export function activityStrip({ blocks, total, previous }, { width } = {}) {
  if (!Array.isArray(blocks) || blocks.length !== 21) throw new RangeError('activity strip needs 21 blocks');
  for (const block of blocks) { if (typeof block.future !== 'boolean' || !Number.isFinite(Date.parse(block.start))) throw new TypeError('invalid activity block'); for (const k of ['you', 'agents']) if (!Number.isSafeInteger(block[k]) || block[k] < 0) throw new RangeError('activity must be nonnegative integers'); }
  for (const n of [...Object.values(total), ...Object.values(previous)]) if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('totals must be nonnegative integers');
  const g = new CellGrid(width, 5);
  g.text(0, 0, 'THIS WEEK', { fg: D.muted });
  const sum = `${total.you} you · ${total.agents} agents`;
  if (width >= sum.length + 10) Array.from(sum).forEach((ch,i)=>g.put(width-sum.length+i,0,ch,{fg:D.bone}));
  for (let day = 0; day < 7; day++) { const date = new Date(blocks[day * 3].start); g.text(8 + day * 4, 1, ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()], { fg: D.muted }); }
  ['you', 'agents'].forEach((k, row) => {
    g.text(0, row + 2, k.toUpperCase(), { fg: D.muted });
    const max = Math.max(1, ...blocks.filter(b => !b.future).map(b => b[k]));
    blocks.forEach((b, i) => {
      const x = 7 + Math.floor(i / 3) * 4 + i % 3;
      g.put(x, row + 2, b.future ? '·' : '▆', { fg: b.future ? 'surface' : b[k] ? mixOver(D.bone, [0.26, 0.5, 0.75, 1][Math.min(3, Math.ceil(b[k] / max * 4) - 1)]) : mixOver('surface', 0.8) });
    });
  });
  const delta = total.you + total.agents - previous.you - previous.agents;
  g.text(0, 4, delta === 0 ? 'same as last week so far' : `${Math.abs(delta)} ${delta < 0 ? 'fewer' : 'more'} than last week so far`, { fg: D.muted });
  return g.lines();
}
