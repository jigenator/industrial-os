// A whole-lesson request claims the slides and groups it changes (claim_slides); only those stay locked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toDoc } from '../src/lesson.mjs';
import {
  createState,
  slideById,
  order,
  setField,
  createItem,
  placeSlide,
  setLocks,
  selectSlide,
  undoOutline,
  claimed,
  editLocked,
} from '../src/model.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { render, plainFrame } from '../src/render.mjs';
import { connect, settle } from './fake-ai.mjs';

const setup = () => {
  const s = createState(),
    jobs = createScheduler(s),
    ai = connect(s, jobs);
  return { s, jobs, ai };
};
const lessonCall = async (s, jobs, ai, text = 'Work on the first section') => {
  s.wholeLesson = true;
  jobs.send(text);
  s.wholeLesson = false;
  await settle();
  return ai.open().find((call) => call.tools?.some((t) => t.name === 'claim_slides'));
};
const tool = (call, name) => call.tools.find((t) => t.name === name);
const claim = (call, args) => tool(call, 'claim_slides').execute(args);
const setSlides = (call, changes) => tool(call, 'set_slides').execute({ changes });
const original = (id) => slideById(createState(), id);

test('claims: all locked until the first claim, edits wait for one, update_lesson needs all first', async () => {
  const { s, jobs, ai } = setup();
  const call = await lessonCall(s, jobs, ai);
  assert.match(call.prompt, /call claim_slides with exactly the slides, subsections or sections you will change/);
  // Before a claim the request holds everything, as a whole-lesson request always did.
  assert.match(setField(s, 'S-6', 'notes', 'x'), /LOCKED/);
  assert.match(createItem(s, 'section', null, 'x'), /Locked: the lesson agent/);
  assert.equal(editLocked(s, { principle: true, field: 'outcomes' }), true);
  assert.match(await setSlides(call, [{ id: 'S-1', fields: { title: 'X' } }]), /^Not applied: claim the slides/);
  const lesson = toDoc(s);
  assert.match(await tool(call, 'update_lesson').execute({ lesson }), /^Not applied: claim the slides/);
  assert.match(await claim(call, {}), /^Nothing claimed/);
  assert.match(await claim(call, { ids: ['SEC-1'] }), /^Claimed section "Why browsers keep copies"\./);
  assert.match(await tool(call, 'update_lesson').execute({ lesson }), /needs claim_slides \{"all": true\} as your/);
  assert.match(await claim(call, { all: true }), /all: only as your first claim/);
  // Now only the claim is locked: its section's slides, not the rest or the plan.
  assert.match(setField(s, 'S-2', 'notes', 'x'), /LOCKED/);
  assert.match(setField(s, 'title-SEC-1', 'title', 'x'), /LOCKED/);
  assert.equal(setField(s, 'S-6', 'notes', 'mine'), null);
  assert.equal(editLocked(s, { principle: true, field: 'outcomes' }), false);
  assert.equal(createItem(s, 'slide', 'SUB-4', 'Author slide'), null);
  assert.match(createItem(s, 'slide', 'SEC-1', 'x'), /claimed by the whole-lesson request/);
  call.answer('Done.');
  await settle();
});

test('claims: edits inside apply, edits outside are refused; the plan and pictures need claiming too', async () => {
  const { s, jobs, ai } = setup();
  const call = await lessonCall(s, jobs, ai);
  await claim(call, { ids: ['S-1'] });
  assert.match(await setSlides(call, [{ id: 'S-1', fields: { title: 'Claimed' } }]), /^Done/);
  assert.match(
    await setSlides(call, [{ id: 'S-4', fields: { title: 'Outside' } }]),
    /^Not applied:\nSlide 7 "[^"]+" \(id S-4\) is not claimed - claim it first with claim_slides/,
  );
  // All or nothing: one slide outside the claim refuses the whole call.
  assert.match(
    await setSlides(call, [
      { id: 'S-1', fields: { title: 'Both' } },
      { id: 'S-4', fields: { title: 'Both' } },
    ]),
    /^Not applied/,
  );
  assert.equal(slideById(s, 'S-1').title, 'Claimed');
  assert.equal(slideById(s, 'S-4').title, original('S-4').title);
  assert.match(
    await tool(call, 'set_plan').execute({ fields: { outcomes: 'x' } }),
    /The lesson plan is not claimed - claim it first with claim_slides \{"plan": true\}/,
  );
  assert.match(await claim(call, { plan: true }), /^Claimed slide 2; the plan\./);
  assert.match(await tool(call, 'set_plan').execute({ fields: { outcomes: 'Learners explain caching.' } }), /^Done/);
  assert.equal(editLocked(s, { principle: true, field: 'outcomes' }), true);
  assert.match(
    await tool(call, 'generate_picture').execute({ slideId: 'S-4', image: 'image' }),
    /^Not made: Slide 7 "[^"]+" is not claimed/,
  );
  call.answer('Done.');
  await settle();
});

