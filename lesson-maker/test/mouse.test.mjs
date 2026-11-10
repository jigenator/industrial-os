import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createDecoder } from '../src/input.mjs';
import { createHost } from '../src/host.mjs';
import { plainFrame, render } from '../src/render.mjs';
import { outlineRows, slideById, order, createState, focusedBox, chatAim } from '../src/model.mjs';
import { createController } from '../src/controller.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { MIN_COLUMNS } from '../src/geometry.mjs';
import { fakeAi, settle } from './fake-ai.mjs';

function fakeHost(columns = 180, rows = 64, options = {}) {
  const timers = new Map();
  let seq = 0;
  const clock = {
    setTimeout(fn) {
      timers.set(++seq, fn);
      return seq;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    isRaw: false,
    setRawMode(value) {
      this.isRaw = value;
    },
    resume() {},
    pause() {},
  });
  const written = [];
  const output = Object.assign(new EventEmitter(), {
    isTTY: true,
    columns,
    rows,
    write(text) {
      written.push(text);
    },
  });
  const host = createHost({ input, output, signals: new EventEmitter(), clock, env: {}, mode: 'text', ...options });
  host.start();
  const press = (x, y, button = 0) =>
    input.emit('data', Buffer.from(`\x1b[<${button};${x + 1};${y + 1}M\x1b[<${button};${x + 1};${y + 1}m`));
  const target = (act, where = () => true) => {
    const hit = host.frame.hits.find((h) => (h.act === act || h.scroll === act) && where(h));
    assert.ok(hit, `no ${act} target`);
    return hit;
  };
  const click = (act, where) => {
    const hit = target(act, where);
    press(hit.x, hit.y);
  };
  host.input = input;
  // A lone Esc waits for the decoder's timer; this fires it.
  const escape = () => {
    input.emit('data', Buffer.from('\x1b'));
    for (const [id, fn] of timers) {
      timers.delete(id);
      fn();
    }
  };
  return { host, written, press, target, click, escape, state: () => host.state };
}

test('SGR mouse reports decode clicks, releases, wheel and split packets; other buttons are inert', () => {
  const d = createDecoder();
  assert.deepEqual(d.feed('\x1b[<0;10;5M'), [{ key: 'mouse', button: 'left', x: 9, y: 4, release: false }]);
  assert.deepEqual(d.feed('\x1b[<0;10;5m'), [{ key: 'mouse', button: 'left', x: 9, y: 4, release: true }]);
  assert.deepEqual(
    d.feed('\x1b[<64;3;3M\x1b[<65;3;3M').map((e) => e.button),
    ['wheelup', 'wheeldown'],
  );
  assert.deepEqual(d.feed('\x1b[<2;1;1M')[0].button, 'other');
  assert.deepEqual(d.feed('\x1b[<0;1'), []);
  assert.deepEqual(d.feed('2;3M'), [{ key: 'mouse', button: 'left', x: 11, y: 2, release: false }]);
});

test('host enables click reporting on start and restores it on stop', () => {
  const { host, written } = fakeHost();
  assert.ok(written.join('').includes('\x1b[?1003h\x1b[?1006h'));
  host.stop();
  assert.ok(written.join('').includes('\x1b[?1006l\x1b[?1003l'));
});

test('clicks choose options and focus a form box; typing goes in, clicking elsewhere saves; the slide is inert', () => {
  const { host, click, press, target, state } = fakeHost(180, 80);
  click('choice', (h) => h.control === 'type' && h.index === 2);
  assert.equal(slideById(state(), state().selected).type, 'Worked example');
  click('choice', (h) => h.control === 'layout' && h.index === 0);
  assert.equal(slideById(state(), state().selected).layout, 'points-image');
  const purpose = slideById(state(), state().selected).purpose;
  click('field', (h) => h.box.field === 'purpose');
  assert.equal(state().control, 'purpose');
  assert.deepEqual(chatAim(state()), { slideId: state().selected, field: 'purpose' });
  host.input.emit('data', Buffer.from('q?'));
  assert.equal(state().modal, null);
  assert.equal(state().edit.text, purpose + 'q?');
  // A click inside the slide preview lands on nothing but empty space, which leaves the box and saves it.
  const { main } = host.frame.g;
  const inSlide = host.frame.hits.filter(
    (h) => h.act && main.x + 10 >= h.x && main.x + 10 < h.x + h.w && main.y + 6 >= h.y && main.y + 6 < h.y + h.h,
  );
  assert.deepEqual(
    inSlide.map((h) => h.act),
    ['blur'],
  );
  press(main.x + 10, main.y + 6);
  assert.equal(state().edit, null);
  assert.equal(state().control, null);
  assert.equal(slideById(state(), state().selected).purpose, purpose + 'q?');
  click('field', (h) => h.box.field === 'title');
  host.input.emit('data', Buffer.from('!'));
  click('field', (h) => h.box.field === 'content');
  assert.match(slideById(state(), state().selected).title, /!$/);
  assert.equal(state().control, 'content');
  const form = target('form');
  for (let i = 0; i < 10; i++) press(form.x + 1, form.y, 65);
  click('prompt', (h) => h.field === 'imageDesc');
  assert.equal(state().modal.kind, 'prompt');
  assert.ok(state().modal.lines.includes('# Model'));
  host.input.emit('data', Buffer.from('\r'));
  assert.equal(state().modal, null);
  click('attach', (h) => h.field === 'imageDesc');
  assert.equal(state().modal.kind, 'attach');
  host.stop();
});

