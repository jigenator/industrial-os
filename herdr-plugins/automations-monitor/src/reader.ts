// The only I/O with Tatsu. Each read runs one of two fixed argvs, bounded in time and output size, in its own
// process group; stderr is discarded because it can hold local paths. A read finishes only once the process
// group is gone, so the next read never starts beside an orphan. Bounds: ../docs/architecture.md#data-contract.
import { Context, Duration, Effect, Layer, Schema, SchemaIssue, Stream } from 'effect';
import { ChildProcess, ChildProcessSpawner } from 'effect/process';
import { ErrorEnvelope, PipelinesData, SCHEMA_VERSION, SchedulesData } from './contract.ts';
import { redact } from './redact.ts';

export const PIPELINES_ARGS = ['automations', 'pipelines', '--json'] as const;
export const SCHEDULES_ARGS = ['automations', 'schedules', '--json'] as const;
export const READ_TIMEOUT_MS = 8000;
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
// SIGTERM to the read's process group, then SIGKILL after this grace; Effect's spawner then waits up to one
// more second for the group to empty.
export const KILL_GRACE_MS = 1000;

export type ReadFailure =
  | { readonly kind: 'missing' }
  | { readonly kind: 'spawn-failed'; readonly code: string }
  | { readonly kind: 'timeout'; readonly timeoutMs: number }
  | { readonly kind: 'too-large'; readonly maxBytes: number }
  | { readonly kind: 'error-envelope'; readonly code: string; readonly message: string | null; readonly exitCode: number | null }
  | { readonly kind: 'exit'; readonly exitCode: number | null }
  | { readonly kind: 'unsupported'; readonly version: number | null }
  | { readonly kind: 'garbage'; readonly at: string | null };

export class TatsuReader extends Context.Service<TatsuReader, {
  readonly pipelines: Effect.Effect<PipelinesData, ReadFailure>;
  readonly schedules: Effect.Effect<SchedulesData, ReadFailure>;
}>()('automations-monitor/TatsuReader') {}

export const tatsuCommand = (env: Record<string, string | undefined> = process.env): string => env.AUTOMATIONS_MONITOR_TATSU || 'tatsu';

export interface ReaderOptions {
  readonly command?: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly killGraceMs?: number;
}

const firstIssuePath = SchemaIssue.makeFormatterStandardSchemaV1();

// One finished read: stdout and exit code in, decoded data or a typed failure out. Classification order is
// part of the contract: an error envelope wins over the exit code, the exit code over the version, and the
// version over the shape.
export function classify<S extends Schema.Decoder<unknown>>(schema: S, stdout: string, exitCode: number | null): { ok: S['Type'] } | { failure: ReadFailure } {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    return { failure: exitCode === 0 ? { kind: 'garbage', at: null } : { kind: 'exit', exitCode } };
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return { failure: { kind: 'garbage', at: null } };
  const record = json as Record<string, unknown>;
  if (record.error !== null && typeof record.error === 'object') {
    const envelope = Schema.decodeUnknownOption(ErrorEnvelope)(record);
    const code = envelope._tag === 'Some' ? envelope.value.error.code : 'UNKNOWN';
    return { failure: { kind: 'error-envelope', code, message: redact((record.error as Record<string, unknown>).message), exitCode } };
  }
  if (exitCode !== 0) return { failure: { kind: 'exit', exitCode } };
  if (record.schema_version !== SCHEMA_VERSION) {
    const v = record.schema_version;
    return { failure: { kind: 'unsupported', version: typeof v === 'number' && Number.isSafeInteger(v) ? v : null } };
  }
  const decoded = Schema.decodeUnknownResult(schema)(record.data);
  if (decoded._tag === 'Success') return { ok: decoded.success };
  return { failure: { kind: 'garbage', at: issuePath(decoded.failure) } };
}

// The location of the first schema mismatch, such as `data.runs.3.phase`; never the offending value, which
// could be a path.
function issuePath(error: Schema.SchemaError): string {
  const path = firstIssuePath(error.issue).issues[0]?.path ?? [];
  const text = ['data', ...path].map(String).join('.');
  return /^[A-Za-z0-9_.-]{1,80}$/.test(text) ? text : 'data';
}

const spawnFailure = (error: { reason?: { _tag?: string } }): ReadFailure =>
  error.reason?._tag === 'NotFound' ? { kind: 'missing' } : { kind: 'spawn-failed', code: error.reason?._tag ?? 'Unknown' };

const TOO_LARGE = Symbol('too-large');

// Run one argv to completion within the bounds. Leaving the scope (normal end, too-large, timeout or an
// interrupt such as quitting) terminates the process group and waits for it.
function runCli<S extends Schema.Decoder<unknown>>(args: ReadonlyArray<string>, schema: S, opts: Required<ReaderOptions>) {
  const read = Effect.scoped(Effect.gen(function* () {
    const handle = yield* ChildProcess.make(opts.command, args, {
      stdin: 'ignore',
      stderr: 'ignore',
      killSignal: 'SIGTERM',
      forceKillAfter: Duration.millis(opts.killGraceMs),
    }).pipe(Effect.mapError(spawnFailure));
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    yield* Stream.runForEach(handle.stdout, (chunk) => {
      bytes += chunk.length;
      if (bytes > opts.maxBytes) return Effect.fail(TOO_LARGE);
      chunks.push(chunk);
      return Effect.void;
    }).pipe(
      Effect.catch((e) => (e === TOO_LARGE ? Effect.fail<ReadFailure>({ kind: 'too-large', maxBytes: opts.maxBytes }) : Effect.void)),
    );
    // A leader killed by a signal has no exit code.
    const exitCode = yield* handle.exitCode.pipe(Effect.map(Number), Effect.orElseSucceed(() => null));
    return { stdout: Buffer.concat(chunks).toString('utf8'), exitCode };
  }));
  return read.pipe(
    Effect.timeoutOrElse({ duration: Duration.millis(opts.timeoutMs), orElse: () => Effect.fail<ReadFailure>({ kind: 'timeout', timeoutMs: opts.timeoutMs }) }),
    Effect.flatMap(({ stdout, exitCode }) => {
      const r = classify(schema, stdout, exitCode);
      return 'ok' in r ? Effect.succeed(r.ok as S['Type']) : Effect.fail(r.failure);
    }),
  );
}

export const makeReader = (options: ReaderOptions = {}) => Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const opts: Required<ReaderOptions> = {
    command: options.command ?? tatsuCommand(),
    timeoutMs: options.timeoutMs ?? READ_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? MAX_OUTPUT_BYTES,
    killGraceMs: options.killGraceMs ?? KILL_GRACE_MS,
  };
  const provide = Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner);
  return TatsuReader.of({
    pipelines: runCli(PIPELINES_ARGS, PipelinesData, opts).pipe(provide),
    schedules: runCli(SCHEDULES_ARGS, SchedulesData, opts).pipe(provide),
  });
});

export const readerLayer = (options: ReaderOptions = {}) => Layer.effect(TatsuReader, makeReader(options));
