// The startup hook. After a server restart Herdr brings every pane back as a new shell in its saved folder with
// its saved label, but does not rerun a plugin pane's command. This finds the monitor's restored panes (the
// manifest's pane title as label, the plugin folder as folder, an idle shell in the foreground) and starts the
// monitor in each. Startup hooks also run after a live handoff, when the monitor is still running; the
// idle-shell check skips those panes, so nothing is ever typed into a live monitor. Flow and limits:
// ../docs/architecture.md#restore-after-a-restart.
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { Duration, Effect, Schema, Stream } from 'effect';
import { ChildProcess, type ChildProcessSpawner } from 'effect/process';

// The `[[panes]]` title in herdr-plugin.toml; Herdr saves it as the pane's label. test/restore.test.ts checks it.
export const PANE_TITLE = 'Automations';
// Restored shells may still be starting when the hook runs: look every STEP_MS, at most SETTLE_MS in all.
const SETTLE_MS = 20_000;
const STEP_MS = 250;
const CALL_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

const Pane = Schema.Struct({ pane_id: Schema.String, label: Schema.optionalKey(Schema.NullOr(Schema.String)), cwd: Schema.optionalKey(Schema.NullOr(Schema.String)) });
const PaneList = Schema.Struct({ result: Schema.Struct({ panes: Schema.Array(Pane) }) });
const ProcessInfo = Schema.Struct({
  result: Schema.Struct({
    process_info: Schema.Struct({
      shell_pid: Schema.NullOr(Schema.Number),
      foreground_process_group_id: Schema.NullOr(Schema.Number),
      foreground_processes: Schema.Array(Schema.Struct({ pid: Schema.Number, argv: Schema.Array(Schema.String) })),
    }),
  }),
});
type Pane = typeof Pane.Type;

const real = (path: string): string | null => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

// Panes that were the monitor before the restart.
export function candidates(panes: readonly Pane[], root: string): string[] {
  const home = real(root);
  return panes.filter((p) => p.label === PANE_TITLE && typeof p.cwd === 'string' && home !== null && real(p.cwd) === home).map((p) => p.pane_id);
}

// Nothing but the pane's own shell is in the foreground, so a typed line goes to the shell. The process group
// alone is not enough: a running monitor shares its launcher's group, and the launcher is the pane's first
// process when Herdr opened the pane. A launcher alone in the foreground is holding an error message.
const isIdleShell = (info: typeof ProcessInfo.Type): boolean => {
  const { shell_pid, foreground_process_group_id, foreground_processes: fg } = info.result.process_info;
  return shell_pid !== null && foreground_process_group_id === shell_pid && fg.length === 1 && fg[0]!.pid === shell_pid
    && !fg[0]!.argv.some((a) => /automations-monitor\.(sh|ts)$/.test(a));
};

// The line typed into a restored shell. `exec` makes the launcher the pane's process, as when Herdr opens the
// pane, so quitting closes the pane.
export const runLine = (root: string): string => `exec sh '${join(root, 'bin', 'automations-monitor.sh').replaceAll("'", `'\\''`)}' pane`;

class HerdrCallError extends Error {}

function call(herdr: string, args: readonly string[]): Effect.Effect<string, HerdrCallError, ChildProcessSpawner.ChildProcessSpawner> {
  const run = Effect.scoped(Effect.gen(function* () {
    const handle = yield* ChildProcess.make(herdr, args, { stdin: 'ignore', stderr: 'ignore', killSignal: 'SIGTERM', forceKillAfter: Duration.seconds(1) });
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    yield* Stream.runForEach(handle.stdout, (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) return Effect.fail(new HerdrCallError(`herdr ${args[0]} ${args[1]}: output too large`));
      chunks.push(chunk);
      return Effect.void;
    });
    const code = Number(yield* handle.exitCode);
    if (code !== 0) return yield* Effect.fail(new HerdrCallError(`herdr ${args[0]} ${args[1]}: exit ${code}`));
    return Buffer.concat(chunks).toString('utf8');
  }));
  return run.pipe(
    Effect.mapError((e) => (e instanceof HerdrCallError ? e : new HerdrCallError(`herdr ${args[0]} ${args[1]}: could not run`))),
    Effect.timeoutOrElse({ duration: Duration.millis(CALL_TIMEOUT_MS), orElse: () => Effect.fail(new HerdrCallError(`herdr ${args[0]} ${args[1]}: timed out`)) }),
  );
}

const decode = <S extends Schema.Decoder<unknown>>(schema: S, what: string) => (text: string): Effect.Effect<S['Type'], HerdrCallError> =>
  Effect.try({ try: () => JSON.parse(text) as unknown, catch: () => new HerdrCallError(`${what}: not JSON`) }).pipe(
    Effect.flatMap((json) => Schema.decodeUnknownEffect(schema)(json).pipe(Effect.mapError(() => new HerdrCallError(`${what}: unexpected shape`)))),
  );

export interface RestoreOptions {
  readonly herdr: string;
  readonly root: string;
  readonly settleMs?: number;
  readonly stepMs?: number;
}

// Starts the monitor in each restored pane once its shell has been idle on two looks in a row; a pane that is
// busy until the settle time ends is left alone. Fails only if the panes cannot be listed.
export const restorePanes = (o: RestoreOptions) => Effect.gen(function* () {
  const stepMs = o.stepMs ?? STEP_MS;
  const list = yield* call(o.herdr, ['pane', 'list']).pipe(Effect.flatMap(decode(PaneList, 'pane list')));
  const found = candidates(list.result.panes, o.root);
  const pending = new Map(found.map((id) => [id, 0]));
  const started: string[] = [];
  for (let look = Math.ceil((o.settleMs ?? SETTLE_MS) / stepMs); pending.size > 0 && look > 0; look--) {
    for (const [id, idle] of pending) {
      const ok = yield* call(o.herdr, ['pane', 'process-info', '--pane', id]).pipe(
        Effect.flatMap(decode(ProcessInfo, 'pane process-info')),
        Effect.map(isIdleShell),
        Effect.orElseSucceed(() => false),
      );
      if (!ok) pending.set(id, 0);
      else if (idle === 0) pending.set(id, 1);
      else {
        pending.delete(id);
        const ran = yield* call(o.herdr, ['pane', 'run', id, runLine(o.root)]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
        if (ran) started.push(id);
      }
    }
    if (pending.size > 0) yield* Effect.sleep(Duration.millis(stepMs));
  }
  return { found: found.length, started: started.length };
});