test('outline rows open slides, carets fold, and the outline buttons run the same actions as keys', () => {
  const { host, click, state } = fakeHost();
  const rows = outlineRows(state());
  const freshness = rows.findIndex((row) => row.id === 'S-3');
  click('outline-row', (h) => h.index === freshness);
  assert.equal(state().selected, 'S-3');
  const sub = rows.findIndex((row) => row.id === 'SUB-3');
  click('outline-row', (h) => h.index === sub);
  assert.equal(slideById(state(), state().selected).titleFor, 'SUB-3');
  click('fold', (h) => h.index === sub);
  assert.ok(state().collapsed.includes('SUB-3'));
  click('outline-key', (h) => h.key === 'm');
  assert.equal(state().modal.kind, 'move');
  // Only dialog targets answer while a dialog is open.
  click('modal-option', (h) => h.index === 0);
  assert.equal(state().modal, null);
  assert.deepEqual(
    state().sections[1].subs.map((sub) => sub.id),
    ['SUB-3', 'SUB-4'],
  );
  host.stop();
});

test('the wheel scrolls a form that does not fit under the slide, and focus brings a box back into view', () => {
  const { host, click, press, target, state } = fakeHost(100, 24);
  const form = target('form', () => true);
  press(form.x + 1, form.y, 65);
  assert.ok(state().formScroll > 0);
  assert.equal(state().formFollow, false);
  for (let i = 0; i < 20; i++) press(form.x + 1, form.y, 64);
  assert.equal(host.frame.g.formOffset, 0);
  // The notes and comments sit first under the slide; Tab on to the title scrolls the title into view.
  click('field', (h) => h.box?.field === 'notes');
  assert.equal(state().formFollow, true);
  assert.ok(!host.frame.hits.some((h) => h.act === 'field' && h.box.field === 'title'));
  host.input.emit('data', Buffer.from('\t'));
  assert.equal(state().control, 'comments');
  host.input.emit('data', Buffer.from('\t'));
  assert.equal(state().control, 'title');
  assert.ok(host.frame.hits.some((h) => h.act === 'field' && h.box.field === 'title'));
  host.stop();
});

test('chat clicks focus the composer, aim at the whole lesson, pick a model, and wheel scrolls history', () => {
  const { host, click, press, target, state } = fakeHost(180, 80);
  click('field', (h) => h.box?.field === 'purpose');
  click('composer');
  assert.equal(state().pane, 'chat');
  assert.equal(state().chatMode, 'composer');
  // Aimed at the box it came from; [whole lesson] aims at the lesson, and [this slide] gives the aim back to focus.
  assert.equal(chatAim(state()).field, 'purpose');
  click('clear-target');
  assert.equal(chatAim(state()), null);
  assert.match(plainFrame(host.frame), /● Whole lesson[\s\S]*\[this slide\]|\[this slide\][\s\S]*● Whole lesson/);
  click('clear-target');
  assert.deepEqual(chatAim(state()), { slideId: state().selected, field: 'purpose' });
  // The model button lists every model Pi offers; a click on one picks it.
  Object.assign(state().ai, { status: 'ready', models: [{ key: 'a/one' }, { key: 'b/two' }], model: 'a/one' });
  host.draw();
  click('model');
  assert.equal(state().modal.kind, 'models');
  click('modal-option', (h) => h.index === 1);
  assert.equal(state().ai.model, 'b/two');
  assert.equal(state().modal, null);
  host.draw();
  assert.match(plainFrame(host.frame), /b\/two/);
  state().chat = Array.from({ length: 30 }, (_, i) => ({ role: 'Lesson AI', text: `Message ${i}`, stamp: '' }));
  host.draw();
  const transcript = target('transcript');
  press(transcript.x + 1, transcript.y + 1, 64);
  assert.equal(typeof state().chatAnchor, 'number');
  for (let i = 0; i < 40; i++) press(transcript.x + 1, transcript.y + 1, 65);
  assert.equal(state().chatAnchor, null);
  host.stop();
});

