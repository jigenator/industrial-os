// One frame: header, machine row, the current screen, the event log, the footer and the modal. Pure: app
// state, pane size, wall clock, motion time and the motion flag in; exactly `rows` lines of exactly `cols`
// cells out, with the hit regions and list geometry that keys and clicks act on.
import { fitLine, span, type Line } from '@industrial-os/design-system/foundation/cells';
import { BOARD_TONES } from '@industrial-os/design-system/foundation/board-tones';
import { labelPlate } from '@industrial-os/design-system/elements/label-plate';
import { sectionHead } from '@industrial-os/design-system/elements/section-head';
import { tabRule } from '@industrial-os/design-system/elements/tab-rule';
import { Canvas, measure, type Hit, type Screen } from '../canvas.ts';
import { age, clock, pipelineEvents, pipelineViews, reportingOf, runnerEvents, scheduleEvents, scheduleViews, type Reporting } from '../model.ts';
import { T, type Tone } from '../theme.ts';
import { logShown, type AppState, type Feed } from '../ui.ts';
import { L, layout, tooSmall, type Layout } from './layout.ts';
import { runModal } from './modal.ts';
import { ago, chip, describeFailure, eventLog, message, pad2 } from './parts.ts';
import { pipelineList, pipelineReadouts } from './pipelines.ts';
import { scheduleList, scheduleReadouts } from './schedules.ts';

export interface Frame {
  readonly lines: Line[];
  readonly hitAt: (x: number, y: number) => Hit | null;
  readonly items: readonly string[];
  readonly page: number;
  readonly scroll: number;
  readonly liveRuns: number;
}

export interface FrameOptions {
  readonly cols: number;
  readonly rows: number;
  readonly now: number;
  // Motion time in milliseconds; only the blink phase depends on it.
  readonly t: number;
}

const STALE_INTERVALS = 3;
const isStale = (feed: Feed<unknown>, intervalMs: number, now: number) => feed.okAt !== null && now - feed.okAt > STALE_INTERVALS * intervalMs;

export function renderFrame(state: AppState, { cols, rows, now, t }: FrameOptions): Frame {
  const ui = state.ui;
  const motion = ui.motion;
  if (tooSmall(cols, rows)) {
    const text = cols >= 34 ? `AUTOMATIONS ${cols}x${rows}: TOO SMALL` : `${cols}x${rows} TOO SMALL`;
    const lines = Array.from({ length: rows }, (_, i) => fitLine(i === 0 ? [span(text, { fg: T.secondary, bg: T.field })] : [], cols, { bg: T.field }));
    return { lines, hitAt: () => null, items: [], page: 1, scroll: 0, liveRuns: 0 };
  }
  const c = new Canvas(cols, rows);
  const lay = layout(cols, rows, logShown(ui));
  const pData = state.pipelines.value, sData = state.schedules.value;
  const reporting: Reporting = reportingOf(pData?.runner.state ?? sData?.runner.state);
  const pViews = pData ? pipelineViews(pData, now) : [];
  const runner = pData ? runnerEvents(pData) : [];
  const feed = ui.screen === 'pipelines' ? state.pipelines : state.schedules;

  header(c, state, ui.screen, feed, now);
  machineRow(c, lay, state, feed, now);
  let list = { items: [] as readonly string[], scroll: 0, page: 1, selected: null as string | null };
  const listArea = { x: L, y: lay.list0, w: lay.scrollX - L, h: lay.list1 - lay.list0 + 1 };
  const select = { selected: ui.selected[ui.screen], scroll: ui.scroll, snap: ui.snap };
  if (ui.screen === 'pipelines') {
    pipelineReadouts(c, lay, pData, pViews, sData, now);
    if (pData) {
      list = pipelineList(c, lay, pViews, ui.filter, select, reporting, pData.runner.recorded_at, now, t, motion);
      if (!pViews.length) message(c, listArea, 'NO PIPELINES', ['The runner lists no pipelines on this machine.'], 'idle');
    } else noData(c, listArea, state, feed);
    eventLog(c, lay, 'PIPELINES', pData ? pipelineEvents(pData, now) : null);
  } else {
    const sViews = sData ? scheduleViews(sData, reporting) : null;
    scheduleReadouts(c, lay, sViews, now);
    if (sViews) list = scheduleList(c, lay, sViews, ui.filter, select, now, t, motion);
    else noData(c, listArea, state, feed);
    eventLog(c, lay, 'SCHEDULES', sData ? scheduleEvents(sData, runner, now) : null);
  }
  footer(c, state, lay, now);

  let liveRuns = 0;
  if (ui.modal && ui.screen === 'pipelines' && pData) {
    const v = pViews.find((p) => p.name === list.selected);
    if (v) {
      liveRuns = v.live.length;
      runModal(c, v, ui.modalRun, pData.machine?.name ?? null, reporting, pipelineEvents(pData, now), now, t, motion);
    }
  }
  return { lines: c.lines(), hitAt: (x, y) => c.hitAt(x, y), items: list.items, page: list.page, scroll: list.scroll, liveRuns };
}

