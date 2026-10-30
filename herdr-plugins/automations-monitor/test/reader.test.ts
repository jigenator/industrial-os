// The reader against the fake `tatsu`: the exact argv, decoding, every failure kind, and that a read never
// returns while any process of its group is alive, including one that ignores SIGTERM.
import { describe, expect, test } from 'bun:test';
import { Effect, Fiber, Result } from 'effect';
import { classify, makeReader, PIPELINES_ARGS, SCHEDULES_ARGS, tatsuCommand, type ReadFailure } from '../src/reader.ts';
import { PipelinesData, type SchedulesData } from '../src/contract.ts';
import { alive, FAKE, fakeLog, platform, use } from './support.ts';
import { envelope, PIPELINES_URL, pipelinesData } from '../fixtures/data.ts';

const read = (which: 'pipelines' | 'schedules', options: Parameters<typeof makeReader>[0] = {}) =>
  Effect.runPromise(Effect.gen(function* () {
    const reader = yield* makeReader({ command: FAKE, ...options });
    const run: Effect.Effect<unknown, ReadFailure> = reader[which];
    return yield* Effect.result(run);
  }).pipe(Effect.provide(platform)));

const failureOf = async (which: 'pipelines' | 'schedules', options: Parameters<typeof makeReader>[0] = {}): Promise<ReadFailure> => {
  const r = await read(which, options);
  if (Result.isSuccess(r)) throw new Error('expected a failure');
  return r.failure;
};

describe('reader', () => {
  test('runs exactly the two fixed argvs and decodes both replies', async () => {
    const log = fakeLog();
    use('floor', log.file);
    const p = await read('pipelines');
    const s = await read('schedules');
    expect(log.calls().map((c) => c.argv)).toEqual([[...PIPELINES_ARGS], [...SCHEDULES_ARGS]]);
    expect(PIPELINES_ARGS).toEqual(['automations', 'pipelines', '--json']);
    expect(SCHEDULES_ARGS).toEqual(['automations', 'schedules', '--json']);
    if (!Result.isSuccess(p) || !Result.isSuccess(s)) throw new Error('expected success');
    const pipelines = p.success as PipelinesData, schedules = s.success as SchedulesData;
    expect(pipelines.pipelines.length).toBe(9);
    expect(typeof pipelines.runs[0]!.claimed_at).toBe('number');
    expect(schedules.schedules.length).toBe(7);
  });

  test('the executable is tatsu on PATH unless overridden', () => {
    expect(tatsuCommand({})).toBe('tatsu');
    expect(tatsuCommand({ AUTOMATIONS_MONITOR_TATSU: '' })).toBe('tatsu');
    expect(tatsuCommand({ AUTOMATIONS_MONITOR_TATSU: '/opt/t' })).toBe('/opt/t');
  });

  test('an error envelope is an error, with its message redacted', async () => {
    use('error', fakeLog().file);
    const f = await failureOf('pipelines');
    expect(f).toEqual({ kind: 'error-envelope', code: 'AUTOMATIONS_RUNNER_UNAVAILABLE', message: 'runner state at <path> is unreadable', exitCode: 1 });
  });

  test('unsupported schema, garbage, a mismatch and an empty nonzero exit are told apart', async () => {
    use('unsupported', fakeLog().file);
    expect(await failureOf('pipelines')).toEqual({ kind: 'unsupported', version: 3 });
    use('garbage', fakeLog().file);
    expect(await failureOf('pipelines')).toEqual({ kind: 'garbage', at: null });
    use('invalid', fakeLog().file);
    expect(await failureOf('pipelines')).toEqual({ kind: 'garbage', at: 'data.runs.3.phase' });
    use('no-lists', fakeLog().file);
    expect(await failureOf('pipelines')).toEqual({ kind: 'garbage', at: 'data.runs' });
    use('exit', fakeLog().file);
    expect(await failureOf('pipelines')).toEqual({ kind: 'exit', exitCode: 3 });
  });

  test('a missing executable is missing', async () => {
    expect(await failureOf('pipelines', { command: '/nonexistent/automations-monitor/tatsu' })).toEqual({ kind: 'missing' });
  });

  test('output over the cap is too large, and the process is gone', async () => {
    const log = fakeLog();
    use('big', log.file);
    expect(await failureOf('pipelines', { maxBytes: 1024 * 1024 })).toEqual({ kind: 'too-large', maxBytes: 1024 * 1024 });
  });

  test('a timeout kills a process group whose leader and descendant ignore SIGTERM before returning', async () => {
    const log = fakeLog();
    use('stubborn', log.file);
    const start = Date.now();
    const f = await failureOf('pipelines', { timeoutMs: 800, killGraceMs: 300 });
    expect(f).toEqual({ kind: 'timeout', timeoutMs: 800 });
    const pids = log.pids();
    expect(pids.length).toBe(2);
    expect(pids.filter(alive)).toEqual([]);
    expect(Date.now() - start).toBeLessThan(4000);
  });

  test('a timeout also reaps a descendant left behind by a leader that exits on SIGTERM', async () => {
    const log = fakeLog();
    use('leaves-child', log.file);
    await failureOf('pipelines', { timeoutMs: 800, killGraceMs: 300 });
    expect(log.pids().length).toBe(2);
    expect(log.pids().filter(alive)).toEqual([]);
  });

  test('a finished read does not return beside an orphan of its group', async () => {
    const log = fakeLog();
    use('orphan-exit', log.file);
    const r = await read('pipelines', { killGraceMs: 300 });
    expect(Result.isSuccess(r)).toBe(true);
    expect(log.pids().length).toBe(2);
    expect(log.pids().filter(alive)).toEqual([]);
  });

  test('interrupting a read (quitting) kills the stubborn group before the interrupt completes', async () => {
    const log = fakeLog();
    use('stubborn', log.file);
    await Effect.runPromise(Effect.gen(function* () {
      const reader = yield* makeReader({ command: FAKE, killGraceMs: 300 });
      const fiber = yield* Effect.forkChild(reader.pipelines);
      while (!log.calls().some((c) => c.ready)) yield* Effect.sleep(20);
      yield* Fiber.interrupt(fiber);
    }).pipe(Effect.provide(platform)));
    expect(log.pids().length).toBe(2);
    expect(log.pids().filter(alive)).toEqual([]);
  });
});

