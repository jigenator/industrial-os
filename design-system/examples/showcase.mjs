#!/usr/bin/env node
// Host for the native showcase: options, snapshot, and the scroll state of the live view. Terminal modes,
// listeners, and cleanup live in terminal-host.mjs; layout lives in showcase-layout.mjs.
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { paint } from '../foundation/cells.mjs';
import { composeShowcase, viewport } from './showcase-layout.mjs';
import { colorMode, runTerminal, sizeOption } from './terminal-host.mjs';

const USAGE = `Usage: node examples/showcase.mjs [options]

Live view when stdin and stdout are terminals; otherwise prints one snapshot and exits.

  --snapshot        print once and exit, even in a terminal
  --columns N       snapshot width in cells (1-1000); implies --snapshot
  --rows N          snapshot height in rows (1-1000); implies --snapshot
  --plain           one snapshot without escape sequences
  --color           force 24-bit color, e.g. when piping to a file
  -h, --help        show this help

Live keys: j/k or arrows scroll, PgUp/PgDn or Space page, q or Esc quits, Ctrl-C quits.`;

const HINT = 'J/K SCROLL  Q QUIT';

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

// Plain output trims trailing pad cells; color output keeps them so the black field is painted.
export function renderSnapshot({ columns, rows, color }) {
  const mode = color === 'none' ? 'PLAIN' : 'TRUECOLOR';
  let lines = composeShowcase({ columns, rows, mode });
  if (rows !== undefined) lines = viewport(lines, { columns, rows, hint: 'MORE BELOW' }).lines;
  return lines.map((l) => (color === 'none' ? paint(l, color).trimEnd() : paint(l, color))).join('\n') + '\n';
}

// Live view on a terminal. Resolves with the exit code after restoring every mode it changed.
// Redraws only on resize and scroll keys; there is no redraw timer.
export function runLive({ input, output, proc = process, color }) {
  let offset = 0;
  let maxOffset = 0;
  const mode = color === 'none' ? 'PLAIN' : 'TRUECOLOR';
  const render = ({ columns, rows }) => {
    const view = viewport(composeShowcase({ columns, rows, mode }), { columns, rows, offset, hint: HINT });
    ({ offset, maxOffset } = view);
    return view.lines;
  };
  const onKey = (key, host) => {
    const scroll = (delta) => {
      const next = Math.min(Math.max(0, offset + delta), maxOffset);
      if (next !== offset) {
        offset = next;
        host.redraw();
      }
    };
    const page = Math.max(1, (output.rows ?? 2) - 2);
    if (key === 'q' || key === 'Q' || key === '\x1b') return host.quit(0);
    if (key === 'j' || key === '\x1b[B' || key === '\x1bOB') scroll(1);
    else if (key === 'k' || key === '\x1b[A' || key === '\x1bOA') scroll(-1);
    else if (key === '\x1b[6~' || key === ' ') scroll(page);
    else if (key === '\x1b[5~') scroll(-page);
  };
  return runTerminal({ input, output, proc, color, name: 'showcase', render, onKey });
}

export async function main(argv = process.argv.slice(2), io = process) {
  let options;
  try {
    options = parseOptions(argv);
  } catch (error) {
    io.stderr.write(`showcase: ${error.message}\n\n${USAGE}\n`);
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
    io.stderr.write('showcase: terminal width unavailable; pass --columns N\n');
    return 2;
  }
  io.stdout.write(renderSnapshot({ columns: Math.min(columns, 1000), rows: options.rows, color }));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
