// The `[[startup]]` hook's entry: start the monitor in the panes Herdr restored after a server restart
// (../src/restore.ts). Prints only counts, never pane labels or paths; exit 1 only if the panes could not be listed.
import { BunChildProcessSpawner, BunFileSystem, BunPath, BunRuntime } from '@effect/platform-bun';
import { resolve } from 'node:path';
import { Effect, Layer } from 'effect';
import { restorePanes } from '../src/restore.ts';

const platform = BunChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)));
const root = resolve(import.meta.dir, '..');

BunRuntime.runMain(
  restorePanes({ herdr: process.env.HERDR_BIN_PATH || 'herdr', root }).pipe(
    Effect.tap(({ found, started }) => Effect.sync(() => process.stdout.write(`automations-monitor restore: started in ${started} of ${found} monitor panes\n`))),
    Effect.catch((e) => Effect.sync(() => {
      process.stderr.write(`automations-monitor restore: ${e.message}\n`);
      process.exitCode = 1;
    })),
    Effect.provide(platform),
  ),
  { disableErrorReporting: true },
);