function header(c: Canvas, state: AppState, screen: Screen, feed: Feed<unknown>, now: number): void {
  const title = 'AUTOMATIONS';
  let x = c.blit(L, 0, sectionHead({ title }, { width: title.length + 2 })) + 4;
  const counts: Record<Screen, number | null> = {
    pipelines: state.pipelines.value?.pipelines.length ?? null,
    schedules: state.schedules.value?.schedules.length ?? null,
  };
  for (const [k, key, label] of [['pipelines', '1', 'PIPELINES'], ['schedules', '2', 'SCHEDULES']] as const) {
    const on = screen === k, x0 = x;
    x = c.blit(x, 0, labelPlate(key, { form: 'slab', pad: false, style: on ? BOARD_TONES.live.chip : BOARD_TONES.idle.chip }));
    x = c.text(x + 1, 0, label, { fg: on ? T.primary : T.decorative, bold: on });
    x = c.text(x + 1, 0, counts[k] === null ? '?' : pad2(counts[k]), { fg: T.decorative });
    c.hit(x0, 0, x - x0, 1, { kind: 'screen', screen: k });
    x += 3;
  }
  // Read status of this screen's command, then the clock; the right side yields to the tabs.
  const [status, tone] = readStatus(state, feed, now);
  const parts: Array<readonly [string, Tone | null]> = [[clock(now), null], [status, tone], ['OBSERVE ONLY', null]];
  let text = parts;
  const width = (p: typeof parts) => p.reduce((n, [s]) => n + s.length + 3, -3);
  while (text.length > 1 && x + 2 + width(text) > c.w - 3) text = text.length === 3 ? text.slice(0, 2) : text.slice(1, 2);
  let rx = c.w - 2 - width(text);
  if (rx > x + 1) {
    text.forEach(([s, t], i) => {
      if (i) rx = c.text(rx, 0, ' · ', { fg: T.decorative });
      rx = c.text(rx, 0, s, { fg: t === null ? T.decorative : t === 'crit' ? T.critical : t === 'warn' ? T.warning : T.decorative, bold: t === 'crit' || t === 'warn' });
    });
  }
  c.blit(L, 1, rule(c, 14));
}

// A full-width rule under a row: an acid tab of `tab` cells, then a faint hairline.
const rule = (c: Canvas, tab: number): Line => tabRule({ tabCells: tab, inks: { tab: T.accent, rule: T.faint } }, { width: c.w - 2 - L, lead: false });

function readStatus(state: AppState, feed: Feed<unknown>, now: number): readonly [string, Tone | null] {
  if (feed.failure) return [feed.okAt === null ? 'READ FAILED' : `READ FAILED · LAST OK ${ago(now - feed.okAt)}`, 'crit'];
  if (feed.okAt === null) return [state.reading ? 'READING' : 'NOT READ YET', null];
  if (isStale(feed, state.intervalMs, now)) return [`STALE · READ ${ago(now - feed.okAt)}`, 'warn'];
  return [`READ ${ago(now - feed.okAt)}`, null];
}

const RUNNER: Record<string, readonly [string, Tone]> = {
  running: ['RUNNING', 'live'], starting: ['STARTING', 'idle'], draining: ['DRAINING', 'warn'], stopped: ['STOPPED', 'warn'], unreachable: ['UNREACHABLE', 'crit'],
};

