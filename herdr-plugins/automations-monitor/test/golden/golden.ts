#!/usr/bin/env bun
// Golden frames: the monitor's full-colour `--frame` output for every fast fake scenario, size, screen, flag set
// and lamp phase, under a frozen clock (GOLDEN_NOW, TZ=UTC), so a change can show it alters no frame. No baseline is
// stored; capture one from a git ref, then diff this checkout against it.
//   bun test/golden/golden.ts compare REF OUT        capture REF into OUT/base, this checkout into OUT/head, then diff
//   bun test/golden/golden.ts capture OUT [--ref REF] capture this checkout, or REF, into OUT
//   bun test/golden/golden.ts diff BASE OUT          capture this checkout into OUT and diff it against BASE
// A ref is drawn from a temporary `git archive` of its monitor and design system, with the harness of this checkout.
import { availableParallelism, tmpdir } from 'node:os';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const HERE = import.meta.dir;
const MONITOR = resolve(HERE, '..', '..');
const BUN = process.execPath;
const NOW = 1792999987654;

// Excluded: stubborn, leaves-child, hang and orphan-exit. Their reads end only through the reader's timeout or its
// TERM-to-KILL grace, which the frozen clock stops; orphan-exit would draw the same frame as floor.
const SCENARIOS = ['floor', 'empty', 'stopped', 'unreachable', 'no-schedules', 'schedules-error', 'error', 'garbage', 'exit', 'unsupported', 'invalid', 'no-lists', 'big'];
const SIZES = ['200x50', '160x51', '120x40', '80x24', '60x16', '59x16', '50x10', '30x5'];
const SCREENS = ['pipelines', 'schedules'];
const FLAGS: Record<string, readonly string[]> = {
  none: [], log: ['--log'], modal: ['--modal'], nomotion: ['--no-motion'], 'log-modal-nomotion': ['--log', '--modal', '--no-motion'],
};
const TIMES = [0, 600];

const jobs = SCENARIOS.flatMap((s) => SIZES.flatMap((size) => SCREENS.flatMap((screen) => Object.keys(FLAGS).flatMap((flags) =>
  TIMES.map((t) => ({ s, name: `${s}.${size}.${screen}.${flags}.t${t}`, args: ['--frame', size, '--screen', screen, '--time', String(t), ...FLAGS[flags]!] }))))));

function run(argv: string[], cwd: string): string {
  const p = Bun.spawnSync(argv, { cwd, stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) throw new Error(`${argv.join(' ')}: ${p.stderr.toString().trim()}`);
  return p.stdout.toString();
}

// Every frame of the monitor in `monitor` (a checkout's herdr-plugins/automations-monitor) into `out`.
async function render(monitor: string, out: string): Promise<void> {
  // `out` is emptied first, so refuse anything that could be someone's files: a path inside the repository, or a
  // folder holding anything but earlier frames.
  const repo = resolve(run(['git', '-C', MONITOR, 'rev-parse', '--show-toplevel'], MONITOR).trim());
  const target = resolve(out);
  if (target === repo || target.startsWith(`${repo}/`) || repo.startsWith(`${target}/`)) throw new Error(`refusing ${out}: keep the output outside the repository`);
  if (existsSync(target) && readdirSync(target).some((n) => !n.endsWith('.ansi') && !n.endsWith('.err'))) throw new Error(`refusing ${out}: it holds files other than golden frames`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const env: Record<string, string | undefined> = {
    ...process.env, TZ: 'UTC', GOLDEN_NOW: String(NOW), GOLDEN_BUN: BUN, GOLDEN_FAKE: join(monitor, 'fixtures', 'fake-tatsu.ts'),
    AUTOMATIONS_MONITOR_TATSU: join(HERE, 'fake-tatsu.sh'), FAKE_TATSU_LOG: undefined, FAKE_TATSU_DELAY_MS: undefined,
  };
  let next = 0;
  const worker = async () => {
    for (let job = jobs[next++]; job; job = jobs[next++]) {
      const p = Bun.spawn([BUN, '--preload', join(HERE, 'freeze.ts'), join(monitor, 'bin', 'automations-monitor.ts'), ...job.args], {
        cwd: monitor, env: { ...env, FAKE_TATSU_SCENARIO: job.s }, stdout: 'pipe', stderr: 'pipe',
      });
      const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).arrayBuffer(), new Response(p.stderr).text(), p.exited]);
      writeFileSync(join(out, `${job.name}.ansi`), new Uint8Array(stdout));
      writeFileSync(join(out, `${job.name}.err`), stderr + (code ? `exit ${code}\n` : ''));
    }
  };
  await Promise.all(Array.from({ length: Math.max(2, availableParallelism()) }, worker));
  const errs = jobs.filter((j) => readFileSync(join(out, `${j.name}.err`), 'utf8') !== '').length;
  const empty = jobs.filter((j) => readFileSync(join(out, `${j.name}.ansi`)).length === 0).length;
  console.log(`${jobs.length} frames in ${out} (${empty} empty, ${errs} with stderr)`);
}