describe('classify', () => {
  test('envelope beats exit code, exit code beats version, version beats shape', () => {
    const env = JSON.stringify({ schema_version: 9, error: { code: 'X', message: 'm', hint: null } });
    expect(classify(PipelinesData, env, 4)).toEqual({ failure: { kind: 'error-envelope', code: 'X', message: 'm', exitCode: 4 } });
    expect(classify(PipelinesData, JSON.stringify({ schema_version: 9, data: {} }), 4)).toEqual({ failure: { kind: 'exit', exitCode: 4 } });
    expect(classify(PipelinesData, JSON.stringify({ schema_version: 9, data: {} }), 0)).toEqual({ failure: { kind: 'unsupported', version: 9 } });
    expect(classify(PipelinesData, JSON.stringify({ schema_version: 2, data: {} }), 0)).toEqual({ failure: { kind: 'garbage', at: 'data.runner' } });
    expect(classify(PipelinesData, '[1]', 0)).toEqual({ failure: { kind: 'garbage', at: null } });
  });

  test('a blocked run outcome decodes', () => {
    const data = pipelinesData(Date.parse('2026-10-31T00:00:00Z'));
    data.runs[0] = { ...data.runs[0]!, phase: 'terminal', outcome: 'blocked', reason: 'handler-blocked', ended_at: data.runs[0]!.claimed_at };
    const r = classify(PipelinesData, JSON.stringify(envelope(PIPELINES_URL, data)), 0);
    expect('ok' in r && r.ok.runs[0]!.outcome).toBe('blocked');
  });

  test('an unknown error code shape still reads as an error envelope', () => {
    const r = classify(PipelinesData, JSON.stringify({ error: { code: 42, message: '/home/demo/x failed' } }), 1);
    expect(r).toEqual({ failure: { kind: 'error-envelope', code: 'UNKNOWN', message: '<path> failed', exitCode: 1 } });
  });
});
