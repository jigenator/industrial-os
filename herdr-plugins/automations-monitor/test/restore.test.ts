// The startup hook against the fake `herdr`: which restored panes it picks, that it types only into an idle
// shell (never into a running monitor after a live handoff), the exact line, and its failure.
import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Effect, Result } from 'effect';
import { candidates, PANE_TITLE, restorePanes, runLine } from '../src/restore.ts';
import { platform } from './support.ts';

const ROOT = resolve(import.meta.dir, '..');
const FAKE = join(ROOT, 'fixtures', 'fake-herdr.ts');
const IDLE = { shell_pid: 50, foreground_process_group_id: 50, foreground_processes: [{ pid: 50, argv: ['-zsh'] }] };
const BUSY = { shell_pid: 50, foreground_process_group_id: 77, foreground_processes: [{ pid: 77, argv: ['npm', 'test'] }] };
const STARTING = { shell_pid: null, foreground_process_group_id: null, foreground_processes: [] };
// What Herdr reports for a pane running the monitor (opened by Herdr, so the launcher is the pane's process)
// and for the launcher holding an error message: the same group as the pane's first process.
const MONITOR = { shell_pid: 50, foreground_process_group_id: 50, foreground_processes: [
  { pid: 51, argv: ['bun', `${ROOT}/bin/automations-monitor.ts`] }, { pid: 50, argv: ['sh', 'bin/automations-monitor.sh', 'pane'] },
] };
const HOLDING = { shell_pid: 50, foreground_process_group_id: 50, foreground_processes: [{ pid: 50, argv: ['sh', `${ROOT}/bin/automations-monitor.sh`, 'pane'] }] };

function run(state: object) {
  const dir = mkdtempSync(join(tmpdir(), 'am-restore-'));
  process.env.FAKE_HERDR_STATE = join(dir, 'state.json');
  process.env.FAKE_HERDR_LOG = join(dir, 'calls.jsonl');
  writeFileSync(process.env.FAKE_HERDR_STATE, JSON.stringify(state));
  const result = Effect.runPromise(Effect.result(restorePanes({ herdr: FAKE, root: ROOT, settleMs: 400, stepMs: 20 })).pipe(Effect.provide(platform)));
  const calls = () => readFileSync(process.env.FAKE_HERDR_LOG!, 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { argv: string[] }).argv);
  return { result, calls };
}

const pane = (id: string, label: string | null, cwd: string | null) => ({ pane_id: id, label, cwd, focused: false });

describe('restore', () => {
  test('the label it looks for is the manifest pane title', () => {
    const toml = readFileSync(join(ROOT, 'herdr-plugin.toml'), 'utf8');
    expect(toml.match(/\[\[panes\]\][^[]*?title = "([^"]+)"/)?.[1]).toBe(PANE_TITLE);
    expect(toml).toContain('[[startup]]\ncommand = ["sh", "bin/automations-monitor.sh", "restore"]');
  });

  test('candidates have the label and the plugin folder, through symlinks; nothing else matches', () => {
    const link = join(mkdtempSync(join(tmpdir(), 'am-link-')), 'monitor');
    symlinkSync(ROOT, link);
    const other = mkdtempSync(join(tmpdir(), 'am-other-'));
    mkdirSync(join(other, 'x'));
    expect(candidates([
      pane('a', PANE_TITLE, ROOT), pane('b', PANE_TITLE, link), pane('c', 'Shell', ROOT), pane('d', PANE_TITLE, other),
      pane('e', PANE_TITLE, null), pane('f', null, ROOT), pane('g', PANE_TITLE, join(other, 'gone')), pane('h', 'automations', ROOT),
    ], ROOT)).toEqual(['a', 'b']);
  });

  test('the typed line execs the launcher by absolute path, quoted for sh', () => {
    expect(runLine('/p/q')).toBe("exec sh '/p/q/bin/automations-monitor.sh' pane");
    expect(runLine("/it's")).toBe(`exec sh '/it'\\''s/bin/automations-monitor.sh' pane`);
  });

  test('starts the monitor in an idle restored pane after two idle looks, and in no other pane', async () => {
    const r = run({ panes: [pane('w:p1', PANE_TITLE, ROOT), pane('w:p2', 'Shell', ROOT)], info: { 'w:p1': [STARTING, IDLE] } });
    const out = await r.result;
    expect(Result.isSuccess(out) && out.success).toEqual({ found: 1, started: 1 });
    const calls = r.calls();
    expect(calls[0]).toEqual(['pane', 'list']);
    expect(calls.filter((c) => c[1] === 'process-info').every((c) => c[3] === 'w:p1')).toBe(true);
    expect(calls.filter((c) => c[1] === 'process-info').length).toBe(3);
    expect(calls.at(-1)).toEqual(['pane', 'run', 'w:p1', runLine(ROOT)]);
  });

  test('never types into a busy pane, a monitor still running after a handoff, or a launcher holding an error', async () => {
    for (const info of [BUSY, MONITOR, HOLDING]) {
      const r = run({ panes: [pane('w:p1', PANE_TITLE, ROOT)], info: { 'w:p1': [info] } });
      const out = await r.result;
      expect(Result.isSuccess(out) && out.success).toEqual({ found: 1, started: 0 });
      expect(r.calls().some((c) => c[1] === 'run')).toBe(false);
    }
  });

  test('an idle look interrupted by a busy one starts the count again', async () => {
    const r = run({ panes: [pane('w:p1', PANE_TITLE, ROOT)], info: { 'w:p1': [IDLE, BUSY, IDLE, IDLE] } });
    const out = await r.result;
    expect(Result.isSuccess(out) && out.success).toEqual({ found: 1, started: 1 });
    expect(r.calls().filter((c) => c[1] === 'process-info').length).toBe(4);
  });

  test('no restored pane: one list call and nothing else', async () => {
    const r = run({ panes: [pane('w:p1', 'Shell', ROOT)], info: {} });
    const out = await r.result;
    expect(Result.isSuccess(out) && out.success).toEqual({ found: 0, started: 0 });
    expect(r.calls()).toEqual([['pane', 'list']]);
  });

  test('fails only when the panes cannot be listed', async () => {
    const out = await run({ panes: [], info: {}, failList: true }).result;
    expect(Result.isFailure(out) && out.failure.message).toBe('herdr pane list: exit 1');
  });
});