// A temporary tree holding REF's monitor and design system, linked as the root install links them.
function checkout(ref: string): { monitor: string; done: () => void } {
  const repo = run(['git', '-C', MONITOR, 'rev-parse', '--show-toplevel'], MONITOR).trim();
  const tree = mkdtempSync(join(tmpdir(), 'am-golden-'));
  const done = () => rmSync(tree, { recursive: true, force: true });
  try {
    const archive = Bun.spawnSync(['git', '-C', repo, 'archive', ref, '--', 'herdr-plugins/automations-monitor', 'design-system'], { stdout: 'pipe', stderr: 'pipe' });
    if (archive.exitCode !== 0) throw new Error(`git archive ${ref}: ${archive.stderr.toString().trim()}`);
    const tar = Bun.spawnSync(['tar', '-x', '-C', tree], { stdin: archive.stdout, stderr: 'pipe' });
    if (tar.exitCode !== 0) throw new Error(`tar: ${tar.stderr.toString().trim()}`);
    mkdirSync(join(tree, 'node_modules', '@industrial-os'), { recursive: true });
    symlinkSync(join('..', '..', 'design-system'), join(tree, 'node_modules', '@industrial-os', 'design-system'));
    const monitor = join(tree, 'herdr-plugins', 'automations-monitor');
    // The same lockfile reuses this checkout's install; another one gets its own frozen install.
    if (existsSync(join(MONITOR, 'node_modules')) && readFileSync(join(monitor, 'bun.lock'), 'utf8') === readFileSync(join(MONITOR, 'bun.lock'), 'utf8')) {
      symlinkSync(join(MONITOR, 'node_modules'), join(monitor, 'node_modules'));
    } else run([BUN, 'install', '--frozen-lockfile'], monitor);
    return { monitor, done };
  } catch (error) {
    done();
    throw error;
  }
}

async function capture(out: string, ref: string | null): Promise<void> {
  if (ref === null) return render(MONITOR, out);
  const { monitor, done } = checkout(ref);
  try {
    await render(monitor, out);
  } finally {
    done();
  }
}

// Every file of both directories, byte for byte. Returns whether they match.
function diff(base: string, out: string): boolean {
  const names = [...new Set([...readdirSync(base), ...readdirSync(out)])].sort();
  const differ = names.filter((n) => !existsSync(join(base, n)) || !existsSync(join(out, n)) || !readFileSync(join(base, n)).equals(readFileSync(join(out, n))));
  for (const n of differ.slice(0, 20)) console.log(`differs: ${n}`);
  const frames = `${names.filter((n) => n.endsWith('.ansi')).length} frames and their stderr`;
  console.log(differ.length ? `DIFF: ${differ.length} files differ, of ${frames}` : `DIFF: 0 differences across ${frames}`);
  return differ.length === 0;
}

const USAGE = 'usage: golden.ts compare REF OUT | capture OUT [--ref REF] | diff BASE OUT';
const [mode, a, b, c] = process.argv.slice(2);
if (mode === 'compare' && a && b && !c) {
  await capture(join(b, 'base'), a);
  await capture(join(b, 'head'), null);
  process.exitCode = diff(join(b, 'base'), join(b, 'head')) ? 0 : 1;
} else if (mode === 'capture' && a && (b === undefined || (b === '--ref' && c))) {
  await capture(a, c ?? null);
} else if (mode === 'diff' && a && b && !c) {
  await capture(b, null);
  process.exitCode = diff(a, b) ? 0 : 1;
} else {
  console.error(USAGE);
  process.exitCode = 2;
}
