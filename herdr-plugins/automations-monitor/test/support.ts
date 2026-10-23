// Shared test helpers: the Bun platform layers, the fake `tatsu`, its call log, process liveness, and app
// states built from the fixtures.
import { BunChildProcessSpawner, BunFileSystem, BunPath } from '@effect/platform-bun';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Layer, Result } from 'effect';
import { envelope, PIPELINES_URL, pipelinesData, SCHEDULES_URL, schedulesData } from '../fixtures/data.ts';
import { PipelinesData, SchedulesData } from '../src/contract.ts';
import { classify, type ReadFailure } from '../src/reader.ts';
import { applyPoll, initialState, type AppState } from '../src/ui.ts';

export const FAKE = resolve(import.meta.dir, '..', 'fixtures', 'fake-tatsu.ts');
export const platform = BunChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)));

export interface Call {
  readonly argv?: string[];
  readonly started?: number;
  readonly ended?: number;
  readonly pid?: number;
  readonly child?: number;
  readonly descendant?: number;
  readonly ready?: boolean;
}

// A fresh fake-call log; set the scenario with `use`.
export function fakeLog() {
  const file = join(mkdtempSync(join(tmpdir(), 'am-test-')), 'calls.jsonl');
  return {
    file,
    calls: (): Call[] => (existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Call) : []),
    pids(): number[] {
      return [...new Set(this.calls().flatMap((c) => [c.pid, c.child, c.descendant].filter((p): p is number => typeof p === 'number')))];
    },
  };
}

export function use(scenario: string, log: string, delayMs = 0): void {
  process.env.FAKE_TATSU_SCENARIO = scenario;
  process.env.FAKE_TATSU_LOG = log;
  process.env.FAKE_TATSU_DELAY_MS = String(delayMs);
}

// Alive and not a zombie: a killed descendant whose parent died first stays a zombie until init reaps it.
export const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  const stat = Bun.spawnSync(['ps', '-o', 'stat=', '-p', String(pid)]).stdout.toString().trim();
  return stat !== '' && !stat.startsWith('Z');
};

// Fixture replies decoded exactly as the reader decodes them, and app states built from them.
export function decoded(now: number, pv: Parameters<typeof pipelinesData>[1] = 'floor', sv: Parameters<typeof schedulesData>[1] = 'list') {
  const p = classify(PipelinesData, JSON.stringify(envelope(PIPELINES_URL, pipelinesData(now, pv))), 0);
  const s = classify(SchedulesData, JSON.stringify(envelope(SCHEDULES_URL, schedulesData(now, sv))), 0);
  if (!('ok' in p) || !('ok' in s)) throw new Error('fixture does not decode');
  return { pipelines: p.ok, schedules: s.ok };
}

export function stateAt(now: number, opts: { pv?: Parameters<typeof pipelinesData>[1]; sv?: Parameters<typeof schedulesData>[1]; failure?: ReadFailure; motion?: boolean } = {}): AppState {
  const d = decoded(now, opts.pv, opts.sv);
  const outcome = <A>(a: A) => (opts.failure ? Result.fail(opts.failure) : Result.succeed(a));
  return applyPoll(initialState(opts.motion ?? true), { _tag: 'Read', at: now, nextAt: now + 10_000, pipelines: outcome(d.pipelines), schedules: outcome(d.schedules) });
}
