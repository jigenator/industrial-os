// Pure derivation from decoded CLI data to what the screens show: pipeline and schedule states and groups,
// lanes, events and alerts. Nothing here reads a clock or does I/O; `now` is always an argument.
// States and groups: ../docs/design.md#states.
import type { Outcome, Phase, PipelineRecord, PipelinesData, RunnerState, RunRecord, ScheduleRecord, SchedulesData } from './contract.ts';
import type { Tone } from './theme.ts';

export const HOUR = 3600_000;
export const PAST_MS = 3 * HOUR;
export const FUTURE_MS = HOUR;
export const MAX_LANES = 6;

// Whether the runner is reporting live, stopped, or unreachable (last known).
export type Reporting = 'live' | 'stopped' | 'unreachable';
export const reportingOf = (state: RunnerState | undefined): Reporting =>
  state === 'stopped' ? 'stopped' : state === 'unreachable' ? 'unreachable' : 'live';

export interface RunView {
  readonly issue: string;
  // The issue number for bars: the part after the last hyphen when numeric, else the identifier.
  readonly num: string;
  readonly phase: Phase;
  readonly outcome: Outcome | null;
  readonly reason: string | null;
  readonly admittedAt: number;
  readonly claimedAt: number | null;
  readonly verifiedAt: number | null;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  // When the run took a slot: its claim, else its admission.
  readonly start: number;
  readonly live: boolean;
  readonly verifying: boolean;
  lane: number;
}

export interface PipelineView {
  readonly name: string;
  readonly number: number;
  readonly category: number;
  readonly scope: string | null;
  readonly slots: number | null;
  readonly lanes: number;
  readonly runs: readonly RunView[];
  readonly live: readonly RunView[];
  readonly done: readonly RunView[];
  readonly word: string;
  readonly tone: Tone;
  readonly group: number;
  readonly why: string;
  readonly whyTone: Tone;
}

export const PIPELINE_GROUPS: ReadonlyArray<readonly [string, Tone]> = [
  ['RUNNING', 'live'], ['NEEDS ATTENTION', 'crit'], ['IDLE', 'idle'], ['NOT REPORTING', 'warn'], ['OFF', 'off'],
];

const LIVE_PHASES: ReadonlySet<Phase> = new Set(['claiming', 'verifying', 'starting', 'running', 'cancelling', 'finalizing']);
const isLive = (r: RunRecord): boolean => r.outcome === null && LIVE_PHASES.has(r.phase);

const issueNumber = (id: string): string => {
  const tail = id.slice(id.lastIndexOf('-') + 1);
  return /^\d{1,8}$/.test(tail) ? tail : id.slice(0, 12);
};

function runView(r: RunRecord): RunView {
  const live = isLive(r);
  return {
    issue: r.issue_identifier,
    num: issueNumber(r.issue_identifier),
    phase: r.phase,
    outcome: r.outcome,
    reason: r.reason,
    admittedAt: r.admitted_at,
    claimedAt: r.claimed_at,
    verifiedAt: r.verified_at,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    start: r.claimed_at ?? r.admitted_at,
    live,
    verifying: live && (r.phase === 'claiming' || r.phase === 'verifying'),
    lane: 0,
  };
}

// One lane per slot, at most MAX_LANES. The CLI does not say which slot a run used, so runs are packed into
// lanes by time: each takes the first lane free at its start, so concurrent runs never share a lane while
// there are lanes left. Lanes are layout, not slot identities.
export function packLanes(runs: RunView[], lanes: number, now: number): void {
  const ends = Array.from({ length: lanes }, () => -Infinity);
  for (const r of [...runs].sort((a, b) => a.start - b.start || a.admittedAt - b.admittedAt || a.issue.localeCompare(b.issue))) {
    const end = r.live ? now : r.endedAt ?? r.start;
    let lane = ends.findIndex((e) => e <= r.start);
    if (lane < 0) lane = ends.indexOf(Math.min(...ends));
    r.lane = lane;
    ends[lane] = Math.max(ends[lane]!, end);
  }
}

