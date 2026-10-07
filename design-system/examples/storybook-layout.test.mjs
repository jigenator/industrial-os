import test from 'node:test';
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { GLYPHS, lineWidth, paint } from '../foundation/cells.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel } from '../elements/numbered-panel/numbered-panel.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { scan } from '../motions/scan.mjs';
import { revealDuration } from '../motions/reveal.mjs';
import { advance, composeStorybook, hitAction, initialState, playbackTime, press } from './storybook-layout.mjs';
import { STORIES, canPlay } from './storybook-stories.mjs';

const allowed = (s) => [...s].every((c) => (c >= ' ' && c <= '~') || GLYPHS.includes(c));
const plain = (view) => view.lines.map((l) => paint(l, 'none'));
const story = (id) => STORIES.findIndex((s) => s.id === id);
const at = (id, variant = 0, extra = {}) => ({ ...initialState(), story: story(id), variant, ...extra });
const playing = (id, variant = 0, startedAt = 0) => at(id, variant, { playback: { status: 'playing', elapsed: 0, startedAt } });

test('every story fits every width from 1 to 160 at short, normal, and unbounded heights', () => {
  const states = [...STORIES.map((_, i) => ({ ...initialState(), story: i })), playing('scan', 0), playing('reveal', 1), playing('ghost', 1), playing('marker-timeline'), at('colors', 1), { ...initialState(), help: true }];
  for (const state of states) {
    for (let columns = 1; columns <= 160; columns++) {
      for (const rows of [1, 2, 3, 5, 9, 14, 24, undefined]) {
        const view = composeStorybook(state, { columns, rows, mode: 'TRUECOLOR', now: 700 });
        if (rows !== undefined) assert.ok(view.lines.length <= rows, `${columns}x${rows}`);
        for (const line of view.lines) {
          assert.equal(lineWidth(line), columns, `${STORIES[state.story].id} ${columns}x${rows}`);
          assert.ok(allowed(paint(line, 'none')), `${columns}x${rows}`);
        }
      }
    }
  }
});

test('the story, its state, and key hints stay visible at every supplied size, down to 1x1', () => {
  for (const [columns, rows] of [[160, 50], [120, 40], [80, 24], [72, 16], [60, 12], [40, 8], [30, 5], [24, 3], [20, 2]]) {
    STORIES.forEach((s, i) => {
      s.variants.forEach((v, j) => {
        const all = plain(composeStorybook({ ...initialState(), story: i, variant: j }, { columns, rows })).join('\n');
        const number = String(i + 1).padStart(2, '0');
        assert.ok(all.includes(`▐${number}▌`) || all.startsWith(`${number} `), `${columns}x${rows} ${s.id} number`);
        if (columns >= 24) assert.ok(all.includes(`[${v.name}]`), `${columns}x${rows} ${s.id} ${v.name}`);
        assert.match(all.split('\n').at(-1), /Q/, `${columns}x${rows} quit hint`);
      });
    });
  }
  assert.deepEqual(plain(composeStorybook(initialState(), { columns: 1, rows: 1 })), ['0']);
  const g = String(story('gauge') + 1).padStart(2, '0');
  assert.deepEqual(plain(composeStorybook(at('gauge'), { columns: 12, rows: 2 })), [`${g}  [KNOWN] `, '? Q         ']);
  assert.deepEqual(plain(composeStorybook(at('numbered-panel', 2), { columns: 24, rows: 3 })), ['01  [HEADER PRIORITY]   ', '                        ', 'LINES 1-1 OF 55  ? Q    ']);
  assert.equal(plain(composeStorybook(at('gauge', 1), { columns: 30, rows: 3 }))[0], `${g} GAUGE  [ZERO] 2/10         `);
});

