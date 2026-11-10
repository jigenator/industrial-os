import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, order, selectSlide, outlineRows, slideById } from '../src/model.mjs';
import { fromDoc, toDoc } from '../src/lesson.mjs';
import { createReader, spokenText, fromSecond } from '../src/speech.mjs';
import { createController } from '../src/controller.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { render, plainFrame } from '../src/render.mjs';
import { settle } from './fake-ai.mjs';

// A speech call and player that never reach Google or the speakers: each played clip waits until the test ends it.
function fakes(key = 'k') {
  const spoken = [],
    clips = [];
  const speak = async (text, { key: given }) => {
    spoken.push({ text, key: given });
    return Buffer.from(text);
  };
  const player = {
    async play(wav) {
      let end;
      const clip = { text: String(wav), paused: false, stopped: false, done: new Promise((r) => (end = r)) };
      clip.end = () => end(null);
      clip.pause = () => (clip.paused = true);
      clip.resume = () => (clip.paused = false);
      clip.stop = () => {
        clip.stopped = true;
        end('stopped');
      };
      clips.push(clip);
      return clip;
    },
    dispose() {},
  };
  return { spoken, clips, options: { key: async () => key, speak, player } };
}

test('a slide says its speaker notes, or its title and text when it has none', () => {
  assert.equal(spokenText({ notes: '  Hello there.  ', title: 'T', content: 'C' }), 'Hello there.');
  assert.equal(spokenText({ notes: '', title: 'Why copies\nmatter', content: 'Fast.' }), 'Why copies matter. Fast.');
  assert.equal(spokenText({ notes: '', title: '', content: '' }), '');
});

test("p reads this slide aloud with Pi's Google key and stops with p; no key says why", async () => {
  const s = createState(),
    { spoken, clips, options } = fakes();
  const reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  selectSlide(s, 'S-3');
  s.slides.find((x) => x.id === 'S-3').notes = 'Imagine opening the same page twice.';
  c.handle({ key: 'text', text: 'p' });
  await settle();
  assert.deepEqual(spoken, [{ text: 'Imagine opening the same page twice.', key: 'k' }]);
  assert.deepEqual([s.reading.mode, s.reading.status], ['slide', 'playing']);
  c.handle({ key: 'text', text: 'p' });
  assert.equal(s.reading, null);
  assert.equal(clips[0].stopped, true);
  // A clip that ends finishes the reading.
  c.handle({ key: 'text', text: 'p' });
  await settle();
  clips[1].end();
  await settle();
  assert.equal(s.reading, null);
  assert.match(s.notice, /^Finished reading/);
  // Without a key nothing plays and the notice says what to do.
  const none = fakes(null),
    t = createState();
  createReader(t, none.options).readSlide('S-3');
  await settle();
  assert.equal(none.clips.length, 0);
  assert.match(t.notice, /no Google API key/);
});

test('P presents in the editor: the slide follows the voice, the next is ready, Space pauses, Esc stops', async () => {
  const s = createState(),
    { spoken, clips, options } = fakes(),
    all = order(s);
  for (const [i, x] of all.entries()) x.notes = `Notes ${i + 1}.`;
  const reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  selectSlide(s, all[1].id);
  c.handle({ key: 'text', text: 'P' });
  await settle();
  // No dialog: the editor stays, with what the voice is doing and its controls on the slide's title row.
  assert.equal(s.modal, null);
  assert.deepEqual([s.reading.mode, s.reading.slideId, s.reading.status], ['present', all[1].id, 'playing']);
  assert.deepEqual(
    spoken.map((x) => x.text),
    ['Notes 2.', 'Notes 3.'],
  );
  let shown = plainFrame(render(s, 196, 50));
  assert.match(shown, /▶ PRESENTING .*\[back\] \[pause\] \[next\] \[stop\] \[V Orus\] \[s 1x\]/);
  assert.match(shown, /SPEAKER NOTES/);
  // Space pauses the clip and resumes it.
  c.handle({ key: 'text', text: ' ' });
  assert.equal(clips[0].paused, true);
  assert.match(plainFrame(render(s, 196, 50)), /‖ PAUSED .* resume +\[next\]/);
  c.handle({ key: 'text', text: ' ' });
  assert.equal(clips[0].paused, false);
  // The clip ends: the editor moves to the next slide, read from the prepared audio.
  clips[0].end();
  await settle();
  assert.equal(s.selected, all[2].id);
  assert.equal(clips[1].text, 'Notes 3.');
  assert.equal(spoken.filter((x) => x.text === 'Notes 3.').length, 1);
  // Left goes back a slide; choosing a slide yourself moves the presentation there.
  c.handle({ key: 'left' });
  await settle();
  assert.equal(clips[1].stopped, true);
  assert.deepEqual([s.selected, s.reading.slideId], [all[1].id, all[1].id]);
  selectSlide(s, all[4].id);
  c.handle({ key: 'text', text: '?' });
  c.handle({ key: 'escape' });
  await settle();
  assert.equal(s.reading.slideId, all[4].id);
  // Esc stops.
  c.handle({ key: 'escape' });
  assert.equal(s.reading, null);
  assert.equal(clips.at(-1).stopped, true);
  assert.match(s.notice, /Stopped presenting/);
});

