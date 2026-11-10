import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
import { render, plainFrame } from '../src/render.mjs';
import { createState, selectSlide, setChoice, focusField, order } from '../src/model.mjs';
import { geometry, aspectPlacement } from '../src/geometry.mjs';
import { TYPES, LAYOUTS, LAYOUT_NAMES } from '../src/seed.mjs';

// wide (3 columns), mid (2 columns), stack (chat dock), then the resize screen.
const supported = [
  [180, 48],
  [150, 40],
  [140, 40],
  [100, 24],
  [100, 40],
  [90, 32],
  [80, 30],
];
const small = [
  [99, 29],
  [80, 24],
  [79, 40],
  [60, 18],
  [20, 5],
  [1, 1],
];
const rowText = (frame, y) => frame.lines[y].map((cell) => cell.text).join('');
function bounded(frame, w, h) {
  const rows = plainFrame(frame).split('\n');
  assert.equal(rows.length, h);
  assert.ok(rows.every((line) => [...line].length === w));
  assert.ok(!rows.some((line) => /\x1b/.test(line)));
  for (const hit of frame.hits)
    assert.ok(hit.x >= 0 && hit.y >= 0 && hit.x + hit.w <= w && hit.y + hit.h <= h, JSON.stringify(hit));
}

// Short windows scroll the form under the slide; this collects every row the form can show.
function formText(s, w, h) {
  s.formFollow = false;
  s.formScroll = 9999;
  const most = render(s, w, h).g.formOffset;
  let plain = '';
  for (let offset = 0; offset <= most; offset++) {
    s.formScroll = offset;
    const f = render(s, w, h);
    bounded(f, w, h);
    plain += plainFrame(f);
  }
  s.formScroll = 0;
  s.formFollow = true;
  return plain;
}

test('every supported size reaches all seven Types and five layouts with a non-colour selection mark', () => {
  const s = createState();
  for (const [w, h] of supported) {
    const f = render(s, w, h),
      plain = formText(s, w, h);
    bounded(f, w, h);
    for (const label of [...TYPES, ...LAYOUT_NAMES]) assert.ok(plain.includes(label), `${w}x${h}: ${label}`);
    assert.match(plain, /● Initial question/);
    assert.match(plain, /● Statement/);
    assert.match(plain, /○ First principle/);
    for (const label of ['PURPOSE', 'NOTES', 'LESSON CHAT', 'MESSAGE'])
      assert.ok(plain.includes(label), `${w}x${h}: ${label}`);
    assert.ok(!plain.includes('KEY POINTS'));
    assert.equal(f.g.mode, w >= 150 ? 'wide' : w >= 100 ? 'mid' : 'stack');
    assert.equal(Boolean(f.g.outline), w >= 150);
  }
  for (const [w, h] of small) {
    const f = render(s, w, h);
    bounded(f, w, h);
    if (w >= 60) assert.match(plainFrame(f), /Window too small/);
    assert.equal(f.hits.length, 0);
  }
});

test('chrome and options never move with content, jobs, long text or typing', () => {
  const s = createState();
  selectSlide(s, 'S-6');
  for (const [w, h] of supported) {
    const expected = geometry(w, h);
    const layoutHits = (f) => f.hits.filter((hit) => hit.act === 'choice' && hit.control === 'type');
    for (const layout of LAYOUTS) {
      setChoice(s, 'layout', layout);
      s.jobs = [];
      const base = render(s, w, h);
      s.slides.find((x) => x.id === s.selected).notes = 'Long notes '.repeat(200);
      s.notice = 'An error with a very long detail '.repeat(50);
      s.chat = Array.from({ length: 40 }, () => ({
        role: 'Lesson AI',
        text: 'Long text '.repeat(50),
        stamp: 'Whole lesson',
      }));
      s.jobs = [
        { slideId: s.selected, field: 'content', status: 'working' },
        { slideId: s.selected, field: 'content', status: 'queued' },
      ];
      const f = render(s, w, h);
      for (const key of ['mode', 'main', 'chat', 'outline']) assert.deepEqual(f.g[key], expected[key]);
      assert.deepEqual(layoutHits(f), layoutHits(base), `${w}x${h} ${layout}: Type options moved`);
      bounded(f, w, h);
    }
    focusField(s, 'purpose');
    const before = render(s, w, h);
    s.edit = { slideId: s.selected, field: 'purpose', text: 'Typed '.repeat(80), cursor: 480, base: 0 };
    const f = render(s, w, h);
    bounded(f, w, h);
    assert.deepEqual(layoutHits(f), layoutHits(before), `${w}x${h}: typing moved the options`);
    assert.ok(f.cursor, `${w}x${h}: no caret`);
    s.edit = null;
    s.control = null;
  }
});

