// Screen 1: four readouts, then one block per pipeline with a lane per slot on a 3h-back to 1h-ahead axis.
// History is grey; a pipeline's category color appears only on its live runs, so color always marks work
// happening now. Design: ../../docs/design.md#pipelines.
import type { Canvas } from '../canvas.ts';
import type { PipelinesData, SchedulesData } from '../contract.ts';
import { alerts, applyFilter, FUTURE_MS, PAST_MS, PIPELINE_GROUPS, reportingOf, type Filter, type PipelineView, type Reporting, type RunView } from '../model.ts';
import { CATEGORIES, ink, lampOn, T, type Color } from '../theme.ts';
import type { Layout } from './layout.ts';
import { chip, countdown, countdownUnit, groupHead, head, lineReadouts, pad2, tallReadouts, unknownReadout, type Readout } from './parts.ts';
import { type ListResult, drawList, type Entry } from './list.ts';

const L = 2;

export function pipelineReadouts(c: Canvas, lay: Layout, data: PipelinesData | null, views: readonly PipelineView[], schedules: SchedulesData | null, now: number): void {
  const reporting = data ? reportingOf(data.runner.state) : 'live';
  const live = views.flatMap((v) => v.live.map((r) => ({ r, v })));
  const slots = data?.machine?.slots ?? null;
  const done = views.flatMap((v) => v.done.filter((r) => (r.endedAt ?? -Infinity) > now - PAST_MS));
  const fails = done.filter((r) => r.outcome === 'failed').length;
  const amber = done.filter((r) => r.outcome === 'interrupted' || r.outcome === 'dropped').length;
  // A stopped or unreachable runner will not poll, whatever its last report scheduled.
  const nextPoll = reporting === 'live' ? data?.polling.next_poll_at ?? null : null;
  const pollIn = nextPoll === null ? null : nextPoll - now;
  const blocked = data?.polling.blocked_reasons ?? [];
  const al = data ? alerts(data, schedules) : null;
  const readouts: Readout[] = data ? [
    {
      label: 'ACTIVE RUNS', value: pad2(live.length), valueInk: T.primary,
      unit: [['/', T.decorative], [`${slots ?? '?'}`, T.secondary], ['SLOTS', T.decorative]],
      line: [['ACTIVE', T.decorative], [`${pad2(live.length)}/${slots ?? '?'}`, T.primary]],
      // One cell per busy slot in its pipeline's color (grey while not reporting), then the free slots.
      strip: (cv, x, y, w) => {
        live.slice(0, w).forEach(({ v }, i) => cv.put(x + i, y, reporting === 'live' ? '█' : '▒', { fg: reporting === 'live' ? CATEGORIES[v.category]!.fill : T.decorative }));
        for (let i = live.length; i < Math.min(slots ?? 0, w); i++) cv.put(x + i, y, '▁', { fg: T.structural });
      },
    },
    {
      label: 'FINISHED · 3H', value: pad2(done.length), valueInk: T.primary,
      unit: [['RUNS', T.decorative], [`${fails}`, fails ? T.critical : T.secondary], ['FAIL', T.decorative]],
      line: [['3H', T.decorative], [pad2(done.length), T.primary], ['RUNS', T.decorative], [`${fails}`, fails ? T.critical : T.secondary], ['FAIL', T.decorative]],
      strip: (cv, x, y, w) => {
        const n = done.length, ok = n ? Math.round(((n - fails - amber) / n) * w) : 0, mid = n ? Math.round((amber / n) * w) : 0;
        for (let i = 0; i < w; i++) cv.put(x + i, y, '▀', { fg: !n ? T.faint : i < ok ? T.primary : i < ok + mid ? T.warning : T.critical });
      },
    },
    {
      // The next time the runner polls its queue for work; the CLI has no per-pipeline dispatch time.
      label: 'NEXT POLL', value: pollIn === null ? '--:--' : countdown(pollIn), valueInk: pollIn === null ? T.structural : T.primary,
      unit: [[pollIn === null ? '' : countdownUnit(pollIn), T.decorative]],
      line: [['POLL', T.decorative], [pollIn === null ? '--:--' : countdown(pollIn), pollIn === null ? T.structural : T.primary], ...(blocked.length ? [[`BLOCKED ${blocked[0]!.toUpperCase()}`, T.warning] as const] : [])],
      sub: reporting !== 'live' ? [reporting === 'stopped' ? 'RUNNER STOPPED' : 'RUNNER NOT REPORTING', T.warning]
        : blocked.length ? [`BLOCKED ${blocked[0]!.toUpperCase()}`, T.warning] : nextPoll === null ? ['NOT SCHEDULED', T.decorative] : [`QUEUE · EVERY ${Math.round(data.polling.interval_seconds / 60)}M`, T.decorative],
    },
    {
      label: 'ALERTS', value: pad2(al!.length), valueInk: al!.length ? T.critical : T.structural,
      unit: [[al!.length ? 'OPEN' : 'CLEAR', T.decorative]],
      line: [['ALERTS', T.decorative], [pad2(al!.length), al!.length ? T.critical : T.structural], ...(al![0] ? [[al![0].text.toUpperCase(), ink(al![0].tone)] as const] : [])],
      strip: (cv, x, y, w) => {
        const first = al![0];
        if (!first) return;
        cv.text(x, y, first.text.toUpperCase(), { fg: ink(first.tone) }, al!.length > 1 ? w - 4 : w);
        if (al!.length > 1) cv.rtext(x + w - 1, y, `+${al!.length - 1}`, { fg: T.decorative });
      },
    },
  ] : [unknownReadout('ACTIVE RUNS', 'ACTIVE'), unknownReadout('FINISHED · 3H', '3H'), unknownReadout('NEXT POLL', 'POLL'), unknownReadout('ALERTS', 'ALERTS')];
  if (lay.tallReadouts) tallReadouts(c, lay, readouts);
  else lineReadouts(c, lay.readY, lay.scrollX, readouts);
}

