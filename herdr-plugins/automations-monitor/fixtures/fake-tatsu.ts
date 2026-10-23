#!/usr/bin/env bun
// A stand-in `tatsu` for tests, frames and the isolated Herdr check; it never runs the real CLI.
// FAKE_TATSU_SCENARIO picks the reply (default `floor`). FAKE_TATSU_LOG, when set, receives one JSON line per
// call with the argv, start and end times and pids, so tests can check the argv and that calls never overlap.
// FAKE_TATSU_DELAY_MS delays the answer.
// Teardown scenarios (they need FAKE_TATSU_LOG, where each process logs its pid once it is ready):
//   stubborn     ignores SIGTERM, starts a descendant that ignores it too, and never answers
//   leaves-child exits on SIGTERM but its SIGTERM-ignoring descendant does not; never answers
//   orphan-exit  starts a SIGTERM-ignoring descendant, then answers and exits normally, leaving it behind
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { envelope, PIPELINES_URL, pipelinesData, SCHEDULES_URL, schedulesData } from './data.ts';

const started = Date.now();
const argv = process.argv.slice(2);
const logFile = process.env.FAKE_TATSU_LOG;
const log = (extra: Record<string, unknown> = {}) => {
  if (logFile) appendFileSync(logFile, JSON.stringify({ argv, started, ended: Date.now(), pid: process.pid, ...extra }) + '\n');
};
const scenario = process.env.FAKE_TATSU_SCENARIO ?? 'floor';
const delay = Number(process.env.FAKE_TATSU_DELAY_MS ?? 0);
const schedules = argv[1] === 'schedules';
const now = Date.now();

const good = (pv: Parameters<typeof pipelinesData>[1], sv: Parameters<typeof schedulesData>[1]): [string, number] =>
  [JSON.stringify(schedules ? envelope(SCHEDULES_URL, schedulesData(now, sv)) : envelope(PIPELINES_URL, pipelinesData(now, pv))), 0];

const replies: Record<string, () => [string, number]> = {
  floor: () => good('floor', 'list'),
  empty: () => good('empty', 'empty'),
  stopped: () => good('stopped', 'stopped'),
  unreachable: () => good('unreachable', 'list'),
  'no-schedules': () => good('floor', 'empty'),
  'schedules-error': () => (schedules ? replies.error!() : good('floor', 'list')),
  error: () => [JSON.stringify({ schema_version: 2, schema_url: PIPELINES_URL, error: { code: 'AUTOMATIONS_RUNNER_UNAVAILABLE', message: 'runner state at /home/demo/.private/state.json is unreadable', hint: null }, next_actions: [] }), 1],
  garbage: () => ['<html>not json</html>', 0],
  exit: () => ['', 3],
  unsupported: () => [JSON.stringify({ schema_version: 3, data: {} }), 0],
  invalid: () => {
    const data = pipelinesData(now, 'floor');
    return [JSON.stringify(envelope(PIPELINES_URL, { ...data, runs: data.runs.map((r, i) => (i === 3 ? { ...r, phase: '/home/demo/.private/phase' } : r)) })), 0];
  },
  'no-lists': () => [JSON.stringify(envelope(PIPELINES_URL, { ...pipelinesData(now, 'floor'), runs: undefined })), 0],
  big: () => ['x'.repeat(5 * 1024 * 1024), 0],
};

// A descendant in this process group, with no stdio, that ignores SIGTERM and logs when it is ready.
function descendant(ready: (pid: number) => void) {
  const code = `process.on('SIGTERM', () => {}); require('fs').appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({ descendant: process.pid }) + '\\n'); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore' });
  const wait = setInterval(() => {
    if (logFile && existsSync(logFile) && readFileSync(logFile, 'utf8').includes(`"descendant":${child.pid}`)) {
      clearInterval(wait);
      ready(child.pid!);
    }
  }, 10);
}

if (scenario === 'stubborn' || scenario === 'leaves-child') {
  if (scenario === 'stubborn') process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
  descendant((pid) => log({ child: pid, ready: true }));
} else if (scenario === 'orphan-exit') {
  descendant((pid) => {
    log({ child: pid });
    process.stdout.write(replies.floor!()[0], () => process.exit(0));
  });
} else if (scenario === 'hang') {
  log({ hang: true });
  setInterval(() => {}, 1000);
} else {
  const [out, code] = (replies[scenario] ?? replies.garbage!)();
  setTimeout(() => {
    process.stdout.write(out, () => {
      log();
      process.exit(code);
    });
  }, delay);
}
