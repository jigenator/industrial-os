// The scrolling list both screens share: entries at virtual rows, clipped to the list rows, the selection
// kept in view, a scrollbar, and the position row with the filter and a legend.
import type { Canvas } from '../canvas.ts';
import { FILTERS, type Filter } from '../model.ts';
import { T } from '../theme.ts';
import type { Layout } from './layout.ts';

export interface Entry {
  // Items have a key; group headings do not.
  readonly key?: string;
  // Rows taken, including any gap after the entry.
  readonly rows: number;
  // Rows that must be visible to show it (defaults to all of them).
  readonly body?: number;
  readonly draw: (y: number, selected: boolean) => void;
}

export interface ListResult {
  readonly items: readonly string[];
  readonly scroll: number;
  readonly page: number;
  readonly selected: string | null;
}

export function drawList(c: Canvas, lay: Layout, entries: readonly Entry[], ui: { selected: string | null; scroll: number; snap: boolean }, filter: Filter,
  emptyText: string | null, legend: string): ListResult {
  const items = entries.flatMap((e) => (e.key === undefined ? [] : [e.key]));
  const vis = lay.list1 - lay.list0 + 1;
  const placed: Array<{ e: Entry; vy: number }> = [];
  let vy = 0;
  for (const e of entries) {
    placed.push({ e, vy });
    vy += e.rows;
  }
  const total = vy;
  const selected = items.includes(ui.selected ?? '') ? ui.selected : items[0] ?? null;
  let scroll = ui.scroll;
  if (selected !== null && ui.snap) {
    const i = placed.findIndex((p) => p.e.key === selected);
    const me = placed[i]!;
    const before = placed[i - 1];
    // Keep its group heading in view with it.
    const top = before && before.e.key === undefined ? before.vy : me.vy;
    const bottom = me.vy + (me.e.body ?? me.e.rows) - 1;
    if (top < scroll) scroll = top;
    else if (bottom > scroll + vis - 1) scroll = Math.min(top, bottom - vis + 1);
  }
  scroll = Math.max(0, Math.min(scroll, Math.max(0, total - vis)));
  c.clipY = [lay.list0, lay.list1];
  for (const p of placed) {
    const y = lay.list0 + p.vy - scroll;
    if (y > lay.list1 || y + p.e.rows <= lay.list0) continue;
    p.e.draw(y, p.e.key !== undefined && p.e.key === selected);
  }
  c.clipY = null;
  if (emptyText) c.text(4, lay.list0 + 1, emptyText, { fg: T.decorative, bold: true });
  if (total > vis) {
    const th = Math.max(2, Math.round((vis * vis) / total));
    const ty = lay.list0 + Math.round((scroll / (total - vis)) * (vis - th));
    for (let j = lay.list0; j <= lay.list1; j++) {
      const on = j >= ty && j < ty + th;
      c.put(lay.scrollX, j, on ? '┃' : '│', { fg: on ? T.primary : T.faint });
    }
  }
  // Position: the first and last item at least partly in view.
  const inView = placed.filter((p) => p.e.key !== undefined && lay.list0 + p.vy - scroll <= lay.list1 && lay.list0 + p.vy - scroll + (p.e.body ?? p.e.rows) > lay.list0);
  const a = inView.length ? items.indexOf(inView[0]!.e.key!) + 1 : 0;
  const b = inView.length ? items.indexOf(inView[inView.length - 1]!.e.key!) + 1 : 0;
  const right = lay.scrollX;
  let x = 2;
  x = c.text(x, lay.posY, items.length ? `${a}–${b} OF ${items.length}` : '0 OF 0', { fg: T.decorative, bold: true }, right - x) + 2;
  if (total > vis) x = c.text(x, lay.posY, 'SCROLL OR ↑ ↓', { fg: T.structural }, right - x) + 3;
  x = c.text(x, lay.posY, 'FILTER', { fg: T.decorative }, right - x) + 1;
  for (const f of FILTERS) {
    x = c.text(x, lay.posY, ` ${f} `, f === filter ? { fg: T.field, bg: T.primary, bold: true } : { fg: T.decorative }, right - x) + 1;
  }
  if (x + 2 <= right - [...legend].length) c.rtext(right, lay.posY, legend, { fg: T.decorative });
  return { items, scroll, page: Math.max(1, vis - 1), selected };
}
