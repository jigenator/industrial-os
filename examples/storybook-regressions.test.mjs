import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paint, span } from '../foundation/cells.mjs';
import { gauge, gaugeScale } from '../elements/gauge/gauge.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { statusRow } from '../elements/status-row/status-row.mjs';
import { scan } from '../motions/scan.mjs';
import { pulse } from '../motions/pulse.mjs';
import { reveal, revealDuration } from '../motions/reveal.mjs';
import { STORIES } from './storybook-stories.mjs';
import { advance, composeStorybook, initialState } from './storybook-layout.mjs';

const text = (lines) => lines.map((line) => paint(line, 'none'));

test('every displayed motion example executes and matches its real specimen', () => {
  const api = { gauge, gaugeScale, numberedPanel, statusRow, span, scan, pulse, reveal };
  for (const story of STORIES.filter((s) => s.kind === 'motion')) {
    for (const variant of story.variants) {
      for (const width of [1, 24, 40, 80]) {
        for (const animate of [false, true]) {
          const time = 350;
          const specimen = story.specimen(variant, width, { animate, time });
          // Execute only our trusted, generated example source; no user input is evaluated.
          const statements = specimen.calls.slice(0, -1).join('\n').replace(/^(\w+) = /gm, 'const $1 = ');
          const run = new Function(...Object.keys(api), 'time', `${statements}\nreturn ${specimen.calls.at(-1)};`);
          assert.deepEqual(run(...Object.values(api), time), specimen.lines, `${story.id}/${variant.name}/${width}/${animate}`);
        }
      }
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
