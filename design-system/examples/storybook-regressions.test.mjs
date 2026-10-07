import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitLine, lineWidth, paint, resolveColor as resolve, span } from '../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { COUNT_PLATES, countPlate } from '../elements/count-plate/count-plate.mjs';
import { LAMP_DIM_STYLE, lamp } from '../elements/lamp/lamp.mjs';
import { modePlate, pnytlPlate } from '../elements/mode-plate/mode-plate.mjs';
import { stateChips } from '../elements/state-chip/state-chip.mjs';
import { numeralAt, numeralGrid, numeralLines, pixelNumeral } from '../elements/pixel-numeral/pixel-numeral.mjs';
import { providerColumn, segmentMeter } from '../elements/segment-meter/segment-meter.mjs';
import { threadRail, threadRailPieces } from '../elements/thread-rail/thread-rail.mjs';
import { instrumentFrame } from '../elements/instrument-frame/instrument-frame.mjs';
import { MARKER_PLATES, MARKER_TIMELINE, markerBars, markerPlate, transcriptMarker } from '../elements/transcript-marker/transcript-marker.mjs';
import { scan } from '../motions/scan.mjs';
import { pulse } from '../motions/pulse.mjs';
import { reveal, revealDuration } from '../motions/reveal.mjs';
import { drawIn } from '../motions/draw-in.mjs';
import { warmUp } from '../motions/warm-up.mjs';
import { latch } from '../motions/latch.mjs';
import { beacon } from '../motions/beacon.mjs';
import { cycle } from '../motions/cycle.mjs';
import { fade } from '../motions/fade.mjs';
import { blink, BLINK_PRESETS } from '../motions/blink.mjs';
import { flash, FLASH_PRESETS } from '../motions/flash.mjs';
import { ping } from '../motions/ping.mjs';
import { wipe } from '../motions/wipe.mjs';
import { fillIn } from '../motions/fill-in.mjs';
import { burnOut, BURN_OUT_PRESETS } from '../motions/burn-out.mjs';
import { edgePulse } from '../motions/edge-pulse.mjs';
import { restrike } from '../motions/restrike.mjs';
import { ghost } from '../motions/ghost.mjs';
import { nudge } from '../motions/nudge.mjs';
import { STORIES } from './storybook-stories.mjs';
import { advance, composeStorybook, initialState } from './storybook-layout.mjs';

// Everything the generated usage text may name.
const API = {
  fitLine, span, SIGNAL_COLORS, gauge, gaugeScale, labelPlate, numberedPanel, panelInnerWidth, statusRow, COUNT_PLATES, countPlate,
  LAMP_DIM_STYLE, lamp, modePlate, pnytlPlate, stateChips, numeralAt, numeralGrid, numeralLines, pixelNumeral, providerColumn,
  segmentMeter, threadRail, threadRailPieces, instrumentFrame, markerBars, markerPlate, transcriptMarker, scan, pulse, reveal,
  drawIn, warmUp, latch, beacon, cycle, fade, blink, BLINK_PRESETS, flash, FLASH_PRESETS, ping, wipe, fillIn, burnOut,
  BURN_OUT_PRESETS, edgePulse, restrike, ghost, nudge,
};
// Execute only our trusted, generated example source; no user input is evaluated. Assignments become
// declarations; every other statement is an expression whose value is returned in order.
function execute(calls, time) {
  const statements = [];
  for (const line of calls.join('\n').replace(/^(\w+) = /gm, 'const $1 = ').split('\n')) {
    if (/^(\s|\])/.test(line)) statements[statements.length - 1] += '\n' + line; // a multi-line `body = [` block
    else statements.push(line);
  }
  const body = statements.map((st) => (st.startsWith('const ') ? st : `out.push(${st});`)).join('\n');
  return new Function(...Object.keys(API), 'time', `const out = [];\n${body}\nreturn out;`)(...Object.values(API), time);
}
const motionStories = STORIES.filter((s) => s.kind === 'motion');

const text = (lines) => lines.map((line) => paint(line, 'none'));

test('every displayed motion example executes and matches its real specimen', () => {
  for (const story of motionStories) {
    for (const variant of story.variants) {
      for (const width of [1, 24, 40, 80]) {
        for (const animate of [false, true]) {
          for (const time of [0, 350, 1300]) {
            const specimen = story.specimen(variant, width, { animate, time });
            assert.deepEqual(execute(specimen.calls, time).at(-1), specimen.lines, `${story.id}/${variant.name}/${width}/${animate}/${time}`);
          }
        }
      }
    }
  }
});

