import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendChat, historyFolder, readChat, snapshotLesson, toDoc, writeLesson } from '../src/lesson.mjs';
import { createState, selectSlide, focusField } from '../src/model.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { lessonPrompt } from '../src/prompts.mjs';
import { render, plainFrame } from '../src/render.mjs';
import { findLessons } from '../src/start.mjs';
import { imageBackend, imagegenParams } from '../src/pi.mjs';
import { connect, settle } from './fake-ai.mjs';

const main = new URL('../main.mjs', import.meta.url).pathname;
const at = new Date(2026, 10, 10, 14, 5, 7, 89);
const snapshots = (path) =>
  existsSync(historyFolder(path))
    ? readdirSync(historyFolder(path))
        .filter((n) => n.endsWith('.lesson.json'))
        .sort()
    : [];
const chatLines = (path) =>
  readFileSync(join(historyFolder(path), 'chat.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);

test('history: a sortable local-time copy beside the lesson, skipped when identical or with no file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-history-')),
    path = join(dir, 'foo.lesson.json');
  assert.equal(historyFolder(path), join(dir, 'foo.lesson.history'));
  // No saved file yet: nothing to copy, and no folder is made.
  assert.equal(snapshotLesson(path, at), null);
  assert.ok(!existsSync(historyFolder(path)));
  writeFileSync(path, '{"one": 1}\n');
  assert.equal(snapshotLesson(path, at), join(dir, 'foo.lesson.history', '2026-11-10T14-05-07-089.lesson.json'));
  assert.equal(readFileSync(join(historyFolder(path), snapshots(path)[0]), 'utf8'), '{"one": 1}\n');
  // The same bytes again write nothing.
  assert.equal(snapshotLesson(path, new Date(at.getTime() + 60000)), null);
  assert.equal(snapshots(path).length, 1);
  // Changed bytes at a taken time move on a millisecond, so names still sort in the order they were made.
  writeFileSync(path, '{"two": 2}\n');
  assert.match(snapshotLesson(path, at), /2026-11-10T14-05-07-090\.lesson\.json$/);
  writeFileSync(path, '{"three": 3}\n');
  snapshotLesson(path, new Date(at.getTime() + 1000));
  assert.deepEqual(
    snapshots(path).map((n) => readFileSync(join(historyFolder(path), n), 'utf8')),
    ['{"one": 1}\n', '{"two": 2}\n', '{"three": 3}\n'],
  );
  // The start screen does not list the copies as lessons.
  assert.deepEqual(
    findLessons(dir).map((l) => l.name),
    ['foo.lesson.json'],
  );
  rmSync(dir, { recursive: true });
});

async function lessonOnDisk() {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-history-')),
    path = join(dir, 'l.lesson.json'),
    s = createState();
  assert.equal(await writeLesson(path, toDoc(s)), null);
  Object.assign(s.file, { path, name: 'l.lesson.json', status: 'saved' });
  const jobs = createScheduler(s, { lessonPath: path, now: () => at.getTime() }),
    ai = connect(s, jobs);
  return { dir, path, s, jobs, ai };
}

test('history: every AI request copies the lesson before it runs, a batch once; read-only lessons never', async () => {
  const { dir, path, s, jobs, ai } = await lessonOnDisk();
  selectSlide(s, 'S-3');
  focusField(s, 'notes');
  assert.equal(jobs.send('Shorter notes'), true);
  // The copy is there before the model is asked.
  assert.equal(snapshots(path).length, 1);
  assert.equal(readFileSync(join(historyFolder(path), snapshots(path)[0]), 'utf8'), readFileSync(path, 'utf8'));
  ai.open()[0].answer('Short notes.');
  await settle();
  // The saved file has not changed since (no saver runs here), so the next request's copy is skipped.
  s.wholeLesson = true;
  jobs.send('Anything');
  await settle();
  assert.equal(snapshots(path).length, 1);
  ai.open()[0].answer('ok');
  await settle();
  appendFileSync(path, ' ');
  assert.equal(jobs.generate('S-3', 'imageDesc'), null);
  assert.equal(snapshots(path).length, 2);
  ai.open()[0].fail(Error('quota'));
  await settle();
  // The batch is copied once when it starts, not before each of its pictures.
  appendFileSync(path, ' ');
  for (const x of s.slides) x.imageDesc ||= `A diagram for ${x.id}`;
  s.pictures = {};
  assert.match(jobs.generateMissing(), /^Generating \d+ pictures/);
  assert.ok(ai.open().length > 1);
  assert.equal(snapshots(path).length, 3);
  jobs.dispose();

  // A lesson opened read-only gets no history, neither copies nor chat.
  const other = await lessonOnDisk();
  other.s.file.readOnly = true;
  other.s.wholeLesson = true;
  other.jobs.send('Anything');
  await settle();
  assert.equal(other.ai.open().length, 1);
  other.ai.open()[0].answer('ok');
  await settle();
  assert.ok(!existsSync(historyFolder(other.path)));
  rmSync(dir, { recursive: true });
  rmSync(other.dir, { recursive: true });
});

