// Frames: exactly the pane's size at every checked size and in every state, only single-cell glyphs, no
// local path or identifier on screen, honest wording for each failure, unknown never shown as zero, and a
// fully still screen with motion off.
import { describe, expect, test } from 'bun:test';
import { GLYPHS, lineWidth, paint } from '@industrial-os/design-system/foundation/cells';
import { EXTRA_GLYPHS } from '../src/canvas.ts';
import type { ReadFailure } from '../src/reader.ts';
import { initialState, type AppState } from '../src/ui.ts';
import { renderFrame } from '../src/view/frame.ts';
import { stateAt } from './support.ts';

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const SIZES = [[200, 50], [160, 51], [120, 40], [80, 24], [60, 16]] as const;
const TINY = [[59, 16], [80, 15], [40, 10], [10, 3], [1, 1]] as const;
const ALLOWED = new Set([...GLYPHS, ...EXTRA_GLYPHS]);

const text = (state: AppState, cols: number, rows: number, t = 0, now = NOW) =>
  renderFrame(state, { cols, rows, now, t }).lines.map((l) => l.map((s) => s.text).join(''));

// The frame as the terminal gets it, colours included.
const painted = (state: AppState, t: number) => renderFrame(state, { cols: 160, rows: 51, now: NOW, t }).lines.map((l) => paint(l, 'truecolor')).join('\n');

const FAILURES: ReadFailure[] = [
  { kind: 'missing' },
  { kind: 'spawn-failed', code: 'PermissionDenied' },
  { kind: 'timeout', timeoutMs: 8000 },
  { kind: 'too-large', maxBytes: 4 * 1024 * 1024 },
  { kind: 'error-envelope', code: 'AUTOMATIONS_RUNNER_UNAVAILABLE', message: 'runner state at <path> is unreadable', exitCode: 1 },
  { kind: 'exit', exitCode: 3 },
  { kind: 'unsupported', version: 3 },
  { kind: 'garbage', at: null },
  { kind: 'garbage', at: 'data.runs.3.phase' },
];

const withUi = (s: AppState, ui: Partial<AppState['ui']>): AppState => ({ ...s, ui: { ...s.ui, ...ui } });

// Every state the screens can be in, on both screens, with the log and the modal.
function scenarios(): Array<readonly [string, AppState]> {
  const base: Array<readonly [string, AppState]> = [
    ['floor', stateAt(NOW)],
    ['empty', stateAt(NOW, { pv: 'empty', sv: 'empty' })],
    ['stopped', stateAt(NOW, { pv: 'stopped', sv: 'stopped' })],
    ['unreachable', stateAt(NOW, { pv: 'unreachable' })],
    ['no data yet', initialState()],
    ['reading', { ...initialState(), reading: true }],
    ['last known', { ...stateAt(NOW - 60_000), pipelines: { ...stateAt(NOW - 60_000).pipelines, failure: { kind: 'timeout', timeoutMs: 8000 } } }],
    ...FAILURES.map((f) => [`failure ${f.kind}`, stateAt(NOW, { failure: f })] as const),
  ];
  return base.flatMap(([name, s]) => [
    [name, s],
    [`${name} log`, withUi(s, { log: true })],
    [`${name} modal`, withUi(s, { modal: true })],
    [`${name} schedules`, withUi(s, { screen: 'schedules' })],
    [`${name} schedules no log`, withUi(s, { screen: 'schedules', log: false })],
  ] as const);
}

