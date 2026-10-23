// The terminal check: runs the live pane in a real pseudo-terminal against the fake `tatsu` and checks, for
// quitting with `q`, SIGTERM, an uncaught error and a defect in the loop, that the pane was in raw mode
// while running, that the terminal settings (`stty -g`) are identical before and after, that the alternate
// screen was left and the cursor shown, and that the pane exits only once the fake's process group is gone.
// Run from the plugin directory: `bun test/pty-check.ts`. It never touches Herdr or the real `tatsu`.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { alive, FAKE } from './support.ts';

const ROOT = dirname(import.meta.dir);
// Only this bun and the system tools: no version-manager shim, and never the real `tatsu`.
const PATH = [dirname(process.execPath), '/usr/bin', '/bin'].join(':');
const ENTER = '\x1b[?1049h', LEAVE = '\x1b[?1049l', SHOW = '\x1b[?25h';

interface Case {
  readonly name: string;
  readonly scenario: string;
  readonly stop: 'q' | 'SIGTERM' | 'throw' | 'defect';
  // Stop while a read that ignores SIGTERM is in flight.
  readonly midRead: boolean;
  readonly code: number;
}

const CASES: Case[] = [
  { name: 'q', scenario: 'floor', stop: 'q', midRead: false, code: 0 },
  { name: 'SIGTERM', scenario: 'floor', stop: 'SIGTERM', midRead: false, code: 0 },
  { name: 'uncaught error', scenario: 'floor', stop: 'throw', midRead: false, code: 1 },
  { name: 'defect in the loop', scenario: 'floor', stop: 'defect', midRead: false, code: 1 },
  { name: 'q during a stubborn read', scenario: 'stubborn', stop: 'q', midRead: true, code: 0 },
  { name: 'SIGTERM during a stubborn read', scenario: 'stubborn', stop: 'SIGTERM', midRead: true, code: 0 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(what: string, test: () => boolean, ms = 10_000) {
  const end = Date.now() + ms;
  while (!test()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(25);
  }
}
const sttyOf = (tty: string) => Bun.spawnSync(['stty', process.platform === 'darwin' ? '-f' : '-F', tty, '-a']).stdout.toString();

async function run(c: Case): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), 'am-pty-'));
  const f = (n: string) => join(dir, n);
  const read = (n: string) => (existsSync(f(n)) ? readFileSync(f(n), 'utf8').trim() : '');
  // An error thrown outside every fiber, as a defect in a library callback would be.
  writeFileSync(f('throw.ts'), "setTimeout(() => { throw new Error('check defect at /home/demo/private'); }, 1500);\n");
  // A defect inside the app's fibers: reading the pane size starts throwing after 1.5 s.
  writeFileSync(f('defect.ts'), [
    "const start = Date.now(), cols = Object.getOwnPropertyDescriptor(process.stdout, 'columns');",
    "Object.defineProperty(process.stdout, 'columns', { configurable: true, get() {",
    "  if (Date.now() - start > 1500) throw new Error('check defect at /home/demo/private');",
    "  return cols?.get ? cols.get.call(process.stdout) : cols?.value; } });",
  ].join('\n') + '\n');
  const preload = c.stop === 'throw' || c.stop === 'defect' ? `--preload ${f(`${c.stop}.ts`)}` : '';
  // Without job control a background job's stdin is /dev/null, so the pane's is set to the terminal again, by
  // its device name: macOS cannot watch `/dev/tty` itself for input.
  const script = `t=$(tty); echo $t > ${f('tty')}; stty -g > ${f('before')}; bun ${preload} bin/automations-monitor.ts <$t & echo $! > ${f('pid')}; wait $!; echo $? > ${f('code')}; stty -g > ${f('after')}`;
  let out = '';
  const proc = Bun.spawn(['sh', '-c', script], {
    cwd: ROOT,
    env: { PATH, HOME: dir, TERM: 'xterm-256color', AUTOMATIONS_MONITOR_TATSU: FAKE, FAKE_TATSU_SCENARIO: c.scenario, FAKE_TATSU_LOG: f('log') },
    terminal: { cols: 120, rows: 40, data: (_t, d) => void (out += new TextDecoder().decode(d)) },
  });
  const problems: string[] = [];
  try {
    await until('the first frame', () => out.includes('AUTOMATIONS') && read('pid') !== '');
    const pid = Number(read('pid'));
    const raw = sttyOf(read('tty'));
    if (!/-icanon/.test(raw) || !/-echo\b/.test(raw)) problems.push('the terminal was not in raw mode while running');
    const fakePids = () => [...new Set(read('log').split('\n').filter(Boolean).flatMap((l) => {
      const e = JSON.parse(l) as { pid?: number; child?: number; descendant?: number };
      return [e.pid, e.child, e.descendant].filter((p): p is number => typeof p === 'number');
    }))];
    if (c.midRead) await until('the stubborn read', () => read('log').includes('"ready":true'));
    else await until('the first read on screen', () => out.includes('DEMOMACHINE'));
    const stoppedAt = Date.now();
    if (c.stop === 'q') proc.terminal!.write('q');
    else if (c.stop === 'SIGTERM') process.kill(pid, 'SIGTERM');
    await until('the pane to exit', () => read('code') !== '');
    const exitedAfter = Date.now() - stoppedAt;
    const left = fakePids().filter(alive);
    if (left.length) problems.push(`fake processes still alive after exit: ${left.length}`);
    if (c.midRead && !fakePids().length) problems.push('the stubborn read never started');
    await proc.exited;
    const code = Number(read('code'));
    if (code !== c.code) problems.push(`exit status ${code}, expected ${c.code}`);
    if (read('before') !== read('after') || !read('before')) problems.push('stty -g differs before and after');
    if (out.lastIndexOf(LEAVE) < out.lastIndexOf(ENTER) || out.lastIndexOf(SHOW) < out.lastIndexOf(ENTER)) problems.push('alternate screen not left or cursor hidden');
    if (out.includes('/home/demo')) problems.push('a private path reached the terminal');
    const failing = c.stop === 'throw' || c.stop === 'defect';
    if (failing && !out.slice(out.lastIndexOf(LEAVE)).includes('automations-monitor: check defect at <path>')) problems.push('the error was not reported, redacted, after restoring');
    const since = failing ? 'after the first frame' : 'after stopping';
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${c.name}: exit ${code} ${exitedAfter} ms ${since}; ${fakePids().length} fake processes seen, ${left.length} left`);
  } catch (e) {
    problems.push(String(e));
    console.log(`FAIL ${c.name}`);
  } finally {
    proc.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
  return problems.map((p) => `${c.name}: ${p}`);
}

const problems: string[] = [];
for (const c of CASES) problems.push(...(await run(c)));
for (const p of problems) console.log(`  ${p}`);
console.log(problems.length ? `${problems.length} problem(s)` : `all ${CASES.length} cases passed`);
process.exit(problems.length ? 1 : 0);
