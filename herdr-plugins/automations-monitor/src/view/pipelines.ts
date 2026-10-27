// Screen 1: four readouts, then one block per pipeline with a lane per slot on a 3h-back to 1h-ahead axis.
// History is grey; a pipeline's category color appears only on its live runs, so color always marks work
// happening now. Design: ../../docs/design.md#pipelines.
import { fitLine, fitText, lineWidth, span } from '@industrial-os/design-system/foundation/cells';
import { pointer, runMark, runTrail, spine, type RunOutcome } from '@industrial-os/design-system/elements/board-marks';
import { labelPlate } from '@industrial-os/design-system/elements/label-plate';
import { slotStrip, splitBar } from '@industrial-os/design-system/elements/readout';
import { crossNow, laneAxis, laneRun, laneScale, laneTrack } from '@industrial-os/design-system/elements/time-lane';
import { cleanText, CUT, measure, type Canvas } from '../canvas.ts';
import type { PipelinesData, SchedulesData } from '../contract.ts';
import { alerts, applyFilter, FUTURE_MS, PAST_MS, PIPELINE_GROUPS, reportingOf, type Filter, type PipelineView, type Reporting, type RunView } from '../model.ts';
import { CATEGORIES, ink, lampOn, T, type Color } from '../theme.ts';
import type { Layout } from './layout.ts';
import { chip, countdown, countdownUnit, groupHead, head, lineReadouts, numeral, pad2, part as p, tallReadouts, unknownReadout, type Readout } from './parts.ts';
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
      unit: [p('/', T.decorative), p(`${slots ?? '?'}`, T.secondary), p('SLOTS', T.decorative)],
      line: [p('ACTIVE', T.decorative), p(`${pad2(live.length)}/${slots ?? '?'}`, T.primary)],
      // One cell per busy slot in its pipeline's color (grey while not reporting), then the free slots.
      strip: (w) => slotStrip({ busy: live.map(({ v }) => CATEGORIES[v.category]!.fill), slots, reporting: reporting === 'live' }, { maxWidth: w }),
    },
    {
      label: 'FINISHED · 3H', value: pad2(done.length), valueInk: T.primary,
      unit: [p('RUNS', T.decorative), p(`${fails}`, fails ? T.critical : T.secondary), p('FAIL', T.decorative)],
      line: [p('3H', T.decorative), p(pad2(done.length), T.primary), p('RUNS', T.decorative), p(`${fails}`, fails ? T.critical : T.secondary), p('FAIL', T.decorative)],
      strip: (w) => splitBar({ ok: done.length - fails - amber, warn: amber, fail: fails }, { width: w }),
    },
    {
      // The next time the runner polls its queue for work; the CLI has no per-pipeline dispatch time.
      label: 'NEXT POLL', value: pollIn === null ? '--:--' : countdown(pollIn), valueInk: pollIn === null ? T.structural : T.primary,
      unit: [p(pollIn === null ? '' : countdownUnit(pollIn), T.decorative)],
      line: [p('POLL', T.decorative), p(pollIn === null ? '--:--' : countdown(pollIn), pollIn === null ? T.structural : T.primary), ...(blocked.length ? [p(`BLOCKED ${blocked[0]!.toUpperCase()}`, T.warning)] : [])],
      sub: reporting !== 'live' ? p(reporting === 'stopped' ? 'RUNNER STOPPED' : 'RUNNER NOT REPORTING', T.warning)
        : blocked.length ? p(`BLOCKED ${blocked[0]!.toUpperCase()}`, T.warning) : nextPoll === null ? p('NOT SCHEDULED', T.decorative) : p(`QUEUE · EVERY ${Math.round(data.polling.interval_seconds / 60)}M`, T.decorative),
    },
    {
      label: 'ALERTS', value: pad2(al!.length), valueInk: al!.length ? T.critical : T.structural,
      unit: [p(al!.length ? 'OPEN' : 'CLEAR', T.decorative)],
      line: [p('ALERTS', T.decorative), p(pad2(al!.length), al!.length ? T.critical : T.structural), ...(al![0] ? [p(al![0].text.toUpperCase(), ink(al![0].tone))] : [])],
      // The first alert, and how many more there are at the right.
      strip: (w) => {
        const first = al![0];
        if (!first) return [];
        const text = fitText(cleanText(first.text.toUpperCase()), al!.length > 1 ? w - 4 : w, { ...CUT, style: { fg: ink(first.tone) } });
        if (al!.length === 1) return text;
        const more = `+${al!.length - 1}`;
        return fitLine([...text, span(' '.repeat(Math.max(0, w - lineWidth(text, { measure }) - more.length))), span(more, { fg: T.decorative })], w, {}, { measure });
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
  const scale = laneScale({ past: PAST_MS, future: FUTURE_MS }, { width: lane1 - lane0 + 1 });
  const col = (dt: number) => lane0 + scale.col(dt);
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
    const now = q && crossNow({ text: q.ch, style: { bg: q.bg } });
    if (now) c.blit(G.nowX, j, [now]);
  }
  return result;
}