test('claims: adding, moving and deleting need every group whose slides or subsections change', async () => {
  const { s, jobs, ai } = setup();
  const call = await lessonCall(s, jobs, ai);
  await claim(call, { ids: ['S-3'] });
  const run = (name, args) => tool(call, name).execute(args);
  assert.match(
    await run('delete_items', { ids: ['S-3'] }),
    /Subsection "Worked examples" \(id SUB-3\) is not claimed, so its slides stay as they are/,
  );
  assert.match(await run('add_slide', { groupId: 'SUB-4' }), /\(id SUB-4\) is not claimed/);
  await claim(call, { ids: ['SUB-3'] });
  // A move needs its destination too.
  assert.match(await run('move_items', { ids: ['S-3'], groupId: 'SUB-4' }), /\(id SUB-4\) is not claimed/);
  await claim(call, { ids: ['SUB-4'] });
  assert.match(await run('move_items', { ids: ['S-3'], groupId: 'SUB-4' }), /^Done: Moved/);
  assert.equal(slideById(s, 'S-3').subId, 'SUB-4');
  // Deleting a subsection changes its section's list, so it needs the section.
  assert.match(await run('delete_items', { ids: ['SUB-3'] }), /Section "How the browser decides" \(id SEC-2\)/);
  // Sections it has not claimed keep their order; a new section needs no claim and is claimed at once.
  assert.match(await run('move_items', { ids: ['SEC-3'], beforeId: 'SEC-1' }), /Sections you have not claimed keep/);
  assert.match(await run('add_group', { kind: 'section', title: 'Extra' }), /^Done: Added section "Extra" \(id SEC-4/);
  assert.equal(claimed(s, 'SEC-4'), true);
  const title = s.slides.find((x) => x.titleFor === 'SEC-4');
  assert.match(await run('add_slide', { groupId: 'SEC-4', fields: { title: 'Inside' } }), /^Done: Added/);
  assert.match(await setSlides(call, [{ id: title.id, fields: { title: 'Extra, renamed' } }]), /^Done/);
  // Nothing outside moved.
  assert.deepEqual(
    s.sections.map((x) => x.id),
    ['SEC-1', 'SEC-2', 'SEC-3', 'SEC-4'],
  );
  call.answer('Done.');
  await settle();
});

test('claims: the author edits unclaimed slides meanwhile; later commits and the undo keep those edits', async () => {
  const { s, jobs, ai } = setup();
  const before = order(s).map((x) => x.id);
  const call = await lessonCall(s, jobs, ai);
  await claim(call, { ids: ['S-1'] });
  assert.match(await setSlides(call, [{ id: 'S-1', fields: { title: 'AI one' } }]), /^Done/);
  // The author's edits beside it: notes (no undo step), a rename (an undo step) and a move (an undo step).
  assert.equal(setField(s, 'S-6', 'notes', 'author notes'), null);
  assert.equal(setField(s, 'S-6', 'title', 'Author title'), null);
  assert.equal(placeSlide(s, 'S-6', 'SUB-4', 'S-5'), null);
  // Its later changes start from the lesson as it is now, so they never put the author's edits back.
  assert.match(await setSlides(call, [{ id: 'S-1', fields: { speakerNotes: 'AI notes' } }]), /^Done/);
  assert.match(await claim(call, { ids: ['S-2'] }), /^Claimed slides 2–3\./);
  assert.match(await setSlides(call, [{ id: 'S-2', fields: { title: 'AI two' } }]), /^Done/);
  assert.equal(slideById(s, 'S-6').notes, 'author notes');
  assert.equal(slideById(s, 'S-6').title, 'Author title');
  call.answer('Done.');
  await settle();
  assert.equal(s.undo.filter((u) => u.kind === 'lesson').length, 1);
  // The author's own steps undo first and land where they were, though the request rebuilt the slide list since.
  assert.equal(undoOutline(s), null);
  assert.deepEqual(
    order(s).map((x) => x.id),
    before,
  );
  assert.equal(undoOutline(s), null);
  assert.equal(slideById(s, 'S-6').title, original('S-6').title);
  // Then the request, in one step: its slides go back and the author's notes stay.
  assert.equal(undoOutline(s), null);
  assert.equal(slideById(s, 'S-1').title, original('S-1').title);
  assert.equal(slideById(s, 'S-1').notes, original('S-1').notes);
  assert.equal(slideById(s, 'S-2').title, original('S-2').title);
  assert.equal(slideById(s, 'S-6').notes, 'author notes');
  assert.equal(s.provenance['S-1:title'], undefined);
});

test('claims: an undo that would put back a slide changed since refuses, and so does one under a claim', async () => {
  const { s, jobs, ai } = setup();
  let call = await lessonCall(s, jobs, ai);
  await claim(call, { ids: ['S-1'] });
  await setSlides(call, [{ id: 'S-1', fields: { title: 'AI one' } }]);
  call.answer('Done.');
  await settle();
  assert.equal(setField(s, 'S-1', 'notes', 'changed later'), null);
  assert.match(undoOutline(s), /^Cannot undo .*: Slide 2 "AI one" changed since$/);
  assert.equal(slideById(s, 'S-1').title, 'AI one');
  assert.equal(setField(s, 'S-1', 'notes', original('S-1').notes), null);
  // While a second request holds the slide, the first one's undo waits.
  call = await lessonCall(s, jobs, ai, 'Again');
  await claim(call, { ids: ['S-1'] });
  assert.match(undoOutline(s), /Slide 2 "AI one" is claimed by the whole-lesson request/);
  call.answer('Nothing to do.');
  await settle();
  assert.equal(undoOutline(s), null);
  assert.equal(slideById(s, 'S-1').title, original('S-1').title);
});

test('claims: refused per item for a locked slide, another request, the author typing, and unknown ids', async () => {
  const { s, jobs, ai } = setup();
  assert.equal(setLocks(s, ['S-2'], true), null);
  const call = await lessonCall(s, jobs, ai);
  await claim(call, { ids: ['S-1'] });
  // A box request on a slide it has not claimed starts beside it.
  jobs.send('Shorter notes', { slideId: 'S-5', field: 'notes' });
  await settle();
  assert.equal(s.jobs.at(-1).status, 'working');
  s.edit = { slideId: 'S-6', field: 'notes', text: 'typing', cursor: 0, base: 0 };
  const result = await claim(call, { ids: ['S-2', 'S-5', 'S-6', 'SUB-4', 'SEC-1', 'nope', 'S-7'] });
  assert.match(result, /^Claimed slides 2, 12\.\nRefused \(leave these as they are and work around them\):/);
  assert.match(result, /- S-2 \(Slide 3 "[^"]+"\): locked by the author/);
  assert.match(result, /- S-5 \(Slide 9 "[^"]+"\): Slide 9 "[^"]+" \/ Speaker notes has another request on it/);
  assert.match(result, /- S-6 \(Slide 10 "[^"]+"\): the author is editing Slide 10/);
  assert.match(result, /- SUB-4 \(Subsection "[^"]+"\): Slide 9 .* has another request on it/);
  assert.match(result, /- SEC-1 \(Section "[^"]+"\): it holds a slide locked by the author \(Slide 3/);
  assert.match(result, /- nope: no slide, subsection or section has this id/);
  for (const id of ['S-2', 'S-5', 'S-6', 'SUB-4', 'SEC-1']) assert.equal(claimed(s, id), false, id);
  assert.equal(claimed(s, 'S-7'), true);
  s.edit = { principle: true, field: 'outcomes', text: 'typing', cursor: 0, base: 0 };
  assert.match(await claim(call, { plan: true }), /- plan: the author is editing it/);
  s.edit = null;
  // A slide claimed after the author changed it comes back as it is now, so the model works from that.
  assert.equal(setField(s, 'S-4', 'notes', 'author wrote this'), null);
  assert.match(await claim(call, { ids: ['S-4'] }), /Changed by the author since[\s\S]*author wrote this/);
  for (const c of ai.open()) c.answer('Done.');
  await settle();
});

test('claims: a request on a slide outside the claim runs beside it; one on a claimed slide waits', async () => {
  const { s, jobs, ai } = setup();
  const call = await lessonCall(s, jobs, ai);
  // Before the claim, everything waits.
  jobs.send('Tighten this slide', { slideId: 'S-4' });
  const outside = s.jobs.at(-1);
  await settle();
  assert.equal(outside.status, 'queued');
  await claim(call, { ids: ['S-1'] });
  await settle();
  assert.equal(outside.status, 'working');
  jobs.send('Tighten the claimed slide', { slideId: 'S-1' });
  jobs.send('Its notes', { slideId: 'S-1', field: 'notes' });
  const inside = s.jobs.slice(-2);
  await settle();
  assert.deepEqual(
    inside.map((j) => j.status),
    ['queued', 'queued'],
  );
  assert.match(jobs.generate('S-1', 'imageDesc') ?? '', /claimed by the whole-lesson request/);
  call.answer('Done.');
  await settle();
  assert.equal(inside[0].status, 'working');
  for (const c of ai.open()) c.answer('Done.');
  await settle();
});

test('claims: released when the request finishes, fails, is stopped or review stops it', async () => {
  for (const end of ['finish', 'fail', 'stop', 'review']) {
    const { s, jobs, ai } = setup();
    const call = await lessonCall(s, jobs, ai);
    await claim(call, { ids: ['S-1', 'SUB-3'], plan: true });
    assert.equal(claimed(s, 'S-1') && claimed(s, 'S-3'), true, end);
    if (end === 'finish') call.answer('Done.');
    if (end === 'fail') call.fail(Error('boom'));
    if (end === 'stop') jobs.cancel('Stopped');
    if (end === 'review') jobs.setReview(true);
    await settle();
    if (end === 'review') jobs.setReview(false);
    assert.equal(claimed(s, 'S-1') || claimed(s, 'S-3'), false, end);
    assert.equal(setField(s, 'S-3', 'notes', 'free'), null, end);
    assert.equal(editLocked(s, { principle: true, field: 'outcomes' }), false, end);
  }
});

test('claims: outline and form show claimed slides working, the rest normal; the chat lists the claim', async () => {
  const { s, jobs, ai } = setup();
  const call = await lessonCall(s, jobs, ai);
  await claim(call, { ids: ['S-1', 'S-2', 'SUB-3'] });
  const outline = (frame) => frame.split('\n').map((line) => line.slice(0, 40));
  const row = (frame, n) => outline(frame).find((line) => new RegExp(`(≡|[▾▸]) *${n}\\b| ${n} ≡`).test(line));
  selectSlide(s, 'S-1');
  Object.assign(s, { control: null, formScroll: 0 });
  let frame = plainFrame(render(s, 180, 60));
  for (const n of [2, 3, 5, 6, 7]) assert.match(row(frame, n), /▒ *$/, `slide ${n}`);
  for (const n of [1, 4, 9, 10, 12]) assert.doesNotMatch(row(frame, n), /▒/, `slide ${n}`);
  assert.match(frame, /SPEAKER NOTES ─+ {2}▒ WORKING/);
  selectSlide(s, 'S-5');
  frame = plainFrame(render(s, 180, 60));
  assert.doesNotMatch(frame, /▒ WORKING/);
  const live = s.chat.at(-1);
  assert.match(live.text, /^· Claimed slides 2–3; subsection "Worked examples"$/);
  call.answer('Done.');
  await settle();
  assert.match(s.chat.at(-1).text, /^Done\.\n· Claimed slides 2–3; subsection "Worked examples"$/);
});
