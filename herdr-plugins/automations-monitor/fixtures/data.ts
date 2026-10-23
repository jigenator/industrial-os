// Invented Tatsu replies for tests, frames and the fake `tatsu`. Every name, issue key, machine and path here
// is made up; the shapes follow schema version 2. Paths sit in fields the monitor ignores, so tests can check
// that none reaches the screen. Times are relative to `now`.
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();
const PRIVATE = '/home/demo/.private';

export const PIPELINES_URL = 'https://example.invalid/schemas/automations-pipelines.v2.json';
export const SCHEDULES_URL = 'https://example.invalid/schemas/automations-schedules.v2.json';

export const envelope = (url: string, data: unknown) => ({ schema_version: 2, schema_url: url, data, next_actions: [], notices: [] });

const ref = (name: string) => ({ state: 'available', path: `${PRIVATE}/${name}` });

function runner(state: string, observation: string, recordedAt: number | null) {
  return {
    state,
    observation,
    instance_id: state === 'running' ? '00000000-0000-4000-8000-000000000001' : null,
    version: state === 'running' ? 'demo' : null,
    mode: state === 'running' ? 'background' : null,
    observed_at: iso(recordedAt ?? 0),
    recorded_at: recordedAt === null ? null : iso(recordedAt),
    recorded_state: state === 'unreachable' ? 'running' : state,
    problems: [],
    service: { installed: true, autostart: true, environment_drift: ['PATH'], manager: 'launchd', configuration: ref('service.plist') },
    diagnostics: [ref('diagnostics.log')],
  };
}

interface RunSpec { pipeline: string; issue: number; claimed: number; verified?: number | null; started?: number | null; ended?: number | null; outcome?: string | null; phase?: string }

function run(now: number, s: RunSpec) {
  const ended = s.ended === undefined || s.ended === null ? null : now + s.ended * MIN;
  const outcome = s.outcome ?? (ended === null ? null : 'succeeded');
  const reason = outcome === null ? null : { succeeded: 'exit-zero', failed: 'nonzero-exit', cancelled: 'cancel-requested', interrupted: 'runner-interrupted', dropped: 'ownership-lost' }[outcome];
  const claimed = now + s.claimed * MIN;
  const verified = s.verified === null ? null : claimed + (s.verified ?? 0.33) * MIN;
  return {
    run_id: `00000000-0000-4000-8000-${String(s.issue).padStart(12, '0')}`,
    pipeline: s.pipeline,
    issue_id: '00000000-0000-4000-8000-000000000000',
    issue_identifier: `DEMO-${s.issue}`,
    machine: 'demoMachine',
    machine_label_id: '00000000-0000-4000-8000-000000000002',
    phase: s.phase ?? (outcome === null ? 'running' : 'terminal'),
    outcome,
    reason,
    admitted_at: iso(claimed - 2000),
    claimed_at: iso(claimed),
    verified_at: verified === null ? null : iso(verified),
    started_at: s.started === null || verified === null ? null : iso(verified + 1000),
    ended_at: ended === null ? null : iso(ended),
    script_exit_code: outcome === 'succeeded' ? 0 : outcome === 'failed' ? 1 : null,
    script_signal: null,
    source: ref(`runs/${s.issue}/source`),
    work: ref(`runs/${s.issue}/work`),
    issue_file: ref(`runs/${s.issue}/issue.md`),
    stdout: ref(`runs/${s.issue}/stdout.log`),
    stderr: ref(`runs/${s.issue}/stderr.log`),
    stdout_truncated: false,
    stderr_truncated: false,
    failure_label: { status: 'not-needed', error_code: null },
    maintenance: [],
    diagnostic_code: null,
  };
}

function pipeline(name: string, opts: { slots?: number | null; scope?: string | null; enabled?: boolean; def?: string; active?: number; blocked?: string[] } = {}) {
  const def = opts.def ?? 'valid';
  return {
    name,
    scope: opts.scope === undefined ? 'pool' : opts.scope,
    definition_state: { state: def, digest: def === 'valid' ? 'sha256:demo' : null, errors: def === 'invalid' ? [{ path: ['slots'], reason: 'invalid-value' }] : [] },
    enabled: opts.enabled ?? true,
    slots: opts.slots === undefined ? 3 : opts.slots,
    active_slots: opts.active ?? 0,
    blocked_reasons: opts.blocked ?? [],
    latest_diagnostic: null,
    last_clean_pass_at: null,
  };
}