function axis(c: Canvas, lay: Layout, G: Geometry): void {
  const { ruler, labels } = laneAxis({ past: PAST_MS, future: FUTURE_MS }, { width: G.lane1 - G.lane0 + 1 });
  c.blit(G.lane0, lay.axisY, ruler);
  for (const label of labels) c.blit(G.lane0 + label.at, lay.listHeadY, label.line);
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
    c.blit(0, y, pointer({ bold: true }));
  }
  const bg = sel ? { bg: T.selection } : {};
  c.blit(L, y, labelPlate(pad2(v.number), { form: 'slab', style: { fg: plateFg, bg: plateBg } }));
  for (let j = 1; j < rows; j++) c.blit(L, y + j, spine(plateBg), bg);
  const dim = v.tone === 'off';
  c.text(G.name, y, v.name.toUpperCase(), { fg: dim ? T.decorative : T.primary, bold: true, ...bg }, G.nameW);
  c.text(G.name, y + 1, (v.scope ?? 'NO DEFINITION').toUpperCase(), { fg: T.decorative, ...bg }, G.nameW);
  // The newest eight results, newest first.
  c.blit(G.name, y + 2, runTrail(v.done.slice(0, 8).map(outcomeOf)), bg);
  const busy = String(v.live.length);
  if (G.full) {
    const numX = L + 25;
    const numInk = dim || v.slots === null ? T.structural : v.live.length ? T.primary : T.decorative;
    numeral(c, numX, y, v.slots === null ? '?' : busy, numInk, 'instrument');
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

// A run with no recorded outcome reads as interrupted.
const outcomeOf = (r: RunView): RunOutcome => r.outcome ?? 'interrupted';
export const resultMark = (r: RunView) => runMark(outcomeOf(r), { bold: true });

// Lane columns relative to the lane's first cell. Anything outside the lane is clamped just off it on that side, since
// only the side matters there: a run recorded ahead of this clock starts past the lane and draws nothing.
const laneAt = (G: Geometry, dt: number): number => Math.min(G.lane1 - G.lane0 + 2, Math.max(-2, G.col(dt) - G.lane0));

function laneBase(c: Canvas, G: Geometry, y: number, reporting: Reporting, recordedAt: number | null, now: number): void {
  // Since the runner stopped the lane is dashed; since it was last heard from (unreachable) it is hatched.
  const since = recordedAt === null || reporting === 'live' ? null : laneAt(G, recordedAt - now);
  c.blit(G.lane0, y, laneTrack({ now: G.nowX - G.lane0, since, after: reporting === 'unreachable' ? 'hatched' : 'dashed' }, { width: G.lane1 - G.lane0 + 1, origin: G.lane0 }));
}

// One run on its lane. Finished: a grey bar, marked at its end when it did not succeed. Live: hatched while
// claiming or verifying, then solid in the pipeline's color with the issue number, and a head at NOW that
// blinks acid while the run is running. Returns the drawn span of a live run, for clicks.
function runBar(c: Canvas, G: Geometry, y: number, r: RunView, cat: { fill: Color; ink: Color }, reporting: Reporting, now: number, t: number, motion: boolean): readonly [number, number] | null {
  const end = r.live ? now : r.endedAt;
  if (end === null) return null;
  const drawn = laneRun({
    from: laneAt(G, r.start - now), to: laneAt(G, end - now), verified: r.verifiedAt === null ? null : laneAt(G, r.verifiedAt - now),
    verifying: r.verifying, live: r.live, outcome: outcomeOf(r), label: cleanText(r.num),
    fill: reporting === 'live' ? cat.fill : T.decorative, ink: reporting === 'live' ? cat.ink : T.field,
    head: reporting === 'live', lit: lampOn(t, motion) && r.phase === 'running',
  }, { width: G.lane1 - G.lane0 + 1, measure });
  if (!drawn) return null;
  for (const piece of drawn.pieces) c.blit(G.lane0 + piece.at, y, piece.line);
  return drawn.span && [G.lane0 + drawn.span[0], G.lane0 + drawn.span[1]];
}
