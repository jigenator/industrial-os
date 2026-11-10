import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { exampleDoc } from '../src/seed.mjs';
import { validateLesson, toDoc } from '../src/lesson.mjs';
import { deleteItems, addSlide, addGroup, moveItems, setSlide, setSlides, setPlan } from '../src/edits.mjs';
import {
  createState,
  slideById,
  order,
  setField,
  undoOutline,
  selectSlide,
  focusField,
  chatAim,
} from '../src/model.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { lessonPrompt, slidePrompt } from '../src/prompts.mjs';
import { htmlText, listArtifacts, readDocument } from '../src/documents.mjs';
import { samplePng } from '../src/png.mjs';
import { connect, settle } from './fake-ai.mjs';

const ids = (doc) =>
  doc.sections.flatMap((sec) => [
    sec.id,
    ...sec.slides.map((x) => x.id),
    ...sec.subsections.flatMap((sub) => [sub.id, ...sub.slides.map((x) => x.id)]),
  ]);

test('edits: delete, add, move and set change the file JSON and say what they did', () => {
  const doc = exampleDoc();
  assert.match(deleteItems(doc, { ids: ['S-1', 'SUB-4'] }), /^Deleted Slide 2 "[^"]+", subsection "Learner practice/);
  assert.ok(!ids(doc).includes('S-1') && !ids(doc).includes('SUB-4') && !ids(doc).includes('S-5'));
  assert.throws(() => deleteItems(doc, { ids: ['title-SEC-1'] }), /title slide/);
  assert.throws(() => deleteItems(doc, { ids: ['nope'] }), /No item has id "nope"/);
  assert.throws(() => deleteItems(doc, { ids: doc.sections.map((sec) => sec.id) }), /at least one section/);

  assert.match(
    addSlide(doc, { groupId: 'SUB-3', beforeId: 'S-4', fields: { title: 'New' } }),
    /^Added Slide \d+ "New"/,
  );
  const added = doc.sections[1].subsections[0].slides.at(-2);
  assert.equal(added.title, 'New');
  assert.equal(added.image.style, 'generic');
  assert.match(addGroup(doc, { kind: 'subsection', title: 'Recap', parentId: 'SEC-3' }), /Added subsection "Recap"/);
  assert.match(addGroup(doc, { kind: 'section', title: 'Extra', beforeId: 'SEC-1' }), /Added section "Extra"/);
  assert.equal(doc.sections[0].titleSlide.title, 'Extra');

  assert.match(moveItems(doc, { ids: ['S-2'], groupId: 'SUB-3', beforeId: 'S-3' }), /^Moved Slide/);
  assert.equal(doc.sections[2].subsections[0].slides[0].id, 'S-2');
  assert.match(moveItems(doc, { ids: ['SEC-3'], beforeId: 'SEC-1' }), /^Moved section "Transfer"/);
  assert.throws(() => moveItems(doc, { ids: ['S-2', 'SEC-1'] }), /one kind a call/);

  assert.match(setSlide(doc, { id: 'S-3', fields: { title: 'T', image: { style: 'xiaohei' } } }), /title, image/);
  assert.throws(() => setSlide(doc, { id: 'S-3', fields: { image: { picture: { file: 'x.png' } } } }), /only be set/);
  assert.throws(() => setSlide(doc, { id: 'S-3', fields: { id: 'X' } }), /keeps its id/);
  // Locked slides: no field changes, no deletes or moves of them or the groups holding them, and no lock changes.
  const slidesIn = (sections) =>
      sections.flatMap((sec) => [sec, ...sec.subsections]).flatMap((g) => [g.titleSlide, ...g.slides]),
    lockedDoc = structuredClone(doc),
    lockedId = 'S-2',
    holder = lockedDoc.sections.find((sec) => slidesIn([sec]).some((x) => x.id === lockedId));
  slidesIn(lockedDoc.sections).find((x) => x.id === lockedId).locked = true;
  assert.throws(() => setSlide(lockedDoc, { id: lockedId, fields: { title: 'x' } }), /locked by the author/);
  assert.throws(() => deleteItems(lockedDoc, { ids: [lockedId] }), /locked by the author/);
  assert.throws(() => deleteItems(lockedDoc, { ids: [holder.id] }), /locked by the author/);
  assert.throws(() => moveItems(lockedDoc, { ids: [holder.id] }), /locked by the author/);
  assert.throws(() => setSlide(lockedDoc, { id: 'S-3', fields: { locked: true } }), /Only the author/);
  // The optional tag line is a field like any other, so a request can fill a Title + image slide.
  assert.match(setSlide(doc, { id: 'S-3', fields: { layout: 'title-image', tagline: 'Session 1' } }), /tagline/);
  // Many slides in one call: all apply, or none when one is wrong.
  assert.match(
    setSlides(doc, {
      changes: [
        { id: 'S-1', fields: { title: 'One' } },
        { id: 'S-2', fields: { title: 'Two' } },
      ],
    }),
    /^Changed .*: title\n· Changed .*: title$/,
  );
  const kept = structuredClone(doc);
  assert.throws(() =>
    setSlides(structuredClone(doc), {
      changes: [
        { id: 'S-1', fields: {} },
        { id: 'nope', fields: {} },
      ],
    }),
  );
  assert.throws(() => setSlides(doc, { changes: [] }), /list/);
  assert.deepEqual(doc, kept);
  assert.throws(() => setPlan(doc, { fields: { goals: 'x' } }), /no "goals"/);
  assert.match(setPlan(doc, { fields: { outcomes: 'Learners can explain caching.' } }), /outcomes/);
  assert.deepEqual(validateLesson(doc), []);
  // Wrong values are the schema's job: the tool reports its errors by JSON path.
  setSlide(doc, { id: 'S-3', fields: { layout: 'grid' } });
  assert.match(validateLesson(doc)[0].path, /\/layout$/);
});