describe('frames', () => {
  test('every frame is exactly the pane size, in single-cell glyphs only', () => {
    for (const [name, state] of scenarios()) {
      for (const [cols, rows] of [...SIZES, ...TINY]) {
        const { lines } = renderFrame(state, { cols, rows, now: NOW, t: 0 });
        expect({ name, cols, rows, n: lines.length }).toEqual({ name, cols, rows, n: rows });
        for (const line of lines) {
          expect({ name, cols, rows, w: lineWidth(line) }).toEqual({ name, cols, rows, w: cols });
          for (const ch of line.map((s) => s.text).join('')) {
            if (!(ch >= ' ' && ch <= '~') && !ALLOWED.has(ch)) throw new Error(`${name} ${cols}x${rows}: glyph ${JSON.stringify(ch)} outside the cell contract`);
          }
        }
      }
    }
  });

  test('a pane too small shows a short notice', () => {
    expect(text(stateAt(NOW), 59, 16)[0]!.trim()).toBe('AUTOMATIONS 59x16: TOO SMALL');
    expect(text(stateAt(NOW), 20, 5)[0]!.trim()).toBe('20x5 TOO SMALL');
    expect(text(stateAt(NOW), 60, 16).join('\n')).toContain('PIPELINES');
  });

  test('no local path, identifier or raw description reaches the screen', () => {
    for (const [name, state] of scenarios()) {
      for (const [cols, rows] of SIZES) {
        const screen = text(state, cols, rows).join('\n');
        for (const leak of ['/home', '.private', '/Users', 'diagnostics.log', '00000000-', 'sha256', 'runs here']) {
          if (screen.includes(leak)) throw new Error(`${name} ${cols}x${rows} shows ${leak}`);
        }
      }
    }
  });

  test('each failure has its own honest wording', () => {
    const titles = FAILURES.map((f) => text(stateAt(NOW, { failure: f }), 120, 40).join('\n'));
    expect(titles[0]).toContain('TATSU NOT FOUND');
    expect(titles[0]).toContain('AUTOMATIONS_MONITOR_TATSU');
    expect(titles[2]).toContain('TIMED OUT');
    expect(titles[3]).toContain('TOO LARGE');
    expect(titles[4]).toContain('TATSU ERROR AUTOMATIONS_RUNNER_UNAVAILABLE');
    expect(titles[4]).toContain('runner state at <path> is unreadable');
    expect(titles[5]).toContain('TATSU EXITED 3');
    expect(titles[6]).toContain('UNSUPPORTED SCHEMA');
    expect(titles[7]).toContain('UNREADABLE OUTPUT');
    expect(titles[8]).toContain('data.runs.3.phase');
    for (const t of titles) expect(t).toContain('READ FAILED');
  });

  test('the runner state is told: stopped, unreachable, last known and stale', () => {
    expect(text(stateAt(NOW, { pv: 'stopped', sv: 'stopped' }), 160, 51).join('\n')).toContain('RUNNER STOPPED');
    expect(text(stateAt(NOW, { pv: 'unreachable' }), 160, 51).join('\n')).toContain('RUNNER UNREACHABLE');
    const lastKnown = stateAt(NOW - 60_000);
    const failed = { ...lastKnown, pipelines: { ...lastKnown.pipelines, failure: { kind: 'timeout', timeoutMs: 8000 } as const } };
    const screen = text(failed, 160, 51).join('\n');
    expect(screen).toContain('LAST KNOWN');
    expect(screen).toContain('LAST OK 1M AGO');
    const stale = text(stateAt(NOW - 45_000), 160, 51).join('\n');
    expect(stale).toContain('STALE · READ 45S AGO');
    expect(text(stateAt(NOW - 8_000), 160, 51)[0]).toContain('READ 8S AGO');
  });

  test('runs recorded ahead of the local clock draw nothing past the lane, however far ahead', () => {
    // A remote clock ahead of this one puts run starts in the future: just past the lane, and far past it.
    for (const behind of [2 * 3_600_000, 30 * 86_400_000, 2 * 365 * 86_400_000]) {
      for (const [cols, rows] of [[200, 50], [160, 51], [120, 40]] as const) {
        const lines = text(stateAt(NOW), cols, rows, 0, NOW - behind);
        expect(lines).toHaveLength(rows);
        for (const line of lines) expect([...line]).toHaveLength(cols);
      }
    }
  });

  test('unknown is never zero: with nothing read, counts are ? and readouts are not 00', () => {
    const screen = text(stateAt(NOW, { failure: { kind: 'missing' } }), 160, 51);
    expect(screen[0]).toContain('PIPELINES ?');
    expect(screen[0]).toContain('SCHEDULES ?');
    expect(screen.join('\n')).toContain('MACHINE ?');
    const small = text(stateAt(NOW, { failure: { kind: 'missing' } }), 80, 24).join('\n');
    expect(small).toContain('ACTIVE ?');
    expect(small).not.toMatch(/ACTIVE 00/);
  });

  test('the third readout is NEXT POLL, from the poll schedule, and goes unknown when the runner will not poll', () => {
    expect(text(stateAt(NOW), 160, 51).join('\n')).toContain('NEXT POLL');
    expect(text(stateAt(NOW), 80, 24).join('\n')).toContain('POLL 01:20');
    expect(text(stateAt(NOW, { pv: 'stopped' }), 80, 24).join('\n')).toContain('POLL --:--');
    expect(text(stateAt(NOW, { pv: 'unreachable' }), 80, 24).join('\n')).toContain('POLL --:--');
    expect(text(stateAt(NOW, { pv: 'unreachable' }), 160, 51).join('\n')).toContain('RUNNER NOT REPORTING');
  });

  test('with motion off the screen is fully still', () => {
    for (const ui of [{}, { modal: true }, { screen: 'schedules' as const }, { log: true }]) {
      const still = withUi(stateAt(NOW, { motion: false }), ui);
      const first = painted(still, 0);
      for (const t of [137, 400, 650, 1000, 1999, 5000]) expect(painted(still, t)).toBe(first);
    }
  });

  test('with motion on the live heads blink', () => {
    const moving = stateAt(NOW);
    const frames = new Set([0, 300, 600, 900, 1200].map((t) => painted(moving, t)));
    expect(frames.size).toBeGreaterThan(1);
  });

  test('the log is off by default on pipelines and narrows the lanes; on by default on schedules', () => {
    const s = stateAt(NOW);
    expect(text(s, 160, 51).join('\n')).not.toContain('EVENT LOG  PIPELINES');
    expect(text(withUi(s, { log: true }), 160, 51).join('\n')).toContain('EVENT LOG  PIPELINES');
    expect(text(withUi(s, { screen: 'schedules' }), 160, 51).join('\n')).toContain('EVENT LOG  SCHEDULES');
    const axis = (st: AppState) => text(st, 160, 51).find((l) => l.includes('-3H'))!;
    expect(axis(withUi(s, { log: true })).indexOf('+1H')).toBeLessThan(axis(s).indexOf('+1H'));
  });

  test('the footer lists the keys', () => {
    const footer = text(stateAt(NOW), 160, 51).at(-1)!;
    for (const k of ['1 2', '↑ ↓', 'ENTER', 'F', 'L', 'M', 'R', 'Q', 'QUIT']) expect(footer).toContain(k);
    expect(text(withUi(stateAt(NOW), { modal: true }), 160, 51).at(-1)).toContain('ESC');
  });
});