test('header tabs, slide arrows and review toggle respond to clicks', () => {
  const { host, click, state } = fakeHost();
  click('view', (h) => h.view === 'preview');
  assert.equal(state().view, 'preview');
  const before = state().selected;
  click('nav', (h) => h.delta === 1);
  assert.notEqual(state().selected, before);
  // Each part of the lesson plan is its own tab; there is no arc page.
  assert.equal(host.frame.hits.filter((h) => h.act === 'view' && h.view === 'plan').length, 4);
  // Tabs are numbered in authoring order: the plan's four parts, then Slides and Learner preview.
  assert.match(plainFrame(host.frame).split('\n')[0], /1 Outcomes .*4 Progression .*5 Slides .*6 Learner preview/);
  click('view', (h) => h.tab === 2);
  assert.equal(state().view, 'plan');
  assert.equal(state().planIndex, 2);
  assert.match(plainFrame(host.frame), /TEACHING PRINCIPLES/);
  assert.doesNotMatch(plainFrame(host.frame), /Whole-lesson arc/);
  click('view', (h) => h.view === 'workspace');
  assert.equal(state().view, 'workspace');
  click('review');
  assert.equal(state().review, true);
  host.stop();
});

test('narrow windows: the outline opens as a panel over the workspace and a click closes it', () => {
  const { host, click, state } = fakeHost(120, 40);
  host.state.pane = 'outline';
  host.draw();
  assert.equal(host.frame.images.length, 0);
  click('outline-row', (h) => h.index === outlineRows(state()).findIndex((row) => row.id === 'S-6'));
  assert.equal(state().selected, 'S-6');
  assert.equal(state().pane, 'workbench');
  host.stop();
});

test('drag a slide row onto a slide or group row to move it; undo puts it back; + adds and opens the name', () => {
  const { host, click, press, target, state } = fakeHost();
  const d = createDecoder();
  assert.deepEqual(d.feed('\x1b[<32;5;6M')[0], {
    key: 'mouse',
    button: 'left',
    x: 4,
    y: 5,
    release: false,
    motion: true,
  });
  const rowOf = (id) => target('outline-row', (h) => outlineRows(state())[h.index].id === id);
  const drag = (fromId, toHit) => {
    const from = rowOf(fromId);
    host.input.emit('data', Buffer.from(`\x1b[<0;${from.x + 3};${from.y + 1}M`));
    host.input.emit('data', Buffer.from(`\x1b[<32;${toHit.x + 3};${toHit.y + 1}M`));
    assert.match(state().notice, /Release to move/);
    host.input.emit('data', Buffer.from(`\x1b[<0;${toHit.x + 3};${toHit.y + 1}m`));
  };
  const before = order(state()).map((x) => x.id);
  drag('S-2', rowOf('S-1'));
  assert.deepEqual(
    order(state())
      .map((x) => x.id)
      .slice(1, 3),
    ['S-2', 'S-1'],
  );
  drag('S-1', rowOf('S-5'));
  assert.equal(slideById(state(), 'S-1').subId, 'SUB-4');
  assert.equal(
    order(state())
      .map((x) => x.id)
      .indexOf('S-1') + 1,
    order(state())
      .map((x) => x.id)
      .indexOf('S-5'),
  );
  drag(
    'S-2',
    target('outline-row', (h) => outlineRows(state())[h.index].id === 'SUB-3'),
  );
  // A subsection row is its title slide: the dropped slide goes first after it.
  assert.deepEqual(
    order(state())
      .filter((x) => x.subId === 'SUB-3')
      .slice(0, 2)
      .map((x) => x.id),
    ['title-SUB-3', 'S-2'],
  );
  for (let i = 0; i < 3; i++) click('outline-key', (h) => h.key === 'u');
  assert.deepEqual(
    order(state()).map((x) => x.id),
    before,
  );
  const count = state().slides.length;
  click('outline-row', (h) => outlineRows(state())[h.index].id === 'S-4');
  assert.ok(!outlineRows(state()).some((row) => row.kind === 'add'));
  assert.match(plainFrame(host.frame), /ADD TO Worked examples/);
  click('add', (h) => h.kind === 'slide');
  assert.equal(state().slides.length, count + 1);
  assert.equal(slideById(state(), state().selected).subId, 'SUB-3');
  assert.equal(state().control, 'title');
  host.input.emit('data', Buffer.from('Fresh slide'));
  host.input.emit('data', Buffer.from('\t'));
  assert.equal(slideById(state(), state().selected).title, 'Fresh slide');
  host.stop();
});

test('nothing focused: Left and Right page slides; unused fields are dimmed and refuse focus', () => {
  const { host, click, state } = fakeHost(180, 90);
  const first = state().selected;
  host.input.emit('data', Buffer.from('\x1b[C'));
  assert.notEqual(state().selected, first);
  host.input.emit('data', Buffer.from('\x1b[D'));
  assert.equal(state().selected, first);
  assert.ok(host.frame.hits.some((h) => h.act === 'field-off'));
  click('field-off');
  assert.equal(state().control, null);
  assert.match(state().notice, /Not used by the Statement layout/);
  host.stop();
});