const setup = (lessonPath = null) => {
  const s = createState(),
    jobs = createScheduler(s, { lessonPath }),
    ai = connect(s, jobs);
  return { s, jobs, ai };
};
const lessonCall = async (s, jobs, ai, text) => {
  s.wholeLesson = true;
  jobs.send(text);
  await settle();
  return ai.open().find((call) => call.tools?.length);
};
const tool = (call, name) => call.tools.find((t) => t.name === name);
// Waits for a request that starts after real file reads, which take longer than settle() allows.
async function until(find) {
  for (let i = 0; i < 200; i++) {
    const found = find();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw Error('timed out');
}

test('whole-lesson tools apply one by one, show each change, and undo together', async () => {
  const { s, jobs, ai } = setup();
  const before = order(s).map((x) => x.id);
  const call = await lessonCall(s, jobs, ai, 'Delete the transfer section and retitle slide 2');
  assert.match(await tool(call, 'claim_slides').execute({ ids: ['SEC-3', 'S-1'] }), /^Claimed slide 2; section/);
  assert.match(await tool(call, 'delete_items').execute({ ids: ['SEC-3'] }), /^Done: Deleted section "Transfer"/);
  // Applied at once: the outline has lost the section while the request still runs.
  assert.ok(!slideById(s, 'S-7'));
  assert.match(s.chat.at(-1).text, /^· Claimed slide 2\n· Deleted section "Transfer"/);
  assert.match(
    await tool(call, 'set_slides').execute({ changes: [{ id: 'S-1', fields: { title: 'Shorter' } }] }),
    /^Done: Changed Slide 2/,
  );
  assert.equal(s.provenance['S-1:title'], 'AI EDIT');
  assert.match(
    await tool(call, 'set_slides').execute({ changes: [{ id: 'S-1', fields: { layout: 'grid' } }] }),
    /^Not applied[\s\S]*layout/,
  );
  assert.match(await tool(call, 'add_slide').execute({ groupId: 'nope' }), /^Not applied: No item has id "nope"/);
  call.answer('Removed Transfer and shortened slide 2.');
  await settle();
  assert.match(
    s.chat.at(-1).text,
    /\n· Deleted section "Transfer"\n· Changed Slide 2 "Shorter": title\n\[u in the outline/,
  );
  assert.equal(setField(s, 'S-4', 'notes', 'free again'), null);
  // Both changes are one undo.
  assert.equal(s.undo.filter((u) => u.kind === 'lesson').length, 1);
  assert.equal(undoOutline(s), null);
  assert.deepEqual(
    order(s).map((x) => x.id),
    before,
  );
  assert.notEqual(slideById(s, 'S-1').title, 'Shorter');
});

test('the lesson agent can generate with its own prompt; the picture joins the request undo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-')),
    { s, jobs, ai } = setup(join(dir, 'x.lesson.json'));
  const call = await lessonCall(s, jobs, ai, 'Draw slide 6 in Xiaohei style');
  await tool(call, 'claim_slides').execute({ ids: ['S-3'] });
  assert.match(
    await tool(call, 'set_slides').execute({ changes: [{ id: 'S-3', fields: { image: { style: 'xiaohei' } } }] }),
    /^Done/,
  );
  const making = tool(call, 'generate_picture').execute({ slideId: 'S-3', image: 'image', prompt: 'My own prompt' });
  await settle();
  const image = ai.open().find((c) => c.kind === 'image');
  assert.equal(image.prompt, 'My own prompt');
  mkdirSync(dirname(image.outputPath), { recursive: true });
  writeFileSync(image.outputPath, samplePng('etag'));
  image.answer({ file: image.outputPath, model: 'gpt-image-test', prompt: image.prompt });
  assert.match(await making, /^Generated the picture for Slide 6/);
  assert.equal(toDoc(s).sections[1].subsections[0].slides[0].image.picture.prompt, 'My own prompt');
  call.answer('Done.');
  await settle();
  assert.equal(undoOutline(s), null);
  assert.equal(s.pictures['S-3'].imageDesc.source, 'attached');
  assert.equal(slideById(s, 'S-3').imageStyle, 'generic');
  rmSync(dir, { recursive: true });
});