// Block geometry: the full form of the approved design, or a compact one where the lanes would be too short.
interface Geometry {
  readonly full: boolean;
  readonly name: number;
  readonly nameW: number;
  readonly chip: number;
  readonly lane0: number;
  readonly lane1: number;
  readonly col: (dt: number) => number;
  readonly nowX: number;
}

function geometry(lay: Layout): Geometry {
  const lane1 = lay.scrollX - 2;
  const full = lane1 - 54 >= 40;
  const lane0 = full ? 54 : L + 36;
  const col = (dt: number) => lane0 + Math.round(((dt + PAST_MS) / (PAST_MS + FUTURE_MS)) * (lane1 - lane0));
  return { full, name: L + 5, nameW: full ? 19 : 15, chip: full ? L + 36 : L + 21, lane0, lane1, col, nowX: col(0) };
}

const rowsOf = (v: PipelineView): number => Math.max(3, v.lanes);

export function pipelineList(c: Canvas, lay: Layout, views: readonly PipelineView[], filter: Filter, ui: { selected: string | null; scroll: number; snap: boolean },
  reporting: Reporting, recordedAt: number | null, now: number, t: number, motion: boolean): ListResult {
  const G = geometry(lay);
  const items = applyFilter(views, filter);
  head(c, L, lay.listHeadY, 'PIPELINES', G.lane0 - 6 - L, pad2(items.length));
  axis(c, lay, G);
  const entries: Entry[] = [];
  let group = -1;
  for (const v of items) {
    if (v.group !== group) {
      group = v.group;
      const [title, tone] = PIPELINE_GROUPS[group]!;
      const count = items.filter((i) => i.group === v.group).length;
      entries.push({ rows: 2, draw: (y) => groupHead(c, y, title, tone, count, G.lane0 - 4) });
    }
    entries.push({ key: v.name, rows: rowsOf(v) + 1, body: rowsOf(v), draw: (y, sel) => block(c, G, v, y, sel, reporting, recordedAt, now, t, motion) });
  }
  const result = drawList(c, lay, entries, ui, filter, items.length === 0 && views.length > 0 ? (filter === 'ATTENTION' ? 'NOTHING NEEDS ATTENTION' : 'NOTHING LIVE RIGHT NOW') : null,
    lay.cols - 4 - G.lane0 >= 60 ? '■ OK  ✕ FAIL  ◩ INTERRUPTED  ▒ VERIFYING  GREY = HISTORY  COLOUR = LIVE' : '■ OK  ✕ FAIL  ▒ VERIFYING');
  // NOW through the visible lanes and gaps.
  for (let j = lay.list0; j <= lay.list1; j++) {
    const q = c.at(G.nowX, j);
    if (q && ' ─·┄'.includes(q.ch) && q.bg === T.field) c.put(G.nowX, j, '│', { fg: T.accent });
  }
  return result;
}