test('presenting runs to the last slide and stops there; a failed voice waits for Space', async () => {
  const s = createState(),
    { clips, options } = fakes(),
    all = order(s);
  let fail = true;
  const speak = options.speak;
  options.speak = async (text, o) => {
    if (fail) throw Error('quota');
    return speak(text, o);
  };
  const reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  selectSlide(s, all.at(-1).id);
  c.handle({ key: 'text', text: 'P' });
  await settle();
  assert.deepEqual([s.reading.status, s.reading.message], ['error', 'quota']);
  assert.match(plainFrame(render(s, 196, 50)), /✕ VOICE FAILED: quota .*\[again\]/);
  fail = false;
  c.handle({ key: 'text', text: ' ' });
  await settle();
  clips[0].end();
  await settle();
  assert.equal(s.reading.status, 'done');
  assert.match(plainFrame(render(s, 196, 50)), /■ END OF THE LESSON/);
});

test('typing in a box or the chat pauses presenting; [resume] saves the box, leaves it and carries on', async () => {
  const s = createState(),
    { clips, options } = fakes(),
    all = order(s);
  for (const [i, x] of all.entries()) x.notes = `Notes ${i + 1}.`;
  const reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  selectSlide(s, all[1].id);
  const click = (act, where = () => true) => {
    const f = render(s, 196, 50),
      h = f.hits.find((x) => x.act === act && where(x));
    assert.ok(h, `no ${act}`);
    const at = { key: 'mouse', button: 'left', x: h.x, y: h.y + (h.h > 1 ? 1 : 0) };
    c.handle({ ...at, release: false }, f.g, f.hits);
    c.handle({ ...at, release: true }, f.g, f.hits);
  };
  click('speak', (h) => h.key === 'P');
  await settle();
  assert.equal(s.reading.mode, 'present');
  // Into the comments box: the voice pauses, and typing goes into the box, not to the voice.
  click('field', (h) => h.box.field === 'comments');
  assert.equal(s.control, 'comments');
  assert.equal(clips[0].paused, true);
  assert.match(s.notice, /Paused while you type/);
  for (const ch of 'Too long ') c.handle({ key: 'text', text: ch });
  assert.equal(s.reading.paused, true);
  // [resume] saves the comment, leaves the box and carries on.
  click('speak', (h) => h.key === 'toggle');
  assert.equal(all[1].comments, 'Too long ');
  assert.equal(s.control, null);
  assert.equal(clips[0].paused, false);
  // [next], then the chat composer pauses too; [stop] ends it.
  click('speak', (h) => h.key === 'next');
  await settle();
  assert.equal(s.selected, all[2].id);
  click('composer');
  assert.equal(s.reading.paused, true);
  click('speak', (h) => h.key === 'stop');
  assert.equal(s.reading, null);
  // [p read] reads one slide; while it reads, the button says stop.
  click('speak', (h) => h.key === 'p');
  await settle();
  assert.equal(s.reading.mode, 'slide');
  assert.match(plainFrame(render(s, 196, 50)), / p stop .*\[P present\]/);
});