test('the wide layout keeps an index of every story with the selection marked in text', () => {
  const label = (i) => `${String(i + 1).padStart(2, '0')} ${STORIES[i].title}`;
  const unbounded = plain(composeStorybook(at('pulse'), { columns: 120 })).join('\n');
  for (const i of STORIES.keys()) assert.ok(unbounded.includes(label(i)), STORIES[i].title);
  assert.match(unbounded, /1 COMPONENTS[\s\S]*2 MOTIONS[\s\S]*3 FOUNDATION[\s\S]*COLORS/);
  assert.doesNotMatch(unbounded, /MORE (ABOVE|BELOW)/, 'a full-height snapshot lists every story');
  const all = plain(composeStorybook(at('pulse'), { columns: 120, rows: 40 })).join('\n');
  assert.match(all, new RegExp(`> ${label(story('pulse'))}`));
  assert.match(all, /FIXTURE VALUES AND DEMONSTRATION PLAYBACK, NOT LIVE TELEMETRY/);
  // A short index scrolls with the selection: every story is visible when selected, with counts of the rest.
  for (const rows of [15, 24, 40]) {
    for (const i of STORIES.keys()) {
      const lines = plain(composeStorybook({ ...initialState(), story: i }, { columns: 100, rows }));
      const side = lines.map((l) => [...l].slice(0, 22).join('').trimEnd());
      assert.ok(side.includes(`> ${label(i)}`), `${rows} rows: story ${i} visible`);
      const shown = side.filter((l) => /^[> ] \d\d [A-Z]/.test(l) && !/ MORE (ABOVE|BELOW)$/.test(l)).length;
      const more = side.map((l) => /^ {2}(\d+) MORE (ABOVE|BELOW)$/.exec(l)).filter(Boolean).reduce((n, m) => n + Number(m[1]), 0);
      assert.equal(shown + more, STORIES.length, `${rows} rows, story ${i}: shown plus hidden counts every story`);
    }
  }
  // No sidebar when it would not fit; the panel header still names the story.
  assert.doesNotMatch(plain(composeStorybook(at('pulse'), { columns: 71, rows: 40 })).join('\n'), /COMPONENTS/);
  assert.doesNotMatch(plain(composeStorybook(at('pulse'), { columns: 120, rows: 10 })).join('\n'), /COMPONENTS/);
});

test('component specimens are the real renderers called with the arguments the usage text shows', () => {
  const gaugeStory = STORIES[story('gauge')];
  const zero = gaugeStory.specimen(gaugeStory.variants[1], 80);
  assert.deepEqual(zero.lines, [...gauge({ label: 'ZERO', value: 0 }, { width: 56 }), gaugeScale({}, { width: 56 })]);
  assert.deepEqual(zero.calls, ["gauge({ label: 'ZERO', value: 0 }, { width: 56 })", 'gaugeScale({}, { width: 56 })']);
  const rows = STORIES[story('status-row')];
  const error = rows.specimen(rows.variants[3], 30);
  assert.deepEqual(error.lines, statusRow({ label: 'PARSE', value: 'specimen parse failed', status: 'error' }, { width: 30 }));
  const plates = STORIES[story('label-plate')];
  assert.deepEqual(plates.specimen(plates.variants[2], 40).lines[0].slice(0, 3), labelPlate('WARN HEAT', { tone: 'warning' }));
  // Narrower than the plate: the renderer truncates it, and the usage says so, rather than clipping mid-plate.
  const tight = plates.specimen(plates.variants[0], 8);
  assert.deepEqual(tight.lines[0], labelPlate('SECTOR 7', { tone: 'accent', maxWidth: 8 }));
  assert.deepEqual(tight.calls, ["labelPlate('SECTOR 7', { tone: 'accent', maxWidth: 8 })"]);
  const all = plain(composeStorybook(at('gauge', 1), { columns: 120, rows: 60 })).join('\n');
  assert.ok(all.includes("gauge({ label: 'ZERO', value: 0 }, { width: 56 })"));
  assert.ok(all.includes('elements/gauge/README.md'));
});

