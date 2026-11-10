import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, mkdir, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { samplePng, validatePng, admitPng, MAX_BYTES, crc32 } from '../src/png.mjs';
import { imageMode, transmit, createImageTransport } from '../src/kitty.mjs';
import { createState, selectSlide, focusField, setChoice } from '../src/model.mjs';
import { render, plainFrame } from '../src/render.mjs';
import { createHost } from '../src/host.mjs';
import { createScheduler } from '../src/scheduler.mjs';
import { createController } from '../src/controller.mjs';
import { EventEmitter } from 'node:events';
test('generated PNGs deterministic, valid CRC/chunks, actual decompressed RGB pixels, semantic variants', () => {
  const kinds = ['nearby', 'freshness', 'etag', 'exercise', 'policy', 'recap'],
    seen = [];
  for (const kind of kinds) {
    const bytes = samplePng(kind);
    assert.deepEqual(bytes, samplePng(kind));
    assert.deepEqual(validatePng(bytes), { width: 640, height: 240 });
    assert.ok(bytes.length < MAX_BYTES);
    let offset = 8,
      data = [];
    while (offset < bytes.length) {
      const n = bytes.readUInt32BE(offset),
        type = bytes.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') data.push(bytes.subarray(offset + 8, offset + 8 + n));
      offset += n + 12;
    }
    const pixels = inflateSync(Buffer.concat(data));
    assert.equal(pixels.length, 240 * (640 * 3 + 1));
    assert.ok(pixels.some((b) => b > 0));
    seen.push(bytes.toString('base64'));
  }
  assert.equal(new Set(seen).size, kinds.length);
  assert.notDeepEqual(samplePng('policy', 'before'), samplePng('policy', 'after'));
});
test(
  'PNG admission: regular file only, cap, signature, dimensions, ' + 'corrupt/truncated/unsupported pixels, symlinks',
  async () => {
    const dir = await mkdtemp(join(await realpath(tmpdir()), 'lesson-png-'));
    try {
      const bytes = samplePng('freshness'),
        file = join(dir, 'timeline.png');
      await writeFile(file, bytes);
      const admitted = await admitPng(file);
      assert.equal(admitted.name, 'timeline.png');
      assert.deepEqual(admitted.bytes, bytes);
      await symlink(file, join(dir, 'link.png'));
      await assert.rejects(admitPng(join(dir, 'link.png')), /Symlinks/);
      await mkdir(join(dir, 'folder'));
      await assert.rejects(admitPng(join(dir, 'folder')), /regular/);
      for (const [name, data] of [
        ['large', Buffer.alloc(MAX_BYTES + 1)],
        ['notpng', Buffer.from('not png')],
        ['truncated', bytes.subarray(0, bytes.length - 4)],
        ['crc', Buffer.from(bytes)],
      ]) {
        if (name === 'crc') data[45] ^= 255;
        const path = join(dir, name);
        await writeFile(path, data);
        await assert.rejects(admitPng(path));
      }
      for (const mutator of [
        (b) => b.writeUInt32BE(4097, 16),
        (b) => {
          b[24] = 16;
        },
        (b) => {
          b[28] = 1;
        },
      ]) {
        const b = Buffer.from(bytes);
        mutator(b);
        b.writeUInt32BE(crc32(b.subarray(12, 29)), 29);
        assert.throws(() => validatePng(b));
      }
    } finally {
      await rm(dir, { recursive: true });
    }
  },
);
test(
  'attachment error retains prior pixels/path draft; review and busy block; late ' +
    'completion after the controller is gone changes nothing',
  async () => {
    const s = createState();
    selectSlide(s, 'S-3');
    focusField(s, 'imageDesc');
    // The attach button follows its image box.
    s.control = 'attach:imageDesc';
    const prior = { bytes: samplePng(), name: 'prior.png', width: 640, height: 240 };
    s.pictures['S-3'] = { imageDesc: prior };
    const jobs = createScheduler(s);
    let calls = 0;
    const c = createController(s, jobs, {
      attach: async () => {
        calls++;
        throw Error('private absolute path not echoed');
      },
    });
    c.handle({ key: 'enter' });
    s.modal.input = '/private/example.png';
    c.handle({ key: 'enter' });
    await new Promise((r) => setImmediate(r));
    assert.equal(s.pictures['S-3'].imageDesc, prior);
    assert.equal(s.modal.input, '/private/example.png');
    assert.match(s.modal.error, /previous picture kept/);
    assert.equal(s.chat.length, 0);
    c.handle({ key: 'escape' });
    jobs.setReview(true);
    c.handle({ key: 'enter' });
    assert.equal(s.modal, null);
    assert.equal(calls, 1);
    jobs.dispose();
    const t = createState();
    selectSlide(t, 'S-3');
    focusField(t, 'imageDesc');
    // The attach button follows its image box.
    t.control = 'attach:imageDesc';
    const j = createScheduler(t),
      original = t.pictures['S-3'].imageDesc;
    let resolve;
    const controller = createController(t, j, { attach: () => new Promise((r) => (resolve = r)) });
    controller.handle({ key: 'enter' });
    controller.handle({ key: 'enter' });
    controller.dispose();
    resolve(prior);
    await new Promise((r) => setImmediate(r));
    assert.equal(t.pictures['S-3'].imageDesc, original);
    j.dispose();
  },
);
test('Kitty detection rejects uncertain auto hosts; plain/NO_COLOR beat forced mode; no probes', () => {
  for (const env of [
    { TERM: 'xterm' },
    { TERM: 'dumb', TERM_PROGRAM: 'herdr' },
    { TERM: 'screen', TERM_PROGRAM: 'herdr' },
    { TERM: 'xterm', TMUX: 'x', TERM_PROGRAM: 'herdr' },
    { TERM: 'xterm', STY: 'x', KITTY_WINDOW_ID: '1' },
  ])
    assert.equal(imageMode({ env, tty: true }), false);
  assert.equal(imageMode({ env: { TERM: 'xterm', TERM_PROGRAM: 'herdr' }, tty: true }), true);
  assert.equal(imageMode({ env: { TERM: 'xterm-kitty' }, tty: true }), true);
  assert.equal(imageMode({ env: { TERM_PROGRAM: 'herdr' }, tty: false }), false);
  assert.equal(imageMode({ mode: 'kitty', plain: true, tty: true }), false);
  assert.equal(imageMode({ mode: 'kitty', env: { NO_COLOR: '' }, tty: true }), false);
  assert.equal(imageMode({ mode: 'text', env: { TERM_PROGRAM: 'herdr' }, tty: true }), false);
});
test('protocol PNG f=100 chunking, absolute c/r placements, unique paired images and cursor restoration', () => {
  const bytes = Buffer.alloc(12000, 42),
    rect = { x: 30, y: 12, width: 40, height: 8 },
    out = transmit(bytes, 1, 2, rect);
  assert.match(out, /a=T,f=100,t=d,q=2,i=1,p=2,c=40,r=8/);
  assert.ok(out.startsWith('\x1b7\x1b[13;31H'));
  assert.ok(out.endsWith('\x1b8'));
  const payloads = [...out.matchAll(/\x1b_G([^;]*);([^\x1b]*)\x1b\\/g)];
  assert.ok(payloads.length > 1);
  for (const [, params, payload] of payloads) {
    assert.ok(payload.length <= 4096);
    assert.ok(payload.length % 4 === 0);
    assert.match(params, /m=[01]/);
  }
  assert.deepEqual(Buffer.from(payloads.map((m) => m[2]).join(''), 'base64'), bytes);
  const s = createState();
  selectSlide(s, 'S-6');
  const f = render(s, 140, 40, { graphics: true });
  let writes = '';
  const tx = createImageTransport((x) => (writes += x));
  tx.sync(f.images);
  assert.equal(tx.placements.length, 2);
  assert.notEqual(tx.placements[0].id, tx.placements[1].id);
  assert.notEqual(tx.placements[0].placement, tx.placements[1].placement);
  const sent = writes;
  tx.sync(f.images);
  assert.equal(writes, sent);
  tx.dispose();
  assert.equal(tx.placements.length, 0);
  assert.equal((writes.match(/a=d,d=I/g) || []).length, 2);
});
function streams() {
  const input = new EventEmitter(),
    output = new EventEmitter(),
    signals = new EventEmitter();
  Object.assign(input, {
    isTTY: true,
    isRaw: false,
    setRawMode(v) {
      this.isRaw = v;
    },
    resume() {},
    pause() {},
  });
  Object.assign(output, {
    columns: 140,
    rows: 40,
    isTTY: true,
    write(data) {
      this.capture += data;
    },
    capture: '',
  });
  return { input, output, signals };
}
test(
  'host image lifetime: no retransmit on chat typing/busy; deletes ' + 'slide/view/layout/overlay/resize/text/exit',
  () => {
    const io = streams(),
      host = createHost({ ...io, mode: 'kitty', env: {} });
    host.start();
    selectSlide(host.state, 'S-6');
    host.draw();
    assert.equal((io.output.capture.match(/a=T,f=100/g) || []).length, 2);
    let at = io.output.capture.length;
    host.state.pane = 'chat';
    io.input.emit('data', Buffer.from('hello'));
    assert.ok(!io.output.capture.slice(at).includes('a=T'));
    host.state.jobs = [{ id: 1, slideId: 'S-6', field: 'afterDesc', status: 'working' }];
    host.draw();
    assert.ok(!io.output.capture.slice(at).includes('a=T'));
    host.state.jobs = [];
    // Typing in a form box under the slide keeps the pictures in place.
    host.state.pane = 'workbench';
    focusField(host.state, 'beforeCap');
    at = io.output.capture.length;
    io.input.emit('data', Buffer.from(' more'));
    assert.match(host.state.edit.text, / more$/);
    io.input.emit('data', Buffer.from('\t'));
    assert.equal(host.state.edit, null);
    assert.ok(!io.output.capture.slice(at).includes('a=T'));
    assert.ok(!io.output.capture.slice(at).includes('a=d,d=I'));
    for (const change of [
      () => selectSlide(host.state, 'S-3'),
      () => {
        host.state.view = 'preview';
      },
      () => {
        host.state.view = 'workspace';
        setChoice(host.state, 'layout', 'points-image');
      },
      () => {
        io.output.columns = 100;
        io.output.emit('resize');
      },
      () => {
        host.state.images = false;
      },
      () => {
        host.state.images = true;
      },
      () => {
        host.state.modal = { kind: 'help', lines: ['Help'] };
      },
      () => {
        host.state.modal = null;
      },
    ]) {
      const hadImages = host.frame.images.length > 0;
      at = io.output.capture.length;
      change();
      host.draw();
      const emitted = io.output.capture.slice(at);
      const deleteIndex = emitted.indexOf('a=d,d=I');
      const transmitIndex = emitted.indexOf('a=T,f=100');
      if (hadImages) assert.ok(deleteIndex >= 0, 'old placements must be deleted');
      else assert.equal(deleteIndex, -1, 'no obsolete placements exist');
      if (host.frame.images.length) assert.ok(transmitIndex >= 0, 'visible replacements must be transmitted');
      else assert.equal(transmitIndex, -1, 'hidden images must not be transmitted');
      if (hadImages && host.frame.images.length) {
        assert.ok(emitted.lastIndexOf('a=d,d=I') < transmitIndex, 'all deletes must precede replacement PNGs');
      }
    }
    at = io.output.capture.length;
    host.stop();
    assert.match(io.output.capture.slice(at), /a=d,d=I/);
    assert.equal(io.input.isRaw, false);
    assert.match(io.output.capture, /\x1b\[\?2004l/);
    assert.match(io.output.capture, /\x1b\[\?1049l/);
    assert.equal(io.signals.listenerCount('SIGINT'), 0);
    assert.equal(io.input.listenerCount('data'), 0);
  },
);
test('text and NO_COLOR host paths emit zero image bytes; cleanup on all signals and handled errors', () => {
  for (const variant of ['text', 'nocolor', 'SIGINT', 'SIGTERM', 'SIGHUP', 'error']) {
    const io = streams();
    let errors = 0;
    const host = createHost({
      ...io,
      mode: variant === 'text' ? 'text' : 'kitty',
      env: variant === 'nocolor' ? { NO_COLOR: '' } : {},
      onError: () => errors++,
    });
    host.start();
    selectSlide(host.state, 'S-3');
    host.draw();
    if (['text', 'nocolor'].includes(variant)) assert.ok(!io.output.capture.includes('\x1b_G'));
    if (variant.startsWith('SIG')) io.signals.emit(variant);
    else if (variant === 'error') io.input.emit('error', Error('handled'));
    else host.stop();
    assert.equal(io.input.isRaw, false);
    assert.equal(host.stopped, true);
    assert.equal(host.scheduler.running, 0);
    if (variant === 'error') assert.equal(errors, 1);
  }
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const settle = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve));
};
// Stands in for copying into the lesson's picture folder.
const store = async (_lesson, _bytes, stem) => `test.lesson.assets/${stem}.png`;

test(
  'pending admission locks its dialog; cancelled and replacement reads are safe in both ' + 'completion orders',
  async () => {
    for (const completionOrder of [
      ['A', 'B'],
      ['B', 'A'],
    ]) {
      const state = createState();
      selectSlide(state, 'S-3');
      focusField(state, 'imageDesc');
      // The attach button follows its image box.
      state.control = 'attach:imageDesc';
      const requests = { A: deferred(), B: deferred() };
      const images = {
        A: { bytes: samplePng('freshness'), name: 'A.png', width: 640, height: 240 },
        B: { bytes: samplePng('etag'), name: 'B.png', width: 640, height: 240 },
      };
      const calls = [],
        original = state.pictures['S-3'].imageDesc;
      const scheduler = createScheduler(state);
      const controller = createController(state, scheduler, {
        store,
        attach(path) {
          calls.push(path);
          return requests[path].promise;
        },
      });
      try {
        controller.handle({ key: 'enter' });
        controller.handle({ key: 'text', text: 'A' });
        controller.handle({ key: 'enter' });
        const originalDialog = state.modal;
        assert.equal(originalDialog.pending, true);
        controller.handle({ key: 'text', text: 'B' });
        controller.handle({ key: 'paste', text: 'B' });
        controller.handle({ key: 'backspace' });
        controller.handle({ key: 'enter' });
        assert.equal(originalDialog.input, 'A');
        assert.deepEqual(calls, ['A']);
        const pendingFrame = render(state, 140, 40);
        assert.match(plainFrame(pendingFrame), /CHECKING PNG - input locked/);
        assert.match(plainFrame(pendingFrame), /WAIT ATTACHMENT/);
        assert.equal(pendingFrame.cursor, null);

        controller.handle({ key: 'escape' });
        controller.handle({ key: 'enter' });
        controller.handle({ key: 'text', text: 'B' });
        controller.handle({ key: 'enter' });
        assert.deepEqual(calls, ['A', 'B']);
        for (const key of completionOrder) {
          requests[key].resolve(images[key]);
          await settle();
          if (key === 'A' && completionOrder[0] === 'A') {
            assert.equal(state.pictures['S-3'].imageDesc, original);
            assert.equal(state.modal.pending, true);
          }
        }
        assert.equal(state.pictures['S-3'].imageDesc.bytes, images.B.bytes);
        assert.equal(state.pictures['S-3'].imageDesc.file, 'test.lesson.assets/S-3-image.png');
        assert.equal(state.modal, null);
      } finally {
        controller.dispose();
        scheduler.dispose();
      }
    }
  },
);

test('failed admission unlocks the retained path for correction and explicit retry', async () => {
  const state = createState();
  selectSlide(state, 'S-3');
  focusField(state, 'imageDesc');
  // The attach button follows its image box.
  state.control = 'attach:imageDesc';
  const request = deferred();
  const scheduler = createScheduler(state);
  const controller = createController(state, scheduler, { store, attach: () => request.promise });
  controller.handle({ key: 'enter' });
  controller.handle({ key: 'text', text: 'A' });
  controller.handle({ key: 'enter' });
  request.reject(Error('admission failed'));
  await settle();
  assert.equal(state.modal.pending, false);
  assert.equal(state.modal.input, 'A');
  assert.match(state.modal.error, /previous picture kept/);
  controller.handle({ key: 'text', text: 'B' });
  assert.equal(state.modal.input, 'AB');
  controller.dispose();
  scheduler.dispose();
});

test('successful attachment stays visible with an empty or subsequently cleared concept', async () => {
  const state = createState();
  selectSlide(state, 'S-3');
  focusField(state, 'imageDesc');
  // The attach button follows its image box.
  state.control = 'attach:imageDesc';
  const slide = state.slides.find((slide) => slide.id === state.selected);
  slide.imageDesc = '';
  const attachment = { bytes: samplePng('freshness'), name: 'diagram.png', width: 640, height: 240 };
  const scheduler = createScheduler(state);
  const controller = createController(state, scheduler, { store, attach: async () => attachment });
  controller.handle({ key: 'enter' });
  controller.handle({ key: 'enter' });
  await settle();
  assert.equal(state.pictures[slide.id].imageDesc.bytes, attachment.bytes);
  assert.equal(state.pictures[slide.id].imageDesc.source, 'attached');

  for (const concept of ['', 'A temporary concept', '']) {
    slide.imageDesc = concept;
    for (const view of ['workspace', 'preview']) {
      state.view = view;
      const frame = render(state, 140, 40, { graphics: true });
      assert.equal(frame.images.length, 1);
      assert.equal(frame.images[0].bytes, attachment.bytes);
      const rect = frame.images[0].rect;
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        assert.ok(frame.lines[y].slice(rect.x, rect.x + rect.width).every((cell) => cell.text === ' '));
      }
      if (!concept) {
        const noteRow = frame.lines.findIndex((row) =>
          row
            .map((cell) => cell.text)
            .join('')
            .includes('No image concept'),
        );
        assert.ok(noteRow >= 0);
        assert.ok(noteRow < rect.y || noteRow >= rect.y + rect.height);
      }
    }
  }
  controller.dispose();
  scheduler.dispose();
});

