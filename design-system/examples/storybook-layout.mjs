// Deterministic, I/O-free storybook: browsing state, its key actions, and the composed frame. The host
// supplies the size, color mode, and clock reading `now` (ms); nothing here reads a clock or starts a
// timer. Playback time is derived from that reading, so the same state and `now` give the same frame.
import { assertCells, blank, fit, fitLine, lineWidth, safeText, span } from '../foundation/cells.mjs';
import { labelPlate } from '../elements/label-plate/label-plate.mjs';
import { numberedPanel, panelInnerWidth } from '../elements/numbered-panel/numbered-panel.mjs';
import { STORIES, canPlay, motionParameters } from './storybook-stories.mjs';
import { CONTINUOUS_FRAME_MS } from './storybook-motions.mjs';

const SIDEBAR = 22; // '> 13 TRANSCRIPT MARKER'
const GAP = 2;
const WIDE_FROM = 72; // columns for the index sidebar beside the story pane
const INDEX_FROM = 13; // pane rows for the index sidebar; a longer index scrolls with the selection
const BRAND_FROM = 12; // rows for the title line
const NOTICE_FROM = 20; // rows for the title, fixture notice, and a spacer
const LABEL = 10; // label column of field lines such as USAGE

const muted = { fg: 'secondary' };
// Readable labels use secondary text; decorative grey is kept for the nonessential size readout.
const heading = { fg: 'secondary', bold: true };
const faint = { fg: 'decorative' };
const strong = { fg: 'primary', bold: true };
const picked = { fg: 'accent', bold: true };
const bar = { fg: 'primary', bg: 'surface' };
const text = (value, style = {}) => span(safeText(value), style);

// Index sections in story order, each with its jump key (1, 2, 3), and the words for each kind's variants.
const SECTION_TITLES = { component: 'COMPONENTS', motion: 'MOTIONS', foundation: 'FOUNDATION' };
export const SECTIONS = Object.freeze(STORIES.flatMap((story, i) => (story.kind === STORIES[i - 1]?.kind ? [] : [Object.freeze({ title: SECTION_TITLES[story.kind], first: i })])));
const VARIANT_LABEL = { component: 'STATE', motion: 'EXAMPLE', foundation: 'VIEW' };

const OFF = Object.freeze({ status: 'off', elapsed: 0, startedAt: null });

// Browsing state. playback.status is 'off' (stable motion-off view), 'playing', 'paused', or 'complete'.
export function initialState() {
  return { story: 0, variant: 0, offset: 0, help: false, playback: OFF };
}

// Demonstration time in ms: frozen while paused or complete, running from startedAt while playing.
export function playbackTime(playback, now) {
  return playback.status === 'playing' ? playback.elapsed + Math.max(0, now - playback.startedAt) : playback.elapsed;
}

const hold = (playback, now) => (playback.status === 'playing' ? { status: 'paused', elapsed: playbackTime(playback, now), startedAt: null } : playback);
const start = (elapsed, now) => ({ status: 'playing', elapsed, startedAt: now });

// The redraw interval while the current preview plays: its motion's own step, in ms.
export function playbackInterval(state) {
  const story = STORIES[state.story];
  return story.frameMs(story.variants[state.variant]);
}

export const ACTIONS = Object.freeze(['next-story', 'prev-story', 'next-variant', 'prev-variant', 'page-down', 'page-up', 'play-pause', 'replay', 'motion-off', 'help', 'close-help']);

