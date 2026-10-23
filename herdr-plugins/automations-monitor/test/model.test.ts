// State and group mapping: the pipeline groups and their order, the failed-last-run rule, the ATTENTION
// filter, category colours, lane packing, schedules, events and the unknown-is-not-zero rule.
import { describe, expect, test } from 'bun:test';
import type { PipelinesData } from '../src/contract.ts';
import { age, alerts, applyFilter, packLanes, PIPELINE_GROUPS, pipelineEvents, pipelineViews, scheduleViews, type RunView } from '../src/model.ts';
import { decoded } from './support.ts';

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const MIN = 60_000;

describe('pipelines', () => {
  test('groups in order: running oldest first, needs attention, idle, not reporting, off', () => {
    const views = pipelineViews(decoded(NOW).pipelines, NOW);
    expect(views.map((v) => [PIPELINE_GROUPS[v.group]![0], v.name, v.word])).toEqual([
      ['RUNNING', 'implement', 'RUNNING'],
      ['RUNNING', 'dep-bump', 'RUNNING'],
      ['RUNNING', 'impl-plan', 'RUNNING'],
      ['RUNNING', 'spec-review', 'RUNNING'],
      ['NEEDS ATTENTION', 'docs-sweep', 'INVALID'],
      ['IDLE', 'nightly-evals', 'IDLE'],
      ['IDLE', 'release-notes', 'IDLE'],
      ['IDLE', 'triage', 'IDLE'],
      ['OFF', 'sandbox', 'OFF'],
    ]);
    expect(views.find((v) => v.name === 'triage')!.why).toBe('QUEUE-LABEL-MISSING');
    expect(views.find((v) => v.name === 'sandbox')!.why).toBe('NO DEFINITION');
  });

  test('a failed last run is not a state: the pipeline stays idle and out of ATTENTION', () => {
    const data = decoded(NOW).pipelines;
    const fixed: PipelinesData = {
      ...data,
      pipelines: data.pipelines.map((p) => (p.name === 'docs-sweep' ? { ...p, definition_state: { state: 'valid' } } : p)),
    };
    const v = pipelineViews(fixed, NOW).find((p) => p.name === 'docs-sweep')!;
    expect(v.done[0]!.outcome).toBe('failed');
    expect([v.word, v.group, v.tone]).toEqual(['IDLE', 2, 'idle']);
    expect(applyFilter(pipelineViews(fixed, NOW), 'ATTENTION')).toEqual([]);
  });

  test('ATTENTION keeps definition problems only; LIVE keeps live work only', () => {
    const views = pipelineViews(decoded(NOW).pipelines, NOW);
    expect(applyFilter(views, 'ATTENTION').map((v) => v.name)).toEqual(['docs-sweep']);
    expect(applyFilter(views, 'LIVE').map((v) => v.name)).toEqual(['implement', 'dep-bump', 'impl-plan', 'spec-review']);
    expect(applyFilter(views, 'ALL').length).toBe(9);
  });

  test('a stopped or unreachable runner is not reporting; disabled stays off; definitions still need attention', () => {
    for (const [variant, word] of [['stopped', 'BLOCKED'], ['unreachable', 'NO REPORT']] as const) {
      const views = pipelineViews(decoded(NOW, variant).pipelines, NOW);
      const groups = new Map(views.map((v) => [v.name, v.group]));
      expect(groups.get('implement')).toBe(3);
      expect(groups.get('triage')).toBe(3);
      expect(groups.get('docs-sweep')).toBe(1);
      expect(groups.get('sandbox')).toBe(4);
      expect(views.find((v) => v.name === 'implement')!.word).toBe(word);
    }
  });

  test('category is the sorted-name index mod 7', () => {
    const views = pipelineViews(decoded(NOW).pipelines, NOW);
    const cat = Object.fromEntries(views.map((v) => [v.name, v.category]));
    expect(cat).toEqual({ 'dep-bump': 0, 'docs-sweep': 1, 'impl-plan': 2, implement: 3, 'nightly-evals': 4, 'release-notes': 5, sandbox: 6, 'spec-review': 0, triage: 1 });
  });

  test('a verifying run is live and verifying; slots and lanes come from the definition', () => {
    const v = pipelineViews(decoded(NOW).pipelines, NOW).find((p) => p.name === 'impl-plan')!;
    expect(v.live.map((r) => [r.num, r.verifying])).toEqual([['3301', false], ['3310', true]]);
    expect(v.why).toBe('1 VERIFYING');
    expect([v.slots, v.lanes]).toEqual([3, 3]);
    const off = pipelineViews(decoded(NOW).pipelines, NOW).find((p) => p.name === 'sandbox')!;
    expect([off.slots, off.lanes]).toEqual([null, 1]);
  });

  test('concurrent runs never share a lane while lanes are left', () => {
    const run = (issue: string, start: number, end: number | null): RunView => ({
      issue, num: issue, phase: end === null ? 'running' : 'terminal', outcome: end === null ? null : 'succeeded', reason: null,
      admittedAt: start, claimedAt: start, verifiedAt: null, startedAt: null, endedAt: end, start, live: end === null, verifying: false, lane: -1,
    });
    const runs = [run('a', 0, 10), run('b', 5, 20), run('c', 12, null), run('d', 21, null)];
    packLanes(runs, 2, 30);
    expect(runs.map((r) => r.lane)).toEqual([0, 1, 0, 1]);
  });

  test('events use the six verbs, newest first, and never the future', () => {
    const events = pipelineEvents(decoded(NOW).pipelines, NOW);
    expect(new Set(events.map((e) => e.verb))).toEqual(new Set(['CLAIM', 'DONE', 'FAIL', 'STOP', 'LOST']));
    for (let i = 1; i < events.length; i++) expect(events[i]!.at).toBeLessThanOrEqual(events[i - 1]!.at);
    expect(events.every((e) => e.at <= NOW)).toBe(true);
  });

  test('alerts name definition problems, drift and unread schedules', () => {
    const d = decoded(NOW);
    expect(alerts(d.pipelines, null).map((a) => a.text)).toEqual(['docs-sweep invalid', 'schedules unread', 'service PATH drift']);
    expect(alerts(d.pipelines, d.schedules).map((a) => a.text)).toContain('quota-refresh failed');
  });
});

