// Screen 2: four readouts and one row per schedule: cadence, state, last run, next run and a −3h…+1h strip.
// The CLI reports only a schedule's last result, any active run and its next fire, so the strip shows those
// three and nothing else; there is no fire history to draw. Design: ../../docs/design.md#schedules.
import type { Canvas } from '../canvas.ts';
import { age, applyFilter, FUTURE_MS, PAST_MS, SCHEDULE_GROUPS, type Filter, type ScheduleView } from '../model.ts';
import { cell, ink, lampOn, T } from '../theme.ts';
import type { Layout } from './layout.ts';
import { drawList, type Entry, type ListResult } from './list.ts';
import { countdown, countdownUnit, groupHead, head, lineReadouts, pad2, tallReadouts, unknownReadout, type Readout } from './parts.ts';

const L = 2;

export function scheduleReadouts(c: Canvas, lay: Layout, views: readonly ScheduleView[] | null, now: number): void {
  let readouts: Readout[];
  if (!views) readouts = [unknownReadout('NEEDS ATTENTION', 'ATTENTION'), unknownReadout('NEXT RUN', 'NEXT'), unknownReadout('ON', 'ON'), unknownReadout('HELD OR OFF', 'HELD/OFF')];
  else {
    const att = views.filter((v) => v.group === 0).length;
    const on = views.filter((v) => v.word === 'ON' || v.word === 'FIRING').length;
    const held = views.filter((v) => v.group >= 2).length;
    const next = views.filter((v) => v.next !== null).sort((a, b) => a.next! - b.next!)[0];
    const d = next ? next.next! - now : null;
    const attInk = att ? T.critical : T.structural, heldInk = held ? T.warning : T.structural;
    const nextText = d === null ? '--:--' : countdown(d), nextInk = d === null ? T.structural : T.primary;
    readouts = [
      { label: 'NEEDS ATTENTION', value: pad2(att), valueInk: attInk, unit: [['SCHEDULES', T.decorative]], line: [['ATTENTION', T.decorative], [pad2(att), attInk]] },
      {
        label: 'NEXT RUN', value: nextText, valueInk: nextInk, unit: [[d === null ? '' : countdownUnit(d), T.decorative]], sub: [next ? next.id.toUpperCase() : 'NONE QUEUED', T.decorative],
        line: [['NEXT', T.decorative], [nextText, nextInk], [next ? next.id.toUpperCase() : 'NONE QUEUED', T.decorative]],
      },
      { label: 'ON', value: pad2(on), valueInk: T.primary, unit: [['/', T.decorative], [`${views.length}`, T.secondary], ['SCHEDULES', T.decorative]], line: [['ON', T.decorative], [`${pad2(on)}/${views.length}`, T.primary]] },
      { label: 'HELD OR OFF', value: pad2(held), valueInk: heldInk, unit: [['SCHEDULES', T.decorative]], line: [['HELD/OFF', T.decorative], [pad2(held), heldInk]] },
    ];
  }
  if (lay.tallReadouts) tallReadouts(c, lay, readouts);
  else lineReadouts(c, lay.readY, lay.scrollX, readouts);
}

interface Columns {
  readonly full: boolean;
  readonly name: number;
  readonly nameW: number;
  readonly cadence: number | null;
  readonly state: number;
  readonly last: number;
  readonly next: number;
  readonly lane0: number;
  readonly lane1: number;
}

function columns(lay: Layout): Columns {
  const lane1 = lay.scrollX - 2;
  const full = lane1 - 78 >= 30;
  return full
    ? { full, name: L + 4, nameW: 20, cadence: 27, state: 40, last: 51, next: 64, lane0: 78, lane1 }
    : { full, name: L + 4, nameW: 16, cadence: null, state: L + 21, last: L + 32, next: L + 44, lane0: Math.min(L + 55, lane1), lane1 };
}