test('state variants cover gauge, status row, plate, and panel states without color', () => {
  const text = (id) => STORIES[story(id)].variants.map((v, j) => plain(composeStorybook(at(id, j), { columns: 120 })).join('\n')).join('\n');
  const gauges = text('gauge');
  for (const shown of ['64.0 %', '0.0 %', '100.0 %', 'UNKNOWN', '╱╱╱', '7.25 L/m']) assert.ok(gauges.includes(shown), shown);
  const rows = text('status-row');
  for (const shown of ['○ INFO', '● OK', '▲ WARN', '✕ ERROR', '? N/A', 'FORM stacked at 22 cells']) assert.ok(rows.includes(shown), shown);
  const plates = text('label-plate');
  for (const shown of ['▐ SECTOR 7 ▌', '▐ MANIFEST ▌', '▐ WARN HEAT ▌', '▐ FAULT E21 ▌', '▐01▌', '▐ CALIBRA… ▌']) assert.ok(plates.includes(shown), shown);
  const panels = text('numbered-panel');
  for (const shown of ['FORM full at 48 cells', 'FORM compact at 36 cells', 'CALIBRATION SEQU…']) assert.ok(panels.includes(shown), shown);
  assert.equal(STORIES[story('gauge')].variants[3].input.value, null, 'unknown stays null, never zero');
});

test('the new element states read without color: words, shapes, and digits carry them', () => {
  const text = (id) => STORIES[story(id)].variants.map((v, j) => plain(composeStorybook(at(id, j), { columns: 120 })).join('\n')).join('\n');
  const expect = {
    gauge: ['70.0 %', '▲ WARN', '▲ HIGH', '? UNKNOWN'],
    'label-plate': [' 01 ACT ', ' 03 MDL ', '▐ MODEL ▌'],
    'count-plate': ['CMP×??', 'CMP×00', 'CMP×04', 'CMP×99+', ' 03 AU ', '  ? AU ', ' 120 AU ', '###'],
    'mode-plate': ['⌑ PNYTL // LTE', '⌑ PNYTL // UNK', '• PNYTL // LTE', '◆ LINK // ON'],
    'state-chip': ['▲ UP×1', '▲ FIX ◆ EDIT', '✕ MISS', '✕ UNAV', '· CHK', '· OFF'],
    lamp: ['PLAIN: a full block', 'PLAIN: a space', 'PLAIN: a hatch'],
    'pixel-numeral': ['▀▀▀ ▀▀▀', 'FALLBACK', '64.0'],
    'segment-meter': ['GPT ■■■■■■■■', 'pending', 'timeout', '16m', 'none', '????????', '41m', '4h03m'],
    'thread-rail': ['█  ROOT  █·█·█·······  03 AU', '00 AU', '╱  ROOT', '? AU', '120 AU'],
    'instrument-frame': ['┏━ CMP×12', 'cwd /launch unrelated', 'FORM minimal at 30 cells', 'gutter 1'],
    'transcript-marker': ['DIRECTIVE UPDATED  ││ │ │  │  │   │', 'DIRECTIVE UPDATED  ││ │ │ '],
  };
  for (const [id, shown] of Object.entries(expect)) {
    const all = text(id);
    for (const s of shown) assert.ok(all.includes(s), `${id}: ${s}`);
  }
});

test('motion previews are the real motion over real renderer output, framed by a still panel', () => {
  const s = STORIES[story('scan')];
  const v = s.variants[0];
  const body = [...gauge({ label: 'FILL', value: 42.5 }, { width: 56, readoutWidth: 8 }), ...gauge({ label: 'FLOW', value: null, max: 12, unit: 'L/m' }, { width: 56, readoutWidth: 8 }), gaugeScale({}, { width: 56, readoutWidth: 8 })];
  const frame = { number: 1, title: 'BAY 04', meta: 'DEMONSTRATION' };
  assert.deepEqual(s.specimen(v, 80, { animate: true, time: 1200 }).lines, numberedPanel(frame, scan(body, { time: 1200 }), { width: 60 }));
  assert.deepEqual(s.specimen(v, 80).lines, numberedPanel(frame, body, { width: 60 }), 'motion off is the input');
  assert.ok(s.specimen(v, 80, { animate: true, time: 1200 }).calls.includes('frame = scan(body, { time })'));
  assert.ok(s.specimen(v, 80).calls.includes('frame = scan(body, { animate: false })'));
  const r = STORIES[story('reveal')];
  assert.equal(r.duration(r.variants[1], 80), revealDuration(3, { veil: 'blank', stagger: 120 }));
  assert.equal(s.duration(v, 80), null, 'scan loops');
});