function axis(c: Canvas, lay: Layout, G: Geometry): void {
  for (let x = G.lane0; x <= G.lane1; x++) c.put(x, lay.axisY, '─', { fg: T.structural });
  for (let q = -11; q <= 3; q++) if (q % 4) c.put(G.col(q * 900_000), lay.axisY, '┴', { fg: T.faint });
  for (let h = -3; h <= 1; h++) {
    const x = G.col(h * 3600_000), label = h === 0 ? 'NOW' : `${h > 0 ? '+' : ''}${h}H`;
    c.put(x, lay.axisY, h === 0 ? '┼' : '┬', { fg: h === 0 ? T.accent : T.structural });
    c.text(Math.min(x - Math.floor(label.length / 2), G.lane1 - label.length + 1), lay.listHeadY, label, { fg: h === 0 ? T.primary : T.decorative, bold: h === 0 });
  }
}

function block(c: Canvas, G: Geometry, v: PipelineView, y: number, sel: boolean, reporting: Reporting, recordedAt: number | null, now: number, t: number, motion: boolean): void {
  const rows = rowsOf(v);
  const cat = CATEGORIES[v.category]!;
  const hot = v.live.length > 0 && reporting === 'live';
  // The plate takes the pipeline's color while live, red or amber while it needs attention, grey otherwise.
  const [plateBg, plateFg]: readonly [Color, Color] = hot ? [cat.fill, cat.ink] : v.tone === 'crit' ? [T.critical, T.primary] : v.tone === 'warn' ? [T.warning, T.field] : [T.structural, T.primary];
  const left = G.lane0 - 4 - L;
  if (sel) {
    c.fill(L, y, left, rows, T.selection);
    c.put(0, y, '▶', { fg: T.primary, bold: true });
  }
  const bg = sel ? { bg: T.selection } : {};
  c.text(L, y, ` ${pad2(v.number)} `, { fg: plateFg, bg: plateBg, bold: true });
  for (let j = 1; j < rows; j++) c.put(L, y + j, '▌', { fg: plateBg, ...bg });
  const dim = v.tone === 'off';
  c.text(G.name, y, v.name.toUpperCase(), { fg: dim ? T.decorative : T.primary, bold: true, ...bg }, G.nameW);
  c.text(G.name, y + 1, (v.scope ?? 'NO DEFINITION').toUpperCase(), { fg: T.decorative, ...bg }, G.nameW);
  // The newest eight results, newest first.
  v.done.slice(0, 8).forEach((r, i) => c.put(G.name + i * 2, y + 2, resultGlyph(r), { fg: resultInk(r), ...bg }));
  const busy = String(v.live.length);
  if (G.full) {
    const numX = L + 25;
    const numInk = dim || v.slots === null ? T.structural : v.live.length ? T.primary : T.decorative;
    c.numeral(numX, y, v.slots === null ? '?' : busy, numInk);
    c.text(numX + 4, y, 'SLOTS', { fg: T.decorative, ...bg });
    c.text(numX + 4, y + 2, `/${v.slots ?? '?'}`, { fg: T.secondary, ...bg });
  } else c.text(G.chip, y + 2, `${v.slots === null ? '?' : busy}/${v.slots ?? '?'} SLOTS`, { fg: v.live.length ? T.primary : T.decorative, ...bg }, G.lane0 - 4 - G.chip);
  // A live pipeline whose runner is not reporting keeps its word but loses the acid chip.
  chip(c, G.chip, y, v.word, v.tone === 'live' && reporting !== 'live' ? 'idle' : v.tone);
  c.text(G.chip, y + 1, v.why, { fg: v.whyTone === 'idle' ? T.decorative : v.whyTone === 'off' ? T.decorative : v.whyTone === 'crit' ? T.critical : T.warning, ...bg }, G.full ? 13 : G.lane0 - 4 - G.chip);
  c.hit(L, y, left, rows, { kind: 'select', key: v.name });
  for (let lane = 0; lane < v.lanes; lane++) {
    c.text(G.lane0 - 3, y + lane, pad2(lane + 1), { fg: T.structural });
    laneBase(c, G, y + lane, reporting, recordedAt, now);
    // Finished runs first, so a live run is drawn over any overlap.
    const runs = v.runs.filter((r) => r.lane === lane).sort((a, b) => Number(a.live) - Number(b.live));
    for (const r of runs) {
      const span = runBar(c, G, y + lane, r, cat, reporting, now, t, motion);
      if (span) c.hit(span[0], y + lane, span[1] - span[0] + 1, 1, { kind: 'select', key: v.name, run: v.live.indexOf(r) });
    }
  }
}

