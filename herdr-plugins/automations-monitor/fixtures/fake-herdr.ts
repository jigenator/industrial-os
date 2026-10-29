#!/usr/bin/env bun
// A stand-in `herdr` for the restore hook's tests; it never talks to a Herdr server. FAKE_HERDR_STATE names a
// JSON file: { panes, info: { <pane id>: [process_info, ...] }, failList?: true }. Each `pane process-info`
// call for a pane answers with the next entry of its list, repeating the last. Every call is appended to
// FAKE_HERDR_LOG as one JSON line with its argv.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const logFile = process.env.FAKE_HERDR_LOG!;
const state = JSON.parse(readFileSync(process.env.FAKE_HERDR_STATE!, 'utf8')) as {
  panes: unknown[];
  info: Record<string, Array<Record<string, unknown>>>;
  failList?: boolean;
};
const earlier = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { argv: string[] }) : [];
appendFileSync(logFile, JSON.stringify({ argv }) + '\n');
const reply = (result: unknown) => process.stdout.write(JSON.stringify({ id: 'cli', result }));

if (argv[0] === 'pane' && argv[1] === 'list') {
  if (state.failList) process.exit(1);
  reply({ panes: state.panes, type: 'pane_list' });
} else if (argv[0] === 'pane' && argv[1] === 'process-info' && argv[2] === '--pane') {
  const seq = state.info[argv[3]!] ?? [{ shell_pid: null, foreground_process_group_id: null, foreground_processes: [] }];
  const n = earlier.filter((c) => c.argv[1] === 'process-info' && c.argv[3] === argv[3]).length;
  reply({ process_info: { pane_id: argv[3], ...seq[Math.min(n, seq.length - 1)]! }, type: 'pane_process_info' });
} else if (argv[0] === 'pane' && argv[1] === 'run') {
  reply({ type: 'ok' });
} else process.exit(2);