test('the composed frame follows playback time; motion off and t=0 of a loop show the input', () => {
  const color = (state, now) => composeStorybook(state, { columns: 120, rows: 40, mode: 'TRUECOLOR', now }).lines.map((l) => paint(l, 'truecolor')).join('\n');
  const off = color(at('scan'), 0);
  const mid = color(playing('scan', 0, 100), 1300);
  assert.notEqual(stripVTControlCharacters(off), stripVTControlCharacters(mid), 'status line changes');
  assert.match(stripVTControlCharacters(mid), /▐ DEMO ▌ PLAYING {2}1\.20 s {2}loop 2\.40 s/);
  assert.match(stripVTControlCharacters(off), /▐ DEMO ▌ MOTION OFF {2}stable view, P plays/);
  const specimen = (text) => text.split('\n').filter((l) => /FILL|FLOW/.test(stripVTControlCharacters(l))).join('\n');
  assert.notEqual(specimen(mid), specimen(off), 'band restyles cells');
  assert.equal(specimen(color(playing('scan', 0, 100), 100)), specimen(off), 'time 0 equals input');
  assert.deepEqual(composeStorybook(playing('scan'), { columns: 90, rows: 30, now: 555 }), composeStorybook(playing('scan'), { columns: 90, rows: 30, now: 555 }));
  // A blank reveal changes decorative text only; complete error details remain outside the veil.
  const preview = (state) => plain(composeStorybook(state, { columns: 120, rows: 40, now: 50 })).filter((l) => l.includes('│ │')).join('\n');
  const early = preview(playing('reveal', 1));
  assert.match(early, /specimen parse failed/);
  assert.match(early, /✕ ERROR/);
  assert.match(preview(at('reveal', 1)), /specimen parse failed/);
});

test('color and plain frames have the same cells; plain frames have no escapes', () => {
  for (const state of [initialState(), playing('pulse', 0), playing('blink', 1), playing('nudge'), playing('marker-timeline', 1), at('signal-colors'), { ...initialState(), help: true }]) {
    for (const [columns, rows] of [[120, 40], [48, 12], [12, 3]]) {
      for (const line of composeStorybook(state, { columns, rows, mode: 'TRUECOLOR', now: 1500 }).lines) {
        assert.equal(stripVTControlCharacters(paint(line, 'truecolor')), paint(line, 'none'));
        assert.doesNotMatch(paint(line, 'none'), /\x1b/);
      }
    }
  }
});

test('story and state navigation wraps, resets scrolling, and turns motion off', () => {
  const n = STORIES.length;
  let s = press(initialState(), 'prev-story');
  assert.equal(s.story, n - 1);
  s = press(s, 'next-story');
  assert.equal(s.story, 0);
  s = press(s, 'story:2');
  assert.equal(s.story, 2);
  assert.equal(press(s, 'story:2'), s, 'same story is a no-op');
  assert.equal(press(s, `story:${n}`), s, 'out of range is a no-op');
  const count = STORIES[2].variants.length;
  assert.equal(press(s, 'prev-variant').variant, count - 1);
  assert.equal(press(press(s, 'next-variant'), 'next-variant').variant, 2);
  s = { ...playing('scan'), offset: 9 };
  for (const action of ['next-story', 'prev-story', 'next-variant', 'prev-variant', 'story:0']) {
    const next = press(s, action, { now: 10, mode: 'TRUECOLOR' });
    assert.equal(next.offset, 0, action);
    assert.equal(next.playback.status, 'off', action);
  }
  assert.equal(press(s, 'bogus'), s);
  assert.equal(press(s, 'toString'), s);
});