test('Xiaohei: [generate] has the chat model write the prompt from the skill; the chat gets the skill', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-')),
    skill = join(dir, 'skill');
  mkdirSync(join(skill, 'references'), { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), 'Draw Xiaohei doing the idea.');
  writeFileSync(join(skill, 'references', 'prompt-template.md'), 'Pure white background.');
  const { s, jobs, ai } = setup(join(dir, 'x.lesson.json'));
  ai.xiaohei = { dir: skill, file: join(skill, 'SKILL.md') };
  s.slides.find((x) => x.id === 'S-3').imageStyle = 'xiaohei';
  assert.equal(jobs.generate('S-3', 'imageDesc'), null);
  const writer = await until(() => ai.open()[0]);
  assert.equal(writer.kind, 'run');
  assert.match(writer.prompt, /What the picture must teach: Timeline from 0 s/);
  assert.match(writer.prompt, /Draw Xiaohei doing the idea\.[\s\S]*references\/prompt-template\.md[\s\S]*Pure white/);
  writer.answer('A hand-drawn Xiaohei holding a stopwatch.');
  assert.equal((await until(() => ai.open()[0])).kind, 'image');
  assert.equal(ai.open()[0].prompt, 'A hand-drawn Xiaohei holding a stopwatch.');
  ai.open()[0].fail(Error('quota'));
  await settle();

  s.wholeLesson = true;
  jobs.send('Use Xiaohei');
  const call = await until(() => ai.open().find((c) => c.tools?.length));
  // The skill comes with its file, so Pi's read tool finds its references; reading is read-only.
  assert.equal(call.reading, true);
  assert.match(call.prompt, /<skill name="ian-xiaohei-illustrations" file="[^"]+SKILL\.md">\nDraw Xiaohei doing/);
  call.answer('ok');
  await settle();
  rmSync(dir, { recursive: true });
});