// Apply one action; an action that changes nothing returns the same state object, so the host can
// skip the redraw. `story:N`, `variant:N`, and `section:N` select their zero-based indexes (a section by its
// first story). Changing story or variant resets scrolling and
// turns motion off; opening the key list pauses a playing preview. Play, replay, and motion-off apply
// only to a motion that changes visibly in `mode`. page and maxOffset come from the last frame.
export function press(state, action, { now = 0, page = 1, maxOffset = 0, mode = 'PLAIN' } = {}) {
  const story = STORIES[state.story];
  const count = story.variants.length;
  const select = (s, v) => ({ ...state, story: s, variant: v, offset: 0, help: false, playback: OFF });
  const scroll = (offset) => (offset === state.offset ? state : { ...state, offset });
  const jump = /^story:(\d+)$/.exec(action);
  if (jump) {
    const target = Number(jump[1]);
    return target < STORIES.length && target !== state.story ? select(target, 0) : state;
  }
  const sectionJump = /^section:(\d+)$/.exec(action);
  if (sectionJump) {
    const target = SECTIONS[Number(sectionJump[1])]?.first;
    return target !== undefined && target !== state.story ? select(target, 0) : state;
  }
  const variantJump = /^variant:(\d+)$/.exec(action);
  if (variantJump) {
    const target = Number(variantJump[1]);
    return target < count && target !== state.variant ? select(state.story, target) : state;
  }
  switch (action) {
    case 'next-story':
      return select((state.story + 1) % STORIES.length, 0);
    case 'prev-story':
      return select((state.story + STORIES.length - 1) % STORIES.length, 0);
    case 'next-variant':
      return count > 1 ? select(state.story, (state.variant + 1) % count) : state;
    case 'prev-variant':
      return count > 1 ? select(state.story, (state.variant + count - 1) % count) : state;
    case 'page-down':
      return scroll(Math.max(0, Math.min(maxOffset, state.offset + page)));
    case 'page-up':
      return scroll(Math.max(0, state.offset - page));
    case 'help':
      return { ...state, help: !state.help, offset: 0, playback: hold(state.playback, now) };
    case 'close-help':
      return state.help ? { ...state, help: false, offset: 0 } : state;
  }
  if (state.help || !canPlay(story, story.variants[state.variant], mode)) return state;
  const p = state.playback;
  switch (action) {
    case 'play-pause':
      if (p.status === 'playing') return { ...state, playback: hold(p, now) };
      return { ...state, playback: start(p.status === 'paused' ? p.elapsed : 0, now) };
    case 'replay':
      return { ...state, playback: start(0, now) };
    case 'motion-off':
      return { ...state, playback: OFF };
  }
  return state;
}

function geometry(columns, rows) {
  const footer = rows === undefined || rows >= 2 ? 1 : 0;
  const brand = rows === undefined || rows >= NOTICE_FROM ? 3 : rows >= BRAND_FROM ? 1 : 0;
  const paneRows = rows === undefined ? undefined : rows - footer - brand;
  const wide = columns >= WIDE_FROM && (paneRows === undefined || paneRows >= INDEX_FROM);
  const paneWidth = wide ? columns - SIDEBAR - GAP : columns;
  return { footer, brand, paneRows, wide, paneWidth, inner: panelInnerWidth(paneWidth) };
}

// A finite preview completes when its time reaches the motion's duration at the current width. The host
// calls this on each timer tick; looping previews keep playing until paused.
export function advance(state, { now, columns, rows }) {
  if (state.playback.status !== 'playing') return state;
  const story = STORIES[state.story];
  const end = story.duration(story.variants[state.variant], geometry(columns, rows).inner);
  if (end === null || playbackTime(state.playback, now) < end) return state;
  return { ...state, playback: { status: 'complete', elapsed: end, startedAt: null } };
}

