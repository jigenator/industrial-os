import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { samplePng } from '../src/png.mjs';
import { exampleDoc } from '../src/seed.mjs';
import { render, plainFrame } from '../src/render.mjs';
import assert from 'node:assert/strict';
import {
  createState,
  order,
  owners,
  slideById,
  slideName,
  selectSlide,
  focusField,
  targetLabel,
  setField,
  setChoice,
  saveEdit,
  editRevision,
  focusedBox,
  formFields,
  keyOf,
  renameOwner,
  createItem,
  moveItem,
  undoOutline,
  activeFields,
  outlineRows,
  setLocks,
  deleteSlide,
  deleteGroup,
  placeSlide,
  placeGroup,
  setPicture,
  applyLesson,
  editLocked,
  chatAim,
} from '../src/model.mjs';
import { TYPES, LAYOUTS } from '../src/seed.mjs';
import { createScheduler, boxReply, PICTURES_AT_ONCE } from '../src/scheduler.mjs';
import { fakeAi, settle, until, connect } from './fake-ai.mjs';
import { toDoc, validateLesson } from '../src/lesson.mjs';
import { createController } from '../src/controller.mjs';
const setup = () => {
  const s = createState(),
    jobs = createScheduler(s),
    ai = connect(s, jobs);
  return { s, ai, jobs };
};
// Answers every open model request with the same text and lets the results land.
const answerAll = async (ai, text) => {
  for (const call of ai.open()) call.answer(text);
  await settle();
};
test('v19 seed: exact hierarchy, order, linked titles, all layouts and seven Types', () => {
  const s = createState(),
    all = order(s);
  // The state holds exactly the example file, and turns back into it.
  assert.deepEqual(toDoc(s), exampleDoc());
  assert.equal(
    createHash('sha256')
      .update(JSON.stringify(toDoc(s)))
      .digest('hex'),
    '12a8bc75ada88ebe0e28636174672cf44b11e79f78a7e7cba9fa052ce616dba8',
  );
  assert.equal(s.sections.length, 3);
  assert.equal(owners(s).length, 5);
  assert.equal(all.length, 12);
  assert.equal(all.filter((x) => x.titleFor).length, 5);
  assert.deepEqual(
    all.map((x) => x.title),
    [
      'Why browsers keep copies',
      'Why is the second visit faster?',
      'A nearby copy beats a faraway trip',
      'How the browser decides',
      'Worked examples',
      'Trusting a copy for one hour',
      'Asking cheaply when the copy expires',
      'Learner practice and feedback',
      'Your turn: pick a setting',
      'Compare with a reasoned answer',
      'Transfer',
      'Same idea elsewhere',
    ],
  );
  assert.deepEqual(new Set(all.map((x) => x.layout)), new Set(LAYOUTS));
  assert.deepEqual(new Set(all.map((x) => x.type)), new Set(TYPES));
  assert.equal(all[5].content, 'With max-age=3600 the browser reuses its copy for one hour without asking.');
  // Its key points moved to the top of its notes when KEY POINTS was removed.
  assert.equal(
    all[5].notes,
    'Key points:\nmax-age sets a freshness window\n\nPause and ask learners what they expect at second 3601.',
  );
  assert.equal(all[9].afterDesc, 'Logo with max-age one year; news feed with validate on every visit.');
  assert.match(s.principles.progression, /4\. When trust expires, ask cheaply/);
  for (const owner of owners(s)) {
    const linked = all.find((x) => x.titleFor === owner.id);
    assert.equal(linked.title, owner.title);
    assert.equal(all.filter((x) => (x.subId || x.secId) === owner.id)[0], linked);
  }
});
test('inline edits save, a busy box refuses, a changed base asks; off a box the chat aims at the slide', async () => {
  const { s, jobs, ai } = setup();
  selectSlide(s, 'S-3');
  focusField(s, 'purpose');
  const stamp = targetLabel(s),
    box = { slideId: 'S-3', field: 'purpose' };
  assert.equal(saveEdit(s, { ...box, text: 'A clear purpose', base: editRevision(s, box) }), null);
  assert.equal(slideById(s, 'S-3').purpose, 'A clear purpose');
  const edit = { ...box, text: 'Local text', base: editRevision(s, box) };
  jobs.send('change saved purpose');
  assert.match(saveEdit(s, edit), /Locked/);
  await answerAll(ai, 'Agent purpose');
  assert.equal(slideById(s, 'S-3').purpose, 'Agent purpose');
  assert.equal(saveEdit(s, edit), 'BASE CHANGED');
  assert.equal(saveEdit(s, edit, true), null);
  assert.equal(slideById(s, 'S-3').purpose, 'Local text');
  assert.equal(stamp, 'Slide 6 "Trusting a copy for one hour" / Teaching purpose');
  // On a control, not a box, the chat aims at the whole slide; on another slide, at that one.
  s.control = 'layout';
  assert.equal(targetLabel(s), 'Slide 6 "Trusting a copy for one hour"');
  selectSlide(s, 'S-4');
  assert.deepEqual(chatAim(s), { slideId: 'S-4' });
});
test('linked rename both directions, editable linked Type/layout, group moves carry descendants', () => {
  const s = createState(),
    linked = s.slides.find((x) => x.titleFor === 'SEC-2');
  assert.equal(renameOwner(s, 'SEC-2', 'New section'), null);
  assert.equal(linked.title, 'New section');
  setField(s, linked.id, 'title', 'From heading');
  assert.equal(s.sections[1].title, 'From heading');
  selectSlide(s, linked.id);
  assert.equal(setChoice(s, 'layout', 'statement'), null);
  assert.equal(setChoice(s, 'type', 'Feedback'), null);
  assert.match(moveItem(s, linked.id, 1), /cannot|Linked/);
  const group = order(s)
    .filter((x) => x.secId === 'SEC-2')
    .map((x) => x.id);
  assert.equal(moveItem(s, 'SEC-2', -1), null);
  assert.deepEqual(
    order(s)
      .slice(0, group.length)
      .map((x) => x.id),
    group,
  );
  assert.equal(order(s)[0].id, linked.id);
  undoOutline(s);
  assert.equal(s.sections[1].id, 'SEC-2');
});
test('moves across groups, boundaries, structural undo preserves unrelated edits and target identity', () => {
  const s = createState();
  selectSlide(s, 'S-3');
  focusField(s, 'content');
  const target = chatAim(s);
  assert.match(moveItem(s, 'S-3', -1), /boundary/);
  assert.equal(moveItem(s, 'S-3', 1), null);
  setField(s, 'S-2', 'notes', 'Unrelated author work');
  assert.equal(undoOutline(s), null);
  assert.equal(slideById(s, 'S-2').notes, 'Unrelated author work');
  assert.equal(moveItem(s, 'S-3', 0, 'SEC-3'), null);
  assert.equal(order(s).at(-1).id, 'S-3');
  assert.deepEqual(chatAim(s), target);
  const n = s.undo.length;
  assert.match(moveItem(s, 'S-3', 0, 'SEC-3'), /nothing/);
  assert.equal(s.undo.length, n);
  undoOutline(s);
  assert.equal(slideById(s, 'S-3').subId, 'SUB-3');
});
test('create all kinds, prohibit deeper nesting; destructive undo confirms and cancels removed jobs', async () => {
  const { s, jobs } = setup();
  createItem(s, 'subsection', 'SUB-3', 'Sibling');
  const group = s.sections[1].subs.at(-1);
  assert.equal(group.title, 'Sibling');
  assert.equal(group.subs, undefined);
  const id = s.selected;
  setField(s, id, 'notes', 'Authored');
  focusField(s, 'notes');
  jobs.send('change');
  // Content edit did not create structural undo. Creation undo must remove it explicitly.
  const warning = undoOutline(s);
  assert.match(warning, /CONFIRM.*removes 1 slides/);
  assert.ok(slideById(s, id));
  assert.equal(
    undoOutline(s, true, (removed) => jobs.cancel('Stopped: slide removed', removed)),
    null,
  );
  await settle();
  assert.equal(slideById(s, id), undefined);
  assert.notEqual(chatAim(s)?.slideId, id);
  assert.equal(jobs.running, 0);
  createItem(s, 'section', null, 'New section');
  assert.equal(s.sections.at(-1).title, 'New section');
  createItem(s, 'slide', s.sections.at(-1).id, 'Ordinary');
  assert.ok(!slideById(s, s.selected).titleFor);
});
test('undo rename warns before overwriting a newer agent rename, busy linked owner locks', async () => {
  const { s, jobs, ai } = setup();
  const x = s.slides.find((x) => x.titleFor === 'SEC-1');
  renameOwner(s, 'SEC-1', 'Manual name');
  selectSlide(s, x.id);
  focusField(s, 'title');
  jobs.send('agent name');
  assert.match(renameOwner(s, 'SEC-1', 'Blocked'), /LOCKED/);
  await answerAll(ai, 'Agent name');
  assert.equal(x.title, 'Agent name');
  assert.match(undoOutline(s), /CONFIRM.*Newer name/);
  assert.equal(undoOutline(s, true), null);
  assert.equal(x.title, 'Why browsers keep copies');
});
test('box requests: FIFO per box on the latest text, parallel across boxes, locking, AI EDIT, stamps', async () => {
  const { s, jobs, ai } = setup();
  selectSlide(s, 'S-3');
  focusField(s, 'content');
  jobs.send('first');
  const stamp = s.chat[0].stamp;
  jobs.send('second');
  focusField(s, 'notes');
  jobs.send('parallel');
  assert.deepEqual(
    s.jobs.map((j) => j.status),
    ['working', 'queued', 'working'],
  );
  assert.match(setField(s, 'S-3', 'content', 'blocked'), /LOCKED/);
  assert.equal(setField(s, 'S-3', 'purpose', 'unrelated'), null);
  // The request carries the model, the box, what it is for and the whole lesson.
  assert.equal(ai.calls[0].model, 'test/fast');
  assert.match(ai.calls[0].prompt, /Slide 6 "Trusting a copy for one hour", box "Sentence"/);
  assert.match(ai.calls[0].prompt, /Request: first/);
  assert.match(ai.calls[0].prompt, /"schemaVersion": 1/);
  ai.calls[0].answer('```\nFirst text\n```');
  ai.calls[1].answer('Notes text');
  await settle();
  assert.equal(slideById(s, 'S-3').content, 'First text');
  assert.equal(slideById(s, 'S-3').notes, 'Notes text');
  assert.equal(s.provenance['S-3:content'], 'AI EDIT');
  // The queued request starts only now, from the first one's result.
  assert.equal(s.jobs[1].status, 'working');
  assert.match(ai.calls[2].prompt, /<<<\nFirst text\n>>>/);
  ai.calls[2].answer('Second text');
  await settle();
  assert.equal(slideById(s, 'S-3').content, 'Second text');
  assert.ok(s.chat.some((m) => m.text === 'Done: Sentence rewritten.'));
  selectSlide(s, 'S-4');
  assert.equal(s.chat[0].stamp, stamp);
  // A failed request leaves the box as it was and says why.
  focusField(s, 'notes');
  jobs.send('fail');
  ai.open()[0].fail(Error('rate limited'));
  await settle();
  assert.match(s.chat.at(-1).text, /^Failed: rate limited/);
  jobs.dispose();
  assert.equal(jobs.running, 0);
  assert.equal(boxReply('<<<\nx\n>>>'), 'x');
});
test('a whole-lesson request locks everything, validates update_lesson, marks AI edits, and undoes', async () => {
  const { s, jobs, ai } = setup();
  selectSlide(s, 'S-3');
  focusField(s, 'notes');
  jobs.send('box first');
  s.wholeLesson = true;
  jobs.send('Make slide 6 shorter and add a recap slide');
  // It waits for the running box request, and meanwhile everything is locked.
  assert.equal(s.jobs[1].status, 'queued');
  assert.match(setField(s, 'S-4', 'notes', 'x'), /LOCKED/);
  assert.match(createItem(s, 'section', null, 'x'), /Locked: the lesson agent/);
  Object.assign(s, { control: null, formScroll: 0, formFollow: false });
  assert.match(plainFrame(render(s, 150, 70)), /SLIDE NAME ─+ {2}▒ WORKING/);
  await answerAll(ai, 'Box notes');
  const call = ai.open()[0];
  assert.deepEqual(
    call.tools.map((tool) => tool.name),
    [
      'delete_items',
      'add_slide',
      'add_group',
      'move_items',
      'set_slides',
      'set_plan',
      'update_lesson',
      'claim_slides',
      'picture_prompt',
      'generate_picture',
      'read_document',
      'list_artifacts',
    ],
  );
  assert.match(call.prompt, /The lesson JSON Schema/);
  const update = call.tools.find((tool) => tool.name === 'update_lesson');
  await call.tools.find((tool) => tool.name === 'claim_slides').execute({ all: true });
  const doc = toDoc(s);
  doc.sections[1].subsections[0].slides[0].text = 'Short.';
  delete doc.sections[0].slides[0].purpose;
  assert.match(
    await update.execute({ lesson: doc }),
    /Not applied[\s\S]*\/sections\/0\/slides\/0 is missing required "purpose"/,
  );
  doc.sections[0].slides[0].purpose = '';
  doc.sections[0].slides[0].image.picture = { source: 'attached', file: 'invented.png' };
  assert.match(await update.execute({ lesson: doc }), /invented\.png is not one this lesson has/);
  doc.sections[0].slides[0].image.picture = null;
  doc.sections[2].slides.push({ ...structuredClone(doc.sections[2].slides[0]), id: 'S-8', title: 'Recap' });
  assert.deepEqual(validateLesson(doc), []);
  assert.match(await update.execute({ lesson: doc }), /^Done: Rewrote the lesson/);
  assert.equal(slideById(s, 'S-3').content, 'Short.');
  assert.equal(slideById(s, 'S-8').title, 'Recap');
  assert.equal(s.provenance['S-3:content'], 'AI EDIT');
  assert.equal(slideById(s, 'S-1').purpose, '');
  call.answer('Shortened slide 6 and added a recap.');
  await settle();
  assert.match(s.chat.at(-1).text, /^Shortened slide 6.*\n· Claimed the whole lesson\n· Rewrote the lesson\n\[u in the outline undoes/);
  assert.equal(setField(s, 'S-4', 'notes', 'free again'), null);
  // Undo in the outline puts the whole lesson back.
  assert.equal(undoOutline(s), null);
  assert.equal(slideById(s, 'S-8'), undefined);
  assert.match(slideById(s, 'S-3').content, /max-age=3600/);
});
test('generate makes a picture with imagegen into the lesson folder, recording prompt and model', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-')),
    lessonPath = join(dir, 'my lesson.lesson.json');
  const s = createState(),
    jobs = createScheduler(s, { lessonPath }),
    ai = connect(s, jobs);
  assert.match(jobs.generate('S-1', 'content'), /Not an image box/);
  assert.match(jobs.generate('S-1', 'imageDesc'), /concept/);
  // The chat model writes the prompt with the whole lesson, at the chosen effort; its context use is kept.
  s.ai.effort = 'high';
  assert.equal(jobs.generate('S-3', 'imageDesc'), null);
  assert.match(setField(s, 'S-3', 'imageDesc', 'x'), /LOCKED/);
  const writer = ai.open()[0];
  assert.deepEqual([writer.kind, writer.effort, writer.model], ['run', 'high', 'test/fast']);
  assert.match(writer.prompt, /What the picture must teach: Timeline from 0 s to 3600 s/);
  assert.match(writer.prompt, /flat, clean diagram/);
  assert.match(writer.prompt, /"title": "Caching on the web"|The lesson:\n\{/);
  writer.answer({ text: 'A timeline, 0 s to 3600 s.', context: { tokens: 5000, contextWindow: 200000, percent: 2.5 } });
  await until(() => ai.open()[0]?.kind === 'image');
  const call = ai.open()[0];
  assert.equal(s.ai.context.percent, 2.5);
  assert.deepEqual([call.prompt, call.effort], ['A timeline, 0 s to 3600 s.', 'high']);
  assert.match(call.outputPath, /my-lesson\.lesson\.assets\/S-3-image-\w+\.png$/);
  mkdirSync(dirname(call.outputPath), { recursive: true });
  writeFileSync(call.outputPath, samplePng('etag'));
  call.answer({ file: call.outputPath, model: 'gpt-image-test', prompt: call.prompt });
  await until(() => /^Done/.test(s.notice));
  const picture = s.pictures['S-3'].imageDesc;
  assert.match(s.notice, /^Done: picture generated/);
  assert.equal(picture.source, 'generated');
  assert.equal(picture.model, 'gpt-image-test');
  assert.ok(picture.bytes.length > 0);
  assert.deepEqual(toDoc(s).sections[1].subsections[0].slides[0].image.picture, {
    source: 'generated',
    file: picture.file,
    prompt: call.prompt,
    model: 'gpt-image-test',
  });
  assert.equal(undoOutline(s), null);
  assert.equal(s.pictures['S-3'].imageDesc.source, 'attached');
  rmSync(dir, { recursive: true });
});
test('review stops requests at once and blocks all changes; stopped requests never resume', async () => {
  const { s, jobs } = setup();
  focusField(s, 'content');
  jobs.send('one');
  jobs.send('two');
  const saved = slideById(s, s.selected).content;
  jobs.setReview(true);
  await settle();
  assert.equal(jobs.running, 0);
  assert.equal(slideById(s, s.selected).content, saved);
  assert.match(s.chat.at(-1).text, /Stopped by review-only/);
  for (const error of [
    setField(s, s.selected, 'notes', 'x'),
    setChoice(s, 'type', TYPES[1]),
    moveItem(s, 'S-2', 1),
    createItem(s, 'section', null, 'x'),
    undoOutline(s),
  ])
    assert.match(error, /Review-only/);
  assert.equal(jobs.send('still read only'), false);
  assert.match(s.notice, /Review-only/);
  jobs.setReview(false);
  await settle();
  assert.equal(jobs.running, 0);
});
test('sending waits for Pi: not connected keeps the draft and says why', () => {
  const s = createState(),
    jobs = createScheduler(s);
  focusField(s, 'content');
  assert.equal(jobs.send('hello'), false);
  assert.match(s.notice, /not|connecting/i);
  s.ai.status = 'error';
  s.ai.message = 'Pi was not found on PATH';
  assert.equal(jobs.send('hello'), false);
  assert.match(s.notice, /AI unavailable: Pi was not found/);
  assert.equal(s.chat.length, 0);
});
test('keyboard core task: type in boxes, leaving saves, shortcuts stay literal, focused sends and return', async () => {
  const { s, jobs, ai } = setup(),
    c = createController(s, jobs);
  selectSlide(s, 'S-3');
  // Tab starts at the speaker notes, the first box under the slide, then the comments, then the slide's own boxes.
  c.handle({ key: 'tab' });
  assert.equal(s.control, 'notes');
  c.handle({ key: 'tab' });
  assert.equal(s.control, 'comments');
  c.handle({ key: 'tab' });
  assert.equal(s.control, formFields(slideById(s, 'S-3'))[0]);
  focusField(s, 'purpose');
  const purpose = slideById(s, 'S-3').purpose;
  c.handle({ key: 'text', text: ' now' });
  assert.equal(slideById(s, 'S-3').purpose, purpose);
  c.handle({ key: 'tab' });
  assert.equal(slideById(s, 'S-3').purpose, purpose + ' now');
  // Tab follows the fixed form: after the teaching plan come the images, each followed by its border's buttons, the
  // style dropdown first.
  assert.equal(s.control, 'imageDesc');
  c.handle({ key: 'tab' });
  assert.equal(s.control, 'style:imageDesc');
  c.handle({ key: 'enter' });
  assert.equal(s.modal.kind, 'style');
  c.handle({ key: 'down' });
  c.handle({ key: 'enter' });
  assert.equal(s.modal, null);
  assert.equal(slideById(s, 'S-3').imageStyle, 'xiaohei');
  assert.equal(toDoc(s).sections[1].subsections[0].slides[0].image.style, 'xiaohei');
  c.handle({ key: 'tab' });
  assert.equal(s.control, 'generate:imageDesc');
  focusField(s, 'notes');
  c.handle({ key: 'text', text: 'q?v[' });
  assert.equal(s.modal, null);
  assert.equal(s.view, 'workspace');
  assert.equal(s.selected, 'S-3');
  c.handle({ key: 'escape' });
  assert.equal(s.control, null);
  assert.match(slideById(s, 'S-3').notes, /q\?v\[$/);
  s.control = 'layout';
  s.choice = 0;
  c.handle({ key: 'enter' });
  assert.equal(slideById(s, s.selected).layout, 'points-image');
  focusField(s, 'imageDesc');
  c.handle({ key: 'text', text: ' (v2)' });
  c.handle({ key: 'ctrl-g' });
  assert.equal(s.pane, 'chat');
  assert.match(slideById(s, s.selected).imageDesc, / \(v2\)$/);
  c.handle({ key: 'text', text: 'qvm012?' });
  assert.equal(s.chatDraft, 'qvm012?');
  c.handle({ key: 'enter' });
  assert.equal(s.pane, 'chat');
  c.handle({ key: 'ctrl-g' });
  assert.deepEqual(focusedBox(s), { slideId: 'S-3', field: 'imageDesc' });
  c.handle({ key: 'text', text: 'x' });
  assert.equal(s.edit, null);
  assert.match(s.notice, /read only/);
  focusField(s, 'notes');
  c.handle({ key: 'ctrl-g' });
  s.chatDraft = 'second box';
  c.handle({ key: 'enter' });
  assert.equal(s.jobs.filter((j) => j.status === 'working').length, 2);
  await answerAll(ai, 'AI text');
  assert.equal(slideById(s, s.selected).notes, 'AI text');
  assert.equal(slideById(s, s.selected).imageDesc, 'AI text');
});
test('quit asks only while requests run; review toggles; small diagnostic has no mutation', () => {
  const { s, jobs } = setup();
  let exits = 0;
  const c = createController(s, jobs, { exit: () => exits++ });
  focusField(s, 'notes');
  jobs.send('running');
  s.control = null;
  c.handle({ key: 'text', text: 'q' });
  assert.match(s.modal.title, /stop 1 AI request/);
  assert.equal(s.modal.index, 0);
  c.handle({ key: 'enter' });
  assert.equal(exits, 0);
  s.control = 'review';
  c.handle({ key: 'enter' });
  assert.equal(s.review, true);
  c.handle({ key: 'text', text: 'q' });
  assert.equal(exits, 1);
  // A file that broke the schema stays read only: the review switch shows its errors instead.
  s.file.readOnly = true;
  s.file.errors = [{ path: '/plan', message: 'is missing required "outcomes"' }];
  s.control = 'review';
  c.handle({ key: 'enter' });
  assert.equal(s.review, true);
  assert.match(s.modal.lines.join('\n'), /\/plan is missing required "outcomes"/);
  s.modal = null;
  const before = JSON.stringify(s);
  c.handle({ key: 'text', text: 'v' }, { small: true });
  assert.equal(JSON.stringify(s), before);
  c.handle({ key: 'text', text: 'q' }, { small: true });
  assert.equal(exits, 2);
});
test('sentence warning, chat anchor and model picker, and plan tab keys', () => {
  const { s, jobs } = setup(),
    c = createController(s, jobs);
  selectSlide(s, 'S-3');
  focusField(s, 'content');
  c.handle({ key: 'text', text: ' Second one.' });
  c.handle({ key: 'ctrl-s' });
  assert.equal(s.control, 'content');
  assert.match(s.notice, /more than one sentence/);
  // Enter is a new line in every box, the title too; one-line places show the name with a space.
  focusField(s, 'title');
  c.handle({ key: 'enter' });
  c.handle({ key: 'text', text: 'again' });
  c.handle({ key: 'ctrl-s' });
  assert.match(slideById(s, 'S-3').title, /\nagain$/);
  assert.match(slideName(slideById(s, 'S-3')), / again$/);
  focusField(s, 'purpose');
  c.handle({ key: 'enter' });
  assert.equal(s.edit.text.at(-1), '\n');
  c.handle({ key: 'escape' });
  // The plan's parts are top-bar tabs: Left and Right step through them, Tab enters the part's box.
  s.view = 'plan';
  s.planIndex = 3;
  s.control = null;
  c.handle({ key: 'right' });
  assert.equal(s.planIndex, 0);
  c.handle({ key: 'tab' });
  assert.deepEqual(focusedBox(s), { principle: true, field: 'outcomes' });
  c.handle({ key: 'text', text: '!' });
  c.handle({ key: 'escape' });
  assert.equal(s.control, null);
  assert.match(s.principles.outcomes, /!$/);
  c.handle({ key: 'ctrl-g' });
  s.chatDraft = 'test';
  c.handle({ key: 'enter' });
  c.handle({ key: 'tab' });
  assert.equal(s.chatMode, 'transcript');
  c.handle({ key: 'home' });
  const anchor = s.chatAnchor;
  jobs.send('new');
  assert.equal(s.chatAnchor, anchor);
  assert.ok(s.chatNew > 0);
  c.handle({ key: 'end' });
  assert.equal(s.chatAnchor, null);
  c.handle({ key: 'tab' });
  assert.equal(s.chatMode, 'effort');
  c.handle({ key: 'enter' });
  assert.deepEqual(
    s.modal.options.map((o) => o.key),
    ['low', 'medium', 'high'],
  );
  c.handle({ key: 'down' });
  c.handle({ key: 'down' });
  c.handle({ key: 'enter' });
  assert.equal(s.ai.effort, 'high');
  c.handle({ key: 'tab' });
  assert.equal(s.chatMode, 'models');
  c.handle({ key: 'enter' });
  assert.equal(s.modal.kind, 'models');
  assert.deepEqual(
    s.modal.options.map((o) => o.key),
    ['test/fast', 'test/careful'],
  );
  c.handle({ key: 'down' });
  c.handle({ key: 'enter' });
  assert.equal(s.ai.model, 'test/careful');
  c.handle({ key: 'tab' });
  c.handle({ key: 'enter' });
  assert.equal(chatAim(s), null);
  jobs.dispose();
});

test('collapse anchors interior and final descendants to their owner for expand, open and rename', () => {
  for (const [slideId, ownerId] of [
    ['S-3', 'SUB-3'],
    ['S-4', 'SUB-3'],
    ['S-7', 'SEC-3'],
  ]) {
    const { s, jobs } = setup();
    const controller = createController(s, jobs);
    s.pane = 'outline';
    s.outlineCursor = outlineRows(s).findIndex((row) => row.id === slideId);
    s.outlineScroll = s.outlineCursor;
    const viewport = { outlineRows: 12 };
    const visibleRows = viewport.outlineRows;

    controller.handle({ key: 'left' }, viewport);
    let rows = outlineRows(s);
    assert.equal(rows[s.outlineCursor].id, ownerId);
    assert.ok(s.collapsed.includes(ownerId));
    assert.ok(s.outlineCursor >= 0 && s.outlineCursor < rows.length);
    assert.ok(s.outlineScroll >= 0 && s.outlineScroll <= Math.max(0, rows.length - visibleRows));
    assert.ok(s.outlineCursor >= s.outlineScroll && s.outlineCursor < s.outlineScroll + visibleRows);

    controller.handle({ key: 'right' }, viewport);
    assert.equal(outlineRows(s)[s.outlineCursor].id, ownerId);
    assert.ok(!s.collapsed.includes(ownerId));
    controller.handle({ key: 'enter' }, viewport);
    assert.equal(slideById(s, s.selected).titleFor, ownerId);

    s.pane = 'outline';
    s.outlineCursor = outlineRows(s).findIndex((row) => row.id === slideId);
    controller.handle({ key: 'left' }, viewport);
    controller.handle({ key: 'text', text: 'r' }, viewport);
    assert.equal(s.modal.kind, 'rename');
    assert.equal(s.modal.id, ownerId);
    s.modal.input = 'Owner renamed after collapse';
    controller.handle({ key: 'enter' }, viewport);
    assert.equal(s.slides.find((slide) => slide.titleFor === ownerId).title, 'Owner renamed after collapse');
    controller.dispose();
    jobs.dispose();
  }
});

test("a working image box's border buttons are grey and do nothing; Tab skips them", async () => {
  const { s, jobs } = setup();
  selectSlide(s, 'S-3');
  const c = createController(s, jobs);
  const footer = () => {
    Object.assign(s, { control: 'imageDesc', formScroll: 99, formFollow: false });
    return render(s, 196, 50).hits.filter((h) => h.box?.field === 'imageDesc' || h.field === 'imageDesc');
  };
  assert.ok(footer().some((h) => h.act === 'generate'));
  focusField(s, 'imageDesc');
  jobs.send('Make the concept shorter');
  s.edit = null;
  const hits = footer();
  assert.ok(!hits.some((h) => ['style', 'generate', 'prompt', 'attach'].includes(h.act)));
  assert.ok(hits.filter((h) => h.act === 'field-busy').length >= 5);
  // Tab goes from the purpose box past the locked box and its buttons to the header.
  s.control = 'purpose';
  c.handle({ key: 'tab' });
  assert.equal(s.control, 'view');
  // A button still focused from before refuses.
  s.control = 'style:imageDesc';
  c.handle({ key: 'enter' });
  assert.equal(s.modal, null);
  assert.match(s.notice, /locked: an AI request is working on it/);
});

test('a locked slide: nobody changes, moves or deletes it, by hand, by undo or by any agent change', () => {
  const s = createState();
  assert.equal(setField(s, 'S-1', 'title', 'Before the lock'), null);
  assert.equal(setLocks(s, ['S-1'], true), null);
  const frozen = /Slide 2 "Before the lock" is locked/;
  // By hand: text, choices, picture, moves, deletes, and the groups that hold it.
  assert.match(setField(s, 'S-1', 'content', 'x'), frozen);
  assert.match(setField(s, 'S-1', 'content', 'x', { agent: true }), frozen);
  assert.match(setChoice(s, 'layout', 'title', 'S-1'), frozen);
  assert.match(setPicture(s, 'S-1', 'imageDesc', { name: 'a.png' }), frozen);
  assert.match(moveItem(s, 'S-1', 1), frozen);
  assert.match(placeSlide(s, 'S-1', 'SEC-3'), frozen);
  assert.match(deleteSlide(s, 'S-1'), frozen);
  assert.match(deleteGroup(s, 'SEC-1'), frozen);
  assert.match(placeGroup(s, 'SEC-1', 'SEC-3'), frozen);
  // Its rename from before the lock cannot be undone either; the slides around it still move.
  assert.match(undoOutline(s), /Cannot undo .*locked/);
  assert.equal(moveItem(s, 'S-2', -1), null);
  // Its boxes take no focus.
  selectSlide(s, 'S-1');
  focusField(s, 'title');
  assert.equal(focusedBox(s), null);
  assert.ok(editLocked(s, { slideId: 'S-1', field: 'title' }));
  // Agents: any change to it, a move to another group, deleting it or locking a new slide is refused.
  const tryDoc = (change) => {
    const doc = toDoc(s);
    change(doc);
    return applyLesson(s, doc);
  };
  assert.match(tryDoc((d) => (d.sections[0].slides.find((x) => x.id === 'S-1').text = 'x'))[0], /S-1.*locked/);
  assert.match(
    tryDoc((d) =>
      d.sections[2].slides.push(
        d.sections[0].slides.splice(
          d.sections[0].slides.findIndex((x) => x.id === 'S-1'),
          1,
        )[0],
      ),
    )[0],
    /locked/,
  );
  assert.match(tryDoc((d) => (d.sections[0].slides = d.sections[0].slides.filter((x) => x.id !== 'S-1')))[0], /locked/);
  assert.match(tryDoc((d) => (d.sections[2].slides[0].locked = true))[0], /only the author/);
  // Keys in another order are the same slide; a change elsewhere goes through.
  const ok = tryDoc((d) => {
    const i = d.sections[0].slides.findIndex((x) => x.id === 'S-1');
    d.sections[0].slides[i] = Object.fromEntries(Object.entries(d.sections[0].slides[i]).reverse());
    d.sections[2].slides[0].text = 'Changed by the agent';
  });
  assert.equal(ok.changed, 1);
  assert.equal(slideById(s, 'S-1').locked, true);
  // Undoing that agent change leaves the locked slide as it is, so it is allowed.
  assert.equal(undoOutline(s), null);
  // Unlocked, everything works again; a slide an AI request is on cannot be locked.
  assert.equal(setLocks(s, ['S-1'], false), null);
  assert.equal(setField(s, 'S-1', 'content', 'free again'), null);
  s.jobs.push({ id: 'j', kind: 'box', slideId: 'S-2', field: 'content', status: 'working' });
  assert.match(setLocks(s, ['S-2'], true), /AI request on it/);
});

test('Jev checks the aim before a message goes; another scope asks where to send it, Esc puts it back', async () => {
  const { s, jobs, ai } = setup(),
    c = createController(s, jobs),
    asked = [];
  let answer;
  ai.judge = async (request) => {
    asked.push(request);
    if (answer instanceof Error) throw answer;
    return { answers: answer.scope ? answer : { scope: answer } };
  };
  selectSlide(s, 'S-3');
  const say = (text) => {
    c.handle({ key: 'text', text });
    c.handle({ key: 'enter' });
  };
  c.handle({ key: 'ctrl-g' });
  // A whole-lesson reply aimed at the slide: Jev is asked with the chat and the slide titles, and the author picks.
  answer = { choice: 'lesson', probabilities: { slide: 0.28, lesson: 0.72 } };
  say('okay please go');
  assert.equal(s.chatDraft, '');
  await settle();
  assert.deepEqual(Object.keys(asked[0].questions.scope.criteria), ['slide', 'lesson']);
  assert.equal(asked[0].questions.beyond.type, 'noul');
  assert.equal(asked[0].state.message, 'okay please go');
  assert.match(asked[0].state.aimedAt, /^Slide \d+ "/);
  assert.ok(asked[0].state.slides.length > 5);
  assert.equal(s.modal.kind, 'aim');
  assert.match(s.modal.options[0].label, /^Run on Whole lesson - may change anything/);
  assert.match(s.modal.options[1].label, /^Keep on Slide \d+ "/);
  c.handle({ key: 'enter' });
  await settle();
  assert.equal(s.modal, null);
  assert.deepEqual([s.jobs.at(-1).kind, s.jobs.at(-1).text], ['lesson', 'okay please go']);
  // Esc sends nothing and puts the message back.
  const before = s.jobs.length;
  say('restructure it all');
  await settle();
  c.handle({ key: 'escape' });
  assert.equal(s.chatDraft, 'restructure it all');
  assert.equal(s.jobs.length, before);
  // Reaching beyond the slide asks about the whole lesson even when the scope choice says slide.
  answer = { scope: { choice: 'slide', probabilities: { slide: 0.53, lesson: 0.47 } }, beyond: { noul: 0.58 } };
  say('and add the slides for each section');
  await settle();
  assert.equal(s.modal.kind, 'aim');
  assert.match(s.modal.lines[1], /needing the whole lesson \(58%\)/);
  c.handle({ key: 'escape' });
  s.chatDraft = '';
  s.chatCursor = 0;
  // The aim fits, Jev is unsure, or the check fails: the message goes as aimed.
  for (const [given, note] of [
    [{ choice: 'slide', probabilities: { slide: 0.9, lesson: 0.1 } }, null],
    [{ choice: 'slide', probabilities: { slide: 0.55, lesson: 0.45 } }, null],
    [Error('quota'), /^Aim check unavailable \(quota\); sent as aimed/],
  ]) {
    answer = given;
    const count = s.jobs.length;
    say('shorter title');
    await settle();
    assert.equal(s.modal, null);
    assert.deepEqual([s.jobs.length, s.jobs.at(-1).kind], [count + 1, 'slide']);
    if (note) assert.match(s.notice, note);
  }
  // A box aim offers the box, its slide and the whole lesson.
  c.handle({ key: 'escape' });
  focusField(s, 'notes');
  c.handle({ key: 'ctrl-g' });
  answer = { choice: 'box', probabilities: { box: 0.9, slide: 0.05, lesson: 0.05 } };
  say('make it a speech');
  await settle();
  assert.deepEqual(Object.keys(asked.at(-1).questions.scope.criteria), ['box', 'slide', 'lesson']);
  assert.equal(s.jobs.at(-1).field, 'notes');
  jobs.dispose();
});

test('g makes every missing picture, a few at once, in one chat entry; an image limit stops the rest', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-')),
    s = createState(),
    jobs = createScheduler(s, { lessonPath: join(dir, 'l.lesson.json') }),
    ai = connect(s, jobs),
    c = createController(s, jobs);
  // Every slide gets an image concept and no picture; one stays locked and is left out.
  for (const x of s.slides) Object.assign(x, { layout: 'points-image', imageDesc: `A diagram for ${x.id}` });
  s.pictures = {};
  s.slides[0].locked = true;
  const total = s.slides.length - 1;
  assert.ok(total > PICTURES_AT_ONCE);
  assert.equal(jobs.missingPictures().length, total);
  const entries = s.chat.length;
  // g works from the outline, where the other letters are outline keys.
  s.pane = 'outline';
  c.handle({ key: 'text', text: 'g' });
  assert.equal(s.modal.title, `Generate ${total} pictures?`);
  c.handle({ key: 'right' });
  c.handle({ key: 'enter' });
  await settle();
  // Only PICTURES_AT_ONCE start: each first asks the chat model for its prompt.
  const working = () => s.jobs.filter((j) => j.batch && j.status === 'working').length;
  assert.equal(working(), PICTURES_AT_ONCE);
  assert.equal(ai.open().filter((x) => x.kind === 'run').length, PICTURES_AT_ONCE);
  assert.equal(s.chat.length, entries + 1);
  assert.match(
    s.chat.at(-1).text,
    new RegExp(`^Generating ${total} missing pictures, ${PICTURES_AT_ONCE} at a time: 0 done`),
  );
  // One finishes: the next waiting one starts.
  const first = ai.open()[0];
  first.answer('A diagram.');
  await until(() => ai.open().some((x) => x.kind === 'image'));
  const image = ai.open().find((x) => x.kind === 'image');
  mkdirSync(dirname(image.outputPath), { recursive: true });
  writeFileSync(image.outputPath, samplePng('etag'));
  image.answer({ file: image.outputPath, model: 'gpt-image-test', prompt: image.prompt });
  await until(() => /1 done/.test(s.chat.at(-1).text));
  assert.equal(working(), PICTURES_AT_ONCE);
  // An image limit fails one; the waiting ones are not started, the working ones finish.
  ai.open()
    .find((x) => x.kind === 'run')
    .fail(Error('Codex image request failed (429): usage_limit_reached'));
  await settle();
  const waiting = total - 1 - PICTURES_AT_ONCE;
  assert.equal(s.jobs.filter((j) => j.batch && j.status === 'queued').length, 0);
  jobs.cancel('Stopped');
  await settle();
  const report = s.chat.at(-1).text;
  assert.match(report, new RegExp(`^Pictures: 1 of ${total} generated, ${PICTURES_AT_ONCE} failed\\.`));
  assert.match(report, /429\): usage_limit_reached/);
  assert.match(report, new RegExp(`${waiting} not started after the image limit; g generates them later\\.$`));
  assert.equal(s.chat.length, entries + 1);
  assert.equal(jobs.missingPictures().length, total - 1);
  rmSync(dir, { recursive: true });
});
