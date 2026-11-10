import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectRoot, findLessons, newLessonPath, startState, startKey, renderStart, age } from '../src/start.mjs';
import { openLesson, validateLesson } from '../src/lesson.mjs';

const project = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lesson-project-')));
  mkdirSync(join(root, '.git'));
  for (const dir of ['lessons', 'docs/deep', 'node_modules/pkg', '.hidden', 'lessons/a.lesson.assets'])
    mkdirSync(join(root, dir), { recursive: true });
  const files = ['lessons/old.lesson.json', 'docs/deep/new.lesson.json', 'node_modules/pkg/x.lesson.json'];
  files.push('.hidden/y.lesson.json', 'lessons/a.lesson.assets/z.lesson.json', 'lessons/notes.json');
  for (const file of files) writeFileSync(join(root, file), '{}');
  utimesSync(join(root, 'lessons/old.lesson.json'), 1, 1);
  return root;
};

test('start: the project is the git checkout; its lessons are listed newest first, skipping tool folders', () => {
  const root = project();
  assert.equal(projectRoot(join(root, 'docs/deep')), root);
  assert.deepEqual(
    findLessons(root).map((x) => x.name),
    ['docs/deep/new.lesson.json', 'lessons/old.lesson.json'],
  );
  assert.equal(newLessonPath(root, '  Intro to DNS! '), join(root, 'lessons', 'intro-to-dns.lesson.json'));
  assert.equal(newLessonPath(root, '!!!'), null);
  assert.equal(age(0, 3 * 3600_000), '3h ago');
  rmSync(root, { recursive: true });
});

test('start: keys and clicks open a lesson, name a new one, or quit', async () => {
  const root = project(),
    m = startState(root, findLessons(root));
  assert.equal(startKey(m, { key: 'down' }), null);
  assert.deepEqual(startKey(m, { key: 'enter' }), { open: join(root, 'docs/deep/new.lesson.json') });
  const frame = renderStart(m, 100, 20);
  const row = frame.hits.find((h) => h.row === 2);
  assert.deepEqual(startKey(m, { key: 'mouse', button: 'left', x: row.x + 3, y: row.y }, frame.hits), {
    open: join(root, 'lessons/old.lesson.json'),
  });
  // New lesson: the first row asks for a name; Esc goes back, Enter with no usable name says why.
  m.index = 0;
  startKey(m, { key: 'enter' });
  assert.ok(m.naming);
  assert.equal(startKey(m, { key: 'enter' }), null);
  assert.match(m.naming.error, /at least one letter/);
  for (const text of 'Caching 101') startKey(m, { key: 'text', text });
  startKey(m, { key: 'backspace' });
  const screen = renderStart(m, 100, 20)
    .lines.map((line) => line.map((c) => c.text).join(''))
    .join('\n');
  assert.match(screen, /Saves to lessons\/caching-10\.lesson/);
  assert.match(screen, /LESSON MAKER[^\n]*HOLD 2/);
  const chosen = startKey(m, { key: 'enter' });
  assert.deepEqual(chosen, { open: join(root, 'lessons', 'caching-10.lesson.json') });
  // Opening it creates the lessons folder if needed and a valid blank lesson.
  rmSync(join(root, 'lessons'), { recursive: true });
  const opened = await openLesson(chosen.open);
  assert.ok(opened.created);
  assert.deepEqual(validateLesson(opened.doc), []);
  startKey(m, { key: 'escape' });
  assert.equal(m.naming, null);
  assert.deepEqual(startKey(m, { key: 'text', text: 'q' }), { quit: true });
  assert.deepEqual(startKey(m, { key: 'ctrl-c' }), { quit: true });
  rmSync(root, { recursive: true });
});

test('start: every size stays in bounds', () => {
  const m = startState('/project', [{ path: '/p/a.lesson.json', name: 'a.lesson.json', modified: 0 }]);
  for (const [w, h] of [
    [196, 50],
    [80, 24],
    [40, 10],
    [20, 5],
    [1, 1],
  ]) {
    const lines = renderStart(m, w, h).lines;
    assert.equal(lines.length, h);
    assert.ok(lines.every((line) => line.length === w));
  }
});