// Greedy word wrap of safe text into lines of at most `width` cells; long words are split.
function wrap(value, width) {
  if (width < 1) return [];
  const lines = [];
  let current = '';
  for (let word of safeText(value).split(' ')) {
    while (word.length > width) {
      if (current) lines.push(current);
      current = '';
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ' ' + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}

// Label in its own column, value wrapped beside it; below 24 cells the label takes its own line.
function field(label, value, width, style = muted) {
  if (width < 24) return [fitLine([text(label, heading)], width), ...wrap(value, width - 2).map((l) => fitLine([text('  ' + l, style)], width))];
  return wrap(value, width - LABEL).map((l, i) => fitLine([text((i ? '' : label).padEnd(LABEL), heading), text(l, style)], width));
}

// Source lines keep their indentation; wrapped continuations are indented two more cells.
function source(lines, width) {
  return lines.flatMap((src) => {
    const indent = '  ' + /^ */.exec(src)[0];
    const room = width - indent.length - 2;
    const parts = room >= 8 ? wrap(src.trimStart(), room) : wrap(src.trimStart(), width);
    return parts.map((l, i) => fitLine([text(room >= 8 ? indent + (i ? '  ' : '') + l : l, { fg: 'primary' })], width));
  });
}

function bullets(rules, width) {
  return rules.flatMap((rule) => wrap(rule, Math.max(1, width - 4)).map((l, i) => fitLine([text(i ? '    ' + l : '  - ' + l, muted)], width)));
}

const seconds = (ms) => `${(ms / 1000).toFixed(2)} s`;

// The playback status, then the redraw interval the host uses for this preview, so its rate is never implied.
function playLine(story, variant, state, width, mode, now) {
  const p = state.playback;
  const plate = labelPlate('DEMO', { tone: p.status === 'playing' ? 'accent' : 'neutral', maxWidth: width });
  const word = { off: 'MOTION OFF', playing: 'PLAYING', paused: 'PAUSED', complete: 'COMPLETE' }[p.status];
  const rate = `  ${story.frameMs(variant)} MS FRAMES`;
  let detail;
  if (p.status === 'off') detail = canPlay(story, variant, mode) ? `stable view, P plays${rate}` : 'stable view; without color this motion has nothing to show';
  else {
    const end = story.duration(variant, width);
    const loop = story.loop(variant);
    const t = p.status === 'complete' && end !== null ? end : playbackTime(p, now);
    detail = (end === null ? `${seconds(t)}${loop === null ? '' : `  loop ${seconds(loop)}`}` : `${seconds(Math.min(t, end))} of ${seconds(end)}`) + rate;
  }
  return fitLine([...plate, span(' '), text(word, p.status === 'playing' ? picked : strong), text('  ' + detail, muted)], width);
}

// All variant names when they fit, otherwise only the selected one, keeping its name over the count.
// Each target is registered while constructing its complete visible label, before padding.
function tabsLine(story, state, width) {
  const label = VARIANT_LABEL[story.kind];
  const all = [text(label + ' ', heading)];
  const targets = [];
  story.variants.forEach((v, i) => {
    const lead = i === state.variant ? ' ' : '  ';
    const name = i === state.variant ? `[${v.name}]` : v.name;
    targets.push({ column: lineWidth(all) + lead.length + 1, width: name.length, action: `variant:${i}` });
    all.push(text(lead + name + (i === state.variant ? '' : ' '), i === state.variant ? picked : muted));
  });
  if (lineWidth(all) <= width) return { line: fitLine(all, width), targets };
  const name = `[${story.variants[state.variant].name}]`;
  const count = `${state.variant + 1}/${story.variants.length}`;
  const options = [[`${label} ${count} `, name], [`${count} `, name], ['', name]];
  const [lead, shown] = options.find(([l, n]) => l.length + n.length <= width) ?? options.at(-1);
  return {
    line: fitLine([text(lead, heading), text(shown, picked)], width),
    targets: lead.length + shown.length <= width ? [{ column: lead.length + 1, width: shown.length, action: `variant:${state.variant}` }] : [],
  };
}

// One line naming the story and its state, for heights too short for the panel. The title gives way
// first, then the variant count, so the number and the selected state stay readable.
function selectionLine(story, state, width) {
  const number = String(state.story + 1).padStart(2, '0');
  const v = story.variants[state.variant];
  const tails = state.help ? ['  KEYS'] : [`  [${v.name}] ${state.variant + 1}/${story.variants.length}`, `  [${v.name}]`];
  for (const tail of tails) {
    const room = width - number.length - 1 - tail.length;
    if (room >= 4) return fitLine([text(`${number} ${fit(story.title, room)}`, picked), text(tail, muted)], width);
  }
  return fitLine([text(number, picked), text(tails.at(-1), muted)], width);
}

function bodyLines(story, variant, state, width, mode, now) {
  const p = state.playback;
  const live = story.kind === 'motion' && (p.status === 'playing' || p.status === 'paused');
  // A completed preview holds its final frame. That equals the input for every finite motion except ping,
  // whose bars are gone at the end; its motion-off view (the input bars) is shown only before playback.
  const complete = story.kind === 'motion' && p.status === 'complete';
  const animate = live || complete;
  const time = live ? playbackTime(p, now) : complete ? story.duration(variant, width) : 0;
  const specimen = story.specimen(variant, width, { animate, time, mode });
  const out = [blank(width), ...wrap(story.summary, width).map((l) => fitLine([text(l, muted)], width)), blank(width)];
  out.push(...field(story.kind === 'foundation' ? 'VIEW' : 'FIXTURE', variant.note, width), blank(width));
  out.push(...specimen.lines.map((l) => fitLine(l, width)), blank(width));
  for (const fact of specimen.facts) out.push(fitLine([text(fact, muted)], width));
  if (specimen.facts.length) out.push(blank(width));
  if (story.motion) {
    out.push(...field('OPTIONS', `from ${story.motion.defaultsName}; * set here`, width));
    for (const o of motionParameters(story, variant)) {
      out.push(fitLine([text(`  ${o.set ? '*' : ' '} ${o.name.padEnd(11)}`, muted), text(o.value.padEnd(10), strong), text(`  default ${o.defaultValue}`, muted)], width));
    }
    out.push(blank(width));
  }
  out.push(...field('USAGE', story.module, width), ...source(specimen.calls, width), blank(width));
  out.push(...field('CONTRACT', story.contract, width), ...bullets(story.rules, width));
  return out;
}

const KEY_HELP = [
  ['J K, DOWN UP', 'next or previous story'],
  ['TAB, SHIFT-TAB', 'next or previous story'],
  [`1-${SECTIONS.length}`, `jump to a section: ${SECTIONS.map((s, i) => `${i + 1} ${s.title}`).join(', ')}`],
  ['L H, RIGHT LEFT', 'next or previous state, example, or view'],
  ['SPACE, PGDN', 'page the details down'],
  ['B, PGUP', 'page the details up'],
  ['P', 'play or pause a motion preview'],
  ['R', 'replay a motion from the start'],
  ['O', 'motion off: the stable view'],
  ['?', 'show or hide these keys; Esc also hides them'],
  ['Q, ESC', 'quit; Ctrl-C quits from anywhere'],
];
// The redraw intervals the previews use, from the stories themselves.
const RATES = STORIES.filter((s) => s.kind === 'motion').flatMap((s) => s.variants.map((v) => s.frameMs(v)));
const PLAYBACK_HELP =
  `Motion previews are demonstration playback over fixture lines and start with motion off. While one plays, a single redraw timer runs at that motion's own step, shown as MS FRAMES (${Math.min(...RATES)} to ${Math.max(...RATES)} ms here); motions that change continuously redraw every ${CONTINUOUS_FRAME_MS} ms, at most 15 frames a second. Pausing, completing, changing story or example, opening these keys, and quitting stop it. A completed preview holds its last frame; for ping that is its bars gone. Without color, motions that change only color look the same as motion off, so they do not play.`;

function helpLines(width) {
  const out = [blank(width), fitLine([text('KEYS', strong)], width)];
  for (const [keys, what] of KEY_HELP) {
    if (width >= 40) out.push(...wrap(what, width - 20).map((l, i) => fitLine([text(('  ' + (i ? '' : keys)).padEnd(20), strong), text(l, muted)], width)));
    else out.push(fitLine([text('  ' + keys, strong)], width), ...wrap(what, width - 4).map((l) => fitLine([text('    ' + l, muted)], width)));
  }
  out.push(blank(width), fitLine([text('PLAYBACK', strong)], width));
  out.push(...wrap(PLAYBACK_HELP, width - 2).map((l) => fitLine([text('  ' + l, muted)], width)));
  return out;
}

function sidebarLength() {
  return STORIES.length + 2 * SECTIONS.length - 1; // a heading per section, spacers between, one line per story
}

// The index: a numbered heading per section, then its stories. When it is taller than `height`, a window
// around the selection scrolls with it, and its first or last line says how many stories are out of view.
function sidebar(state, height) {
  const rows = [];
  STORIES.forEach((story, i) => {
    const s = SECTIONS.findIndex((section) => section.first === i);
    if (s >= 0) rows.push(...(i ? [{ line: blank(SIDEBAR) }] : []), { line: fitLine([text(`${s + 1} ${SECTIONS[s].title}`, heading)], SIDEBAR) });
    const on = i === state.story;
    const label = `${on ? '>' : ' '} ${String(i + 1).padStart(2, '0')} ${story.title}`;
    const line = fitLine([text(fit(label, SIDEBAR), on ? { ...picked, bg: 'surface' } : muted)], SIDEBAR, on ? { bg: 'surface' } : {});
    rows.push({ line, story: i, target: label.length <= SIDEBAR ? { column: on ? 1 : 3, width: label.length - (on ? 0 : 2), action: `story:${i}` } : undefined });
  });
  const tail = [blank(SIDEBAR), fitLine([text(`1-${SECTIONS.length} SECTION  ? KEYS`, muted)], SIDEBAR)];
  const room = height - tail.length;
  let shown = rows;
  if (rows.length > room) {
    const selected = rows.findIndex((r) => r.story === state.story);
    const start = Math.max(0, Math.min(rows.length - room, selected - Math.floor(room / 2)));
    shown = rows.slice(start, start + room);
    const more = (hidden, where) => ({ line: fitLine([text(`  ${hidden.filter((r) => r.story !== undefined).length} MORE ${where}`, muted)], SIDEBAR) });
    if (start > 0) shown[0] = more(rows.slice(0, start + 1), 'ABOVE');
    if (start + room < rows.length) shown[room - 1] = more(rows.slice(start + room - 1), 'BELOW');
  }
  const targets = shown.flatMap((r, i) => (r.target ? [{ ...r.target, row: i + 1 }] : []));
  const lines = [...shown.map((r) => r.line), ...tail];
  while (lines.length < height) lines.push(blank(SIDEBAR));
  return { lines: lines.slice(0, height), targets: targets.filter((t) => t.row <= height) };
}

// The notice says what the visible values are: fixtures for elements and motions, reference values for colors.
const NOTICES = {
  fixture: ['FIXTURE VALUES AND DEMONSTRATION PLAYBACK, NOT LIVE TELEMETRY', 'FIXTURES AND DEMOS, NOT LIVE DATA', 'FIXTURES, NOT LIVE'],
  foundation: ['REFERENCE VALUES, NOT A THEME OR LIVE DATA', 'REFERENCE VALUES, NOT LIVE DATA', 'REFERENCE, NOT LIVE'],
};

function brandLines(count, columns, rows, mode, kind) {
  const left = [...labelPlate('INDUSTRIAL OS', { tone: 'accent', maxWidth: columns }), span(' ')];
  if (lineWidth(left) + 9 <= columns) left.push(text('STORYBOOK', strong));
  const size = `${rows ? `${columns}x${rows}` : `${columns} COLS`} ${mode}`;
  // The palette name gives way before the truthful size/mode readout does.
  if (columns - lineWidth(left) >= 16 + size.length) left.push(text('  ACID / BLACK', muted));
  const rest = columns - lineWidth(left);
  if (rest >= size.length + 2) left.push(text(size.padStart(rest), faint));
  const lines = [fitLine(left, columns)];
  if (count === 1) return lines;
  const notes = NOTICES[kind === 'foundation' ? 'foundation' : 'fixture'];
  const note = notes.find((n) => n.length <= columns) ?? notes.at(-1);
  return [...lines, fitLine([text(fit(note, columns), muted)], columns), blank(columns)];
}

function hintSets(story, playable, help, snapshot, offset, maxOffset) {
  const control = (label, action, enabled = true) => ({ label, action: enabled ? action : null });
  if (snapshot) return [[control('SNAPSHOT: RUN IN A TERMINAL TO BROWSE', null)], [control('SNAPSHOT', null)], []];
  const close = control(help ? '? CLOSE' : '? KEYS', help ? 'close-help' : 'help');
  const quit = control('Q QUIT', 'quit');
  const pages = [control('SPACE PAGE', 'page-down', offset < maxOffset), control('B BACK', 'page-up', offset > 0)];
  if (help) return [[...pages, control('? OR ESC CLOSES KEYS', 'close-help'), quit], [close, quit], [control('?', 'close-help'), control('Q', 'quit')]];
  const stories = [control('K PREV', 'prev-story'), control('J NEXT', 'next-story')];
  const variants = [control('H PREV', 'prev-variant'), control('L NEXT', 'next-variant')];
  const playback = playable ? [control('P PLAY/PAUSE', 'play-pause'), control('R REPLAY', 'replay'), control('O OFF', 'motion-off')] : [];
  return [
    [...stories, ...variants, ...playback, ...pages, close, quit],
    // Short labels are distinct controls, not a combined forward/backward hint.
    [...stories, ...variants, ...playback, ...pages].map((c) => ({ ...c, label: c.label.split(' ')[0] })).concat(close, quit),
    [...playback, ...pages].map((c) => ({ ...c, label: c.label.split(' ')[0] })).concat(close, quit),
    [control('?', 'help'), control('Q', 'quit')],
  ];
}

// Footer controls and their exact hit extents are composed together. Ranges and padding are inert.
function footer(columns, hints, { offset, maxOffset, shown, total }) {
  const ranges = maxOffset > 0 ? [`LINES ${offset + 1}-${offset + shown} OF ${total}`, `${offset + 1}-${offset + shown}/${total}`] : [''];
  const make = (range, controls) => {
    const spans = range ? [text(range, bar)] : [];
    const targets = [];
    const gap = controls.length === 2 && controls.every((c) => c.label.length === 1) ? ' ' : '  ';
    for (const c of controls) {
      if (spans.length) spans.push(text(spans.length === 1 && range ? '  ' : gap, bar));
      if (c.action) targets.push({ column: lineWidth(spans) + 1, width: c.label.length, action: c.action });
      spans.push(text(c.label, bar));
    }
    return { spans, targets };
  };
  let chosen;
  for (const range of ranges) {
    chosen ??= hints.map((h) => make(range, h)).find((c) => lineWidth(c.spans) <= columns);
  }
  chosen ??= make(ranges.at(-1), hints.at(-1));
  const visibleColumns = lineWidth(chosen.spans) > columns && columns > 1 ? columns - 1 : columns;
  return {
    line: fitLine([text(fit(chosen.spans.map((s) => s.text).join(''), columns), bar)], columns, { bg: 'surface' }),
    targets: chosen.targets.filter((t) => t.column + t.width - 1 <= visibleColumns),
  };
}

// 1-based cell coordinates, inclusive label edges; gaps, clipped labels, and content are inert.
export function hitAction(view, { column, row }) {
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 1 || row < 1) return undefined;
  return view.targets?.find((t) => t.row === row && column >= t.column && column < t.column + t.width)?.action;
}

function assertState(state) {
  const story = STORIES[state?.story];
  if (!story || !Number.isInteger(state.story)) throw new RangeError(`story must be an index from 0 to ${STORIES.length - 1}, got ${state?.story}`);
  if (!Number.isInteger(state.variant) || !story.variants[state.variant]) throw new RangeError(`variant must be an index of story ${story.id}, got ${state.variant}`);
  if (!Number.isInteger(state.offset) || state.offset < 0) throw new RangeError(`offset must be an integer >= 0, got ${state.offset}`);
  if (!['off', 'playing', 'paused', 'complete'].includes(state.playback?.status)) throw new RangeError(`unknown playback status: ${state.playback?.status}`);
}

// Compose one frame. Every line is exactly `columns` cells and there are at most `rows` lines; without
// `rows` the details are shown in full (snapshot). Rows go first to the story and its state, then the
// key hints, then any motion playback status; the title, notice, sidebar, and details give way first.
// Returns the frame, 1-based complete-label targets { column, row, width, action }, the clamped scroll
// offset, its maximum, and a page size for paging actions. Snapshots return no targets.
export function composeStorybook(state, { columns, rows, mode = 'PLAIN', now = 0, snapshot = false }) {
  if (mode !== 'PLAIN' && mode !== 'TRUECOLOR') throw new RangeError('mode must be PLAIN or TRUECOLOR');
  assertCells(columns, 'columns');
  if (rows !== undefined) assertCells(rows, 'rows');
  if (typeof now !== 'number' || !Number.isFinite(now)) throw new RangeError(`now must be a finite number of ms, got ${now}`);
  assertState(state);

  const g = geometry(columns, rows);
  const story = STORIES[state.story];
  const variant = story.variants[state.variant];
  const width = g.paneWidth;
  const tabs = tabsLine(story, state, g.inner);
  const pinned = [tabs.line];
  if (story.kind === 'motion') pinned.push(playLine(story, variant, state, g.inner, mode, now));
  const body = state.help ? helpLines(g.inner) : bodyLines(story, variant, state, g.inner, mode, now);
  const chrome = g.inner === width ? 1 : 2;
  const header = { number: state.story + 1, title: story.title, meta: state.help ? 'KEYS' : `${story.kind.toUpperCase()} ${state.story + 1}/${STORIES.length}` };

  // Too short for the frame, a one-line selection replaces the panel header and state tabs.
  const framed = g.paneRows === undefined || g.paneRows >= chrome + pinned.length + 1;
  const top = framed ? pinned : [selectionLine(story, state, width), ...pinned.slice(1)].slice(0, g.paneRows);
  const shown = g.paneRows === undefined ? body.length : Math.max(0, g.paneRows - top.length - (framed ? chrome : 0));
  const maxOffset = shown > 0 ? Math.max(0, body.length - shown) : 0;
  const offset = Math.min(state.offset, maxOffset);
  const visible = body.slice(offset, offset + shown);
  const pane = framed
    ? numberedPanel(header, [...top, ...visible], g.paneRows === undefined ? { width } : { width, height: g.paneRows })
    : [...top, ...visible].map((l) => fitLine(l, width));

  const lines = g.brand ? brandLines(g.brand, columns, rows, mode, story.kind) : [];
  const targets = [];
  if (framed) targets.push(...tabs.targets.map((t) => ({
    ...t, row: lines.length + 2, column: t.column + (g.wide ? SIDEBAR + GAP : 0) + (g.inner === width ? 0 : 2),
  })));
  if (g.wide) {
    const height = Math.max(pane.length, sidebarLength() + 2);
    const side = sidebar(state, rows === undefined ? height : g.paneRows);
    targets.push(...side.targets.map((t) => ({ ...t, row: t.row + lines.length })));
    side.lines.forEach((s, i) => lines.push([...s, span(' '.repeat(GAP)), ...(pane[i] ?? blank(width))]));
  } else lines.push(...pane);
  if (g.footer) {
    const playable = canPlay(story, variant, mode);
    const foot = footer(columns, hintSets(story, playable, state.help, snapshot, offset, maxOffset), { offset, maxOffset, shown: Math.min(shown, body.length), total: body.length });
    targets.push(...foot.targets.map((t) => ({ ...t, row: lines.length + 1 })));
    lines.push(foot.line);
  }
  return { lines, targets: snapshot ? [] : targets, offset, maxOffset, page: Math.max(1, shown - 1) };
}