test('every displayed element example executes and returns what the specimen draws', () => {
  const asLines = (value) => (Array.isArray(value[0]) ? value : [value]); // lines, or one line of spans
  for (const story of STORIES.filter((s) => s.kind === 'component')) {
    for (const variant of story.variants) {
      for (const width of [1, 7, 24, 60, 132]) {
        const specimen = story.specimen(variant, width);
        const made = execute(specimen.calls).flatMap(asLines);
        assert.equal(made.length, specimen.lines.length, `${story.id}/${variant.name}/${width}`);
        made.forEach((line, i) => {
          const w = lineWidth(specimen.lines[i]);
          assert.equal(paint(fitLine(line, w), 'truecolor'), paint(specimen.lines[i], 'truecolor'), `${story.id}/${variant.name}/${width} line ${i}`);
        });
      }
    }
  }
});

test('a motion example plays without color only when its plain frames really change', () => {
  for (const story of motionStories) {
    for (const variant of story.variants) {
      const settled = story.specimen(variant, 80).lines.map((l) => paint(l, 'none')).join('\n');
      const end = story.duration(variant, 80) ?? story.loop(variant);
      let changes = false;
      for (let t = 0; t <= end && !changes; t += 10) {
        changes = story.specimen(variant, 80, { animate: true, time: t }).lines.map((l) => paint(l, 'none')).join('\n') !== settled;
      }
      assert.equal(changes, variant.plainVisible === true, `${story.id}/${variant.name}`);
    }
  }
});

test('finite previews complete at their duration helper and end on the settled view; loops never complete', () => {
  for (const [i, story] of STORIES.entries()) {
    if (story.kind !== 'motion') continue;
    story.variants.forEach((variant, v) => {
      const size = { columns: 120, rows: 40 };
      const inner = panelInnerWidth(120 - 24); // the story pane beside the index
      const end = story.duration(variant, inner);
      const state = { ...initialState(), story: i, variant: v, playback: { status: 'playing', elapsed: 0, startedAt: 0 } };
      if (end === null) {
        assert.ok(story.loop(variant) > 0, `${story.id}/${variant.name} states its loop`);
        assert.equal(advance(state, { now: 1e7, ...size }), state);
        return;
      }
      assert.equal(advance(state, { now: end - 1, ...size }), state, `${story.id}/${variant.name} still playing`);
      assert.equal(advance(state, { now: end, ...size }).playback.status, 'complete', `${story.id}/${variant.name} complete`);
      const painted = (lines) => lines.map((l) => paint(l, 'truecolor')).join('\n');
      // Ping's own motion-off view is its input bars; its settled marker drops them (MARKER TIMELINE).
      if (story.id !== 'ping') assert.equal(painted(story.specimen(variant, inner, { animate: true, time: end }).lines), painted(story.specimen(variant, inner).lines), `${story.id}/${variant.name} ends settled`);
    });
  }
});

test('seeded examples show their seed in the generated call', () => {
  for (const story of motionStories.filter((s) => 'seed' in (s.motion?.defaults ?? {}))) {
    for (const variant of story.variants) {
      assert.ok(Number.isInteger(variant.options.seed), `${story.id}/${variant.name}`);
      for (const animate of [false, true]) assert.ok(story.specimen(variant, 80, { animate, time: 0 }).calls.some((c) => c.includes(`seed: ${variant.options.seed}`)), `${story.id}/${variant.name}`);
    }
  }
});

// The marker's timeline written from the transcript-marker README, independently of the motions: the plate
// state and wipe count, and each bar's state, at elapsed m.
function readmeMarker(m, outputPad, width) {
  const T = MARKER_TIMELINE;
  if (m >= T.window) return transcriptMarker({ outputPad }, { width });
  const text = markerPlate('record', { outputPad })[0].text;
  const n = text.length;
  const recorded = m < T.settleWipe ? 0 : Math.min(n, Math.ceil(((Math.floor(m / 80) * 80 - T.settleWipe + 80) * n) / 200));
  const head = m >= T.flashOff && m < T.flashOn ? 'outline' : 'live';
  const plate = [span(text.slice(0, n - recorded), MARKER_PLATES[head]), span(text.slice(n - recorded), MARKER_PLATES.record)];
  const p = m >= T.pingLaunch + T.pingRepeatAfter ? m - T.pingRepeatAfter : m;
  const t = Math.floor(p / T.barFrame) * T.barFrame;
  const bars = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const ghostAt = T.ghostAt + i * T.pingStagger;
    return t < T.pingLaunch + i * T.pingStagger || t >= ghostAt + T.ghostFor ? 'off' : t < ghostAt ? 'lit' : 'ghost';
  });
  return [fitLine(fitLine([...plate, span(' '), ...markerBars(bars)], Math.max(0, width - outputPad)), width)];
}