test('history: a copy that cannot be written stops the request, with a chat failure', async () => {
  const { dir, path, s, jobs, ai } = await lessonOnDisk();
  // A file where the folder belongs: neither copies nor chat can be written.
  writeFileSync(historyFolder(path), '');
  s.wholeLesson = true;
  jobs.send('Rewrite everything');
  await settle();
  assert.equal(ai.calls.length, 0);
  assert.match(s.chat.at(-1).text, /^Failed: Not run: the lesson's history copy could not be written \(\w+\)/);
  assert.match(s.notice, /^Chat history not saved/);
  for (const x of s.slides) x.imageDesc ||= `A diagram for ${x.id}`;
  s.pictures = {};
  assert.match(jobs.generateMissing(), /^Not run: the lesson's history copy/);
  assert.equal(ai.calls.length, 0);
  assert.equal(s.jobs.filter((j) => j.batch).length, 0);
  jobs.dispose();
  rmSync(dir, { recursive: true });
});

test('history: final chat entries go to chat.jsonl; live updates do not', async () => {
  const { dir, path, s, jobs, ai } = await lessonOnDisk();
  selectSlide(s, 'S-3');
  focusField(s, 'notes');
  jobs.send('Shorter notes');
  await settle();
  // The message is kept as sent; the live 'Working…' entry is not kept until it ends.
  assert.equal(chatLines(path).length, 1);
  ai.open()[0].answer('Short notes.');
  await settle();
  s.wholeLesson = true;
  jobs.send('Add a recap');
  await settle();
  ai.open()[0].fail(Error('model error'));
  await settle();
  const time = at.toISOString();
  assert.deepEqual(
    chatLines(path).map(({ role, scope, text, time: t }) => [role, scope, text, t === time]),
    [
      ['You', 'box', 'Shorter notes', true],
      ['Edit agent', 'box', 'Done: Speaker notes rewritten.', true],
      ['You', 'lesson', 'Add a recap', true],
      ['Edit agent', 'lesson', 'Failed: model error', true],
    ],
  );
  assert.match(chatLines(path)[0].stamp, /^Slide 6/);
  assert.equal(chatLines(path)[2].stamp, 'Whole lesson');
  jobs.dispose();
  rmSync(dir, { recursive: true });
});

test('history: earlier chat comes back marked, shown only, never sent; a cut-off last line is skipped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-history-')),
    path = join(dir, 'l.lesson.json');
  assert.deepEqual(readChat(path), []);
  appendChat(path, { time: 'x', role: 'You', scope: 'lesson', stamp: 'Whole lesson', text: 'Make it shorter' });
  appendChat(path, { time: 'x', role: 'Lesson AI', scope: 'lesson', stamp: 'Whole lesson', text: 'Shortened it.' });
  // A write cut off mid-line, then a later entry: the later one still reads, on a line of its own.
  appendFileSync(join(historyFolder(path), 'chat.jsonl'), '{"role": "You", "te');
  assert.equal(readChat(path).length, 2);
  appendChat(path, { time: 'x', role: 'You', scope: 'box', stamp: 'Slide 2', text: 'Later' });
  const earlier = readChat(path);
  assert.deepEqual(
    earlier.map((m) => [m.role, m.text, m.stamp, m.earlier]),
    [
      ['You', 'Make it shorter', 'Whole lesson', true],
      ['Lesson AI', 'Shortened it.', 'Whole lesson', true],
      ['You', 'Later', 'Slide 2', true],
    ],
  );
  const s = createState();
  s.chat.push(...earlier, { role: 'You', text: 'This session', stamp: 'Whole lesson' });
  // The model hears only this session's chat.
  const prompt = lessonPrompt(s, { text: 'x' });
  assert.ok(!prompt.includes('Make it shorter') && prompt.includes('You (Whole lesson): This session'));
  const frame = plainFrame(render(s, 180, 60));
  assert.match(frame, /earlier · Whole lesson/);
  assert.match(frame, /Earlier sessions above/);
  rmSync(dir, { recursive: true });
});

test('image backend: unset or subscription sends none, api sends backend api, anything else stops the start', () => {
  const params = { prompt: 'p', outputPath: '/tmp/x.png', effort: 'medium' };
  assert.deepEqual(imagegenParams(params, imageBackend({})), {
    prompt: 'p',
    outputPath: '/tmp/x.png',
    outputFormat: 'png',
    size: '1536x1024',
    background: 'opaque',
    thinking: 'medium',
    quality: 'medium',
  });
  assert.ok(!('backend' in imagegenParams(params, imageBackend({ LESSON_MAKER_IMAGE_BACKEND: 'subscription' }))));
  const api = { LESSON_MAKER_IMAGE_BACKEND: 'api', OPENAI_API_KEY: 'present' };
  assert.equal(imagegenParams(params, imageBackend(api)).backend, 'api');
  assert.equal(imagegenParams(params, imageBackend(api)).size, '1536x1024');
  assert.throws(() => imageBackend({ LESSON_MAKER_IMAGE_BACKEND: 'API' }), /must be subscription or api, not "API"/);
  assert.throws(() => imageBackend({ LESSON_MAKER_IMAGE_BACKEND: 'api' }), /needs OPENAI_API_KEY in the environment/);
  // At startup: the message, exit 2, and no lesson file made.
  const dir = mkdtempSync(join(tmpdir(), 'lesson-history-')),
    path = join(dir, 'new.lesson.json');
  for (const [env, message] of [
    [{ LESSON_MAKER_IMAGE_BACKEND: 'apii' }, /must be subscription or api, not "apii"/],
    [{ LESSON_MAKER_IMAGE_BACKEND: 'api', OPENAI_API_KEY: '' }, /needs OPENAI_API_KEY/],
  ]) {
    const run = spawnSync(process.execPath, [main, path], { env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, message);
  }
  assert.ok(!existsSync(path));
  rmSync(dir, { recursive: true });
});