function pipelineState(p: PipelineRecord, live: readonly RunView[], reporting: Reporting): Pick<PipelineView, 'word' | 'tone' | 'group' | 'why' | 'whyTone'> {
  const blocked = p.blocked_reasons.find((r) => r !== 'disabled' && !r.startsWith('definition-') && !r.startsWith('runner-'));
  if (!p.enabled) return { word: 'OFF', tone: 'off', group: 4, why: p.definition_state.state === 'missing' ? 'NO DEFINITION' : 'DISABLED', whyTone: 'off' };
  if (p.definition_state.state === 'invalid') return { word: 'INVALID', tone: 'crit', group: 1, why: 'DEFINITION INVALID', whyTone: 'crit' };
  if (p.definition_state.state === 'missing') return { word: 'NO DEF', tone: 'crit', group: 1, why: 'DEFINITION MISSING', whyTone: 'crit' };
  if (reporting === 'stopped') return { word: 'BLOCKED', tone: 'warn', group: 3, why: 'RUNNER STOPPED', whyTone: 'warn' };
  if (reporting === 'unreachable') return { word: 'NO REPORT', tone: 'off', group: 3, why: 'LAST KNOWN', whyTone: 'off' };
  if (live.length) {
    const verifying = live.filter((r) => r.verifying).length;
    return {
      word: verifying === live.length ? 'VERIFYING' : 'RUNNING',
      tone: 'live',
      group: 0,
      why: verifying ? `${verifying} VERIFYING` : `${live.length} BUSY`,
      whyTone: 'idle',
    };
  }
  // A failed last run is not a state: it shows as ✕ in the results and lanes. A reason the runner gives for
  // not claiming is shown beside IDLE in warning ink.
  return blocked ? { word: 'IDLE', tone: 'idle', group: 2, why: blocked.toUpperCase(), whyTone: 'warn' } : { word: 'IDLE', tone: 'idle', group: 2, why: 'NO LIVE RUNS', whyTone: 'idle' };
}

export function pipelineViews(data: PipelinesData, now: number): PipelineView[] {
  const reporting = reportingOf(data.runner.state);
  const byName = [...data.pipelines].sort((a, b) => a.name.localeCompare(b.name));
  const views = byName.map((p, index) => {
    const runs = data.runs.filter((r) => r.pipeline === p.name).map(runView);
    const live = runs.filter((r) => r.live).sort((a, b) => a.start - b.start);
    const done = runs.filter((r) => !r.live && r.outcome !== null).sort((a, b) => (b.endedAt ?? -Infinity) - (a.endedAt ?? -Infinity));
    const lanes = p.slots === null ? 1 : Math.min(p.slots, MAX_LANES);
    packLanes(runs.filter((r) => r.live || (r.endedAt ?? r.start) >= now - PAST_MS), lanes, now);
    return {
      name: p.name,
      number: index + 1,
      category: index % 7,
      scope: p.scope,
      slots: p.slots,
      lanes,
      runs,
      live,
      done,
      ...pipelineState(p, live, reporting),
    } satisfies PipelineView;
  });
  return views.sort((a, b) => a.group - b.group || (a.group === 0 ? a.live[0]!.start - b.live[0]!.start : 0) || a.name.localeCompare(b.name));
}

export type Filter = 'ALL' | 'ATTENTION' | 'LIVE';
export const FILTERS: readonly Filter[] = ['ALL', 'ATTENTION', 'LIVE'];
// ATTENTION keeps only problems that need someone (critical); LIVE keeps only live work.
export const applyFilter = <V extends { tone: Tone }>(items: readonly V[], filter: Filter): V[] =>
  items.filter((i) => filter === 'ALL' || (filter === 'ATTENTION' ? i.tone === 'crit' : i.tone === 'live'));

// ---------- schedules ----------

export interface ScheduleView {
  readonly id: string;
  readonly cadence: string;
  readonly word: string;
  readonly tone: Tone;
  readonly group: number;
  readonly why: string;
  readonly last: { readonly at: number; readonly outcome: 'succeeded' | 'failed' | 'cancelled' | 'interrupted'; readonly reason: string } | null;
  readonly next: number | null;
  readonly firing: number | null;
}

