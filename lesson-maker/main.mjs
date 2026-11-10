#!/usr/bin/env node
import { resolve, basename } from 'node:path';
import { createState, EFFORTS } from './src/model.mjs';
import { render, plainFrame } from './src/render.mjs';
import { createHost, pickLesson } from './src/host.mjs';
import { projectRoot, findLessons, startState } from './src/start.mjs';
import {
  fromDoc,
  openLesson,
  readLesson,
  readableDoc,
  loadPicture,
  formatErrors,
  readSettings,
  writeSettings,
  readChat,
} from './src/lesson.mjs';
import { connectPi, imageBackend } from './src/pi.mjs';
import { SPEEDS, VOICES } from './src/speech.mjs';

const USAGE =
  'Usage: lesson [--images=auto|kitty|text] [path/to/name.lesson.json]\n' +
  "       (no file: pick one of this project's lessons or start a new one in lessons/)\n" +
  '       lesson --plain [--size=140x40] [path/to/name.lesson.json]\n' +
  '       lesson --validate path/to/name.lesson.json';
export function parseArgs(args) {
  const options = { mode: 'auto', plain: false, validate: false, width: 100, height: 40, file: null };
  for (const arg of args) {
    if (arg === '--plain') options.plain = true;
    else if (arg === '--validate') options.validate = true;
    else if (/^--images=(auto|kitty|text)$/.test(arg)) options.mode = arg.split('=')[1];
    else if (/^--size=\d+x\d+$/.test(arg)) {
      const [w, h] = arg.slice(7).split('x').map(Number);
      if (w < 1 || h < 1 || w > 1000 || h > 1000) throw Error('Size must be 1..1000 cells per axis');
      options.width = w;
      options.height = h;
    } else if (!arg.startsWith('-') && !options.file) options.file = arg;
    else throw Error(USAGE);
  }
  if (options.validate && !options.file) throw Error(USAGE);
  return options;
}
// The app's state for a lesson file; a file that breaks the schema opens read-only with its errors.
async function stateFor(path) {
  const opened = await openLesson(path);
  const state = createState(fromDoc(opened.doc));
  await Promise.all(
    Object.values(state.pictures).flatMap((byField) => Object.values(byField).map((p) => loadPicture(path, p))),
  );
  Object.assign(state.file, { path, name: basename(path), status: opened.errors ? 'invalid' : 'saved' });
  if (opened.created) state.notice = `Created ${basename(path)}: a blank lesson. Every change saves to it.`;
  if (opened.moved)
    state.notice = `Moved key points into speaker notes on ${opened.moved} slide${opened.moved === 1 ? '' : 's'}.`;
  if (opened.errors) {
    Object.assign(state.file, { readOnly: true, errors: opened.errors });
    state.review = true;
  }
  // The chat kept beside the lesson, shown as earlier and never sent to a model; an unreadable one is left out.
  try {
    state.chat.push(...readChat(path));
  } catch (error) {
    state.notice = `Earlier chat not loaded (${error.code || error.message})`;
  }
  return state;
}
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const path = opts.file && resolve(opts.file);
  if (opts.validate) {
    const read = await readLesson(path);
    const errors = read.missing ? [{ path: '/', message: 'does not exist' }] : read.errors || [];
    process.stdout.write(
      errors.length ? formatErrors(errors).join('\n') + '\n' : `${path} follows the lesson schema\n`,
    );
    process.exitCode = errors.length ? 1 : 0;
    return;
  }
  if (opts.plain) {
    const state = path ? await stateForReading(path) : createState();
    process.stdout.write(plainFrame(render(state, opts.width, opts.height)) + '\n');
    return;
  }
  // A wrong image backend setting stops the start, before any file is opened, rather than falling back.
  imageBackend();
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('Lesson Maker requires an interactive TTY. Use --plain --size=140x40 for a text snapshot.\n');
    process.exitCode = 2;
    return;
  }
  // No file: the start screen picks one of this project's lessons or names a new one.
  const chosen =
    path || (await pickLesson(startState(projectRoot(process.cwd()), findLessons(projectRoot(process.cwd())))));
  if (!chosen) return;
  const state = await stateFor(chosen);
  // The model and effort chosen last time; a model Pi no longer has falls back to Pi's default when it connects.
  const settings = await readSettings();
  if (typeof settings.model === 'string') state.ai.model = settings.model;
  if (EFFORTS.includes(settings.effort)) state.ai.effort = settings.effort;
  if (SPEEDS.includes(settings.speechRate)) state.speechRate = settings.speechRate;
  if (VOICES.some((v) => v.name === settings.voice)) state.voice = settings.voice;
  const host = createHost({
    remember: writeSettings,
    mode: opts.mode,
    state,
    lessonPath: chosen,
    connect: connectPi,
    onExit() {
      // Pi may hold connections open, so the process ends once the last save has landed.
      host.saved.finally(() => process.exit());
    },
    onError() {
      process.stderr.write('Lesson Maker stopped after a terminal error.\n');
      process.exitCode = 1;
    },
  });
  if (state.file.readOnly) host.openErrors();
  host.start();
}
// A snapshot only reads: it never creates or writes the file.
async function stateForReading(path) {
  const read = await readLesson(path);
  if (read.missing) throw Error(`${path} does not exist`);
  const state = createState(fromDoc(read.errors ? readableDoc(read.doc) : read.doc));
  Object.assign(state.file, { path, name: basename(path), status: 'saved', readOnly: Boolean(read.errors) });
  state.file.errors = read.errors || [];
  state.review = Boolean(read.errors);
  await Promise.all(
    Object.values(state.pictures).flatMap((byField) => Object.values(byField).map((p) => loadPicture(path, p))),
  );
  return state;
}
main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 2;
});