test('a new empty subsection and slide open while a presentation is paused or ended; the voice still skips them', async () => {
  let s = createState();
  const { clips, options } = fakes();
  for (const x of s.slides) x.notes = `Notes ${x.id}.`;
  let reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  const at = (h) => ({ key: 'mouse', button: 'left', x: h.x, y: h.y });
  const hitOf = (act, where = () => true) => {
    const f = render(s, 196, 50),
      h = f.hits.find((x) => x.act === act && where(x));
    assert.ok(h, `no ${act}`);
    return { f, h };
  };
  const click = (act, where) => {
    const { f, h } = hitOf(act, where);
    c.handle({ ...at(h), release: false }, f.g, f.hits);
    c.handle({ ...at(h), release: true }, f.g, f.hits);
  };
  const row = (id) => (h) => outlineRows(s)[h.index]?.id === id;
  const drag = (fromId, toId) => {
    const from = hitOf('outline-row', row(fromId)),
      to = hitOf('outline-row', row(toId));
    c.handle({ ...at(from.h), release: false }, from.f.g, from.f.hits);
    c.handle({ ...at(to.h), release: false, motion: true }, to.f.g, to.f.hits);
    c.handle({ ...at(to.h), release: true }, to.f.g, to.f.hits);
  };
  // A presentation paused and left on, then a subsection and a slide added with the outline's buttons and the
  // subsection dragged between two others: the new title slide and slide have nothing to read.
  click('outline-row', row('S-3'));
  c.handle({ key: 'text', text: 'P' });
  await settle();
  c.handle({ key: 'text', text: ' ' });
  click('outline-row', row('S-4'));
  await settle();
  assert.deepEqual([s.reading.slideId, s.reading.paused], ['S-4', true]);
  click('add', (h) => h.kind === 'subsection');
  const sub = slideById(s, s.selected).titleFor,
    title = s.selected;
  click('add', (h) => h.kind === 'slide');
  const fresh = s.selected;
  assert.equal(slideById(s, fresh).subId, sub);
  // Pressing a row to drag it chooses its slide: the new title slide stops the presentation and stays selected,
  // rather than the presentation moving the author on to the next slide.
  drag(sub, 'SUB-4');
  assert.match(s.notice, /^Moved subsection/);
  assert.deepEqual([s.selected, s.reading], [title, null]);
  // So does a click on its row.
  click('outline-row', row('S-4'));
  c.handle({ key: 'text', text: 'P' });
  await settle();
  c.handle({ key: 'text', text: ' ' });
  assert.deepEqual([s.reading.slideId, s.reading.paused], ['S-4', true]);
  click('outline-row', row(sub));
  await settle();
  assert.deepEqual([s.selected, s.reading], [title, null]);
  assert.match(s.notice, /Stopped presenting: this slide has nothing to read/);
  // Left/Right paging onto them while presenting does the same.
  click('outline-row', row('S-4'));
  c.handle({ key: 'text', text: 'P' });
  await settle();
  c.handle({ key: 'text', text: ' ' });
  c.handle({ key: 'right' });
  await settle();
  assert.deepEqual([s.selected, s.reading], [title, null]);
  c.handle({ key: 'right' });
  assert.equal(s.selected, fresh);
  // After the end of the lesson, too.
  click('outline-row', row('S-7'));
  c.handle({ key: 'text', text: 'P' });
  await settle();
  clips.at(-1).end();
  await settle();
  assert.equal(s.reading.status, 'done');
  click('outline-row', row(fresh));
  await settle();
  assert.deepEqual([s.selected, s.reading], [fresh, null]);
  // The voice reaching them by itself skips them, as before.
  click('outline-row', row('S-4'));
  c.handle({ key: 'text', text: 'P' });
  await settle();
  clips.at(-1).end();
  await settle();
  assert.deepEqual([s.selected, s.reading.slideId, s.reading.status], ['title-SUB-4', 'title-SUB-4', 'playing']);
  c.handle({ key: 'escape' });
  // Saved and opened again, the same shapes (empty titles, generated ids) open from the outline.
  const saved = toDoc(s).sections[1].subsections[1];
  assert.deepEqual([saved.id, saved.titleSlide.id, saved.titleSlide.title, saved.slides[0].id], [sub, title, '', fresh]);
  s = createState(fromDoc(toDoc(s)));
  reader = createReader(s, options);
  c = createController(s, createScheduler(s), { reader });
  click('outline-row', row(sub));
  assert.equal(s.selected, title);
  click('outline-row', row(fresh));
  assert.equal(s.selected, fresh);
});

test('s steps the voice speed 1x, 1.5x, 2x, 3x, 4x; a playing slide resumes at the new speed', async () => {
  const s = createState(),
    { clips, options } = fakes(),
    all = order(s);
  for (const [i, x] of all.entries()) x.notes = `Notes ${i + 1}.`;
  const rates = [],
    play = options.player.play;
  options.player.play = async (wav, rate) => {
    rates.push(rate);
    const clip = await play(wav);
    clip.position = () => 3;
    return clip;
  };
  const reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  selectSlide(s, all[1].id);
  c.handle({ key: 'text', text: 'P' });
  await settle();
  assert.match(plainFrame(render(s, 196, 50)), /\[s 1x\]/);
  c.handle({ key: 'text', text: 's' });
  await settle();
  // The clip restarted at 1.5x on the same slide, not the next one.
  assert.equal(clips[0].stopped, true);
  assert.deepEqual(rates, [1, 1.5]);
  assert.equal(s.selected, all[1].id);
  assert.match(plainFrame(render(s, 196, 50)), /\[s 1\.5x\]/);
  c.handle({ key: 'text', text: 's' });
  await settle();
  assert.deepEqual(rates, [1, 1.5, 2]);
  // The next slide plays at the kept speed.
  clips.at(-1).end();
  await settle();
  assert.deepEqual([s.selected, rates.at(-1)], [all[2].id, 2]);
  c.handle({ key: 'escape' });
  // From the editor: s shows the speed, through 3x and 4x, and wraps back to 1x.
  c.handle({ key: 'text', text: 's' });
  assert.equal(s.speechRate, 3);
  c.handle({ key: 'text', text: 's' });
  assert.equal(s.speechRate, 4);
  c.handle({ key: 'text', text: 's' });
  assert.equal(s.speechRate, 1);
  assert.match(s.notice, /Voice speed 1x/);
});