describe('schedules', () => {
  test('states and groups, ordered by next run within a group', () => {
    const views = scheduleViews(decoded(NOW).schedules, 'live');
    expect(views.map((v) => [v.group, v.id, v.word, v.cadence])).toEqual([
      [0, 'quota-refresh', 'FAILED', 'EVERY 30M'],
      [0, 'cert-check', 'PAUSED', 'EVERY 1D'],
      [1, 'mirror-sync', 'ON', 'EVERY 10M'],
      [1, 'disk-report', 'ON', 'EVERY 1H'],
      [1, 'linear-sync', 'FIRING', 'EVERY 30M'],
      [1, 'morning-digest', 'ON', views.find((v) => v.id === 'morning-digest')!.cadence],
      [3, 'artifact-gc', 'OFF', 'DAILY ×2'],
    ]);
    expect(views.find((v) => v.id === 'cert-check')!.next).toBeNull();
  });

  test('a stopped runner holds every enabled schedule', () => {
    const views = scheduleViews(decoded(NOW, 'floor', 'stopped').schedules, 'stopped');
    expect(views.filter((v) => v.word === 'HELD').map((v) => v.id).sort()).toEqual(['disk-report', 'linear-sync', 'mirror-sync', 'morning-digest', 'quota-refresh']);
  });
});

test('unknown age is ?, never zero', () => {
  expect(age(null)).toBe('?');
  expect(age(Number.NaN)).toBe('?');
  expect(age(0)).toBe('0S');
  expect(age(8_000)).toBe('8S');
  expect(age(12 * MIN)).toBe('12M');
  expect(age(127 * MIN)).toBe('2H07');
});
