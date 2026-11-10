import { dirname } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { paint } from '@industrial-os/design-system/foundation/cells';
import { surfaced } from './ground.mjs';
import { createState } from './model.mjs';
import { toDoc, writeLesson } from './lesson.mjs';
import { createScheduler } from './scheduler.mjs';
import { createController } from './controller.mjs';
import { createReader } from './speech.mjs';
import { createDecoder } from './input.mjs';
import { hoverHit, render } from './render.mjs';
import { renderStart, startKey, projectRoot } from './start.mjs';
import { imageMode, createImageTransport } from './kitty.mjs';

// Saves the lesson after every change that reaches it, one write at a time. A lesson that fails the schema is not
// written; the header says so until a later change makes it valid. A read-only lesson is never written.
export function createSaver(state, path, { write = writeLesson, onChange = () => {} } = {}) {
  let tried = path && !state.file.readOnly ? JSON.stringify(toDoc(state)) : null,
    chain = Promise.resolve();
  function save() {
    if (!path || state.file.readOnly) return chain;
    const doc = toDoc(state),
      json = JSON.stringify(doc);
    if (json === tried) return chain;
    tried = json;
    chain = chain.then(async () => {
      try {
        const errors = await write(path, doc);
        Object.assign(state.file, errors ? { status: 'invalid', errors } : { status: 'saved', errors: [] });
      } catch (error) {
        Object.assign(state.file, {
          status: 'error',
          errors: [{ path: '/', message: `could not be written: ${error.message}` }],
        });
        tried = null;
      }
      onChange();
    });
    return chain;
  }
  return {
    save,
    get done() {
      return chain;
    },
  };
}

// Only changed cell runs are emitted: composer/status repaint never touches raster holes.
export function paintChanges(previous, next, color = 'truecolor') {
  let output = '';
  for (let y = 0; y < next.length; y++) {
    const equal = (x) =>
      previous?.[y]?.[x]?.text === next[y][x].text &&
      JSON.stringify(previous[y][x].style) === JSON.stringify(next[y][x].style);
    let x = 0;
    while (x < next[y].length) {
      if (equal(x)) {
        x++;
        continue;
      }
      const start = x;
      const run = [];
      while (x < next[y].length && !equal(x)) run.push(next[y][x++]);
      output += `\x1b[${y + 1};${start + 1}H` + paint(run, color);
    }
  }
  return output;
}

// The start screen's own small loop: the same terminal modes as the app, closed again before the app starts.
// Resolves with the lesson path to open, or null to quit.
export function pickLesson(model, { input = process.stdin, output = process.stdout, now = Date.now } = {}) {
  return new Promise((done) => {
    const decoder = createDecoder(),
      utf8 = new StringDecoder('utf8'),
      priorRaw = Boolean(input.isRaw);
    let previous = null,
      frame = null,
      escapeTimer = null;
    const draw = () => {
      frame = renderStart(model, output.columns || 100, output.rows || 40, now());
      const lines = surfaced(frame.lines, frame.quiet);
      output.write('\x1b[?25l' + paintChanges(previous, lines));
      previous = lines;
      if (frame.cursor) output.write(`\x1b[${frame.cursor.y + 1};${frame.cursor.x + 1}H\x1b[?25h`);
    };
    const resize = () => {
      previous = null;
      output.write('\x1b[2J');
      draw();
    };
    // The plate shows the time, so it is redrawn as the minute turns.
    const tick = setInterval(draw, 15000);
    const finish = (result) => {
      clearInterval(tick);
      clearTimeout(escapeTimer);
      input.off('data', data);
      output.off('resize', resize);
      output.write('\x1b[0m\x1b[?1006l\x1b[?1003l\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[<u\x1b[?1049l');
      if (input.isTTY) input.setRawMode(priorRaw);
      input.pause();
      done(result);
    };
    const handle = (events) => {
      for (const event of events) {
        const result = startKey(model, event, frame?.hits);
        if (result) return finish(result.open || null);
      }
      draw();
    };
    function data(chunk) {
      clearTimeout(escapeTimer);
      handle(decoder.feed(typeof chunk === 'string' ? chunk : utf8.write(chunk)));
      if (decoder.waitingEscape) escapeTimer = setTimeout(() => handle(decoder.flushEscape()), 35);
    }
    if (input.isTTY) input.setRawMode(true);
    output.write('\x1b[?1049h\x1b[?7l\x1b[?25l\x1b[?2004h\x1b[?1003h\x1b[?1006h\x1b[>1u');
    input.on('data', data);
    output.on('resize', resize);
    input.resume();
    draw();
  });
}