export function scheduleList(c: Canvas, lay: Layout, views: readonly ScheduleView[], filter: Filter, ui: { selected: string | null; scroll: number; snap: boolean },
  now: number, t: number, motion: boolean): ListResult {
  const C = columns(lay);
  const strip = C.lane1 - C.lane0 >= 12;
  const col = (at: number) => C.lane0 + Math.round(((at - now + PAST_MS) / (PAST_MS + FUTURE_MS)) * (C.lane1 - C.lane0));
  const items = applyFilter(views, filter);
  head(c, L, lay.listHeadY, 'SCHEDULES', Math.min(C.lane0, C.lane1) - 4 - L, pad2(items.length));
  const label = (x: number, s: string) => c.text(x, lay.axisY, s, { fg: T.structural });
  label(C.name, 'NAME');
  if (C.cadence !== null) label(C.cadence, 'CADENCE');
  label(C.state, 'STATE');
  label(C.last, 'LAST RUN');
  label(C.next, 'NEXT');
  if (strip) {
    label(C.lane0, '-3H');
    const nowLabel = c.text(col(now) - 1, lay.axisY, 'NOW', { fg: T.structural });
    if (nowLabel + 1 < C.lane1 - 2) c.rtext(C.lane1, lay.axisY, '+1H', { fg: T.structural });
  }
  const entries: Entry[] = [];
  let group = -1;
  for (const v of items) {
    if (v.group !== group) {
      if (group !== -1) entries.push({ rows: 1, draw: () => {} });
      group = v.group;
      const [title, tone] = SCHEDULE_GROUPS[group]!;
      const count = items.filter((i) => i.group === v.group).length;
      entries.push({ rows: 1, draw: (y) => groupHead(c, y, title, tone, count, C.lane1 + 1) });
    }
    entries.push({ key: v.id, rows: 1, draw: (y, sel) => row(c, C, strip ? col : null, v, y, sel, now, t, motion) });
  }
  const empty = views.length === 0 ? 'NO SCHEDULES · THE RUNNER LISTS NONE' : items.length === 0 ? (filter === 'ATTENTION' ? 'NOTHING NEEDS ATTENTION' : 'NOTHING LIVE RIGHT NOW') : null;
  return drawList(c, lay, entries, ui, filter, empty, '◆ LAST  ✕ FAILED  ◇ NEXT');
}

function row(c: Canvas, C: Columns, col: ((at: number) => number) | null, v: ScheduleView, y: number, sel: boolean, now: number, t: number, motion: boolean): void {
  if (sel) {
    c.fill(L, y, C.lane1 + 1 - L, 1, T.selection);
    c.put(0, y, '▶', { fg: T.primary });
  }
  const st = sel ? { bg: T.selection } : {};
  c.put(L, y, '█', { fg: cell(v.tone), ...st });
  c.text(C.name, y, v.id.toUpperCase(), { fg: v.group >= 2 ? T.decorative : T.primary, bold: true, ...st }, C.nameW);
  if (C.cadence !== null) c.text(C.cadence, y, v.cadence, { fg: T.decorative, ...st }, 12);
  c.text(C.state, y, v.word, { fg: ink(v.tone), bold: true, ...st }, C.last - C.state - 1);
  if (v.last) {
    const failed = v.last.outcome === 'failed';
    c.put(C.last, y, failed ? '✕' : v.last.outcome === 'succeeded' ? '■' : '◩', { fg: failed ? T.critical : v.last.outcome === 'succeeded' ? T.secondary : T.warning, bold: true, ...st });
    c.text(C.last + 2, y, `${age(now - v.last.at)} AGO`, { fg: failed ? T.critical : T.decorative, ...st }, C.next - C.last - 3);
  } else c.text(C.last, y, '—', { fg: T.decorative, ...st });
  // A paused schedule has no next run until someone re-enables it; its pause reason takes that column.
  const paused = v.word === 'PAUSED';
  const next = v.firing !== null ? 'NOW' : paused ? v.why : v.next !== null ? (v.next <= now ? 'DUE' : `IN ${age(v.next - now)}`) : '—';
  c.text(C.next, y, next, { fg: v.firing !== null ? T.accent : paused ? T.critical : T.primary, bold: v.firing !== null, ...st }, Math.max(0, C.lane0 - C.next - 1));
  c.hit(L, y, C.lane1 + 1 - L, 1, { kind: 'select', key: v.id });
  if (!col) return;
  const inStrip = (x: number) => x >= C.lane0 && x <= C.lane1;
  const nowX = col(now);
  if (v.last && inStrip(col(v.last.at))) {
    const failed = v.last.outcome === 'failed';
    c.put(col(v.last.at), y, failed ? '✕' : '◆', { fg: failed ? T.critical : T.secondary, bold: true, ...st });
  }
  if (v.next !== null && inStrip(col(v.next))) c.put(col(v.next), y, '◇', { fg: T.decorative, ...st });
  if (v.firing !== null && inStrip(col(v.firing))) c.put(col(v.firing), y, '◆', { fg: lampOn(t, motion) ? T.accent : T.decorative, bold: true, ...st });
  if (c.at(nowX, y)?.ch === ' ') c.put(nowX, y, '│', { fg: T.faint, ...st });
}