test('a click on a picture in the preview, or z, shows it over the whole window; Esc or any click closes it', () => {
  const s = createState();
  selectSlide(s, 'S-6');
  const c = createController(s, createScheduler(s));
  const small = render(s, 140, 40, { graphics: true }),
    after = small.hits.find((h) => h.act === 'picture-view' && h.field === 'afterDesc');
  const click = (frame, x, y) => c.handle({ key: 'mouse', button: 'left', x, y, release: false }, frame.g, frame.hits);
  click(small, after.x + 2, after.y + 2);
  assert.deepEqual(s.modal, { kind: 'picture', slideId: 'S-6', field: 'afterDesc' });
  const big = render(s, 140, 40, { graphics: true });
  assert.equal(big.images.length, 1);
  assert.equal(big.images[0].bytes, s.pictures['S-6'].afterDesc.bytes);
  const shown = big.images[0].rect;
  assert.ok(shown.width > 100 && shown.height <= 36, JSON.stringify(shown));
  // Both pictures sit on white cells, which show through transparent pixels.
  const white = (frame, r) => frame.lines[r.y + Math.floor(r.height / 2)][r.x + Math.floor(r.width / 2)].style.bg;
  assert.equal(white(big, shown), 'primary');
  assert.ok(small.images.every((image) => white(small, image.rect) === 'primary'));
  assert.match(plainFrame(big).split('\n')[0], /PICTURE/);
  click(big, 5, 20);
  assert.equal(s.modal, null);
  // z shows the slide's first picture; Esc closes it.
  c.handle({ key: 'text', text: 'z' });
  assert.equal(s.modal.field, 'imageDesc');
  c.handle({ key: 'escape' });
  assert.equal(s.modal, null);
  // Without graphics the view names the file instead.
  c.handle({ key: 'text', text: 'z' });
  assert.match(plainFrame(render(s, 100, 30)), /This terminal shows no pictures here/);
});