export function createHost({
  input = process.stdin,
  output = process.stdout,
  signals = process,
  env = process.env,
  mode = 'auto',
  state: initial = createState(),
  lessonPath = null,
  connect = null,
  persist = writeLesson,
  // Keeps the chosen model and effort for the next start; main passes writeSettings.
  remember = async () => {},
  // Stand-ins for the speech call and the audio player; tests pass fakes.
  speech = {},
  clock = { setTimeout, clearTimeout },
  onExit = () => {},
  onError = () => {},
} = {}) {
  const state = initial;
  let scheduler,
    reader,
    controller,
    bridge = null,
    previous = null,
    frame = null;
  let started = false,
    stopped = false,
    escapeTimer = null,
    modeRaw = false,
    priorRaw = false;
  const write = (text) => {
    if (!output.destroyed) output.write(text);
  };
  const transport = createImageTransport(write);
  const decoder = createDecoder();
  const utf8 = new StringDecoder('utf8');
  const handlers = new Map();

  const saver = createSaver(state, lessonPath, { write: persist, onChange: () => draw() });
  function bind() {
    scheduler = createScheduler(state, { lessonPath, onChange: draw });
    // Highlighted text goes to the clipboard through the terminal (OSC 52), as Herdr and Ghostty pass it on.
    const copy = (text) => write(`\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`);
    reader = createReader(state, { key: async () => (await bridge?.googleKey?.()) ?? null, onChange: draw, ...speech });
    controller = createController(state, scheduler, { exit: stop, onChange: draw, lessonPath, copy, reader });
  }
  // Pi loads in the background: the editor works at once and the chat waits for the models.
  function connectAi() {
    state.ai.status = 'connecting';
    connect({ cwd: lessonPath ? projectRoot(dirname(lessonPath)) : process.cwd() })
      .then((ai) => {
        if (stopped) return ai.dispose();
        bridge = ai;
        const model =
          state.ai.model && ai.models.some((m) => m.key === state.ai.model) ? state.ai.model : ai.defaultModel;
        Object.assign(state.ai, { status: ai.models.length ? 'ready' : 'error', models: ai.models, model });
        state.ai.imagegen = ai.imagegen;
        remembered = settingsKey();
        if (!ai.models.length) state.ai.message = 'Pi has no models logged in';
        scheduler.connect(ai);
        draw();
      })
      .catch((error) => {
        Object.assign(state.ai, { status: 'error', message: error.message });
        draw();
      });
  }
  const settingsKey = () => `${state.ai.model} ${state.ai.effort} ${state.speechRate} ${state.voice}`;
  let remembered = null;
  function draw() {
    if (stopped || !started) return;
    try {
      saver.save();
      if (state.ai.status === 'ready' && settingsKey() !== remembered) {
        remembered = settingsKey();
        remember({
          model: state.ai.model,
          effort: state.ai.effort,
          speechRate: state.speechRate,
          voice: state.voice,
        }).catch((error) => {
          state.notice = `Could not keep the model and effort for next time: ${error.message}`;
        });
      }
      const graphics = state.images && imageMode({ mode, env, tty: Boolean(input.isTTY && output.isTTY) });
      frame = render(state, output.columns || 100, output.rows || 40, { graphics });
      transport.prepare(frame.images);
      const color = env.NO_COLOR === undefined,
        lines = surfaced(frame.lines, frame.quiet, color);
      write('\x1b[?25l' + paintChanges(previous, lines, color ? 'truecolor' : 'none'));
      previous = lines;
      transport.sync(frame.images);
      if (frame.cursor) write(`\x1b[${frame.cursor.y + 1};${frame.cursor.x + 1}H\x1b[?25h`);
    } catch (error) {
      fail(error);
    }
  }
  function dispatch(events) {
    const hits = frame?.hits || [],
      pointed = () => state.hover && hoverHit(hits, state.hover.x, state.hover.y, Boolean(state.modal)),
      before = pointed();
    for (const event of events) {
      if (stopped) break;
      controller.handle(event, frame?.g || {}, hits);
    }
    // Moving the pointer redraws only when it moves onto a different target.
    const moves = events.length && events.every((e) => e.key === 'mouse' && e.motion && e.button === 'other');
    if (!moves || pointed() !== before) draw();
  }
  function data(chunk) {
    try {
      clock.clearTimeout(escapeTimer);
      escapeTimer = null;
      dispatch(decoder.feed(typeof chunk === 'string' ? chunk : utf8.write(chunk)));
      if (!stopped && decoder.waitingEscape)
        escapeTimer = clock.setTimeout(() => {
          escapeTimer = null;
          dispatch(decoder.flushEscape());
        }, 35);
    } catch (error) {
      fail(error);
    }
  }
  function resize() {
    transport.clear();
    previous = null;
    draw();
  }
  function fail(error) {
    stop();
    onError(error);
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    clock.clearTimeout(escapeTimer);
    escapeTimer = null;
    // Text typed in a box is saved on the way out, like leaving the box.
    controller?.flush();
    saver.save();
    controller?.dispose();
    reader?.dispose();
    scheduler?.dispose();
    bridge?.dispose();
    try {
      transport.dispose();
    } catch {
      /* Continue restoring terminal after an output failure. */
    }
    if (started) {
      input.off('data', data);
      input.off('end', stop);
      input.off('close', stop);
      input.off('error', fail);
      output.off('resize', resize);
      output.off('close', stop);
      output.off('error', fail);
      for (const [name, listener] of handlers) signals.off(name, listener);
      try {
        write('\x1b[0m\x1b[?1006l\x1b[?1003l\x1b[?2004l\x1b[?7h\x1b[?25h\x1b[<u\x1b[?1049l');
      } catch {
        /* Broken stream. */
      }
      try {
        if (modeRaw) input.setRawMode(priorRaw);
      } catch {
        /* TTY may have disconnected. */
      }
      input.pause();
    }
    onExit();
  }
  bind();
  return {
    start() {
      if (started || stopped) return;
      started = true;
      try {
        priorRaw = Boolean(input.isRaw);
        if (input.isTTY && typeof input.setRawMode === 'function') {
          // Node/libuv raw mode disables IXON, preventing Ctrl-S software-flow freeze.
          input.setRawMode(true);
          modeRaw = true;
        }
        // All pointer motion (1003: hover feedback, and dragging with the button held) in SGR form (1006).
        // Kitty keyboard disambiguate mode (>1u, popped on leaving), so Shift-Enter differs from Enter; terminals
        // without it ignore it.
        write('\x1b[?1049h\x1b[?7l\x1b[?25l\x1b[?2004h\x1b[?1003h\x1b[?1006h\x1b[>1u');
        input.on('data', data);
        input.on('end', stop);
        input.on('close', stop);
        input.on('error', fail);
        output.on('error', fail);
        output.on('resize', resize);
        output.on('close', stop);
        for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
          const listener = () => stop();
          handlers.set(name, listener);
          signals.on(name, listener);
        }
        for (const name of ['uncaughtException', 'unhandledRejection']) {
          handlers.set(name, fail);
          signals.on(name, fail);
        }
        input.resume();
        if (connect) connectAi();
        draw();
      } catch (error) {
        fail(error);
      }
    },
    stop,
    draw,
    get state() {
      return state;
    },
    get scheduler() {
      return scheduler;
    },
    get frame() {
      return frame;
    },
    get stopped() {
      return stopped;
    },
    openErrors() {
      controller.openErrors();
    },
    // Settles once every pending save has finished.
    get saved() {
      return saver.done;
    },
  };
}