test('before/after keeps both concepts, two pictures side by side in the canvas, text fallback labels both', () => {
  const s = createState();
  selectSlide(s, 'S-6');
  const original = s.slides.find((x) => x.id === 'S-6').afterDesc;
  setChoice(s, 'layout', 'title');
  setChoice(s, 'layout', 'before-after');
  assert.equal(s.slides.find((x) => x.id === 'S-6').afterDesc, original);
  for (const [w, h] of supported) {
    const f = render(s, w, h, { graphics: true }),
      main = f.g.main;
    bounded(f, w, h);
    // Short windows fall back to text when a picture would be under three rows.
    if (h >= 40) assert.equal(f.images.length, 2, `${w}x${h}`);
    if (f.images.length === 2) assert.ok(f.images[0].rect.x + f.images[0].rect.width <= f.images[1].rect.x);
    for (const im of f.images) {
      assert.ok(im.rect.x > main.x && im.rect.x + im.rect.width < main.x + main.w);
      assert.ok(im.rect.y > main.y && im.rect.y + im.rect.height < main.y + main.h);
    }
    const fallback = plainFrame(render(s, w, h));
    assert.match(fallback, /BEFORE/);
    assert.match(fallback, /AFTER/);
    assert.match(fallback, /IMAGE/);
  }
  const p = aspectPlacement({ x: 4, y: 5, width: 72, height: 8 }, 640, 240);
  assert.ok(p.width <= 72 && p.height <= 8 && p.x >= 4 && p.y >= 5);
});

test('learner preview shows content only: no notes, plan, author marks or chat target', () => {
  const s = createState();
  selectSlide(s, 'S-3');
  s.view = 'preview';
  focusField(s, 'content');
  s.slides.find((x) => x.id === 'S-3').notes = 'PRIVATE AUTHOR NOTE';
  s.jobs = [{ slideId: 'S-3', field: 'content', status: 'working' }];
  const f = render(s, 180, 48),
    main = f.g.main,
    stage = f.lines
      .slice(main.y, main.y + main.h)
      .map((line) =>
        line
          .slice(main.x, main.x + main.w)
          .map((cell) => cell.text)
          .join(''),
      )
      .join('\n');
  // ▌ is also the number plate's cap, so author gutters are checked through field hits instead.
  for (const forbidden of ['PRIVATE AUTHOR NOTE', 'TEACHING PLAN', 'KEY POINTS', 'WORKED EXAMPLE', '▒', '◆'])
    assert.ok(!stage.includes(forbidden), forbidden);
  assert.match(stage, /With max-age/);
  assert.ok(!f.hits.some((hit) => hit.act === 'field'));
});

test('plain CLI at each size is escape-free and within bounds', () => {
  for (const [w, h] of [...supported, ...small.slice(0, 4)]) {
    const result = execFileSync(
      process.execPath,
      ['lesson-maker/main.mjs', '--plain', `--size=${w}x${h}`, '--images=kitty'],
      { encoding: 'utf8', cwd: root },
    );
    const lines = result.slice(0, -1).split('\n');
    assert.equal(lines.length, h);
    assert.ok(lines.every((line) => [...line].length <= w));
    assert.ok(!result.includes('\x1b'));
  }
});

