// Terminal lifecycle shared by the showcase and storybook hosts: size and color options, raw and
// alternate-screen modes, Node's stateful key decoder, resize and signal listeners, and one cleanup
// path for every exit. It knows nothing about layout, stories, or timers; each host supplies those.
import { emitKeypressEvents } from 'node:readline';
import { PassThrough } from 'node:stream';
import { blank, paint } from '../foundation/cells.mjs';
import { mouseDecoder } from './terminal-mouse.mjs';

const ENTER = '\x1b[?1049h\x1b[?25l';
const RESTORE = '\x1b[0m\x1b[?25h\x1b[?1049l';
const MOUSE_ENTER = '\x1b[?1006h\x1b[?1000h';
const MOUSE_RESTORE = '\x1b[?1000l\x1b[?1006l';
const SIGNAL_CODES = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

// --columns/--rows value: undefined when absent, otherwise an integer from 1 to 1000.
export function sizeOption(value, name) {
  if (value === undefined) return undefined;
  const n = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new RangeError(`--${name} must be an integer from 1 to 1000`);
  return n;
}

// 'none' or 'truecolor'. Automatic color needs a terminal that Node reports as 24-bit.
export function colorMode({ plain, color }, stdout) {
  if (plain) return 'none';
  if (color) return 'truecolor';
  return stdout.isTTY && stdout.getColorDepth() >= 24 ? 'truecolor' : 'none';
}

// Live session on a terminal. Resolves with the exit code after restoring every mode it changed.
// render({ columns, rows }) returns at most `rows` lines of exactly `columns` cells; it runs on start,
// resize, and host.redraw(). onKey(sequence, host) gets every decoded key except Ctrl-C, which always
// quits with 130. Optional onClick({ column, row }, host) enables 1000/1006 cell reports, consumes mouse
// payloads before onKey(), and receives only unmodified left presses in the viewport. Cleanup disables
// both modes. No other caller changes mouse modes. onStop() runs once before modes are restored. host.redraw() and
// functions wrapped by host.guard() end the session with code 1 if they throw.
export function runTerminal({ input, output, proc = process, color, name, render, onKey, onClick, onStop = () => {} }) {
  return new Promise((resolve) => {
    let active = true;
    // Isolate Node's stateful key decoder so disposing it never changes a host-owned stream's listeners.
    const keys = new PassThrough();

    // One write per frame; every row is repainted at an absolute position, so nothing scrolls.
    const draw = () => {
      if (!active) return;
      if (!Number.isInteger(output.columns) || !Number.isInteger(output.rows) || output.columns < 1 || output.rows < 1) return;
      const columns = Math.min(output.columns, 1000);
      const rows = Math.min(output.rows, 1000);
      const lines = render({ columns, rows });
      let frame = '';
      for (let i = 0; i < rows; i++) frame += `\x1b[${i + 1};1H` + paint(lines[i] ?? blank(columns), color);
      output.write(frame);
    };

    const restore = () => {
      if (!active) return;
      active = false;
      try {
        output.write((onClick ? MOUSE_RESTORE : '') + RESTORE);
      } finally {
        if (input.isRaw) input.setRawMode(false);
        input.pause();
      }
    };

    let finishing = false;
    const finish = (code, error) => {
      if (!active || finishing) return;
      finishing = true;
      input.off('data', onData);
      keys.off('keypress', onKeypress);
      keys.destroy();
      output.off('resize', onResize);
      for (const s of Object.keys(SIGNAL_CODES)) proc.off(s, onSignal);
      proc.off('exit', onExit);
      let failure = error;
      try {
        onStop();
      } catch (stopError) {
        failure ??= stopError;
        code = 1;
      }
      try {
        restore();
      } catch (restoreError) {
        failure ??= restoreError;
        code = 1;
      }
      if (failure) proc.stderr?.write?.(`${name}: ${failure.stack ?? failure}\n`);
      resolve(code);
    };

    const guard = (fn) => (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        finish(1, error);
      }
    };

    const host = { redraw: guard(draw), quit: (code) => finish(code), guard };
    const mouse = onClick ? mouseDecoder((point) => {
      // No drawable viewport (including after a resize): no old target can be activated.
      if (!Number.isInteger(output.columns) || !Number.isInteger(output.rows)) return;
      if (point.column > output.columns || point.row > output.rows) return;
      onClick(point, host);
    }, () => { if (active) onKey('\x1b', host); }) : null;
    const onKeypress = guard((_text, { sequence }) => {
      if (!active) return; // coalesced input after quit must not restart a timer
      if (sequence === '\x03') return finish(130);
      if (mouse?.(sequence)) return;
      onKey(sequence, host);
    });
    const onData = guard((chunk) => keys.write(chunk));
    const onResize = guard(draw);
    const onSignal = (signal) => finish(SIGNAL_CODES[signal]);
    const onExit = (code) => finish(code);

    proc.on('exit', onExit); // last resort: cleanup and TTY writes are synchronous on POSIX
    for (const s of Object.keys(SIGNAL_CODES)) proc.on(s, onSignal);
    guard(() => {
      output.write(ENTER + (onClick ? MOUSE_ENTER : ''));
      input.setRawMode(true);
      emitKeypressEvents(keys);
      keys.on('keypress', onKeypress);
      input.on('data', onData);
      input.resume();
      output.on('resize', onResize);
      host.redraw();
    })();
  });
}