export const SCHEDULE_GROUPS: ReadonlyArray<readonly [string, Tone]> = [
  ['NEEDS ATTENTION', 'crit'], ['ON · BY NEXT RUN', 'idle'], ['NOT REPORTING', 'warn'], ['OFF', 'off'],
];

const pad2 = (n: number): string => String(n).padStart(2, '0');
export const clock = (ms: number, seconds = true): string => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}${seconds ? `:${pad2(d.getSeconds())}` : ''}`;
};

function cadence(t: ScheduleRecord['timing']): string {
  if (!t) return '—';
  if (t.kind === 'interval') {
    const m = t.everyMinutes;
    if (m < 60) return `EVERY ${m}M`;
    if (m % 1440 === 0) return `EVERY ${m / 1440}D`;
    if (m % 60 === 0) return `EVERY ${m / 60}H`;
    return `EVERY ${Math.floor(m / 60)}H${pad2(m % 60)}`;
  }
  // Daily times are UTC in the definition; they are shown in local time.
  const local = t.timesUtc.map((hm) => {
    const [h, m] = hm.split(':').map(Number);
    return clock(Date.UTC(2000, 0, 1, h, m), false);
  });
  return local.length === 1 ? `DAILY ${local[0]}` : `DAILY ×${local.length}`;
}

function scheduleState(s: ScheduleRecord, reporting: Reporting): Pick<ScheduleView, 'word' | 'tone' | 'group' | 'why'> {
  const reason = (r: string) => r.replaceAll('-', ' ').toUpperCase();
  // As for pipelines, a failed last run is not a state: it shows as ✕ in the strip. A failure that matters
  // latches a pause (script-failed, timeout, spawn-failed), and a paused schedule does need someone.
  if (s.pause_reason) return { word: 'PAUSED', tone: 'crit', group: 0, why: reason(s.pause_reason).replace('DEFINITION ', 'DEF ') };
  if (!s.enabled) return { word: 'OFF', tone: 'off', group: 3, why: 'DISABLED' };
  if (s.definition.state === 'invalid') return { word: 'INVALID', tone: 'crit', group: 0, why: 'DEFINITION INVALID' };
  if (s.definition.state === 'missing') return { word: 'NO DEF', tone: 'crit', group: 0, why: 'DEFINITION MISSING' };
  if (reporting === 'stopped') return { word: 'HELD', tone: 'warn', group: 2, why: 'RUNNER STOPPED' };
  if (reporting === 'unreachable') return { word: 'NO REPORT', tone: 'off', group: 2, why: 'LAST KNOWN' };
  if (s.active_run) return { word: 'FIRING', tone: 'live', group: 1, why: '' };
  return { word: 'ON', tone: 'idle', group: 1, why: '' };
}

export function scheduleViews(data: SchedulesData, reporting: Reporting): ScheduleView[] {
  return data.schedules
    .map((s) => ({
      id: s.id,
      cadence: cadence(s.timing),
      ...scheduleState(s, reporting),
      last: s.last_result ? { at: s.last_result.ended_at, outcome: s.last_result.outcome, reason: s.last_result.reason } : null,
      next: s.next_scheduled_at,
      firing: s.active_run ? s.active_run.started_at ?? s.active_run.admitted_at : null,
    }))
    .sort((a, b) => a.group - b.group || (a.next ?? Infinity) - (b.next ?? Infinity) || a.id.localeCompare(b.id));
}

// ---------- events and alerts ----------

export type Verb = 'CLAIM' | 'DONE' | 'FAIL' | 'STOP' | 'LOST' | 'BLOCK' | 'OK';
export interface LogEvent {
  readonly at: number;
  readonly verb: Verb;
  readonly tone: Tone;
  readonly ref: string;
  readonly text: string;
  readonly pipeline?: string;
}

// How an outcome reads in the log: a cancelled run was stopped; an interrupted or dropped one was lost; a blocked
// one stopped on a blocker its handler reported.
const END: Record<Outcome, readonly [Verb, Tone]> = {
  succeeded: ['DONE', 'ok'], failed: ['FAIL', 'crit'], blocked: ['BLOCK', 'warn'], cancelled: ['STOP', 'warn'], interrupted: ['LOST', 'warn'], dropped: ['LOST', 'warn'],
};

export function runnerEvents(data: PipelinesData): LogEvent[] {
  const { state, recorded_at: at } = data.runner;
  if (at === null) return [];
  if (state === 'stopped') return [{ at, verb: 'STOP', tone: 'warn', ref: '', text: 'RUNNER STOPPED' }];
  if (state === 'unreachable') return [{ at, verb: 'LOST', tone: 'crit', ref: '', text: 'LAST REPORT' }];
  return [];
}

export function pipelineEvents(data: PipelinesData, now: number): LogEvent[] {
  const out: LogEvent[] = runnerEvents(data);
  for (const r of data.runs) {
    const num = issueNumber(r.issue_identifier);
    if (r.claimed_at !== null) out.push({ at: r.claimed_at, verb: 'CLAIM', tone: 'live', ref: num, text: r.pipeline.toUpperCase(), pipeline: r.pipeline });
    if (r.outcome !== null && r.ended_at !== null) {
      const [verb, tone] = END[r.outcome];
      const text = r.outcome === 'succeeded' || r.outcome === 'failed' ? r.pipeline : `${r.pipeline} ${r.outcome}`;
      out.push({ at: r.ended_at, verb, tone, ref: num, text: text.toUpperCase(), pipeline: r.pipeline });
    }
  }
  return out.filter((e) => e.at <= now).sort((a, b) => b.at - a.at);
}

export function scheduleEvents(data: SchedulesData, runner: readonly LogEvent[], now: number): LogEvent[] {
  const out: LogEvent[] = [...runner];
  for (const s of data.schedules) {
    const r = s.last_result;
    if (!r) continue;
    const [verb, tone] = r.outcome === 'succeeded' ? (['OK', 'ok'] as const) : END[r.outcome];
    out.push({ at: r.ended_at, verb, tone, ref: '', text: (r.outcome === 'succeeded' ? s.id : `${s.id} ${r.reason}`).toUpperCase() });
  }
  return out.filter((e) => e.at <= now).sort((a, b) => b.at - a.at);
}

export interface Alert { readonly tone: Tone; readonly text: string }

// Everything that needs someone, newest knowledge first. `schedules` is null when they could not be read,
// which is itself an alert: their problems are unknown, not absent.
export function alerts(data: PipelinesData, schedules: SchedulesData | null): Alert[] {
  const out: Alert[] = [];
  const state = data.runner.state;
  if (state === 'unreachable') out.push({ tone: 'crit', text: 'runner unreachable' });
  if (state === 'stopped') out.push({ tone: 'warn', text: 'runner stopped' });
  for (const p of data.pipelines) {
    if (p.enabled && p.definition_state.state !== 'valid') out.push({ tone: 'crit', text: `${p.name} ${p.definition_state.state === 'invalid' ? 'invalid' : 'no definition'}` });
  }
  if (schedules === null) out.push({ tone: 'warn', text: 'schedules unread' });
  else {
    for (const s of schedules.schedules) {
      if (s.pause_reason) out.push({ tone: 'crit', text: `${s.id} paused` });
    }
  }
  for (const p of data.runner.problems) out.push({ tone: 'warn', text: p.toLowerCase().replaceAll('_', ' ') });
  for (const b of data.polling.blocked_reasons) if (!b.startsWith('runner-')) out.push({ tone: 'warn', text: `poll ${b}` });
  for (const d of data.runner.service.environment_drift) out.push({ tone: 'warn', text: `service ${d} drift` });
  return out;
}

// Compact age: 45S, 12M, 5H07, 3D. Unknown is `?`, never zero.
export function age(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '?';
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}S`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H${pad2(m % 60)}`;
  return `${Math.floor(h / 24)}D`;
}