// Finished history behind the live runs: back-to-back runs per lane with gaps, a few failures and others.
function history(pipeline: string, first: number, lanes: number, until: number[]): RunSpec[] {
  const out: RunSpec[] = [];
  let issue = first;
  for (let lane = 0; lane < lanes; lane++) {
    let cursor = until[lane] ?? -6;
    for (let k = 0; cursor > -260; k++) {
      const gap = 4 + ((issue * 7 + lane * 13) % 23);
      const dur = 6 + ((issue * 11 + k * 5) % 29);
      const end = cursor - gap;
      const outcome = issue % 11 === 0 ? 'failed' : issue % 17 === 0 ? 'interrupted' : issue % 19 === 0 ? 'dropped' : issue % 23 === 0 ? 'cancelled' : 'succeeded';
      out.push({ pipeline, issue: issue--, claimed: end - dur, ended: end, outcome });
      cursor = end - dur;
    }
  }
  return out;
}

export function pipelinesData(now: number, variant: 'floor' | 'empty' | 'stopped' | 'unreachable' = 'floor') {
  if (variant === 'empty') {
    return { runner: runner('running', 'live', now - 90 * MIN), machine: { name: 'demoMachine', label_id: '00000000-0000-4000-8000-000000000002', slots: 4, active_slots: 0 }, polling: polling(now, []), pipelines: [], runs: [] };
  }
  const live: RunSpec[] = [
    { pipeline: 'impl-plan', issue: 3301, claimed: -12.5 },
    { pipeline: 'impl-plan', issue: 3310, claimed: -0.5, verified: null, phase: 'verifying' },
    { pipeline: 'implement', issue: 3296, claimed: -49.3 },
    { pipeline: 'spec-review', issue: 3318, claimed: -7 },
    { pipeline: 'dep-bump', issue: 3324, claimed: -21 },
  ];
  const runs = [
    ...live,
    ...history('impl-plan', 3299, 3, [-13, -1, -6]),
    ...history('implement', 3288, 3, [-50, -8, -15]),
    ...history('spec-review', 3317, 3, [-8, -20, -40]),
    ...history('dep-bump', 3200, 2, [-22, -9]),
    ...history('release-notes', 3150, 1, [-30]),
    ...history('nightly-evals', 3100, 2, [-70, -95]),
    ...history('triage', 3050, 1, [-12]),
    { pipeline: 'docs-sweep', issue: 3001, claimed: -200, ended: -180, outcome: 'failed' },
  ];
  const stopped = variant === 'stopped', unreachable = variant === 'unreachable';
  const pipelines = [
    pipeline('spec-review', { active: 1 }),
    pipeline('impl-plan', { active: 2 }),
    pipeline('implement', { active: 1 }),
    pipeline('dep-bump', { slots: 2, active: 1 }),
    pipeline('release-notes', { slots: 1, scope: 'personal' }),
    pipeline('nightly-evals', { slots: 2 }),
    pipeline('triage', { slots: 1, blocked: ['queue-label-missing'] }),
    pipeline('docs-sweep', { slots: 1, scope: 'personal', def: 'invalid', blocked: ['definition-invalid'] }),
    pipeline('sandbox', { slots: null, scope: null, enabled: false, def: 'missing', blocked: ['disabled', 'definition-missing'] }),
  ].map((p) => (stopped ? { ...p, blocked_reasons: [...p.blocked_reasons, 'runner-stopped'] } : p));
  return {
    runner: stopped ? runner('stopped', 'recorded', now - 8 * MIN) : unreachable ? runner('unreachable', 'recorded', now - 14 * MIN) : runner('running', 'live', now - 90 * MIN),
    machine: { name: 'demoMachine', label_id: '00000000-0000-4000-8000-000000000002', slots: 12, active_slots: 5 },
    polling: polling(now, stopped ? ['runner-stopped'] : []),
    pipelines,
    runs: runs.map((r) => run(now, r)),
  };
}