export const resultGlyph = (r: RunView): string => (r.outcome === 'failed' ? '✕' : r.outcome === 'succeeded' ? '■' : r.outcome === 'cancelled' ? '□' : '◩');
export const resultInk = (r: RunView): Color => (r.outcome === 'failed' ? T.critical : r.outcome === 'succeeded' ? T.primary : r.outcome === 'cancelled' ? T.decorative : T.warning);

function laneBase(c: Canvas, G: Geometry, y: number, reporting: Reporting, recordedAt: number | null, now: number): void {
  // Since the runner stopped the lane is dashed; since it was last heard from (unreachable) it is hatched.
  const fromX = recordedAt === null || reporting === 'live' ? null : G.col(recordedAt - now);
  for (let x = G.lane0; x <= G.lane1; x++) {
    if (fromX !== null && reporting === 'unreachable' && x > fromX && x <= G.nowX) c.put(x, y, '╱', { fg: T.hatch });
    else if (x > G.nowX) {
      if (x % 2 === 0) c.put(x, y, '·', { fg: T.faint });
    } else c.put(x, y, fromX !== null && x > fromX ? '┄' : '─', { fg: T.faint });
  }
}

// One run on its lane. Finished: a grey bar, marked at its end when it did not succeed. Live: hatched while
// claiming or verifying, then solid in the pipeline's color with the issue number, and a head at NOW that
// blinks acid while the run is running. Returns the drawn span of a live run, for clicks.
function runBar(c: Canvas, G: Geometry, y: number, r: RunView, cat: { fill: Color; ink: Color }, reporting: Reporting, now: number, t: number, motion: boolean): readonly [number, number] | null {
  const end = r.live ? now : r.endedAt;
  if (end === null) return null;
  const head = r.live && reporting === 'live';
  let x0 = G.col(r.start - now);
  const x1 = Math.max(x0, G.col(end - now) - (head ? 1 : 0));
  if (x1 < G.lane0) return null;
  x0 = Math.max(G.lane0, x0);
  if (!r.live) {
    for (let x = x0; x <= x1; x++) c.put(x, y, ' ', { bg: T.base });
    if (r.outcome !== 'succeeded') c.put(x1, y, r.outcome === 'failed' ? '✕' : '▪', { fg: resultInk(r), bg: T.base, bold: true });
    return null;
  }
  const fill = reporting === 'live' ? cat.fill : T.decorative;
  const onFill = reporting === 'live' ? cat.ink : T.field;
  const xv = r.verifiedAt !== null ? Math.max(x0, G.col(r.verifiedAt - now)) : r.verifying ? x1 + 1 : x0;
  for (let x = x0; x <= x1; x++) {
    if (x < xv) c.put(x, y, '▒', { fg: fill, bg: T.field });
    else c.put(x, y, ' ', { bg: fill });
  }
  if (x1 - x0 >= r.num.length + 1) c.text(Math.max(x0, Math.min(xv, x1 - r.num.length)), y, r.num, { fg: onFill, bg: fill, bold: true });
  else c.text(Math.max(G.lane0, x0 - r.num.length - 1), y, r.num, { fg: T.secondary, bold: true });
  if (head) c.put(x1 + 1, y, ' ', { bg: lampOn(t, motion) && r.phase === 'running' ? T.accent : fill });
  return [x0, head ? x1 + 1 : x1];
}