test('documents: HTML becomes readable text, with slide text kept from scripts; pages and errors', async () => {
  const html = [
    '<html><head><style>.a{color:red}</style></head><body><h1>Deck &amp; notes</h1><ul><li>One</li><li>Two</li></ul>',
    '<img alt="A diagram" src="data:image/png;base64,AAAA"><svg><text>skip me</text></svg>',
    '<script>const slides=[{"title": "Guardrails stop bad actions", "img": "data:image/png;base64,QUJD"},',
    '{"id": "s-1"}, "x.png", "if (a) { b(); }", "<p>Evals score <b>many</b> outputs</p>"];</script></body></html>',
  ].join('');
  const text = htmlText(html);
  assert.match(text, /^# Deck & notes\n\n- One\n- Two\n\[image: A diagram\]/);
  assert.doesNotMatch(text, /color:red|skip me|base64|s-1|x\.png|b\(\)/);
  assert.match(text, /# Text in the page's scripts\n\nGuardrails stop bad actions\n\nEvals score many outputs$/);
  const dir = mkdtempSync(join(tmpdir(), 'lesson-doc-'));
  writeFileSync(join(dir, 'deck.html'), html);
  writeFileSync(join(dir, 'long.md'), 'x'.repeat(45000));
  assert.match(
    await readDocument({ source: 'deck.html' }, dir),
    /^\[deck\.html: characters 0-\d+ of \d+\. This is the end\.\]\n# Deck/,
  );
  assert.match(
    await readDocument({ source: 'long.md' }, dir),
    /characters 0-40000 of 45000\. Call again with offset 40000/,
  );
  assert.match(await readDocument({ source: 'long.md', offset: 40000 }, dir), /characters 40000-45000 of 45000/);
  assert.match(await readDocument({ source: 'missing.html' }, dir), /^Not read: no such file/);
  assert.match(await readDocument({ source: '' }, dir), /^Not read: give a file path/);
  rmSync(dir, { recursive: true });
});

test('documents: artifacts need the configured artifact CLI; links only on the configured host', async (t) => {
  const saved = { cli: process.env.LESSON_MAKER_ARTIFACT_CLI, host: process.env.LESSON_MAKER_ARTIFACT_HOST };
  t.after(() => {
    for (const [key, value] of [['LESSON_MAKER_ARTIFACT_CLI', saved.cli], ['LESSON_MAKER_ARTIFACT_HOST', saved.host]])
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });
  delete process.env.LESSON_MAKER_ARTIFACT_CLI;
  delete process.env.LESSON_MAKER_ARTIFACT_HOST;
  assert.match(await readDocument({ source: 'AbCdEf123456' }), /^Not read: artifacts are unavailable/);
  assert.match(await listArtifacts(), /^Not listed: artifacts are unavailable/);
  // A fake CLI answering the two subcommands Lesson Maker uses, logging its argv.
  const dir = mkdtempSync(join(tmpdir(), 'lesson-artifact-cli-')),
    cli = join(dir, 'artifact-cli'),
    log = join(dir, 'argv');
  writeFileSync(
    cli,
    [
      '#!/bin/sh',
      `echo "$*" >> '${log}'`,
      'if [ "$2" = download ]; then printf "# Notes from the artifact" > "$5"; echo \'{"data":{"contentType":"text/markdown"}}\';',
      'else echo \'{"data":{"files":[{"hostedUrl":"https://files.example/XyZ123456789","filename":"a.md","fileType":"md","uploadedAt":"2026-11-01T00:00:00Z"}]}}\'; fi',
    ].join('\n'),
    { mode: 0o755 },
  );
  process.env.LESSON_MAKER_ARTIFACT_CLI = cli;
  assert.match(await readDocument({ source: 'AbCdEf123456' }), /^\[AbCdEf123456: characters 0-25 of 25\. This is the end\.\]\n# Notes from the artifact$/);
  assert.equal(await listArtifacts({ limit: 5 }), 'https://files.example/XyZ123456789  a.md  md  2026-11-01');
  // Without a host a link is a file path; with it, the link is the artifact.
  assert.match(await readDocument({ source: 'https://files.example/QwErTy123456' }, dir), /^Not read: no such file/);
  process.env.LESSON_MAKER_ARTIFACT_HOST = 'files.example';
  assert.match(await readDocument({ source: 'https://files.example/QwErTy123456/v2' }), /# Notes from the artifact$/);
  const calls = readFileSync(log, 'utf8').trim().split('\n');
  assert.match(calls[0], /^artifacts download AbCdEf123456 --output \S+\/AbCdEf123456 --json$/);
  assert.equal(calls[1], 'artifacts list --no-expired --json --limit 5');
  assert.match(calls[2], /^artifacts download https:\/\/files\.example\/QwErTy123456\/v2 --output \S+ --json$/);
  rmSync(dir, { recursive: true });
});

test('whole-lesson messages sent while it is busy wait, then run together as one request', async () => {
  const s = createState(),
    jobs = createScheduler(s),
    ai = connect(s, jobs);
  s.wholeLesson = true;
  jobs.send('first: recap');
  jobs.send('then pipelines');
  jobs.send('then evals');
  const [first] = ai.open();
  // The running request does not see what is still queued behind it; the queued messages say they wait.
  assert.doesNotMatch(first.prompt, /then pipelines|then evals/);
  assert.equal(s.chat.filter((m) => m.queued).length, 2);
  first.answer('Done the recap.');
  await settle();
  const [next] = ai.open();
  assert.equal(ai.open().length, 1);
  assert.match(next.prompt, /^Request about the whole lesson: then pipelines\n\nthen evals/);
  assert.equal(s.chat.filter((m) => m.queued).length, 0);
  assert.deepEqual(
    s.jobs.map((j) => j.status),
    ['done', 'working', 'merged'],
  );
  next.answer('Done.');
  await settle();
  assert.equal(ai.open().length, 0);
});

test('the live line says what the model is doing: thinking, reading, writing a change', async () => {
  const s = createState(),
    jobs = createScheduler(s),
    ai = connect(s, jobs);
  s.wholeLesson = true;
  jobs.send('outline it from the deck');
  await settle();
  const [call] = ai.open(),
    live = () => s.chat.at(-1).text;
  call.onActivity({ kind: 'thinking' });
  assert.equal(live(), '▸ Thinking…');
  call.onActivity({ kind: 'tool', name: 'read_document', args: { source: 'deck.html' } });
  assert.equal(live(), '▸ Reading deck.html…');
  call.onActivity({ kind: 'tool-done', name: 'read_document', args: { source: 'deck.html' } });
  call.onActivity({ kind: 'writing', name: 'update_lesson', count: 2386 });
  assert.equal(live(), '· Read deck.html\n▸ Rewriting the whole lesson: writing it, 2,386 characters so far');
  call.answer('Done.');
  await settle();
});

test('with no box focused a message is a whole-slide request: only set_slide on its slide, boxes held', async () => {
  const { s, jobs, ai } = setup();
  selectSlide(s, 'S-3');
  s.control = 'layout';
  jobs.send('Tighten this slide');
  await settle();
  const call = ai.open().find((c) => c.tools?.length),
    job = s.jobs.at(-1);
  assert.equal(job.kind, 'slide');
  assert.match(call.prompt, /^Request about one slide, Slide 6 "Trusting a copy for one hour" \(id S-3\)/);
  assert.deepEqual(
    call.tools.map((t) => t.name).filter((n) => !['read_document', 'list_artifacts'].includes(n)),
    ['set_slide', 'picture_prompt', 'generate_picture'],
  );
  // Its boxes are held while it runs; a box request on the same slide waits behind it, another slide's does not.
  assert.match(setField(s, 'S-3', 'notes', 'mine'), /LOCKED/);
  focusField(s, 'notes');
  jobs.send('box after slide');
  assert.equal(s.jobs.at(-1).status, 'queued');
  assert.match(
    await tool(call, 'set_slide').execute({ fields: { title: 'Trust a copy for an hour', purpose: 'P' } }),
    /^Done/,
  );
  assert.equal(slideById(s, 'S-3').title, 'Trust a copy for an hour');
  assert.match(await tool(call, 'generate_picture').execute({ slideId: 'S-4', image: 'image' }), /may only change/);
  call.answer('Tightened it.');
  await settle();
  assert.equal(job.status, 'done');
  assert.equal(s.chat.find((m) => m.role === 'Slide AI')?.text.split('\n')[0], 'Tightened it.');
  // One undo puts the slide back.
  assert.equal(undoOutline(s), null);
  assert.equal(slideById(s, 'S-3').title, 'Trusting a copy for one hour');
  // [whole lesson] makes it a whole-lesson request again; a locked slide refuses a slide request.
  s.control = 'layout';
  s.wholeLesson = true;
  assert.equal(chatAim(s), null);
  s.wholeLesson = false;
  slideById(s, 'S-3').locked = true;
  assert.equal(jobs.send('blocked'), false);
  assert.match(s.notice, /is locked/);
  jobs.dispose();
});

test('every request that can write speaker notes is told they are a spoken script, not points', async () => {
  const { boxPrompt, slidePrompt, lessonPrompt } = await import('../src/prompts.mjs');
  const s = createState(),
    rule = /Speaker notes \(speakerNotes\) are a speech[\s\S]*Never write them as points/;
  assert.match(boxPrompt(s, { slideId: 'S-3', field: 'notes', text: 'x' }), rule);
  assert.match(
    boxPrompt(s, { slideId: 'S-3', field: 'notes', text: 'x' }),
    /What the box is for: The presenter's script/,
  );
  assert.doesNotMatch(boxPrompt(s, { slideId: 'S-3', field: 'purpose', text: 'x' }), rule);
  assert.match(slidePrompt(s, { slideId: 'S-3', text: 'x' }), rule);
  assert.match(lessonPrompt(s, { text: 'x' }), rule);
  // Whole-lesson requests are told that ideas are typed slides, not groups.
  assert.match(
    lessonPrompt(s, { text: 'x' }),
    /Every idea the lesson teaches is a slide inside a group[\s\S]*Initial question/,
  );
});

test('a request on an image box rewrites the concept, then generates its picture in the same request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-')),
    { s, jobs, ai } = setup(join(dir, 'x.lesson.json'));
  selectSlide(s, 'S-3');
  focusField(s, 'imageDesc');
  jobs.send('Show a clock instead');
  await settle();
  const run = ai.open().find((c) => c.kind === 'run');
  assert.match(run.prompt, /A new picture is generated from your reply/);
  run.answer('A wall clock at 3:00 beside a browser window.');
  // The chat model then writes the picture's prompt from the new concept and the whole lesson.
  const writer = await until(() => ai.open().find((c) => c.kind === 'run'));
  assert.match(writer.prompt, /What the picture must teach: A wall clock at 3:00 beside a browser window\./);
  assert.match(writer.prompt, /The lesson:\n\{/);
  writer.answer('A clock face at 3:00 beside a browser tab, flat diagram.');
  const image = await until(() => ai.open().find((c) => c.kind === 'image'));
  assert.equal(image.prompt, 'A clock face at 3:00 beside a browser tab, flat diagram.');
  // The box stays held, and its chat entry says what is happening, until the picture lands.
  assert.equal(s.jobs.at(-1).status, 'working');
  assert.match(s.chat.at(-1).text, /^Image concept rewritten; generating the picture/);
  mkdirSync(dirname(image.outputPath), { recursive: true });
  writeFileSync(image.outputPath, samplePng('clock'));
  image.answer({ file: image.outputPath, model: 'gpt-image-test', prompt: image.prompt });
  await until(() => s.jobs.at(-1).status === 'done');
  assert.equal(s.pictures['S-3'].imageDesc.source, 'generated');
  assert.match(s.chat.at(-1).text, /rewritten, and a new picture generated/);
  // Whole-slide and whole-lesson requests are told to make the pictures they are asked about.
  const { slidePrompt, lessonPrompt } = await import('../src/prompts.mjs');
  for (const prompt of [slidePrompt(s, { slideId: 'S-3', text: 'x' }), lessonPrompt(s, { text: 'x' })])
    assert.match(prompt, /call generate_picture for it yourself: the author will not press generate/);
  rmSync(dir, { recursive: true });
});

// A saved prompt as long as real ones, so leaving it out of the model's lesson is visible.
const SAVED = 'Saved prompt: a flat diagram of a browser cache, with the house style repeated. '.repeat(40);
const withGenerated = (s) => {
  s.pictures['S-3'] = {
    imageDesc: { source: 'generated', file: 'x.lesson.assets/S-3-image.png', prompt: SAVED, model: 'gpt-image-test' },
  };
  // A locked slide with a generated picture must still match exactly after the model's round trip.
  s.pictures['S-4'] = {
    imageDesc: { source: 'generated', file: 'x.lesson.assets/S-4-image.png', prompt: SAVED + '4', model: 'm' },
  };
  slideById(s, 'S-4').locked = true;
};
const lessonIn = (prompt) => JSON.parse(prompt.split('The lesson now:\n')[1].split('\n\nThe lesson JSON Schema:')[0]);

test('saved picture prompts stay out of every prompt; update_lesson and set_slides keep them', async () => {
  const { s, jobs, ai } = setup();
  withGenerated(s);
  // The file still records them; the model's lesson has the picture, its file and model, but not its prompt.
  assert.equal(toDoc(s).sections[1].subsections[0].slides[0].image.picture.prompt, SAVED);
  for (const prompt of [lessonPrompt(s, { text: 'x' }), slidePrompt(s, { slideId: 'S-3', text: 'x' })]) {
    assert.ok(!prompt.includes('Saved prompt:'));
    assert.match(prompt, /"file": "x\.lesson\.assets\/S-3-image\.png",\n *"model": "gpt-image-test"/);
    assert.match(prompt, /leave out the prompt they were made from[^\n]*picture_prompt/);
  }
  const call = await lessonCall(s, jobs, ai, 'Retitle slide 6');
  assert.ok(!call.prompt.includes('Saved prompt:'));
  // The model sends back the lesson as it saw it, with one change: the prompts are absent, so they are unchanged.
  const lesson = lessonIn(call.prompt);
  lesson.sections[1].subsections[0].slides[0].title = 'Retitled';
  assert.match(await tool(call, 'claim_slides').execute({ all: true }), /^Claimed the whole lesson/);
  assert.match(await tool(call, 'update_lesson').execute({ lesson }), /^Done: Rewrote the lesson/);
  assert.equal(slideById(s, 'S-3').title, 'Retitled');
  assert.equal(s.pictures['S-3'].imageDesc.prompt, SAVED);
  assert.equal(s.pictures['S-4'].imageDesc.prompt, SAVED + '4');
  assert.equal(s.provenance['S-3:imageDesc'], undefined);
  // A prompt the model makes up is not one this lesson has.
  const forged = lessonIn(call.prompt);
  forged.sections[1].subsections[0].slides[0].image.picture.prompt = 'invented';
  assert.match(await tool(call, 'update_lesson').execute({ lesson: forged }), /not one this lesson has/);
  assert.match(
    await tool(call, 'set_slides').execute({ changes: [{ id: 'S-3', fields: { image: { concept: 'New concept' } } }] }),
    /^Done/,
  );
  assert.equal(slideById(s, 'S-3').imageDesc, 'New concept');
  assert.equal(toDoc(s).sections[1].subsections[0].slides[0].image.picture.prompt, SAVED);
  assert.deepEqual(validateLesson(toDoc(s)), []);
  call.answer('Done.');
  await settle();
});

test('a whole-slide request keeps picture prompts through set_slide', async () => {
  const { s, jobs, ai } = setup();
  withGenerated(s);
  selectSlide(s, 'S-3');
  s.control = 'layout';
  jobs.send('Make the image about stale copies');
  await settle();
  const call = ai.open().find((c) => c.tools?.length);
  assert.ok(!call.prompt.includes('Saved prompt:'));
  assert.match(
    await tool(call, 'set_slide').execute({ fields: { title: 'Stale copies', image: { concept: 'A stale copy' } } }),
    /^Done/,
  );
  assert.equal(s.pictures['S-3'].imageDesc.prompt, SAVED);
  assert.equal(s.pictures['S-3'].imageDesc.model, 'gpt-image-test');
  call.answer('Done.');
  await settle();
});

test('picture_prompt reads a saved prompt for whole-lesson and whole-slide requests', async () => {
  const { s, jobs, ai } = setup();
  withGenerated(s);
  const call = await lessonCall(s, jobs, ai, 'What does the slide 6 picture show?');
  const read = tool(call, 'picture_prompt');
  assert.equal(await read.execute({ slideId: 'S-3', image: 'image' }), `Model: gpt-image-test\nPrompt:\n${SAVED}`);
  assert.match(await read.execute({ slideId: 'S-3', image: 'afterImage' }), /^Slide 6 "[^"]+" has no after picture$/);
  const attached = Object.keys(s.pictures).find((id) => s.pictures[id].imageDesc?.source === 'attached');
  assert.match(await read.execute({ slideId: attached, image: 'image' }), /is an attached file: it has no prompt$/);
  assert.equal(await read.execute({ slideId: 'S-99', image: 'image' }), 'No such slide or image');
  assert.equal(await read.execute({ slideId: 'S-3', image: 'banner' }), 'No such slide or image');
  call.onActivity({ kind: 'tool-done', name: 'picture_prompt', args: { slideId: 'S-3', image: 'image' } });
  call.answer('It shows a cache.');
  await settle();
  // Listed with what the request read, not with its changes.
  assert.match(s.chat.at(-1).text, /· Read the saved prompt of Slide 6 "[^"]+"'s picture/);
  selectSlide(s, 'S-3');
  s.control = 'layout';
  s.wholeLesson = false;
  jobs.send('Describe the picture');
  await settle();
  const slideCall = ai.open().find((c) => c.tools?.length);
  assert.match(await tool(slideCall, 'picture_prompt').execute({ slideId: 'S-3', image: 'image' }), /Saved prompt:/);
  slideCall.answer('ok');
  await settle();
});
