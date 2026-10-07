#!/usr/bin/env node
// Host for the terminal storybook: options, snapshot, key bindings, the playback clock, and its one
// redraw timer. Terminal modes, listeners, and cleanup live in terminal-host.mjs; browsing state and
// the frame live in storybook-layout.mjs; stories live in storybook-stories.mjs.
import { performance } from 'node:perf_hooks';
import { clearInterval, setInterval } from 'node:timers';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { paint } from '../foundation/cells.mjs';
import { SECTIONS, advance, composeStorybook, hitAction, initialState, playbackInterval, press } from './storybook-layout.mjs';
import { colorMode, runTerminal, sizeOption } from './terminal-host.mjs';

const USAGE = `Usage: node examples/storybook.mjs [options]

Browse the elements and motions when stdin and stdout are terminals; otherwise prints one snapshot
of the first story and exits.

  --snapshot        print once and exit, even in a terminal
  --columns N       snapshot width in cells (1-1000); implies --snapshot
  --rows N          snapshot height in rows (1-1000); implies --snapshot
  --plain           one snapshot without escape sequences
  --color           force 24-bit color, e.g. when piping to a file
  -h, --help        show this help

Live keys: j/k, arrows, or Tab/Shift-Tab change story; 1-${SECTIONS.length} jump to a section; h/l or left/right
change state or example; Space/PgDn and b/PgUp page the details; p plays or pauses a motion preview
at its own step rate, r replays it, o turns motion off; ? shows every key; q or Esc quits, Ctrl-C quits.
Left-click visible index rows, variant names, and footer controls (SGR cell mouse reports required).
Keyboard controls remain available at every size; clipped or omitted controls are not clickable.`;

const SYSTEM_CLOCK = { now: () => performance.now(), setInterval, clearInterval };

const KEYS = new Map([
  ...['j', '\x1b[B', '\x1bOB', '\t'].map((k) => [k, 'next-story']),
  ...['k', '\x1b[A', '\x1bOA', '\x1b[Z'].map((k) => [k, 'prev-story']),
  ...['l', '\x1b[C', '\x1bOC'].map((k) => [k, 'next-variant']),
  ...['h', '\x1b[D', '\x1bOD'].map((k) => [k, 'prev-variant']),
  ...[' ', '\x1b[6~'].map((k) => [k, 'page-down']),
  ...['b', '\x1b[5~'].map((k) => [k, 'page-up']),
  ['p', 'play-pause'],
  ['r', 'replay'],
  ['o', 'motion-off'],
  ['?', 'help'],
  ...SECTIONS.map((_, i) => [String(i + 1), `section:${i}`]),
]);

export function parseOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      snapshot: { type: 'boolean' },
      columns: { type: 'string' },
      rows: { type: 'string' },
      plain: { type: 'boolean' },
      color: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.plain && values.color) throw new RangeError('--plain and --color are mutually exclusive');
  const columns = sizeOption(values.columns, 'columns');
  const rows = sizeOption(values.rows, 'rows');
  return { ...values, columns, rows, snapshot: Boolean(values.snapshot || values.plain || columns || rows) };
}

// The first story with motion off. Without rows its details are shown in full. Plain output trims
// trailing pad cells; color output keeps them so the black field is painted.
export function renderSnapshot({ columns, rows, color }) {
  const mode = color === 'none' ? 'PLAIN' : 'TRUECOLOR';
  const { lines } = composeStorybook(initialState(), { columns, rows, mode, snapshot: true });
  return lines.map((l) => (color === 'none' ? paint(l, color).trimEnd() : paint(l, color))).join('\n') + '\n';
}

// Live storybook on a terminal. Resolves with the exit code after restoring every mode it changed.
// Redraws on resize and on keys that change the view. While, and only while, a motion preview plays,
// one interval timer redraws at that preview's step (playbackInterval); every exit path clears it.
// `clock` is injectable for checks.
export function runLive({ input, output, proc = process, color, clock = SYSTEM_CLOCK }) {
  const mode = color === 'none' ? 'PLAIN' : 'TRUECOLOR';
  let state = initialState();
  let view = { page: 1, maxOffset: 0 };
  let size;
  let timer = null;

  const render = (next) => {
    size = next;
    view = composeStorybook(state, { ...size, mode, now: clock.now() });
    state = { ...state, offset: view.offset };
    return view.lines;
  };

  const stopTimer = () => {
    if (timer === null) return;
    clock.clearInterval(timer);
    timer = null;
  };

  const syncTimer = (host) => {
    if (state.playback.status !== 'playing') return stopTimer();
    timer ??= clock.setInterval(
      host.guard(() => {
        if (size) state = advance(state, { now: clock.now(), ...size }); // no frame yet: nothing to complete
        syncTimer(host); // a finished reveal stops its own timer before the final frame
        host.redraw();
      }),
      playbackInterval(state),
    );
  };

  const act = (action, host) => {
    if (!action) return;
    if (action === 'quit') return host.quit(0);
    const next = press(state, action, { now: clock.now(), page: view.page, maxOffset: view.maxOffset, mode });
    if (next === state) return;
    state = next;
    syncTimer(host);
    host.redraw();
  };

  const onKey = (key, host) => {
    if (key === 'q' || key === 'Q' || (key === '\x1b' && !state.help)) return act('quit', host);
    act(key === '\x1b' ? 'close-help' : KEYS.get(key.length === 1 ? key.toLowerCase() : key), host);
  };
  const onClick = (point, host) => {
    // A dimension change without a drawable resize must not leave the last frame's targets live.
    if (!size || size.columns !== Math.min(output.columns, 1000) || size.rows !== Math.min(output.rows, 1000)) return;
    act(hitAction(view, point), host);
  };

  return runTerminal({ input, output, proc, color, name: 'storybook', render, onKey, onClick, onStop: stopTimer });
}

export async function main(argv = process.argv.slice(2), io = process) {
  let options;
  try {
    options = parseOptions(argv);
  } catch (error) {
    io.stderr.write(`storybook: ${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (options.help) {
    io.stdout.write(USAGE + '\n');
    return 0;
  }
  const tty = Boolean(io.stdout.isTTY);
  const color = colorMode(options, io.stdout);
  if (!options.snapshot && tty && io.stdin.isTTY) {
    return runLive({ input: io.stdin, output: io.stdout, proc: io, color });
  }
  const columns = options.columns ?? (tty ? io.stdout.columns : 80);
  if (!Number.isInteger(columns) || columns < 1) {
    io.stderr.write('storybook: terminal width unavailable; pass --columns N\n');
    return 2;
  }
  io.stdout.write(renderSnapshot({ columns: Math.min(columns, 1000), rows: options.rows, color }));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