test('paging is bounded by the last frame', () => {
  const view = composeStorybook(initialState(), { columns: 60, rows: 12 });
  assert.ok(view.maxOffset > view.page);
  let s = initialState();
  s = press(s, 'page-down', view);
  assert.equal(s.offset, view.page);
  for (let i = 0; i < 20; i++) s = press(s, 'page-down', view);
  assert.equal(s.offset, view.maxOffset);
  const last = composeStorybook(s, { columns: 60, rows: 12 });
  assert.match(plain(last).at(-1), new RegExp(`LINES ${view.maxOffset + 1}-\\d+ OF \\d+`));
  for (let i = 0; i < 20; i++) s = press(s, 'page-up', view);
  assert.equal(s.offset, 0);
  // A stale offset is clamped by the next frame rather than showing blank details.
  assert.equal(composeStorybook({ ...initialState(), offset: 999 }, { columns: 60, rows: 12 }).offset, view.maxOffset);
});

test('playback: default off, play, pause holds time, resume, replay, motion off', () => {
  const ctx = (now) => ({ now, mode: 'TRUECOLOR' });
  let s = at('scan');
  assert.equal(s.playback.status, 'off');
  s = press(s, 'play-pause', ctx(1000));
  assert.deepEqual(s.playback, { status: 'playing', elapsed: 0, startedAt: 1000 });
  assert.equal(playbackTime(s.playback, 1750), 750);
  s = press(s, 'play-pause', ctx(1750));
  assert.deepEqual(s.playback, { status: 'paused', elapsed: 750, startedAt: null });
  assert.equal(playbackTime(s.playback, 9999), 750);
  s = press(s, 'play-pause', ctx(5000));
  assert.equal(playbackTime(s.playback, 5100), 850);
  s = press(s, 'replay', ctx(6000));
  assert.equal(playbackTime(s.playback, 6000), 0);
  s = press(s, 'motion-off', ctx(6100));
  assert.equal(s.playback.status, 'off');
  // Opening the key list pauses; while it is open, playback keys do nothing.
  s = press(press(at('scan'), 'play-pause', ctx(0)), 'help', ctx(300));
  assert.deepEqual([s.help, s.playback.status, s.playback.elapsed], [true, 'paused', 300]);
  assert.equal(press(s, 'play-pause', ctx(400)), s);
  assert.equal(press(s, 'close-help').help, false);
});

test('playback keys do nothing for components or for color-only motion without color', () => {
  for (const action of ['play-pause', 'replay', 'motion-off']) {
    const component = at('gauge');
    assert.equal(press(component, action, { now: 1, mode: 'TRUECOLOR' }), component);
    const scanPlain = at('scan');
    assert.equal(press(scanPlain, action, { now: 1, mode: 'PLAIN' }), scanPlain);
  }
  assert.equal(canPlay(STORIES[story('reveal')], STORIES[story('reveal')].variants[1], 'PLAIN'), true);
  assert.equal(press(at('reveal', 1), 'play-pause', { now: 1, mode: 'PLAIN' }).playback.status, 'playing');
  assert.match(plain(composeStorybook(at('pulse'), { columns: 120, rows: 40, mode: 'PLAIN' })).join('\n'), /MOTION OFF {2}stable view; without color this motion has nothing to show/);
  assert.doesNotMatch(plain(composeStorybook(at('pulse'), { columns: 120, rows: 40, mode: 'PLAIN' })).at(-1), /P PLAY/);
});