// This machine: its name, the runner's state and observation, capacity and service drift; then, on the
// right, why the data on screen may not be current.
function machineRow(c: Canvas, lay: Layout, state: AppState, feed: Feed<unknown>, now: number): void {
  const y = lay.machineY;
  const p = state.pipelines.value;
  const runnerState = p?.runner.state ?? state.schedules.value?.runner.state;
  const name = p?.machine?.name.toUpperCase() ?? (p ? 'MACHINE NOT REGISTERED' : 'MACHINE ?');
  let x = c.text(L, y, name, { fg: T.primary, bold: true }, c.w - 6);
  const nameEnd = x;
  const [word, tone] = runnerState ? RUNNER[runnerState]! : ['RUNNER ?', 'idle' as Tone];
  x = chip(c, x + 2, y, runnerState ? `RUNNER ${word}` : word, tone);
  const observation = p?.runner.observation;
  if (observation && observation !== 'live') x = c.text(x + 2, y, observation === 'recorded' ? 'RECORDED' : 'NO RECORD', { fg: T.warning, bold: true });
  if (p?.machine) x = c.text(x + 2, y, `${p.machine.slots} SLOTS`, { fg: T.decorative });
  const drift = p?.runner.service.environment_drift ?? [];
  if (drift.length) x = c.text(x + 2, y, `${drift.join(' ')} DRIFT`, { fg: T.warning }, c.w - x - 4);
  // Last-known and stale data are labelled where the data starts.
  const banner: readonly [string, Tone, string] | null = feed.failure && feed.okAt !== null
    ? ['LAST KNOWN', 'crit', describeFailure(feed.failure, state.intervalMs).title]
    : isStale(feed, state.intervalMs, now) ? ['STALE', 'warn', `LAST GOOD READ ${ago(now - feed.okAt!)}`] : null;
  if (banner) {
    const w = banner[0].length + 2 + 1 + banner[2].length;
    const bx = c.w - 3 - w;
    if (bx > x + 2) {
      const after = chip(c, bx, y, banner[0], banner[1]);
      c.text(after + 1, y, banner[2], { fg: banner[1] === 'crit' ? T.critical : T.warning });
    }
  }
  if (lay.machineRule) c.blit(L, y + 1, rule(c, nameEnd - L));
}

function noData(c: Canvas, area: { x: number; y: number; w: number; h: number }, state: AppState, feed: Feed<unknown>): void {
  if (feed.failure) {
    const { title, detail } = describeFailure(feed.failure, state.intervalMs);
    message(c, area, title, detail, 'crit');
  } else message(c, area, 'READING', [`tatsu automations ${state.ui.screen} --json`], 'idle');
}

// The middle footer tier: the screen and selection keys explain themselves, the rest keep a short word.
const SHORT: Record<string, string> = { SCREEN: '', SELECT: '', OPEN: '', 'EVENT LOG': 'LOG', 'HIDE LOG': 'LOG', 'LOG: NARROW': 'LOG' };

function footer(c: Canvas, state: AppState, lay: Layout, now: number): void {
  const ui = state.ui;
  const y = c.h - 1;
  c.blit(L, y - 1, rule(c, 0));
  const keys: Array<readonly [string, string]> = ui.modal
    ? [['↑ ↓', 'RUN'], ['ESC', 'CLOSE'], ['M', 'MOTION'], ['Q', 'QUIT']]
    : [['1 2', 'SCREEN'], ['↑ ↓', 'SELECT'], ...(ui.screen === 'pipelines' ? [['ENTER', 'OPEN'] as const] : []), ['F', 'FILTER'],
      ['L', logShown(ui) ? (lay.log ? 'HIDE LOG' : 'LOG: NARROW') : 'EVENT LOG'], ['M', ui.motion ? 'MOTION' : 'MOTION OFF'], ['R', 'READ'], ['Q', 'QUIT']];
  const next = state.reading ? 'READING' : state.nextAt === null ? '' : `NEXT READ ${age(Math.max(0, state.nextAt - now))}`;
  // Narrow footers shorten the labels, then drop all but QUIT; the keys themselves stay.
  const tiers = [keys.map(([, l]) => l), keys.map(([, l]) => SHORT[l] ?? l), keys.map(([k, l]) => (k === 'Q' ? l : ''))];
  const gaps = [3, 2, 1];
  const width = (t: number) => keys.reduce((n, [k], i) => n + k.length + 2 + (tiers[t]![i] ? 1 + tiers[t]![i]!.length : 0) + gaps[t]!, L);
  // The read countdown goes before the labels do; the header still shows the read's age.
  const room = next.length + 2;
  const tier = [0, 1].find((t) => width(t) + room <= c.w - 2) ?? [0, 1].find((t) => width(t) <= c.w) ?? 2;
  let x = L;
  keys.forEach(([k], i) => {
    x = c.blit(x, y, labelPlate(k, { form: 'slab', style: BOARD_TONES.idle.chip, measure, maxWidth: c.w - x }));
    const label = tiers[tier]![i];
    if (label) x = c.text(x + 1, y, label, { fg: T.decorative }, c.w - x - 1);
    x += gaps[tier]!;
  });
  if (next && x + next.length + 2 <= c.w - 2) c.rtext(c.w - 3, y, next, { fg: T.decorative });
}
