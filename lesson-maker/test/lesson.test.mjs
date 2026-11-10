import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSchema } from '../src/schema.mjs';
import {
  SCHEMA,
  validateLesson,
  formatErrors,
  blankLesson,
  fromDoc,
  toDoc,
  readableDoc,
  openLesson,
  writeLesson,
  loadPicture,
  storePicture,
  assetsFolder,
  readSettings,
  writeSettings,
} from '../src/lesson.mjs';
import { exampleDoc } from '../src/seed.mjs';
import { createState, setField } from '../src/model.mjs';
import { createSaver } from '../src/host.mjs';
import { findPi } from '../src/pi.mjs';
import { samplePng } from '../src/png.mjs';
import { settle } from './fake-ai.mjs';

const temp = () => mkdtemp(join(tmpdir(), 'lesson-test-'));

test('the example and a blank lesson follow the schema and survive a round trip through the app state', () => {
  assert.deepEqual(validateLesson(exampleDoc()), []);
  assert.deepEqual(validateLesson(blankLesson()), []);
  for (const doc of [exampleDoc(), blankLesson()])
    assert.deepEqual(toDoc({ ...fromDoc(doc), schemaRef: doc.$schema }), doc);
  // Every slide carries every field, whatever its layout; tagline, comments and locked are optional, so older
  // lessons stay valid.
  assert.deepEqual(
    SCHEMA.$defs.slide.required,
    Object.keys(SCHEMA.$defs.slide.properties).filter((k) => !['tagline', 'comments', 'locked'].includes(k)),
  );
  const old = exampleDoc();
  delete old.sections[0].titleSlide.tagline;
  assert.deepEqual(validateLesson(old), []);
  assert.equal(fromDoc(old).slides[0].tagline, '');
  // A lock is written only when on, and survives the round trip.
  const lockedDoc = exampleDoc();
  lockedDoc.sections[0].slides[0].locked = true;
  assert.deepEqual(validateLesson(lockedDoc), []);
  assert.deepEqual(toDoc({ ...fromDoc(lockedDoc), schemaRef: lockedDoc.$schema }), lockedDoc);
  assert.ok(!('locked' in toDoc({ ...fromDoc(old), schemaRef: old.$schema }).sections[0].slides[0]));
});

test('errors name the JSON path: missing, unknown, type, enum, pattern, length, picture, duplicate id', () => {
  const doc = exampleDoc(),
    slide = doc.sections[0].slides[0];
  delete slide.purpose;
  slide.colour = 'red';
  slide.title = 7;
  slide.layout = 'grid';
  slide.id = 'has space';
  slide.speakerNotes = 'x'.repeat(20001);
  slide.image.picture = { source: 'generated', file: 'a.png', prompt: 'p' };
  doc.sections[0].slides[1].afterImage.picture = { source: 'attached', file: '../outside.png' };
  doc.sections[1].id = 'SEC-1';
  doc.schemaVersion = 2;
  const errors = formatErrors(validateLesson(doc));
  for (const expected of [
    '/schemaVersion must be 1',
    '/sections/0/slides/0 is missing required "purpose"',
    '/sections/0/slides/0/colour is not allowed',
    '/sections/0/slides/0/title must be a string',
    '/sections/0/slides/0/layout must be one of',
    '/sections/0/slides/0/id must match',
    '/sections/0/slides/0/speakerNotes must be at most 20000 characters',
    '/sections/0/slides/0/image/picture is missing required "model"',
    '/sections/0/slides/1/afterImage/picture/file must match',
  ])
    assert.ok(
      errors.some((e) => e.startsWith(expected)),
      `${expected}\n${errors.join('\n')}`,
    );
  // Ids are checked once the schema passes.
  const twice = exampleDoc();
  twice.sections[1].id = 'SEC-1';
  assert.deepEqual(formatErrors(validateLesson(twice)), [
    '/sections/1/id repeats id "SEC-1" first used at /sections/0/id',
  ]);
  assert.match(formatErrors(validateLesson([]))[0], /^\(the file\) must be an object/);
});

test('the validator refuses a schema keyword it does not check', () => {
  assert.throws(() => compileSchema({ type: 'object', minProperties: 1 }), /unsupported keyword minProperties/);
  assert.throws(() => compileSchema({ $ref: '#/$defs/missing' }), /unresolved/);
  const check = compileSchema({ oneOf: [{ type: 'null' }, { type: 'string', maxLength: 2 }] });
  assert.deepEqual(check(null), []);
  assert.equal(check('abc')[0].message, 'must be at most 2 characters');
});