function polling(now: number, blocked: string[]) {
  return { interval_seconds: 120, verify_delay_seconds: 20, last_sync_at: iso(now - 40_000), next_poll_at: blocked.length ? null : iso(now + 80_000), blocked_reasons: blocked };
}

function schedule(now: number, id: string, opts: { every?: number; daily?: string[]; enabled?: boolean; pause?: string | null; last?: [number, string] | null; next?: number | null; firing?: number | null; def?: string }) {
  const def = opts.def ?? 'valid';
  const enabled = opts.enabled ?? true;
  const next = opts.next === undefined || opts.next === null || !enabled || opts.pause ? null : iso(now + opts.next * MIN);
  return {
    id,
    description: `${PRIVATE}/schedules/${id}.ts runs here`,
    definition: { state: def, digest: def === 'valid' ? 'sha256:demo' : null, errors: def === 'invalid' ? [{ path: ['timing'], reason: 'invalid-value' }] : [] },
    enabled,
    pause_reason: opts.pause ?? null,
    maintenance: [],
    timing: opts.daily ? { kind: 'daily', timesUtc: opts.daily } : { kind: 'interval', everyMinutes: opts.every ?? 60, anchorUtc: '2026-01-01T00:00:00.000Z' },
    next_scheduled_at: next,
    next_slot_basis: next === null ? null : 'armed',
    dispatch_watermark: null,
    active_run: opts.firing === undefined || opts.firing === null ? null : {
      run_id: '00000000-0000-4000-8000-000000000010', request_id: null, trigger: 'scheduled', scheduled_slot: iso(now + opts.firing * MIN),
      phase: 'running', admitted_at: iso(now + opts.firing * MIN), started_at: iso(now + opts.firing * MIN + 500), definition_digest: 'sha256:demo',
      source: ref('schedules/source'), stdout: ref('schedules/stdout.log'), stderr: ref('schedules/stderr.log'),
    },
    last_result: opts.last ? {
      run_id: '00000000-0000-4000-8000-000000000011', outcome: opts.last[1],
      reason: opts.last[1] === 'succeeded' ? 'exit-zero' : opts.last[1] === 'failed' ? 'nonzero-exit' : opts.last[1] === 'cancelled' ? 'cancel-requested' : 'runner-interrupted',
      script_exit_code: opts.last[1] === 'succeeded' ? 0 : opts.last[1] === 'failed' ? 2 : null, script_signal: null,
      ended_at: iso(now + opts.last[0] * MIN), source: ref('schedules/last'), maintenance: [],
    } : null,
    successful_cleanup_count: 0,
    work: ref(`schedules/${id}/work`),
    source: ref(`schedules/${id}/source`),
    logs: [],
  };
}

export function schedulesData(now: number, variant: 'list' | 'empty' | 'stopped' = 'list') {
  const r = variant === 'stopped' ? runner('stopped', 'recorded', now - 8 * MIN) : runner('running', 'live', now - 90 * MIN);
  if (variant === 'empty') return { runner: r, schedules: [] };
  return {
    runner: r,
    schedules: [
      schedule(now, 'mirror-sync', { every: 10, last: [-4, 'succeeded'], next: 6 }),
      schedule(now, 'linear-sync', { every: 30, last: [-31, 'succeeded'], firing: -1, next: 29 }),
      schedule(now, 'quota-refresh', { every: 30, last: [-12, 'failed'], next: 18 }),
      schedule(now, 'morning-digest', { daily: ['09:00'], last: [-400, 'succeeded'], next: 600 }),
      schedule(now, 'disk-report', { every: 60, last: [-31, 'interrupted'], next: 29 }),
      schedule(now, 'cert-check', { every: 1440, enabled: false, pause: 'script-failed', last: [-90, 'failed'] }),
      schedule(now, 'artifact-gc', { daily: ['02:00', '14:00'], enabled: false, last: [-200, 'succeeded'] }),
    ],
  };
}