test('d or [d delete] deletes a slide; undo restores it in place', () => {
  const { host, click, state } = fakeHost();
  const before = order(state()).map((x) => x.id);
  click('outline-row', (h) => outlineRows(state())[h.index].id === 'S-3');
  click('outline-key', (h) => h.key === 'd');
  assert.ok(!slideById(state(), 'S-3'));
  assert.match(state().notice, /Deleted Slide \d+ "/);
  assert.equal(state().selected, before[before.indexOf('S-3') + 1]);
  click('outline-key', (h) => h.key === 'u');
  assert.deepEqual(
    order(state()).map((x) => x.id),
    before,
  );
  assert.equal(state().selected, 'S-3');
  host.stop();
});

test('d on a group row asks first, then deletes the group with its subsections and slides; undo restores all', () => {
  const { host, click, state } = fakeHost();
  const before = order(state()).map((x) => x.id),
    sections = state().sections.map((sec) => sec.id);
  click('outline-row', (h) => outlineRows(state())[h.index].id === 'SEC-2');
  click('outline-key', (h) => h.key === 'd');
  assert.equal(state().modal.kind, 'confirm');
  assert.match(state().modal.lines[0], /2 subsections and 4 slides/);
  click('modal-option', (h) => h.index === 0);
  assert.ok(slideById(state(), 'S-3'));
  click('outline-key', (h) => h.key === 'd');
  click('modal-option', (h) => h.index === 1);
  assert.ok(!state().sections.some((sec) => sec.id === 'SEC-2'));
  assert.ok(!['S-3', 'S-4', 'S-5', 'S-6', 'title-SUB-3'].some((id) => slideById(state(), id)));
  click('outline-row', (h) => outlineRows(state())[h.index].id === 'SEC-1');
  click('outline-key', (h) => h.key === 'd');
  assert.match(state().modal.lines[0], /2 slides/);
  host.input.emit('data', Buffer.from('\x1b'));
  click('outline-key', (h) => h.key === 'u');
  assert.deepEqual(
    state().sections.map((sec) => sec.id),
    sections,
  );
  assert.deepEqual(
    order(state()).map((x) => x.id),
    before,
  );
  host.stop();
});

test('clicking the chat keeps the aimed box outlined; the caret moves to the message box', () => {
  const { host, click, state } = fakeHost(180, 80);
  click('field', (h) => h.box.field === 'title');
  assert.match(plainFrame(host.frame), /┏━ SLIDE NAME/);
  click('composer');
  assert.equal(state().pane, 'chat');
  assert.equal(chatAim(state()).field, 'title');
  assert.match(plainFrame(host.frame), /┏━ SLIDE NAME/);
  assert.ok(
    !host.frame.hits.some((h) => h.act === 'field' && h.box.field === 'title' && host.frame.cursor?.y === h.y + 1),
  );
  host.input.emit('data', Buffer.from('\x1b'));
  click('blur', () => true);
  assert.doesNotMatch(plainFrame(host.frame), /┏━ SLIDE NAME/);
  host.stop();
});

test('a box an edit agent is working on is greyed and locked: no focus by click or Tab, text stays readable', () => {
  const { host, click, state } = fakeHost(180, 80);
  state().jobs.push({ id: 99, slideId: state().selected, field: 'purpose', status: 'working' });
  click('field', (h) => h.box.field === 'title');
  assert.ok(!host.frame.hits.some((h) => h.act === 'field' && h.box.field === 'purpose'));
  click('field-busy', (h) => h.box.field === 'purpose');
  assert.equal(state().control, 'title');
  assert.match(state().notice, /Teaching purpose is locked: an AI request is working on it/);
  host.input.emit('data', Buffer.from('\t'));
  assert.equal(state().control, 'content');
  for (let i = 0; i < 3; i++) host.input.emit('data', Buffer.from('\t'));
  assert.equal(state().control, 'type');
  // The busy purpose box is skipped.
  host.input.emit('data', Buffer.from('\t'));
  assert.equal(state().control, 'view');
  assert.doesNotMatch(plainFrame(host.frame), /◆ CHAT/);
  host.stop();
});

test('an overflowing box shows a rail and scrolls with the wheel; at its ends the form stays put', () => {
  // Tall enough that the whole form, notes included, sits under the slide.
  const { host, click, press, state } = fakeHost(196, 110);
  // Start from empty notes: the example's hold its moved key points.
  state().slides.find((x) => x.id === state().selected).notes = '';
  // A 6-row notes box, so 12 lines overflow it.
  state().boxRows.notes = 6;
  const long = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\r');
  click('field', (h) => h.box.field === 'notes');
  host.input.emit('data', Buffer.from(long));
  // Typing keeps the caret in view: the notes box shows 6 of 12 lines, ending at the caret.
  const box = () => host.frame.hits.find((h) => h.scroll === 'box');
  assert.equal(box().most, 6);
  assert.equal(box().offset, 6);
  assert.match(plainFrame(host.frame), /line 12/);
  assert.ok(host.frame.cursor);
  const { x, y } = box(),
    form = state().formScroll;
  for (let i = 0; i < 3; i++) press(x + 2, y, 64);
  assert.equal(box().offset, 3);
  assert.ok(!host.frame.cursor);
  assert.match(plainFrame(host.frame), /line 4/);
  assert.doesNotMatch(plainFrame(host.frame), /line 12/);
  for (let i = 0; i < 6; i++) press(x + 2, y, 64);
  assert.equal(box().offset, 0);
  assert.equal(state().formScroll, form);
  // Past the bottom too: the box stops at its end and the form does not move.
  for (let i = 0; i < 9; i++) press(x + 2, y, 65);
  assert.equal(box().offset, 6);
  assert.equal(state().formScroll, form);
  for (let i = 0; i < 6; i++) press(x + 2, y, 64);
  // Several notches in one read all count, as a fast wheel sends them.
  host.input.emit('data', Buffer.from(`\x1b[<65;${x + 3};${y + 1}M`.repeat(2)));
  assert.equal(box().offset, 2);
  // A caret move follows the caret again: line 11 comes back into view.
  host.input.emit('data', Buffer.from('\x1b[A'));
  assert.equal(box().offset, 5);
  host.input.emit('data', Buffer.from('\t'));
  // After leaving, the box keeps that position and its rail.
  assert.notEqual(state().control, 'notes');
  assert.equal(box().offset, 5);
  host.stop();
});

test('Esc deselects an option group or button picked in the editor, as it does a box', () => {
  const { host, click, escape, state } = fakeHost();
  for (const pick of [
    () => click('choice', (h) => h.control === 'type' && h.index === 1),
    () => click('field', (h) => h.box.field === 'title'),
  ]) {
    pick();
    assert.notEqual(state().control, null);
    escape();
    assert.equal(state().control, null);
  }
  host.stop();
});

test('a click on a line of a box puts the caret at that line and column; past the end goes to the line end', () => {
  const { host, press, state } = fakeHost(196, 110);
  state().slides.find((x) => x.id === state().selected).notes = '';
  const box = () => host.frame.hits.find((h) => h.act === 'field' && h.box.field === 'notes');
  press(box().x, box().y);
  host.input.emit('data', Buffer.from('alpha beta\rgamma delta\repsilon'));
  host.input.emit('data', Buffer.from('\t'));
  const { text } = box();
  press(text.x + 6, text.y + 1);
  assert.equal(state().edit.cursor, 'alpha beta\n'.length + 6);
  host.input.emit('data', Buffer.from('X'));
  assert.equal(state().edit.text, 'alpha beta\ngamma Xdelta\nepsilon');
  press(text.x + 40, text.y);
  assert.equal(state().edit.cursor, 'alpha beta'.length);
  press(text.x + 2, text.y + 4);
  assert.equal(state().edit.cursor, state().edit.text.length);
  host.stop();
});

test('the style dropdown opens under its button in the image border; a click picks, a click outside closes', () => {
  const { host, click, state } = fakeHost();
  click('outline-row', (h) => outlineRows(state())[h.index].id === 'S-3');
  host.input.emit('data', Buffer.from('\x1b[<65;120;30M'.repeat(12)));
  const button = host.frame.hits.find((h) => h.act === 'style' && h.field === 'imageDesc');
  assert.ok(button, 'the style button is in the image border');
  assert.match(plainFrame(host.frame).split('\n')[button.y], /\[Generic ▾\] *\[gen(erate)?\]/);
  click('style', (h) => h.field === 'imageDesc');
  assert.equal(state().modal.kind, 'style');
  // A small list beside the button, not a dialog over the screen: the rest of the form still shows.
  assert.match(plainFrame(host.frame), /━ STYLE ━[\s\S]*Generic[\s\S]*Xiaohei/);
  click('modal-dismiss');
  assert.equal(state().modal, null);
  assert.equal(slideById(state(), 'S-3').imageStyle, 'generic');
  click('style', (h) => h.field === 'imageDesc');
  click('modal-option', (h) => h.index === 1);
  assert.equal(slideById(state(), 'S-3').imageStyle, 'xiaohei');
  assert.match(state().notice, /Picture style: Xiaohei/);
  host.stop();
});

test('columns resize by dragging their lines or with { } < >, within limits, and keep every column usable', () => {
  const s = createState(),
    c = createController(s, createScheduler(s)),
    frame = () => render(s, 196, 50),
    lines = (f) => f.lines.map((row) => row.map((cell) => cell.text).join(''));
  let f = frame();
  const [outlineRule, chatRule] = f.g.rules;
  // Hovering a line turns it acid; pressing it and moving drags it.
  c.handle({ key: 'mouse', button: 'other', motion: true, x: outlineRule, y: 10 }, f.g, f.hits);
  f = frame();
  assert.equal(f.lines[10][outlineRule].style.fg, 'accent');
  c.handle({ key: 'mouse', button: 'left', x: outlineRule, y: 10 }, f.g, f.hits);
  c.handle({ key: 'mouse', button: 'left', motion: true, x: outlineRule + 12, y: 12 }, f.g, f.hits);
  c.handle({ key: 'mouse', button: 'left', release: true, x: outlineRule + 12, y: 12 }, f.g, f.hits);
  f = frame();
  assert.equal(f.g.outline.w, outlineRule + 12);
  assert.equal(s.resize, null);
  // The chat line, dragged far left, stops where the slide area keeps its minimum.
  c.handle({ key: 'mouse', button: 'left', x: chatRule, y: 10 }, f.g, f.hits);
  c.handle({ key: 'mouse', button: 'left', motion: true, x: 5, y: 10 }, f.g, f.hits);
  c.handle({ key: 'mouse', button: 'left', release: true, x: 5, y: 10 }, f.g, f.hits);
  f = frame();
  assert.equal(f.g.main.w, MIN_COLUMNS.main);
  assert.ok(lines(f).every((line) => line.length === 196));
  // The outline kept its width. Keys: < narrows the chat, { narrows the outline; the slide area takes the room.
  assert.equal(f.g.outline.w, outlineRule + 12);
  const chat = f.g.chat.w;
  c.handle({ key: 'text', text: '<' }, f.g, f.hits);
  f = frame();
  assert.equal(f.g.chat.w, chat - 4);
  assert.match(s.notice, /^Chat \d+ columns wide/);
  c.handle({ key: 'text', text: '{' }, f.g, f.hits);
  assert.equal(frame().g.outline.w, outlineRule + 8);
  assert.equal(frame().g.main.w, MIN_COLUMNS.main + 8);
  // Too narrow for columns: the keys say why.
  const small = render(s, 90, 32);
  c.handle({ key: 'text', text: '{' }, small.g, small.hits);
  assert.match(s.notice, /wider window/);
});

test('sections and subsections drag with everything in them; each move undoes', () => {
  const { host, target, click, state } = fakeHost();
  const rowOf = (id) => target('outline-row', (h) => outlineRows(state())[h.index].id === id);
  const drag = (fromId, toId, hint = /Release to move/) => {
    const from = rowOf(fromId),
      to = rowOf(toId);
    host.input.emit('data', Buffer.from(`\x1b[<0;${from.x + 14};${from.y + 1}M`));
    host.input.emit('data', Buffer.from(`\x1b[<32;${to.x + 14};${to.y + 1}M`));
    assert.match(state().notice, hint);
    host.input.emit('data', Buffer.from(`\x1b[<0;${to.x + 14};${to.y + 1}m`));
  };
  const before = order(state()).map((x) => x.id),
    sections = () => state().sections.map((sec) => sec.id);
  // Down onto a later section: it takes that place, after it, so a section can reach the end.
  drag('SEC-1', 'SEC-3');
  assert.deepEqual(sections(), ['SEC-2', 'SEC-3', 'SEC-1']);
  assert.match(state().notice, /Moved section .* after/);
  assert.equal(order(state()).at(-1).id, before[2]);
  // A subsection onto another section's row goes first in it, with its title slide and slides.
  drag('SUB-4', 'SEC-3');
  const sec3 = state().sections.find((sec) => sec.id === 'SEC-3');
  assert.equal(sec3.subs[0].id, 'SUB-4');
  assert.ok(
    state()
      .slides.filter((x) => x.subId === 'SUB-4')
      .every((x) => x.secId === 'SEC-3'),
  );
  // A slide row cannot take a group: dropping a section on its own rows cancels.
  drag('SEC-2', 'SUB-3', /cancel/);
  assert.equal(state().notice, 'Move cancelled');
  for (let i = 0; i < 2; i++) click('outline-key', (h) => h.key === 'u');
  assert.deepEqual(
    order(state()).map((x) => x.id),
    before,
  );
  host.stop();
});

test('form boxes grow in pairs by dragging a bottom edge or Option-Down/Up; the chat box grows with its draft', () => {
  const s = createState(),
    c = createController(s, createScheduler(s)),
    frame = () => render(s, 196, 100),
    field = (f, name) => f.hits.find((h) => h.act === 'field' && h.box.field === name);
  let f = frame();
  const edge = f.hits.find((h) => h.act === 'box-edge' && h.pair === 'content'),
    rows = field(f, 'content').h - 2;
  // Hovering the edge turns its border acid; a press, a move down three rows and a release make the pair taller.
  c.handle({ key: 'mouse', button: 'other', motion: true, x: edge.x + 20, y: edge.y }, f.g, f.hits);
  assert.equal(frame().lines[edge.y][edge.x + 20].style.fg, 'accent');
  c.handle({ key: 'mouse', button: 'left', x: edge.x + 20, y: edge.y }, f.g, f.hits);
  c.handle({ key: 'mouse', button: 'left', motion: true, x: edge.x + 20, y: edge.y + 3 }, f.g, f.hits);
  c.handle({ key: 'mouse', button: 'left', release: true, x: edge.x + 20, y: edge.y + 3 }, f.g, f.hits);
  f = frame();
  assert.equal(s.boxRows.content, rows + 3);
  assert.equal(field(f, 'content').h, rows + 5);
  assert.equal(field(f, 'purpose').h, rows + 5);
  assert.match(s.notice, /^STATEMENT and TEACHING PURPOSE: \d+ lines tall/);
  // Option-Up in the focused box makes its pair one line shorter; the decoder reads it from the arrow's modifier.
  assert.deepEqual(createDecoder().feed('\x1b[1;3A\x1b[1;3B'), [{ key: 'box-shorter' }, { key: 'box-taller' }]);
  for (let i = 0; i < 4; i++) c.handle({ key: 'tab' }, f.g, f.hits);
  assert.equal(focusedBox(s).field, 'content');
  c.handle({ key: 'box-shorter' }, f.g, f.hits);
  assert.equal(s.boxRows.content, rows + 2);
  // Typing grows the chat's message box upward, a row per wrapped line.
  const top = (fr) =>
    fr.lines.findIndex((line) =>
      line
        .map((cell) => cell.text)
        .join('')
        .includes('MESSAGE'),
    );
  const before = top(render(s, 196, 50));
  s.chatDraft = 'one\ntwo\nthree\nfour';
  assert.equal(top(render(s, 196, 50)), before - 2);
});

test('l and L in the outline lock slides: their boxes and options take no focus, and the outline marks them', () => {
  const { host, click, state } = fakeHost(196, 60);
  const s = state(),
    first = s.selected;
  click('outline-key', (h) => h.key === 'l');
  assert.equal(slideById(s, first).locked, true);
  assert.match(s.notice, /^Locked Slide 2 "Why is the second visit faster\?"/);
  const frame = plainFrame(host.frame);
  assert.match(frame, /2 ▪ Why is the second/);
  assert.match(frame, /copies  ▪ SLIDE LOCKED/);
  assert.match(frame, /\[l unlock\] \[L lock all\]/);
  // Its boxes and options only say how to unlock it.
  click('field', (h) => h.box?.slideId === first && h.box.field === 'title');
  assert.equal(focusedBox(s), null);
  assert.match(s.notice, /is locked - l in the outline unlocks it/);
  click('choice', (h) => h.control === 'layout' && h.index === 0);
  assert.equal(slideById(s, first).layout, 'statement');
  // r renames nothing: no box opens and the chat stays on the slide, not a box.
  click('outline-key', (h) => h.key === 'r');
  assert.equal(s.modal, null);
  assert.equal(chatAim(s).field, undefined);
  assert.equal(s.control, null);
  // Tab reaches only the header.
  host.input.emit('data', Buffer.from('\x0f'));
  host.input.emit('data', Buffer.from('\t'));
  assert.ok(['view', 'review'].includes(s.control), s.control);
  // L locks every slide in the section, its title slide included, and again unlocks them.
  click('outline-key', (h) => h.key === 'L');
  const section = s.slides.filter((x) => x.secId === slideById(s, first).secId);
  assert.ok(section.length > 2 && section.every((x) => x.locked));
  assert.match(plainFrame(host.frame), /1 Why browsers[^│]*▪ SECTION/);
  click('outline-key', (h) => h.key === 'L');
  assert.ok(section.every((x) => !x.locked));
  host.stop();
});

test('Down in a focused box moves the caret to the next wrapped row of the same paragraph', () => {
  const { host, click, state } = fakeHost(196, 110);
  const s = state();
  s.slides.find((x) => x.id === s.selected).notes = 'word '.repeat(60).trim();
  click('field', (h) => h.box?.field === 'notes');
  const w = host.frame.hits.find((h) => h.act === 'field' && h.box.field === 'notes').text.w;
  host.input.emit('data', Buffer.from('\x01'));
  assert.equal(s.edit.cursor, 0);
  host.input.emit('data', Buffer.from('\x1b[B'));
  assert.ok(s.edit.cursor > 0 && s.edit.cursor <= w, String(s.edit.cursor));
  host.input.emit('data', Buffer.from('\x1b[A'));
  assert.equal(s.edit.cursor, 0);
  host.stop();
});

test('highlight by dragging or Shift-arrows: copied at once, shown black on acid, deleted or typed over', () => {
  const { host, press, written, state } = fakeHost(196, 110);
  const s = state(),
    osc = (text) => `\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`;
  s.slides.find((x) => x.id === s.selected).notes = 'alpha beta gamma';
  const box = () => host.frame.hits.find((h) => h.act === 'field' && h.box.field === 'notes');
  const { text } = box();
  // Press on "beta", drag to its end, release: highlighted and copied.
  const sgr = (b, x, y, end = 'M') => host.input.emit('data', Buffer.from(`\x1b[<${b};${x + 1};${y + 1}${end}`));
  sgr(0, text.x + 6, text.y);
  sgr(32, text.x + 8, text.y);
  sgr(32, text.x + 10, text.y);
  sgr(0, text.x + 10, text.y, 'm');
  assert.deepEqual([s.edit.mark, s.edit.cursor], [6, 10]);
  assert.ok(written.join('').includes(osc('beta')));
  assert.match(s.notice, /^Copied 4 characters/);
  const cell = host.frame.lines[text.y][text.x + 7];
  assert.deepEqual([cell.text, cell.style.bg, cell.style.fg], ['e', 'accent', 'field']);
  // Typing replaces the highlight.
  host.input.emit('data', Buffer.from('BETA'));
  assert.equal(s.edit.text, 'alpha BETA gamma');
  assert.equal(s.edit.mark, undefined);
  // Shift-Left twice from the end of "gamma" highlights "ma"; Backspace deletes it.
  host.input.emit('data', Buffer.from('\x05\x1b[1;2D\x1b[1;2D'));
  assert.ok(written.join('').includes(osc('ma')));
  host.input.emit('data', Buffer.from('\x7f'));
  assert.equal(s.edit.text, 'alpha BETA gam');
  // A plain arrow drops a highlight without deleting.
  host.input.emit('data', Buffer.from('\x1b[1;2D\x1b[D'));
  assert.equal(s.edit.mark, undefined);
  assert.equal(s.edit.text, 'alpha BETA gam');
  // A click without a drag highlights nothing and copies nothing.
  const before = written.length;
  press(text.x + 2, text.y);
  assert.equal(s.edit.mark, undefined);
  assert.ok(!written.slice(before).some((w) => w.includes('\x1b]52')));
  host.stop();
});

test('the message box highlights the same way: drag copies, Backspace deletes, sending clears it', () => {
  const { host, written, state } = fakeHost(196, 50);
  const s = state();
  s.pane = 'chat';
  s.chatMode = 'composer';
  host.input.emit('data', Buffer.from('hello world'));
  const area = host.frame.hits.find((h) => h.act === 'composer').text;
  const sgr = (b, x, end = 'M') => host.input.emit('data', Buffer.from(`\x1b[<${b};${x + 1};${area.y + 1}${end}`));
  sgr(0, area.x);
  sgr(32, area.x + 5);
  sgr(0, area.x + 5, 'm');
  assert.ok(written.join('').includes(`\x1b]52;c;${Buffer.from('hello').toString('base64')}\x07`));
  host.input.emit('data', Buffer.from('\x7f'));
  assert.equal(s.chatDraft, ' world');
  assert.equal(s.chatMark, undefined);
  host.stop();
});

test('one effort, kept with the model once Pi is ready; the status row shows context use', async () => {
  const kept = [],
    ai = fakeAi();
  const { host, click, state } = fakeHost(196, 50, {
    connect: async () => ai,
    remember: async (settings) => kept.push(settings),
  });
  await settle();
  const s = state();
  assert.equal(s.ai.status, 'ready');
  s.pane = 'chat';
  host.input.emit('data', Buffer.from('\x1b[<35;1;1M'));
  // Connecting writes nothing: only a change is kept.
  assert.deepEqual(kept, []);
  click('effort');
  assert.equal(s.modal.kind, 'effort');
  host.input.emit('data', Buffer.from('\x1b[B\x1b[B\r'));
  assert.equal(s.ai.effort, 'high');
  assert.deepEqual(kept, [{ model: 'test/fast', effort: 'high', speechRate: 1, voice: 'Orus' }]);
  s.ai.context = { tokens: 84800, contextWindow: 200000, percent: 42.4 };
  host.input.emit('data', Buffer.from('\x1b[<35;1;1M'));
  const row = host.frame.hits.find((h) => h.act === 'effort').y,
    line = host.frame.lines[row].map((c) => c.text).join('');
  assert.match(line, /no requests running · ctx 42%.*high.*fast/);
  host.stop();
});

test('a click on [g pictures] under the outline opens the confirmation', () => {
  const { click, state, host } = fakeHost(196, 50);
  const s = state();
  for (const x of s.slides) Object.assign(x, { layout: 'points-image', imageDesc: `A diagram for ${x.id}` });
  s.pictures = {};
  click('outline-key', (h) => h.key === 'g');
  assert.equal(s.pane, 'outline');
  assert.match(s.modal?.title || '', /^Generate \d+ pictures\?$/);
  host.stop();
});