test('outline panel and dialogs keep the chat visible; typing in a box keeps the slide and its pictures', () => {
  const s = createState();
  selectSlide(s, 'S-3');
  for (const size of [
    [180, 48],
    [120, 40],
    [90, 32],
  ]) {
    s.pane = 'outline';
    let f = render(s, ...size, { graphics: true });
    assert.match(plainFrame(f), /LESSON CHAT/);
    assert.match(plainFrame(f), /OUTLINE/);
    if (size[0] < 150) assert.equal(f.images.length, 0);
    s.pane = 'workbench';
    focusField(s, 'imageDesc');
    const idle = render(s, ...size, { graphics: true });
    s.edit = { slideId: 'S-3', field: 'imageDesc', text: 'A new concept', cursor: 13, base: 0 };
    f = render(s, ...size, { graphics: true });
    assert.deepEqual(f.images, idle.images);
    assert.match(plainFrame(f), /┏━ IMAGE CONCEPT ━/);
    assert.match(plainFrame(f), /A new concept/);
    assert.ok(f.cursor);
    s.edit = null;
    s.control = null;
    s.modal = { kind: 'help', title: 'Help', lines: ['# Section', 'key\tWhat it does'] };
    f = render(s, ...size, { graphics: true });
    assert.equal(f.images.length, 0);
    assert.match(plainFrame(f), /What it does/);
    assert.match(plainFrame(f), /LESSON CHAT/);
    s.modal = null;
  }
});

test('graphic raster holes contain no cell text, including AI-edited concepts and pictures', () => {
  const s = createState();
  for (const id of ['S-2', 'S-3', 'S-6']) {
    selectSlide(s, id);
    const x = s.slides.find((x) => x.id === id);
    s.provenance[`${id}:imageDesc`] = 'AI EDIT';
    s.pictures[id] = { ...s.pictures[id], afterDesc: { ...s.pictures['S-6'].afterDesc, name: 'after.png' } };
    for (const position of ['top', 'bottom'])
      for (const [w, h] of supported) {
        x.sentencePos = position;
        const f = render(s, w, h, { graphics: true });
        for (const im of f.images)
          for (let y = im.rect.y; y < im.rect.y + im.rect.height; y++)
            assert.ok(
              f.lines[y].slice(im.rect.x, im.rect.x + im.rect.width).every((cell) => cell.text === ' '),
              `${id} ${w}x${h} raster row ${y}`,
            );
      }
  }
});

test('the footer plate names the actual printable-key owner', () => {
  const state = createState();
  const status = (width = 180, height = 48) => rowText(render(state, width, height), height - 1);
  assert.match(status(), /^ BROWSE WORKBENCH /);
  state.pane = 'chat';
  state.chatMode = 'composer';
  assert.match(status(), /^ TYPE CHAT /);
  assert.match(status(90, 32), /^ TYPE CHAT /);
  state.control = 'purpose';
  state.pane = 'workbench';
  assert.match(status(), /^ TYPE FIELD /);
  state.control = 'layout';
  assert.match(status(), /^ BROWSE WORKBENCH /);
  state.control = 'purpose';
  state.review = true;
  assert.match(status(), /^ READ ONLY FIELD /);
  assert.match(plainFrame(render(state, 180, 48)), /REVIEW ONLY/);
  state.review = false;
  state.pane = 'chat';
  assert.match(status(), /^ TYPE CHAT /);
  state.chatMode = 'transcript';
  assert.match(status(), /^ BROWSE CHAT /);
  state.modal = { kind: 'rename', input: 'New name', cursor: 0 };
  assert.match(status(), /^ TYPE RENAME /);
  state.modal = { kind: 'attach', input: 'diagram.png', pending: true };
  assert.match(status(), /^ WAIT ATTACHMENT /);
  state.modal = { kind: 'confirm', options: ['Cancel', 'Confirm'], index: 0 };
  assert.match(status(), /^ BROWSE DIALOG /);
});

test('outline marks sections and subsections, whose rows are their title slides, with add buttons', () => {
  const s = createState();
  const outline = () => {
    const f = render(s, 180, 48),
      o = f.g.outline;
    return f.lines
      .slice(o.y, o.y + o.h)
      .map((line) =>
        line
          .slice(o.x, o.x + o.w)
          .map((cell) => cell.text)
          .join(''),
      )
      .join('\n');
  };
  // A group's row is its title slide: numbered, with no separate title-slide row.
  assert.match(outline(), /▾ {2}1 Why browsers keep copi… SECTION/);
  assert.doesNotMatch(outline(), /Title slide|▤/);
  assert.match(outline(), /▌ +2 ≡ Why is the second visit/);
  assert.match(outline(), /▾ {2}5 Worked examples +SUB *$/m);
  assert.doesNotMatch(outline(), /SUBSECTION/);
  assert.match(outline(), /│ +6 ≡ Trusting a copy/);
  assert.match(outline(), /\[\+ slide\] \[\+ subsection\]/);
  assert.match(outline(), /\[\+ section\]/);
  selectSlide(s, 'title-SUB-3');
  assert.match(outline(), /▌ +▾ {2}5 Worked examples/);
  // The fold target sits on the caret, not on the slide number beside it.
  const f = render(s, 180, 48);
  for (const h of f.hits.filter((h) => h.act === 'fold')) assert.match(f.lines[h.y][h.x].text, /[▾▸]/);
});

