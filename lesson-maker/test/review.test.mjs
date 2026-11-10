import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, order, selectSlide } from '../src/model.mjs';
import { validateLesson, fromDoc, toDoc } from '../src/lesson.mjs';
import { exampleDoc } from '../src/seed.mjs';
import { lessonPrompt, slidePrompt } from '../src/prompts.mjs';
import { setSlide } from '../src/edits.mjs';
import { createController } from '../src/controller.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { render, plainFrame } from '../src/render.mjs';

test('comments: an optional field written only when there are some, seen by the agent, never by learners', () => {
  const doc = exampleDoc();
  doc.sections[0].slides[0].comments = 'Make this shorter';
  assert.deepEqual(validateLesson(doc), []);
  const s = { ...fromDoc(doc), schemaRef: doc.$schema };
  assert.equal(s.slides.find((x) => x.id === doc.sections[0].slides[0].id).comments, 'Make this shorter');
  assert.deepEqual(toDoc(s), doc);
  // Slides without comments keep their shape.
  assert.ok(!('comments' in toDoc(s).sections[0].slides[1]));
  // Both kinds of request tell the agent what comments are and to clear the ones it handled.
  const state = createState(fromDoc(doc)),
    id = doc.sections[0].slides[0].id;
  for (const prompt of [
    lessonPrompt(state, { text: 'work through my comments' }),
    slidePrompt(state, { slideId: id, text: 'x' }),
  ])
    assert.match(prompt, /review comments.*set that comment to an empty string/s);
  // The agent's tool clears one; a slide without comments cannot be given any it did not have.
  const next = toDoc(state);
  setSlide(next, { id, fields: { comments: '' } });
  assert.equal(fromDoc(next).slides.find((x) => x.id === id).comments, '');
  const other = doc.sections[0].slides[1].id;
  assert.throws(() => setSlide(next, { id: other, fields: { comments: 'mine' } }), /no field "comments"/);
  // Learners never see comments.
  selectSlide(state, id);
  state.view = 'preview';
  assert.doesNotMatch(plainFrame(render(state, 196, 50)), /Make this shorter/);
  state.view = 'workspace';
  assert.match(plainFrame(render(state, 196, 50)), /COMMENTS[\s\S]*Make this shorter/);
});

test('o hides the outline column: the slide and form are wider, the slide taller; [o outline] shows it again', () => {
  const s = createState(),
    c = createController(s, createScheduler(s));
  selectSlide(s, order(s)[1].id);
  const slideFrame = (f) => {
    const row = plainFrame(f)
      .split('\n')
      .find((l) => l.includes('▐02▌'));
    return row.lastIndexOf('┐') - row.indexOf('┌');
  };
  // Rows from the slide frame's top corner down to its bottom corner in the same column.
  const slideHeight = (f) => {
    const lines = plainFrame(f).split('\n'),
      top = lines.findIndex((l) => l.includes('▐02▌')),
      x = lines[top].indexOf('┌▐02▌');
    return lines.findIndex((l, i) => i > top && l[x] === '└') - top + 1;
  };
  let f = render(s, 214, 77);
  const before = { width: slideFrame(f), height: slideHeight(f), outline: f.g.outline.w };
  assert.ok(
    f.hits.some((h) => h.act === 'outline-toggle'),
    '[o hide] on the outline header',
  );
  c.handle({ key: 'text', text: 'o' }, f.g, f.hits);
  assert.equal(s.columns.outlineHidden, true);
  f = render(s, 214, 77);
  assert.equal(f.g.outline, null);
  assert.match(plainFrame(f), /\[o outline\]/);
  assert.ok(slideFrame(f) > before.width + 40, `slide ${slideFrame(f)} wide, was ${before.width}`);
  assert.ok(slideHeight(f) > before.height + 8, `slide ${slideHeight(f)} rows, was ${before.height}`);
  // Ctrl-O still opens the outline, as a panel over the slide area.
  c.handle({ key: 'ctrl-o' }, f.g, f.hits);
  assert.match(plainFrame(render(s, 214, 77)), /OUTLINE/);
  c.handle({ key: 'ctrl-o' }, f.g, f.hits);
  // The button shows the column again.
  f = render(s, 214, 77);
  const button = f.hits.find((h) => h.act === 'outline-toggle');
  for (const release of [false, true])
    c.handle({ key: 'mouse', button: 'left', x: button.x, y: button.y, release }, f.g, f.hits);
  assert.equal(s.columns.outlineHidden, false);
  assert.equal(render(s, 214, 77).g.outline.w, before.outline);
  // Below 150 columns there is no outline column to hide.
  f = render(s, 120, 40);
  c.handle({ key: 'text', text: 'o' }, f.g, f.hits);
  assert.equal(s.columns.outlineHidden, false);
  assert.match(s.notice, /panel at this width/);
});