test('a finite reveal completes at its duration and ends on the input; loops keep playing', () => {
  const size = { columns: 120, rows: 40 };
  const r = STORIES[story('reveal')];
  const end = r.duration(r.variants[0], 94);
  let s = playing('reveal', 0, 0);
  assert.equal(advance(s, { now: end - 1, ...size }), s);
  s = advance(s, { now: end + 500, ...size });
  assert.deepEqual(s.playback, { status: 'complete', elapsed: end, startedAt: null });
  const done = plain(composeStorybook(s, { ...size, now: end + 500 })).join('\n');
  assert.match(done, /COMPLETE {2}0\.72 s of 0\.72 s/);
  assert.equal(press(s, 'play-pause', { now: 2000, mode: 'TRUECOLOR' }).playback.elapsed, 0, 'play after complete starts over');
  const loop = playing('scan', 0, 0);
  assert.equal(advance(loop, { now: 1e9, ...size }), loop);
  assert.equal(advance(at('reveal'), { now: 1e9, ...size }).playback.status, 'off');
  assert.equal(composeStorybook(s, { ...size }).lines.length, 40);
  const painted = (lines) => lines.map((l) => paint(l, 'truecolor'));
  assert.deepEqual(painted(r.specimen(r.variants[0], 94, { animate: true, time: end }).lines), painted(r.specimen(r.variants[0], 94).lines));
  assert.notDeepEqual(painted(r.specimen(r.variants[0], 94, { animate: true, time: end - 300 }).lines), painted(r.specimen(r.variants[0], 94).lines));
});