test('the form is a grid: paired boxes share a top and height, options sit in columns, no doubled headings', () => {
  const s = createState();
  // Tall enough that the whole form fits under the slide.
  const f = render(s, 196, 110),
    field = (name) => f.hits.find((h) => h.act === 'field' && h.box.field === name),
    choices = f.hits.filter((h) => h.act === 'choice' && h.control === 'type');
  for (const [a, b] of [['content', 'purpose']]) {
    assert.equal(field(a).y, field(b).y);
    assert.equal(field(a).h, field(b).h);
  }
  assert.equal(new Set(choices.map((h) => h.x)).size, 2);
  assert.equal(plainFrame(f).split('SPEAKER NOTES').length - 1, 1);
  const o = f.g.outline,
    styleOf = (text) => {
      const y = f.lines.findIndex(
        (line, i) =>
          i >= o.y &&
          line
            .map((c) => c.text)
            .join('')
            .includes(text),
      );
      return f.lines[y].slice(o.x, o.x + o.w).find((c) => /[a-z]/i.test(c.text)).style.fg;
    };
  // Levels differ by ink without hue: white sections, light grey subsections.
  assert.equal(styleOf('SECTION'), 'primary');
  assert.equal(styleOf(' SUB'), 'secondary');
});

test("the slide's frame names the slide; the page title says where it sits, without repeating a name", () => {
  const lines = (id) => {
    const s = createState();
    selectSlide(s, id);
    const frame = plainFrame(render(s, 196, 50)).split('\n');
    return { top: frame.find((line) => line.includes('▐')), strip: frame[1] };
  };
  const { top, strip } = lines('S-3');
  assert.match(top, /▐06▌ Trusting a copy for one hour/);
  assert.doesNotMatch(top, /How the browser decides|Worked examples|IMAGE \+ SENTENCE|WORKED EXAMPLE/);
  assert.match(strip, /How the browser decides › Worked examples/);
  assert.doesNotMatch(strip, /Trusting a copy/);
  // A title slide's own group is its name, so the page title shows only the groups above it.
  const title = lines('title-SUB-3');
  assert.match(title.top, /▐05▌ Worked examples/);
  assert.match(title.strip, /How the browser decides/);
  assert.doesNotMatch(title.strip, /Worked examples/);
  assert.doesNotMatch(lines('title-SEC-1').strip, /Why browsers keep copies/);
});

test('Title + image: title, rule, subtitle and tag line beside the picture; its tag line box greyed elsewhere', () => {
  const s = createState(),
    first = order(s)[0];
  selectSlide(s, first.id);
  assert.equal(first.layout, 'title-image');
  const shown = (side) => {
    setChoice(s, 'imageSide', side);
    const lines = plainFrame(render(s, 196, 90)).split('\n');
    const at = (text) => lines.findIndex((l) => l.includes(text));
    return { lines, at, col: (text) => lines[at(text)].indexOf(text) };
  };
  let v = shown('right');
  // Top to bottom: title, rule, subtitle, tag line; the picture's frame is to their right.
  assert.match(v.lines[v.at('━━━━━━') - 1], /│ {2}Why browsers keep copies {2}/);
  assert.ok(v.at('How a browser decides') > v.at('━━━━━━'));
  assert.ok(v.at('Lesson 1 · Browser caching') > v.at('How a browser decides'));
  assert.ok(v.col('IMAGE (missing)') > v.col('Lesson 1 · Browser caching'));
  assert.match(v.lines.join('\n'), /TAG LINE ─/);
  assert.match(v.lines.join('\n'), /SUBTITLE ─/);
  v = shown('left');
  assert.ok(v.col('IMAGE (missing)') < v.col('Lesson 1 · Browser caching'));
  // Another layout keeps the box in place, greyed.
  selectSlide(s, order(s)[1].id);
  assert.match(plainFrame(render(s, 196, 90)), /TAG LINE ─+┐.*\n.*│ Not used by the Statement layout/);
});