test('the composed marker timeline reproduces the transcript marker README frame by frame', () => {
  const story = STORIES.find((s) => s.id === 'marker-timeline');
  const frame = { number: 1, title: 'BAY 04', meta: 'DEMONSTRATION' };
  // What a terminal shows: each cell's character and background, and its ink only where it has a glyph.
  // (Ping blanks a bar as a space that keeps the bar's ink; the element's off bar is a plain space.)
  const painted = (lines) => lines.map((line) => line.flatMap((s) => [...s.text].map((ch) => [ch, resolve(s.style.bg ?? 'field'), ch === ' ' ? '' : `${resolve(s.style.fg ?? 'secondary')}${s.style.bold ? ' bold' : ''}`].join('|'))).join(',')).join('\n');
  for (const variant of story.variants) {
    for (const width of [24, 44, 60]) {
      const inner = panelInnerWidth(width);
      for (let m = 0; m <= MARKER_TIMELINE.window; m += 20) {
        const expected = numberedPanel(frame, readmeMarker(m, variant.outputPad, inner), { width });
        assert.equal(painted(story.specimen(variant, width, { animate: true, time: m }).lines), painted(expected), `${variant.name} ${width} at ${m} ms`);
      }
      assert.equal(painted(story.specimen(variant, width).lines), painted(numberedPanel(frame, transcriptMarker({ outputPad: variant.outputPad }, { width: inner }), { width })), 'motion-off is the settled record');
    }
  }
});

test('completed reveal is a final frame after resize, not a frozen incomplete timeline', () => {
  const index = STORIES.findIndex((s) => s.id === 'reveal');
  const story = STORIES[index];
  let state = { ...initialState(), story: index, variant: 1, playback: { status: 'playing', elapsed: 0, startedAt: 0 } };
  state = advance(state, { now: 10_000, columns: 120, rows: 40 });
  assert.equal(state.playback.status, 'complete');
  const render = story.specimen;
  const frames = [];
  story.specimen = (...args) => { frames.push(args); return render(...args); };
  try {
    for (const columns of [24, 120]) {
      const view = composeStorybook(state, { columns, rows: 40, mode: 'TRUECOLOR' });
      const [, width, options] = frames.at(-1);
      assert.equal(options.animate, false, 'completed rendering must be dimension-independent');
      assert.deepEqual(text(render(story.variants[1], width, options).lines), text(render(story.variants[1], width).lines));
      if (columns === 120) {
        const duration = (story.duration(story.variants[1], width) / 1000).toFixed(2);
        assert.ok(text(view.lines).some((l) => l.includes(`COMPLETE  ${duration} s of ${duration} s`)));
      }
    }
  } finally {
    story.specimen = render;
  }
});

test('reveal examples keep complete readings and status messages outside the veil', () => {
  const story = STORIES.find((s) => s.id === 'reveal');
  for (const width of [24, 60]) {
    const inner = panelInnerWidth(width);
    const essential = [
      ...gauge({ label: 'FILL', value: 42.5 }, { width: inner, readoutWidth: 8 }),
      ...gauge({ label: 'FLOW', value: null, max: 12, unit: 'L/m' }, { width: inner, readoutWidth: 8 }),
      ...statusRow({ label: 'DOOR', value: 'closed', status: 'success' }, { width: inner }),
      ...statusRow({ label: 'FEED', value: '2 specimen retries', status: 'warning' }, { width: inner }),
      ...statusRow({ label: 'PARSE', value: 'specimen parse failed', status: 'error' }, { width: inner }),
    ];
    for (const variant of story.variants) {
      for (const time of [0, 150, 500]) {
        const actual = text(story.specimen(variant, width, { animate: true, time }).lines);
        for (const line of text(essential)) assert.ok(actual.some((s) => s.includes(line)), `${width}/${variant.name}/${time}: ${line}`);
      }
    }
  }
});

test('documented reveal host completes without recursion and bounds its timer', () => {
  const readme = readFileSync(new URL('../motions/README.md', import.meta.url), 'utf8');
  const sketch = /```js\n([\s\S]*?)\n```/.exec(readme.split('## Host integration')[1])[1];
  let now = 0;
  let serial = 0;
  let writes = 0;
  const timers = new Map();
  const delays = [];
  const lines = [[span('---')]];
  const host = new Function('lines', 'reveal', 'revealDuration', 'performance', 'setInterval', 'clearInterval', 'write', 'paintFrame', `${sketch}\nreturn { play, pause, replay };`)(
    lines, reveal, revealDuration, { now: () => now },
    (callback, delay) => { delays.push(delay); timers.set(++serial, callback); return serial; },
    (id) => timers.delete(id),
    () => { assert.ok(++writes < 20, 'completion must not recursively redraw'); },
    (frame) => frame,
  );
  host.play();
  assert.equal(timers.size, 1);
  now = revealDuration(lines.length);
  for (const callback of [...timers.values()]) callback();
  assert.equal(timers.size, 0);
  assert.ok(delays.every((delay) => delay >= Math.ceil(1000 / 15)));
  host.replay();
  assert.equal(timers.size, 1);
  host.pause();
  assert.equal(timers.size, 0);
});