test('the key list names every binding and the playback rules', () => {
  const all = plain(composeStorybook({ ...initialState(), help: true }, { columns: 60 })).join('\n');
  const prose = all.replace(/[│\s]+/g, ' ');
  for (const key of ['J K, DOWN UP', 'TAB, SHIFT-TAB', '1-3', 'L H, RIGHT LEFT', 'SPACE, PGDN', 'B, PGUP', 'P ', 'R ', 'O ', '? ', 'Q, ESC']) assert.ok(all.includes(key), key);
  assert.match(prose, /jump to a section: 1 COMPONENTS, 2 MOTIONS, 3 FOUNDATION/);
  assert.match(prose, /that motion's own step, shown as MS FRAMES \(40 to 400 ms here\); motions that change continuously redraw every 67 ms, at most 15 frames a second/);
  assert.match(prose, /A completed preview shows the motion-off view/);
  assert.match(all, /\? OR ESC CLOSES KEYS/);
});

test('invalid frames and state are rejected', () => {
  for (const columns of [0, -1, 1.5, Number.NaN, 1001, '80']) assert.throws(() => composeStorybook(initialState(), { columns }), RangeError, String(columns));
  assert.throws(() => composeStorybook(initialState(), { columns: 80, rows: 0 }), RangeError);
  for (const mode of ['COLOR', '\x1b[2J', null]) assert.throws(() => composeStorybook(initialState(), { columns: 80, mode }), RangeError);
  for (const now of [Number.NaN, Infinity, '5']) assert.throws(() => composeStorybook(initialState(), { columns: 80, now }), RangeError);
  for (const bad of [{ story: 99 }, { story: -1 }, { story: 'toString' }, { variant: 99 }, { offset: -1 }, { offset: 1.5 }, { playback: { status: 'running' } }]) {
    assert.throws(() => composeStorybook({ ...initialState(), ...bad }, { columns: 80 }), RangeError, JSON.stringify(bad));
  }
});

test('snapshot frames name the snapshot instead of keys that would not work', () => {
  const last = plain(composeStorybook(initialState(), { columns: 80, rows: 20, snapshot: true })).at(-1);
  assert.match(last, /SNAPSHOT: RUN IN A TERMINAL TO BROWSE/);
  assert.doesNotMatch(last, /Q QUIT/);
});


test('hit geometry covers only complete visible controls at every width and short height', () => {
  const states = [...STORIES.map((_, story) => ({ ...initialState(), story })), { ...initialState(), help: true }, at('gauge', 5), at('colors', 1)];
  for (const state of states) for (let columns = 1; columns <= 160; columns++) for (const rows of [1, 2, 3, 5, 9, 14, 24, 40]) {
    const view = composeStorybook(state, { columns, rows, mode: 'TRUECOLOR' });
    const lines = plain(view);
    const cells = new Set();
    for (const t of view.targets) {
      assert.ok(t.column >= 1 && t.row >= 1 && t.row <= lines.length && t.column + t.width - 1 <= columns, `${columns}x${rows} ${t.action}`);
      const label = [...lines[t.row - 1]].slice(t.column - 1, t.column - 1 + t.width).join('');
      assert.equal(label, label.trim(), `${columns}x${rows} ${t.action}: no padding in target`);
      assert.ok(label.length > 0);
      if (t.action.startsWith('story:')) {
        const i = Number(t.action.split(':')[1]);
        assert.ok(label.endsWith(STORIES[i].title), 'full story label');
      }
      if (t.action.startsWith('variant:')) {
        const i = Number(t.action.split(':')[1]);
        assert.ok(label === STORIES[state.story].variants[i].name || label === `[${STORIES[state.story].variants[i].name}]`, 'full variant name');
      }
      for (let column = t.column; column < t.column + t.width; column++) {
        const key = `${column},${t.row}`;
        assert.ok(!cells.has(key), `no overlapping targets at ${columns}x${rows} ${key}`);
        cells.add(key);
        assert.equal(hitAction(view, { column, row: t.row }), t.action);
      }
    }
    for (let row = 1; row <= lines.length; row++) for (let column = 1; column <= columns; column++) {
      if (!cells.has(`${column},${row}`)) assert.equal(hitAction(view, { column, row }), undefined, 'all other cells inert');
    }
    for (const point of [{ column: 0, row: 1 }, { column: columns + 1, row: 1 }, { column: 1, row: rows + 1 }, { column: 1.5, row: 1 }]) assert.equal(hitAction(view, point), undefined);
  }
});

test('click actions use keyboard transitions; direct variants reset playback and scroll', () => {
  const state = playing('scan');
  const view = composeStorybook(state, { columns: 160, rows: 24, mode: 'TRUECOLOR' });
  for (const action of [`story:${story('scan') + 1}`, 'variant:1', 'prev-story', 'next-story', 'prev-variant', 'next-variant', 'play-pause', 'replay', 'motion-off', 'page-down', 'help', 'quit']) {
    assert.ok(view.targets.some((t) => t.action === action), action);
  }
  assert.deepEqual(press({ ...state, offset: 4 }, 'variant:1'), press({ ...state, offset: 4 }, 'next-variant'));
  assert.equal(press(state, 'variant:0'), state, 'selected name is inert');
  assert.equal(press(state, 'variant:999'), state);
  assert.equal(press(state, 'variant:-1'), state);
  const paged = press(state, 'page-down', view);
  const last = composeStorybook(paged, { columns: 160, rows: 24, mode: 'TRUECOLOR' });
  assert.ok(last.targets.some((t) => t.action === 'page-up'));
  const end = composeStorybook({ ...state, offset: 999 }, { columns: 160, rows: 24, mode: 'TRUECOLOR' });
  assert.ok(!end.targets.some((t) => t.action === 'page-down'), 'disabled page action not a target');
  const help = composeStorybook({ ...state, help: true }, { columns: 160, rows: 24, mode: 'TRUECOLOR' });
  assert.ok(help.targets.some((t) => t.action === 'close-help'));
  assert.ok(!help.targets.some((t) => ['play-pause', 'replay', 'motion-off'].includes(t.action)), 'help prose never becomes playback controls');
  const plain = composeStorybook(state, { columns: 160, rows: 24 });
  assert.ok(!plain.targets.some((t) => ['play-pause', 'replay', 'motion-off'].includes(t.action)), 'disabled no-color controls not targets');
});

test('snapshots and clipped names have no clickable geometry; resizing recomposes targets', () => {
  assert.deepEqual(composeStorybook(initialState(), { columns: 160, rows: 40, snapshot: true }).targets, []);
  const tiny = composeStorybook(initialState(), { columns: 1, rows: 1 });
  assert.deepEqual(tiny.targets, []);
  const normal = composeStorybook(at('gauge'), { columns: 160, rows: 40 });
  const small = composeStorybook(at('gauge'), { columns: 20, rows: 4 });
  for (const t of normal.targets.filter((t) => t.action.startsWith('story:'))) assert.equal(hitAction(small, { column: t.column, row: t.row }), undefined);
});