test('fromSecond cuts a WAV at a time and keeps a valid header', () => {
  const n = 48000,
    h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + n, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(n, 40);
  const cut = fromSecond(Buffer.concat([h, Buffer.alloc(n)]), 0.25);
  assert.equal(cut.length, 44 + 36000);
  assert.equal(cut.readUInt32LE(40), 36000);
  assert.equal(cut.readUInt32LE(4), 36 + 36000);
  assert.equal(fromSecond(Buffer.concat([h, Buffer.alloc(n)]), 9).readUInt32LE(40), 0);
});

test('V opens the voice list at the current voice; a pick restarts the slide being read', async () => {
  const s = createState(),
    { clips, options } = fakes(),
    voices = [],
    speak = options.speak;
  options.speak = async (text, o) => {
    voices.push(o.voice);
    return speak(text, o);
  };
  const reader = createReader(s, options),
    c = createController(s, createScheduler(s), { reader });
  selectSlide(s, 'S-3');
  s.slides.find((x) => x.id === 'S-3').notes = 'Hello.';
  assert.match(plainFrame(render(s, 196, 50)), /\[V Orus\]/);
  c.handle({ key: 'text', text: 'p' });
  await settle();
  c.handle({ key: 'text', text: 'V' });
  assert.equal(s.modal.kind, 'voice');
  assert.equal(s.modal.options.length, 30);
  assert.equal(s.modal.options[s.modal.index].key, 'Orus');
  assert.match(plainFrame(render(s, 196, 50)), /Orus +male +firm/);
  c.handle({ key: 'down' });
  c.handle({ key: 'enter' });
  await settle();
  assert.equal(s.voice, 'Aoede');
  assert.equal(clips[0].stopped, true);
  assert.deepEqual(voices, ['Orus', 'Aoede']);
  assert.deepEqual([s.reading.slideId, s.reading.status], ['S-3', 'playing']);
  assert.match(plainFrame(render(s, 196, 50)), /\[V Aoede\]/);
});

test('the notes box shows the words already spoken in acid as the clip plays, and follows long notes', async () => {
  const s = createState(),
    { clips, options } = fakes(),
    all = order(s),
    wav = (secs) => {
      const n = 48000 * secs,
        h = Buffer.alloc(44);
      h.write('RIFF', 0);
      h.writeUInt32LE(36 + n, 4);
      h.write('WAVEfmt ', 8);
      h.writeUInt32LE(48000, 28);
      h.write('data', 36);
      h.writeUInt32LE(n, 40);
      return Buffer.concat([h, Buffer.alloc(n)]);
    };
  let tick = null,
    heard = 0;
  options.speak = async () => wav(4);
  const play = options.player.play;
  options.player.play = async (w, rate) => Object.assign(await play(w, rate), { position: () => heard });
  options.every = (fn) => ((tick = fn), () => (tick = null));
  all[1].notes = 'Alpha bravo charlie delta echo foxtrot golf hotel.';
  const reader = createReader(s, options);
  selectSlide(s, all[1].id);
  reader.present(all[1].id);
  await settle();
  // The style of a word's first cell in the notes box (cells may hold more than one character, so match by cells).
  const style = (f, word) => {
    for (const row of f.lines)
      for (let x = 0; x < row.length; x++)
        if ([...word].every((ch, k) => row[x + k]?.text === ch)) return row[x].style.fg ?? 'default';
    return 'not shown';
  };
  assert.equal(style(render(s, 196, 50), 'Alpha'), 'default');
  // Half the clip played: the words in the first half are spoken, the rest are not yet.
  heard = 2;
  tick();
  const f = render(s, 196, 50);
  assert.equal(s.reading.heard, 0.5);
  assert.deepEqual([style(f, 'Alpha'), style(f, 'charlie')], ['accent', 'accent']);
  assert.equal(style(f, 'foxtrot'), 'default');
  clips[0].end();
  await settle();
  assert.deepEqual([s.reading.slideId, s.reading.heard], [all[2].id, 0]);
  // Notes longer than the box scroll to keep the words being read in view.
  all[3].notes = Array.from({ length: 60 }, (_, i) => `Line${i} word word word word word word.`).join('\n');
  reader.present(all[3].id);
  await settle();
  heard = 3.6;
  tick();
  const late = plainFrame(render(s, 196, 50));
  assert.doesNotMatch(late, /Line0 /);
  assert.match(late, /Line5\d /);
  reader.stop();
  assert.equal(tick, null, 'stopping ends the watch');
});
