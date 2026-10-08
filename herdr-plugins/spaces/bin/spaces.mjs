#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { target, privateDirectory, lockOwner, alive, log } from '../src/state.mjs';
import { runDaemon } from '../src/daemon.mjs';

const command = process.argv[2];
let destination;
try {
  destination = target();
  await privateDirectory(destination.stateDir);
  if (command === 'ensure') {
    const owner = await lockOwner(destination.lock);
    if (!owner || (!owner.unknown && !alive(owner.pid))) {
      // Herdr waits for EOF on hook pipes. The daemon inherits no pipe, terminal, context payload or secret environment.
      const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'HERDR_SOCKET_PATH', 'HERDR_PLUGIN_STATE_DIR', 'HERDR_PLUGIN_CONFIG_DIR'].filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'run'], { detached: true, stdio: 'ignore', env });
      child.on('error', () => { void log(destination, 'spawn_failed'); process.exitCode = 1; });
      child.unref();
    }
  } else if (command === 'run') {
    const runtime = await runDaemon(destination);
    await runtime.done;
  } else if (command === 'status') {
    const owner = await lockOwner(destination.lock);
    process.stdout.write(JSON.stringify({ running: !!owner && !owner.unknown && alive(owner.pid) }) + '\n');
  } else {
    process.stderr.write('Usage: node bin/spaces.mjs ensure|run|status\n'); process.exitCode = 2;
  }
} catch {
  if (destination) await log(destination, 'startup_failed');
  process.stderr.write('Spaces reporter could not start; check its local state log.\n'); process.exitCode = 1;
}