test('opening: a missing file is created blank; an invalid one is readable with its errors', async () => {
  const dir = await temp();
  try {
    const fresh = join(dir, 'new.lesson.json');
    const created = await openLesson(fresh);
    assert.equal(created.created, true);
    assert.deepEqual(JSON.parse(await readFile(fresh, 'utf8')), blankLesson());
    const broken = join(dir, 'broken.lesson.json');
    const doc = exampleDoc();
    doc.sections[0].slides[0].layout = 'grid';
    delete doc.plan.outcomes;
    await writeFile(broken, JSON.stringify(doc));
    const before = await readFile(broken, 'utf8');
    const opened = await openLesson(broken);
    assert.equal(opened.errors.length, 2);
    assert.equal(opened.doc.sections[0].slides[0].layout, 'points-image');
    assert.equal(opened.doc.plan.outcomes, '');
    assert.deepEqual(validateLesson(opened.doc), []);
    assert.equal(await readFile(broken, 'utf8'), before);
    await writeFile(join(dir, 'text.lesson.json'), 'not json');
    const text = await openLesson(join(dir, 'text.lesson.json'));
    assert.match(formatErrors(text.errors)[0], /is not JSON/);
    assert.deepEqual(validateLesson(readableDoc(undefined)), []);
    // A lesson from before KEY POINTS was removed: its key points move to the top of the speaker notes, and the
    // file is written back without the field.
    const old = exampleDoc(),
      slide = old.sections[0].slides[0],
      oldPath = join(dir, 'old.lesson.json');
    Object.assign(slide, { keyPoints: '- one\n- two', speakerNotes: 'Say hello.' });
    old.sections[0].slides[1].keyPoints = '';
    await writeFile(oldPath, JSON.stringify(old));
    const migrated = await openLesson(oldPath);
    assert.equal(migrated.moved, 1);
    assert.equal(migrated.errors, undefined);
    const saved = JSON.parse(await readFile(oldPath, 'utf8'));
    assert.equal(saved.sections[0].slides[0].speakerNotes, 'Key points:\n- one\n- two\n\nSay hello.');
    assert.ok(!JSON.stringify(saved).includes('keyPoints'));
    assert.deepEqual(validateLesson(saved), []);
    // Opening it again moves nothing.
    assert.equal((await openLesson(oldPath)).moved, 0);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('saving is atomic and refuses an invalid lesson, leaving the old file and no temporary file', async () => {
  const dir = await temp(),
    path = join(dir, 'a.lesson.json');
  try {
    assert.equal(await writeLesson(path, exampleDoc()), null);
    const bad = exampleDoc();
    bad.sections = [];
    assert.match(formatErrors(await writeLesson(path, bad))[0], /\/sections must have at least 1 items/);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), exampleDoc());
    assert.deepEqual(await readdir(dir), ['a.lesson.json']);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('the saver writes each change once, reports schema errors, never writes a read-only lesson', async () => {
  const s = createState(),
    writes = [];
  let refuse = false;
  const write = async (path, doc) => {
    if (refuse) return [{ path: '/sections/0/slides/0/title', message: 'must be a string' }];
    writes.push(doc);
    return null;
  };
  s.file.path = '/x.lesson.json';
  const saver = createSaver(s, '/x.lesson.json', { write });
  await saver.save();
  assert.equal(writes.length, 0, 'an unchanged lesson is not rewritten');
  setField(s, 'S-1', 'notes', 'New notes');
  saver.save();
  saver.save();
  await saver.done;
  assert.equal(writes.length, 1);
  assert.equal(writes[0].sections[0].slides[0].speakerNotes, 'New notes');
  assert.equal(s.file.status, 'saved');
  refuse = true;
  setField(s, 'S-1', 'notes', 'More');
  await saver.save();
  assert.equal(s.file.status, 'invalid');
  assert.equal(s.file.errors.length, 1);
  const readOnly = createState();
  readOnly.file.readOnly = true;
  const none = createSaver(readOnly, '/y.lesson.json', { write });
  readOnly.slides[0].notes = 'changed';
  await none.save();
  assert.equal(writes.length, 1);
});

test('pictures: stored in the lesson folder with schema-safe names; a missing file is reported', async () => {
  const dir = await temp(),
    path = join(dir, 'My lesson (draft).lesson.json');
  try {
    assert.equal(assetsFolder(path), 'My-lesson--draft-.lesson.assets');
    const file = await storePicture(path, samplePng('etag'), 'S-3-image');
    assert.match(file, /^My-lesson--draft-\.lesson\.assets\/S-3-image-\w+\.png$/);
    const doc = exampleDoc();
    doc.sections[0].slides[1].image.picture = { source: 'attached', file };
    assert.deepEqual(validateLesson(doc), []);
    const loaded = await loadPicture(path, { source: 'attached', file });
    assert.equal(loaded.width, 640);
    const missing = await loadPicture(path, { source: 'attached', file: 'gone.png' });
    assert.equal(missing.error, 'file missing');
    assert.equal(missing.bytes, null);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('Pi is found from LESSON_MAKER_PI or the pi on PATH, by its package name only', async () => {
  const dir = await temp();
  try {
    await mkdir(join(dir, 'pkg', 'dist'), { recursive: true });
    await writeFile(join(dir, 'pkg', 'package.json'), JSON.stringify({ name: '@earendil-works/pi-coding-agent' }));
    assert.equal(findPi({ LESSON_MAKER_PI: join(dir, 'pkg') }), join(dir, 'pkg'));
    assert.equal(findPi({ LESSON_MAKER_PI: dir }), null);
    await mkdir(join(dir, 'bin'));
    await writeFile(join(dir, 'pkg', 'dist', 'cli.js'), '');
    const { symlink } = await import('node:fs/promises');
    await symlink(join(dir, 'pkg', 'dist', 'cli.js'), join(dir, 'bin', 'pi'));
    const { realpathSync } = await import('node:fs');
    assert.equal(findPi({ PATH: join(dir, 'bin') }), realpathSync(join(dir, 'pkg')));
    assert.equal(findPi({ PATH: join(dir, 'pkg') }), null);
  } finally {
    await rm(dir, { recursive: true });
    await settle();
  }
});

test('settings read as nothing when missing or broken, and write whole', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'settings-')),
    path = join(dir, 'nested', 'settings.json');
  assert.deepEqual(await readSettings(path), {});
  await writeSettings({ model: 'google/gemini-3.8-flash', effort: 'high' }, path);
  assert.deepEqual(await readSettings(path), { model: 'google/gemini-3.8-flash', effort: 'high' });
  assert.deepEqual(await readdir(join(dir, 'nested')), ['settings.json']);
  for (const broken of ['{', '[1]', 'null']) {
    await writeFile(path, broken);
    assert.deepEqual(await readSettings(path), {});
  }
  await rm(dir, { recursive: true });
});
