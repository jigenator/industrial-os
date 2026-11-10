import { span, fitLine, fitText, paint } from '@industrial-os/design-system/foundation/cells';
import { sectionHead } from '@industrial-os/design-system/elements/section-head';
import { actionLabel, keyHints } from '@industrial-os/design-system/elements/action-label';
import { imageInset, imageLabel } from '@industrial-os/design-system/elements/feed-bezel';
import { noticeRow } from '@industrial-os/design-system/elements/notice-row';
import { popupHeader, popupFooter } from '@industrial-os/design-system/elements/popup-header';
import { stateChip } from '@industrial-os/design-system/elements/state-chip';
import { verticalRule } from '@industrial-os/design-system/elements/tab-rule';
import { scrollRail } from '@industrial-os/design-system/elements/scroll-rail';
import { labelPlate } from '@industrial-os/design-system/elements/label-plate';
import { numberedPanel } from '@industrial-os/design-system/elements/numbered-panel';
import { geometry, aspectPlacement } from './geometry.mjs';
import { TYPES, LAYOUTS, LAYOUT_NAMES } from './seed.mjs';
import { display, wrap, wrapRows, graphemes, caretPos } from './text.mjs';
import {
  order,
  slideById,
  ownerById,
  slideName,
  fieldName,
  outlineRows,
  rowSlide,
  addParents,
  groupContents,
  keyOf,
  busy,
  pending,
  lessonBusy,
  formFields,
  imageFields,
  imageSided,
  focusedBox,
  sameBox,
  chatAim,
  editSource,
  editLocked,
  PLAN_FIELDS,
  STYLE_OF,
  STYLE_NAMES,
  TABS,
  tabIndex,
} from './model.mjs';

export const PLAN_NAMES = ['Outcomes', 'Prerequisites', 'Teaching principles', 'First-principles progression'];
export { PLAN_FIELDS };
// Top-bar tab names, in TABS order, from the widest form down; the window picks the first that fits. Each tab is
// numbered; the narrowest form shows only numbers, with the current tab's short name.
const TAB_NAMES = [
  ['Outcomes', 'Prerequisites', 'Principles', 'Progression', 'Slides', 'Learner preview'],
  ['Outcomes', 'Prereqs', 'Principles', 'Progress', 'Slides', 'Preview'],
];
const CHIPS = {
  working: { shape: '▒', code: 'WORKING', tone: 'warning' },
  queued: { shape: '·', code: 'QUEUED', tone: 'warning' },
  ai: { shape: '◆', code: 'AI EDIT', tone: 'decorative' },
  readonly: { shape: '▲', code: 'READ ONLY', tone: 'warning' },
  locked: { shape: '▪', code: 'LOCKED', tone: 'secondary' },
};
const PLACEHOLDER = {
  title: 'Add a title',
  content: 'Add text',
  tagline: 'Add a tag line, such as the session',
  imageDesc: 'Describe what this image teaches',
  afterDesc: 'Describe what this image teaches',
  beforeCap: 'Add a caption',
  afterCap: 'Add a caption',
  purpose: 'Why is this slide here?',
  notes: 'Author-only notes - learners never see these',
  comments: 'Your review comments - ask the agent to work through them',
};
// Text rows inside each form box; fixed so the form never shifts while typing.
const BOX_ROWS = {
  title: 2,
  content: 8,
  tagline: 1,
  imageDesc: 8,
  afterDesc: 8,
  beforeCap: 8,
  afterCap: 8,
  purpose: 8,
};
const NOTES_ROWS = 12;
const COMMENT_ROWS = 6;
// Boxes that sit side by side share one height; resizing either resizes the row (s.boxRows, keyed by its first field).
export const BOX_PAIRS = [
  ['title'],
  ['content', 'purpose'],
  ['tagline'],
  ['imageDesc', 'afterDesc'],
  ['beforeCap', 'afterCap'],
  ['notes'],
  ['comments'],
];
export const pairOf = (field) => BOX_PAIRS.find((pair) => pair.includes(field))?.[0];
export const BOX_LIMITS = { low: 1, high: 30 };
const LABEL_W = 14;
const ACCENT = { fg: 'accent', bold: true };
const LABEL = { fg: 'secondary' };
const FAINT = { fg: 'decorative' };
// Outline levels are categories, so they take two of the design system's category fills as ink.
// Outline levels by weight and ink, no hue: sections bold white, subsections bold light grey; acid stays for focus.
const LEVEL = { section: 'primary', subsection: 'secondary' };

function inputMode(s) {
  if (s.modal) {
    if (s.modal.pending) return 'WAIT ATTACHMENT';
    return s.modal.input !== undefined ? `TYPE ${s.modal.kind.toUpperCase()}` : 'BROWSE DIALOG';
  }
  if (s.pane === 'chat') return s.chatMode === 'composer' ? 'TYPE CHAT' : 'BROWSE CHAT';
  const box = focusedBox(s);
  if (box) return editLocked(s, box) ? 'READ ONLY FIELD' : 'TYPE FIELD';
  return `BROWSE ${s.pane.toUpperCase()}`;
}

const widthOf = (line) => line.reduce((n, item) => n + [...item.text].length, 0);
// keyHints draws a lead cell, then each token as "key label" plus two trailing cells.
const hintsFor = (tokens) =>
  keyHints(tokens, { width: 1 + tokens.reduce((n, t) => n + t.key.length + t.label.length + 3, 0) });

// Option rows depend only on width, so the layout never shifts when the selection changes.
// Options sit in fixed-width columns so they line up down the group; colW lets groups share a grid.
export function radioLayout(names, width, labelWidth = LABEL_W, colW = 0) {
  const cw = Math.max(colW, ...names.map((name) => name.length + 5)),
    cols = Math.max(1, Math.floor((width - labelWidth + 2) / cw));
  return {
    items: names.map((name, i) => ({
      i,
      row: Math.floor(i / cols),
      col: labelWidth + (i % cols) * cw,
      w: 3 + name.length,
    })),
    rows: Math.max(1, Math.ceil(names.length / cols)),
  };
}

export function chatRows(s, width) {
  const rows = [];
  for (const [i, m] of s.chat.entries()) {
    const state =
      m.role === 'You'
        ? 'you'
        : m.live
          ? 'running'
          : /^(Stopped|Failed)/.test(m.text)
            ? 'failed'
            : m.role === 'Note'
              ? 'note'
              : 'done';
    const shape = { you: '›', done: '■', failed: '✕', running: '▒', note: '·' }[state];
    const tone = { you: 'primary', done: 'accent', failed: 'critical', running: 'warning', note: 'decorative' }[state];
    // Chat restored from the lesson's history reads as earlier: decorative shape and speaker, an "earlier" stamp,
    // secondary text, and a note after the last of it.
    rows.push([
      span(shape + ' ', { fg: m.earlier ? 'decorative' : tone, bold: true }),
      span(m.role, { fg: m.earlier ? 'decorative' : m.role === 'You' ? 'primary' : 'secondary', bold: true }),
    ]);
    if (m.earlier)
      rows.push([
        span(m.stamp ? '  earlier · ' : '  earlier', FAINT),
        ...fitText(display(m.stamp), Math.max(0, width - 12), { style: FAINT }),
      ]);
    else if (m.stamp) rows.push(fitText(display('  ' + m.stamp), width, { style: FAINT }));
    for (const line of wrap(m.text, width - 2))
      rows.push([span('  ' + line, { fg: m.role === 'You' && !m.earlier ? 'primary' : 'secondary' })]);
    if (m.queued) rows.push([span('  ◌ Queued: starts when the request before it finishes', { fg: 'warning' })]);
    rows.push([]);
    if (m.earlier && !s.chat[i + 1]?.earlier)
      rows.push(
        ...wrap('· Earlier sessions above, kept beside the lesson; the AI does not see them.', width).map((line) => [
          span(line, FAINT),
        ]),
        [],
      );
  }
  return rows;
}

// What the pointer would click: the smallest target under it, as the controller picks; popups take every click.
export function hoverHit(hits, x, y, modal = false) {
  return hits
    .filter((h) => h.act && (!modal || h.modal) && x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h)
    .sort((a, b) => a.w * a.h - b.w * b.h)[0];
}
// Hover feedback: a button turns black on acid, as crate-banner tools do; a row brightens a step. Text boxes brighten
// their outline instead (in formBox). Locked controls and plain areas show nothing.
const HOVER = {
  row: new Set(['outline-row', 'choice', 'modal-option']),
  button: new Set([
    'nav',
    'fold',
    'add',
    'outline-key',
    'clear-target',
    'model',
    'view',
    'review',
    'help',
    'images',
    'speak',
    'outline-toggle',
  ]),
};
for (const act of ['file', 'generate', 'style', 'prompt', 'attach']) HOVER.button.add(act);

export function render(s, width, height, { graphics = false } = {}) {
  const g = geometry(width, height, s.columns),
    grid = Array.from({ length: g.h }, () =>
      Array.from({ length: g.w }, () => ({ text: ' ', style: { fg: 'primary', bg: 'field' } })),
    ),
    images = [],
    hits = [];
  let cursor = null,
    clip = null;
  // Where each image box's style button was drawn, for its dropdown.
  const anchors = {};
  // Cell width for the few labels with one-cell Unicode glyphs.
  const cellCount = (value) => [...value].length;

  // clip limits drawing to the rows of a scrolling region.
  function put(x, y, line, { transparent = false } = {}) {
    if (y < 0 || y >= g.h || (clip && (y < clip.top || y >= clip.bottom))) return x;
    let i = x;
    for (const item of line)
      for (const ch of item.text) {
        if (i >= 0 && i < g.w && (!transparent || ch !== ' ')) grid[y][i] = { text: ch, style: item.style || {} };
        i++;
      }
    return i;
  }
  const text = (x, y, value, w, style = { fg: 'primary' }) => {
    if (w <= 0) return;
    put(x, y, fitLine([span(display(value), style)], w, { bg: style.bg || 'field' }));
  };
  const block = (x, y, lines, options) => lines.forEach((line, i) => put(x, y + i, line, options));
  const fill = (r, bg = 'field') => {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        if (y >= 0 && y < g.h && x >= 0 && x < g.w) grid[y][x] = { text: ' ', style: { fg: 'primary', bg } };
  };
  // A white slide behind a picture: Kitty shows the cell background through transparent pixels, and the terminal's
  // own cell size can leave a margin round the picture inside its rectangle.
  const paper = (r) => fill({ x: r.x, y: r.y, w: r.width, h: r.height }, 'primary');
  // Areas the background texture keeps out of (typing areas, the slide, popups), clipped like click targets.
  const quiet = [];
  const calm = (x, y, w, h) => {
    if (clip) {
      const top = Math.max(y, clip.top);
      h = Math.min(y + h, clip.bottom) - top;
      y = top;
    }
    const left = Math.max(0, x);
    w = Math.min(x + w, g.w) - left;
    h = Math.min(h, g.h - y);
    if (w > 0 && h > 0 && y >= 0) quiet.push({ x: left, y, width: w, height: h });
  };
  const hit = (x, y, w, h, act) => {
    if (clip) {
      const top = Math.max(y, clip.top);
      h = Math.min(y + h, clip.bottom) - top;
      y = top;
    }
    w = Math.min(w, g.w - x);
    h = Math.min(h, g.h - y);
    if (w > 0 && h > 0 && x >= 0 && y >= 0) hits.push({ x, y, w, h, ...act });
  };

  if (g.small) {
    put(0, 0, sectionHead({ title: 'LESSON MAKER' }, { width: g.w }));
    block(
      0,
      Math.min(2, g.h - 1),
      noticeRow(
        { text: 'Window too small — resize to at least 100×24 or 80×30', tone: 'warning' },
        { width: g.w, measure: cellCount },
      ),
    );
    wrap('State, unsaved typing and running jobs are preserved. No mutation here. q quit / Ctrl-C exit.', g.w).forEach(
      (line, i) => text(0, 4 + i, line, g.w),
    );
    return { g, lines: grid, images: [], cursor: null, hits: [], quiet: [] };
  }

  const x = slideById(s, s.selected),
    slides = order(s),
    count = slides.length,
    browsing = (control) => s.control === control && s.pane === 'workbench' && !s.modal;

  // ---------- shared parts ----------
  // Narrow columns put the label on its own row so the options get the full width.
  const stackedLabel = (w) => w < 80;
  const radioRows = (names, w, disabled, colW) =>
    disabled
      ? stackedLabel(w)
        ? 2
        : 1
      : stackedLabel(w)
        ? 1 + radioLayout(names, w, 2, colW).rows
        : radioLayout(names, w, LABEL_W, colW).rows;
  function radios(label, names, selected, control, x0, y, w, { disabled = false, note = '', colW = 0 } = {}) {
    const focused = !disabled && browsing(control);
    text(x0, y, (focused ? '▸ ' : '') + label, LABEL_W, focused ? ACCENT : LABEL);
    if (disabled) {
      const at = stackedLabel(w) ? 2 : LABEL_W;
      text(x0 + at, y + (at === 2 ? 1 : 0), note, w - at, FAINT);
      return at === 2 ? 2 : 1;
    }
    const stacked = stackedLabel(w),
      layout = radioLayout(names, w, stacked ? 2 : LABEL_W, colW);
    if (stacked) y += 1;
    for (const it of layout.items) {
      const on = it.i === selected,
        cur = focused && s.choice === it.i;
      put(x0 + it.col, y + it.row, [
        span(cur ? '›' : ' ', ACCENT),
        span(on ? '●' : '○', { fg: on ? 'accent' : 'decorative' }),
        span(' ' + names[it.i], on ? { fg: 'primary', bold: true } : cur ? { fg: 'accent' } : LABEL),
      ]);
      hit(x0 + it.col, y + it.row, it.w, 1, { act: 'choice', control, index: it.i });
    }
    return layout.rows + (stacked ? 1 : 0);
  }
  function chipFor(slide, field) {
    if (!slide) return null;
    if (slide.locked) return stateChip({ label: '', state: 'locked' }, { preset: CHIPS });
    // A whole-lesson request may change any box, so every box carries its tag while it waits or runs.
    if (busy(s, slide.id, field)) return stateChip({ label: '', state: 'working' }, { preset: CHIPS });
    if (s.review) return stateChip({ label: '', state: 'readonly' }, { preset: CHIPS });
    if (s.provenance[keyOf(slide.id, field)]) return stateChip({ label: '', state: 'ai' }, { preset: CHIPS });
    return null;
  }
  // Every text box is one solid frame with its label in the top border: light grey when idle, a heavy accent
  // outline when focused, dim when the layout does not use the field. The design system has no such frame yet.
  function frame(x0, y, w, rows, label, tone = 'idle', tags = []) {
    const heavy = tone === 'focus',
      ink = {
        fg: heavy ? 'accent' : tone === 'off' ? 'decorative' : tone === 'hover' ? 'primary' : 'secondary',
        bold: heavy,
      },
      [tl, tr, bl, br, hz, vt] = heavy ? ['┏', '┓', '┗', '┛', '━', '┃'] : ['┌', '┐', '└', '┘', '─', '│'],
      name = fitText(' ' + label + ' ', Math.max(0, w - 4), {
        style: heavy ? ACCENT : tone === 'off' ? FAINT : { fg: 'primary', bold: true },
      });
    put(x0, y, [span(tl + hz, ink), ...name, span(hz.repeat(Math.max(0, w - 3 - widthOf(name))), ink), span(tr, ink)]);
    for (let r = 1; r <= rows; r++) {
      put(x0, y + r, [span(vt, ink)]);
      put(x0 + w - 1, y + r, [span(vt, ink)]);
    }
    put(x0, y + rows + 1, [span(bl + hz.repeat(Math.max(0, w - 2)) + br, ink)]);
    calm(x0 + 1, y + 1, w - 2, rows);
    if (tags.length && widthOf(tags) + widthOf(name) + 6 <= w)
      put(x0 + w - 3 - widthOf(tags), y, [span(' '), ...tags, span(' ')]);
  }
  // A form box: the frame, the saved or live text, and the caret while focused. x0..x0+w-1 is the frame.
  function formBox(box, label, x0, y, w, rows, { placeholder = '', tags = [], off = '' } = {}) {
    const focused = sameBox(box, focusedBox(s)),
      // While the chat is in use, its target box keeps the focus outline so it is clear what the chat will change.
      // An edit agent's box is greyed out and takes no clicks until its change lands.
      working = !box.principle && busy(s, box.slideId, box.field),
      aimed = !working && s.pane === 'chat' && !s.modal && !box.principle && sameBox(box, chatAim(s)),
      locked = editLocked(s, box),
      edit = sameBox(box, s.edit) ? s.edit : null,
      value = edit ? edit.text : editSource(s, box),
      inner = Math.max(1, w - 4);
    // The pointer over a box it can click into brightens the outline: the box takes a click.
    const pointed =
      !off &&
      !working &&
      !locked &&
      !s.modal &&
      s.hover?.x >= x0 &&
      s.hover.x < x0 + w &&
      s.hover.y >= y &&
      s.hover.y <= y + rows + 1;
    frame(
      x0,
      y,
      w,
      rows,
      label,
      off || working ? 'off' : focused || aimed ? 'focus' : pointed ? 'hover' : 'idle',
      off ? [] : tags,
    );
    if (off) {
      text(x0 + 2, y + 1, off, inner, FAINT);
      hit(x0, y, w, rows + 2, { act: 'field-off', note: off });
      return;
    }
    // Text longer than the box scrolls inside it, with a rail in the frame's inner right column. Typing and caret
    // moves keep the caret in view; the wheel scrolls freely and the box keeps that position after you leave.
    const key = box.principle ? 'principle:' + box.field : keyOf(box.slideId, box.field),
      lines = value ? wrap(value, inner) : [],
      typing = focused && !locked && !working,
      cursorAt = edit ? edit.cursor : graphemes(value).length,
      caret = typing ? caretPos(value, inner, cursorAt) : { row: -1, col: 0 },
      row = caret.row,
      total = Math.max(lines.length, row + 1),
      most = Math.max(0, total - rows);
    let offset = Math.min(most, s.boxScroll[key] || 0);
    if (typing && s.caretFollow) offset = Math.min(Math.max(offset, row - rows + 1), row);
    if (typing) g.boxScroll = { key, offset };
    // Being read aloud, the notes keep the words being read in view.
    const heard = !typing && box.field === 'notes' && value.trim() && s.reading?.slideId === box.slideId;
    if (heard && most) {
      const cut = spokenCut(value, s.reading.heard),
        now = Math.max(
          0,
          wrapRows(value, inner).findLastIndex((row) => row.start <= cut),
        );
      offset = Math.max(0, Math.min(most, now - Math.floor(rows / 3)));
    }
    lines.slice(offset, offset + rows).forEach((line, i) => text(x0 + 2, y + 1 + i, line, inner, working ? FAINT : {}));
    if (heard) spokenWords(value, inner, s.reading.heard, x0 + 2, y + 1, offset, rows);
    if (edit && typing) marked(value, inner, edit.mark, edit.cursor, x0 + 2, y + 1, offset, rows);
    if (!value && !working) text(x0 + 2, y + 1, placeholder, inner, FAINT);
    if (most) {
      block(x0 + w - 2, y + 1, scrollRail({ total, visible: rows, offset }));
      hit(x0 + 1, y + 1, w - 2, rows, { scroll: 'box', key, offset, most });
    }
    if (typing) {
      const cy = y + 1 + row - offset;
      if (cy > y && cy <= y + rows && (!clip || (cy >= clip.top && cy < clip.bottom)))
        cursor = { x: x0 + 2 + Math.min(inner - 1, caret.col), y: cy };
    }
    if (working) {
      hit(x0, y, w, rows + 2, { act: 'field-busy', box });
      return;
    }
    // The text area and scroll offset let a click put the caret where it lands.
    hit(x0, y, w, rows + 2, { act: 'field', box, text: { x: x0 + 2, y: y + 1, w: inner, rows, offset } });
  }
  // Where the words already spoken end: the share heard spread over the characters, cut back to a whole word.
  // Gemini gives no word timings, so this is an estimate.
  function spokenCut(value, heard = 0) {
    const shown = display(value),
      lead = shown.length - shown.trimStart().length,
      said = shown.trim(),
      at = Math.round(heard * said.length);
    return lead + (at >= said.length ? said.length : Math.max(0, said.lastIndexOf(' ', at)));
  }
  // The words already spoken, in acid, on the wrapped rows drawn from row `first` at (x, y).
  function spokenWords(value, width, heard, x, y, first, rows) {
    const cut = spokenCut(value, heard);
    wrapRows(value, width)
      .slice(first, first + rows)
      .forEach((row, i) => {
        const cy = y + i;
        if (clip && (cy < clip.top || cy >= clip.bottom)) return;
        for (let at = row.start; at < Math.min(cut, row.start + row.text.length); at++) {
          const cx = x + at - row.start,
            cell = grid[cy]?.[cx];
          if (cell && cell.text !== ' ') grid[cy][cx] = { ...cell, style: { ...cell.style, fg: 'accent' } };
        }
      });
  }
  // Highlighted text, black on acid like a pressed button: the graphemes from mark to cursor, on the wrapped rows
  // drawn from row `first` at (x, y).
  function marked(value, width, mark, cursor, x, y, first, rows) {
    if (mark === undefined || mark === cursor) return;
    const from = Math.min(mark, cursor),
      to = Math.max(mark, cursor);
    wrapRows(value, width)
      .slice(first, first + rows)
      .forEach((row, i) => {
        const cy = y + i;
        if (clip && (cy < clip.top || cy >= clip.bottom)) return;
        for (let at = Math.max(from, row.start); at < Math.min(to, row.start + row.text.length); at++) {
          const cx = x + at - row.start,
            cell = grid[cy]?.[cx];
          if (cell) grid[cy][cx] = { ...cell, style: { ...cell.style, fg: 'field', bg: 'accent' } };
        }
      });
  }
  // State tags on a box's top border: agent work, review or an AI edit. The chat's aim needs no tag: it follows
  // the box you are in, and the chat panel names it.
  const tagsFor = (slide, field) => chipFor(slide, field) || [];
  function fieldLabel(slide, field) {
    if (field === 'title')
      return ['title', 'title-image', 'points-image'].includes(slide.layout) ? 'TITLE' : 'SLIDE NAME';
    if (field === 'content' && !formFields(slide).includes('content')) return 'POINTS / SENTENCE / STATEMENT';
    if (field === 'imageDesc' && !formFields(slide).includes(field)) return 'IMAGE CONCEPT';
    return fieldName(slide, field).toUpperCase();
  }
  // A form item knows its height before it is drawn, so the form can scroll as one block.
  const item = (h, draw, focus = false) => ({ h, draw, focus });
  // Every slide field keeps its place; one the layout does not use is dimmed and cannot be focused.
  function slideBox(slide, field, rows = s.boxRows[pairOf(field)] ?? BOX_ROWS[field]) {
    const box = { slideId: slide.id, field },
      used = ['notes', 'comments', 'purpose'].includes(field) || formFields(slide).includes(field),
      image = imageFields(slide).includes(field),
      layoutName = LAYOUT_NAMES[LAYOUTS.indexOf(slide.layout)];
    return item(
      rows + 2,
      (x0, y, width) => {
        formBox(box, fieldLabel(slide, field), x0, y, width, rows, {
          placeholder: PLACEHOLDER[field],
          tags: tagsFor(slide, field),
          off: used ? '' : `Not used by the ${layoutName} layout`,
        });
        if (image) imageFooter(slide, field, x0, y + rows + 1, width);
        resizeEdge(field, x0, y, width, rows);
        (g.boxHeights ??= {})[pairOf(field)] = rows;
      },
      sameBox(box, focusedBox(s)) ||
        ['style', 'generate', 'attach', 'prompt'].some((a) => s.control === `${a}:${field}`),
    );
  }
  // A box's bottom border is a drag handle for its row's height: acid under the pointer and while dragged. The
  // border's buttons are smaller targets, so they still win their clicks.
  function resizeEdge(field, x0, y, w, rows) {
    const by = y + rows + 1,
      pair = pairOf(field),
      shown = !clip || (by >= clip.top && by < clip.bottom);
    if (!shown) return;
    hit(x0, by, w, 1, { act: 'box-edge', pair, top: y });
    const on =
      s.boxResize?.pair === pair ||
      (!s.modal && !s.boxResize && s.hover?.y === by && s.hover.x >= x0 && s.hover.x < x0 + w);
    if (on)
      for (let x = x0; x < x0 + w && x < g.w; x++)
        if ('─└┘━┗┛'.includes(grid[by][x].text))
          grid[by][x] = { ...grid[by][x], style: { ...grid[by][x].style, fg: 'accent' } };
  }
  // An image box's bottom border: what the picture is, then its style dropdown and the generate, prompt and attach
  // buttons, shortened when the full labels do not fit.
  function imageFooter(slide, field, x0, y, w) {
    const picture = s.pictures[slide.id]?.[field],
      style = STYLE_NAMES[slide[STYLE_OF[field]]] || STYLE_NAMES.generic,
      // While an AI request works on the box, or the slide is locked, its buttons are grey and do nothing.
      working = slide.locked || busy(s, slide.id, field);
    const button = (act, label) => {
      const on =
        !working &&
        (browsing(act + ':' + field) || (act === 'style' && s.modal?.kind === 'style' && s.modal.field === field));
      // The style button's ▾ needs a measurer; the other labels are ASCII.
      return [
        span(on ? '▸' : ' ', ACCENT),
        ...actionLabel(
          { label, kind: 'keycap', state: on ? 'hover' : 'read' },
          { measure: cellCount, ...(working ? { style: { fg: 'decorative' } } : {}) },
        ),
      ];
    };
    // Labels shorten a step at a time until the row fits the border: attach, then generate, then the style.
    const row = (step) => [
      ['style', button('style', `${step > 2 ? style.slice(0, 3) : style} ▾`)],
      ['generate', button('generate', step > 1 ? 'gen' : 'generate')],
      ['prompt', button('prompt', 'prompt')],
      ['attach', [...button('attach', step > 0 ? 'attach' : 'attach PNG'), span(' ')]],
    ];
    const size = (line) => line.reduce((n, [, part]) => n + widthOf(part), 0),
      buttons = [0, 1, 2].map(row).find((line) => size(line) <= w - 3) || row(3);
    // What the picture is, in the longest form that fits beside the buttons.
    const notes = !picture
      ? []
      : picture.error
        ? [`${picture.name}: ${picture.error}`, picture.error]
        : picture.source === 'generated'
          ? [`generated by ${picture.model}`, 'generated']
          : [`attached ${picture.name}`, 'attached'];
    let bx = x0 + w - 2 - buttons.reduce((n, [, line]) => n + widthOf(line), 0);
    const room = Math.max(0, bx - x0 - 3),
      note = notes.map((n) => ` ${display(n)} `).find((n) => n.length <= room);
    if (note) put(x0 + 2, y, [span(note, picture.error ? { fg: 'warning' } : LABEL)]);
    for (const [act, line] of buttons) {
      // The style dropdown opens under its button, so the button's place is kept for it.
      if (act === 'style' && (!clip || (y >= clip.top && y < clip.bottom))) anchors[field] = { x: bx + 1, y };
      put(bx, y, line);
      hit(bx, y, widthOf(line), 1, working ? { act: 'field-busy', box: { slideId: slide.id, field } } : { act, field });
      bx += widthOf(line);
    }
  }
  // The style dropdown: a small list under its button (above it when there is no room below). A click outside it
  // closes it. Without its button on screen, the list opens as an ordinary dialog.
  function dropdown(m, at, M) {
    const names = m.options.map((o) => o.label),
      w = Math.max(...names.map((n) => n.length)) + 8,
      h = names.length + 2,
      x = Math.max(M.x, Math.min(at.x, M.x + M.w - w)),
      y = at.y + 1 + h <= M.y + M.h ? at.y + 1 : Math.max(M.y, at.y - h);
    for (let i = images.length - 1; i >= 0; i--) {
      const r = images[i].rect;
      if (r.x < x + w && x < r.x + r.width && r.y < y + h && y < r.y + r.height) images.splice(i, 1);
    }
    hit(0, 0, g.w, g.h, { act: 'modal-dismiss', modal: true });
    fill({ x, y, w, h });
    frame(x, y, w, names.length, m.title, 'focus');
    names.forEach((name, i) => {
      const on = m.index === i,
        chosen = m.current === i;
      put(x + 2, y + 1 + i, [
        span(on ? '›' : ' ', ACCENT),
        span(chosen ? '●' : '○', { fg: chosen ? 'accent' : 'decorative' }),
        span(' ' + name, on ? { fg: 'primary', bold: true } : LABEL),
      ]);
      hit(x + 1, y + 1 + i, w - 2, 1, { act: 'modal-option', index: i, modal: true });
    });
  }
  function radioItem(label, names, selected, control, w, options = {}) {
    const rows = radioRows(names, w, options.disabled, options.colW);
    return item(
      rows,
      (x0, y, width) => radios(label, names, selected, control, x0, y, width, options),
      browsing(control),
    );
  }
  // span widens a band's heading across both columns.
  const head = (title, controls, span = 0) =>
    item(1, (x0, y, width) =>
      put(
        x0,
        y,
        sectionHead({ title, mark: controls.some(browsing) ? 'accent' : 'primary' }, { width: span || width }),
      ),
    );
  const gapItem = () => item(1, () => {});
  // The slide's choices: layout, then where its picture or sentence sits, on the layout's option grid.
  function layoutCell(slide, w) {
    const colW = Math.max(...LAYOUT_NAMES.map((name) => name.length + 5));
    const placement = imageSided(slide)
      ? radioItem('IMAGE SIDE', ['Left', 'Right'], slide.imageSide === 'left' ? 0 : 1, 'placement', w, { colW })
      : slide.layout === 'image-sentence'
        ? radioItem('SENTENCE', ['Top', 'Bottom'], slide.sentencePos === 'top' ? 0 : 1, 'placement', w, { colW })
        : radioItem('PLACEMENT', [], -1, 'placement', w, { disabled: true, note: 'Not used by this layout' });
    return [radioItem('LAYOUT', LAYOUT_NAMES, LAYOUTS.indexOf(slide.layout), 'layout', w), placement];
  }
  const typeItem = (slide, w) => radioItem('TYPE', TYPES, TYPES.indexOf(slide.type), 'type', w);
  const SLIDE_CONTROLS = ['title', 'content', 'tagline', 'layout', 'placement'];

  function slideNav(x1, y, index) {
    // Right-aligned "‹  06 / 12  ›" with both arrows clickable.
    const label = ` ${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')} `;
    const start = x1 - label.length - 4;
    put(start, y, [span('‹ ', ACCENT), span(label, { fg: 'primary' }), span(' ›', ACCENT)]);
    hit(start, y, 2, 1, { act: 'nav', delta: -1 });
    hit(x1 - 2, y, 2, 1, { act: 'nav', delta: 1 });
    return start;
  }
  // Page title: where the slide sits, section › subsection; the slide's own name heads its frame. A title slide
  // leaves out the group it names, so nothing shows twice.
  function strip(x0, y, w, slide, lead = '') {
    const path = [slide.secId, slide.subId]
      .filter((id) => id && id !== slide.titleFor)
      .map((id) => display(ownerById(s, id)?.title || 'Untitled'));
    const line = [
      ...(lead ? [span(lead + '  ', ACCENT)] : []),
      ...path.flatMap((name, i) => [
        ...(i ? [span(' › ', LABEL)] : []),
        span(name, i ? { fg: 'primary' } : { fg: 'primary', bold: true }),
      ]),
    ];
    if (slide.locked) line.push(span('  ▪ SLIDE LOCKED', { fg: 'primary', bold: true }));
    const r = s.reading,
      presenting = r?.mode === 'present';
    // Presenting, what the voice is doing leads the row.
    if (presenting)
      line.unshift(
        ...(r.status === 'error'
          ? [span(`✕ VOICE FAILED: ${r.message}`, { fg: 'warning', bold: true })]
          : r.status === 'done'
            ? [span('■ END OF THE LESSON', LABEL)]
            : r.paused
              ? [span('‖ PAUSED', { fg: 'primary', bold: true })]
              : r.status === 'loading'
                ? [span('◌ PREPARING THE VOICE', LABEL)]
                : [span('▶ PRESENTING', ACCENT)]),
        span('   '),
      );
    // With the outline hidden, a button at the row's start brings it back.
    if (s.columns.outlineHidden && !g.outline) {
      const button = actionLabel({ label: 'o outline', kind: 'keycap', state: 'read' });
      put(x0, y, button);
      hit(x0, y, widthOf(button), 1, { act: 'outline-toggle' });
      x0 += widthOf(button) + 2;
      w -= widthOf(button) + 2;
    }
    // Read aloud and present, or while presenting its controls, left of the slide counter, while the row has room
    // for them and some of the path. Rightmost first.
    let bx = slideNav(x0 + w, y, slides.indexOf(slide)) - 1;
    const reading = r?.mode === 'slide',
      again = !r || r.status === 'error' || r.status === 'done';
    const buttons = presenting
      ? [
          ['s', `s ${s.speechRate}x`],
          ['V', `V ${s.voice}`],
          ['stop', 'stop'],
          ['next', 'next'],
          ['toggle', again ? 'again' : r.paused ? 'resume' : 'pause', r.paused],
          ['back', 'back'],
        ]
      : [
          ['s', `s ${s.speechRate}x`],
          ['V', `V ${s.voice}`],
          ['P', 'P present'],
          ['p', reading ? 'p stop' : 'p read', reading],
        ];
    for (const [key, label, on] of buttons) {
      const button = actionLabel({ label, kind: 'keycap', state: on ? 'hover' : 'read' });
      if (bx - widthOf(button) - 1 < x0 + 20) break;
      bx -= widthOf(button) + 1;
      put(bx, y, button);
      hit(bx, y, widthOf(button), 1, { act: 'speak', key });
    }
    put(x0, y, fitLine(line, Math.max(0, bx - x0 - 1)));
  }

  // ---------- slide canvas ----------
  function canvas(K, saved, author) {
    calm(K.x, K.y, K.w, K.h);
    const index = slides.indexOf(saved),
      live = author && s.edit && !s.edit.principle && s.edit.slideId === saved.id,
      // The preview shows the text being typed, before it is saved.
      slide = live ? { ...saved, [s.edit.field]: s.edit.text } : saved;
    block(
      K.x,
      K.y,
      numberedPanel(
        {
          number: Math.min(99, index + 1),
          // The slide's name, live while it is typed; where it sits is on the page title above.
          title: display(slideName(slide)),
        },
        [],
        { width: K.w, height: K.h },
      ),
    );
    const pad = K.h >= 14 ? 1 : 0,
      C = { x: K.x + 3, y: K.y + 1 + pad, w: K.w - 6, h: K.h - 2 - 2 * pad };
    const center = (lines, r, style) => {
      const top = r.y + Math.max(0, Math.floor((r.h - lines.length) / 2));
      lines
        .slice(0, r.h)
        .forEach((line, i) =>
          text(
            r.x + Math.max(0, Math.floor((r.w - line.length) / 2)),
            top + i,
            line,
            Math.min(r.w, line.length),
            style,
          ),
        );
      return { x: r.x, y: top, w: r.w, h: Math.min(r.h, Math.max(1, lines.length)) };
    };
    const content = (field, r, { bold = false, centered = false, bullets = false } = {}) => {
      const value = slide[field];
      if (!value) {
        if (centered) center([PLACEHOLDER[field]], r, FAINT);
        else text(r.x, r.y, PLACEHOLDER[field], r.w, FAINT);
        return 1;
      }
      let lines = [];
      if (bullets)
        for (const raw of display(value).split('\n')) {
          const item = raw.replace(/^- /, '');
          wrap(item, r.w - 2).forEach((line, i) => lines.push((i ? '  ' : raw.startsWith('- ') ? '• ' : '') + line));
        }
      else lines = wrap(value, centered ? Math.max(8, r.w - 6) : r.w);
      const style = bold ? { fg: 'primary', bold: true } : { fg: 'primary' };
      if (centered) {
        center(lines, r, style);
        return lines.length;
      }
      lines.slice(0, r.h).forEach((line, i) => text(r.x, r.y + i, line, r.w, style));
      return Math.min(r.h, lines.length);
    };
    const imageBox = (field, area) => {
      const picture = s.pictures[slide.id]?.[field],
        image = picture?.bytes ? picture : null,
        attached = picture;
      const conceptText = picture?.error
        ? `${picture.name}: ${picture.error}`
        : slide[field] || (picture ? `Picture ${picture.name}` : 'Describe what this image teaches');
      if (area.w < 8 || area.h < 3) {
        // Too small for a frame: one row with the label and as much of the concept as fits.
        const label = imageLabel({ label: 'IMAGE', missing: !image }, { maxWidth: area.w });
        put(area.x, area.y, [
          ...label,
          ...fitText(' ' + display(conceptText), Math.max(0, area.w - widthOf(label)), { style: LABEL }),
        ]);
        return;
      }
      const inner = { x: area.x + 1, y: area.y + 1, width: area.w - 2, height: area.h - 2 };
      const inset = (r) =>
        block(
          r.x - 1,
          r.y - 1,
          imageInset({ x: 1, y: 1, width: r.width, height: r.height }, { width: r.width + 2, height: r.height + 2 }),
          {
            transparent: true,
          },
        );
      const note = () => {
        if (attached && !slide[field])
          text(area.x + 2, area.y + area.h - 1, 'No image concept - describe what it teaches', area.w - 4, {
            fg: 'warning',
          });
      };
      const hole = image ? aspectPlacement(inner, image.width, image.height) : inner;
      // A picture is the one clickable part of the preview: a click shows it large.
      if (image) hit(area.x, area.y, area.w, area.h, { act: 'picture-view', slideId: slide.id, field });
      if (graphics && image && hole.width >= 12 && hole.height >= 3) {
        inset(hole);
        paper(hole);
        images.push({
          key: `${slide.id}:${field}:${image.file}:${s.view}:${slide.layout}:${slide.imageSide}:${slide.sentencePos}`,
          bytes: image.bytes,
          width: image.width,
          height: image.height,
          rect: hole,
        });
        note();
        return;
      }
      // Text mode uses the whole area: a label, then as much of the concept as fits.
      inset(inner);
      put(inner.x, inner.y, imageLabel({ label: 'IMAGE', missing: !image }, { maxWidth: inner.width }));
      wrap(conceptText, inner.width)
        .slice(0, Math.max(0, inner.height - 1))
        .forEach((line, i) =>
          text(inner.x, inner.y + 1 + i, line, inner.width, { fg: slide[field] ? 'secondary' : 'decorative' }),
        );
      note();
    };

    const half = Math.floor((C.w - 3) / 2),
      right = C.x + half + 3;
    if (slide.layout === 'title') {
      const kicker = slide.titleFor ? (ownerById(s, slide.titleFor)?.subs ? 'SECTION' : 'SUBSECTION') : '';
      const lines = wrap(slide.title || PLACEHOLDER.title, Math.max(8, C.w - 8));
      const top = C.y + Math.max(0, Math.floor((C.h - lines.length - (kicker ? 2 : 0)) / 2));
      if (kicker) center([kicker], { ...C, y: top, h: 1 }, { fg: 'accent', bold: true });
      content(
        'title',
        { ...C, y: top + (kicker ? 2 : 0), h: Math.max(1, C.h - (top - C.y) - (kicker ? 2 : 0)) },
        {
          bold: true,
          centered: true,
        },
      );
    } else if (slide.layout === 'title-image') {
      // Title, a short rule, subtitle and tag line down one half, centred as a block; the picture takes the other.
      const tx = slide.imageSide === 'left' ? right : C.x,
        ix = slide.imageSide === 'left' ? C.x : right,
        part = (field, most) => wrap(slide[field] || PLACEHOLDER[field], half).slice(0, most),
        title = part('title', 4),
        sub = part('content', 4),
        tag = part('tagline', 2),
        bottom = C.y + C.h;
      let y = C.y + Math.max(0, Math.floor((C.h - title.length - sub.length - tag.length - 3) / 2));
      const lines = (rows, field, style) => {
        for (const row of rows) if (y < bottom) text(tx, y++, row, half, slide[field] ? style : FAINT);
      };
      lines(title, 'title', { fg: 'primary', bold: true });
      if (y < bottom) text(tx, y, '━'.repeat(Math.min(6, half)), half, { fg: 'accent' });
      y += 2;
      lines(sub, 'content', { fg: 'primary' });
      y += 1;
      lines(tag, 'tagline', { fg: 'secondary', bold: true });
      imageBox('imageDesc', { x: ix, y: C.y, w: half, h: C.h });
    } else if (slide.layout === 'statement') {
      content('content', C, { bold: true, centered: true });
    } else if (slide.layout === 'points-image') {
      const tx = slide.imageSide === 'left' ? right : C.x,
        ix = slide.imageSide === 'left' ? C.x : right;
      const used = content('title', { x: tx, y: C.y, w: half, h: Math.min(2, C.h) }, { bold: true });
      content('content', { x: tx, y: C.y + used + 1, w: half, h: Math.max(1, C.h - used - 1) }, { bullets: true });
      imageBox('imageDesc', { x: ix, y: C.y, w: half, h: C.h });
    } else if (slide.layout === 'image-sentence') {
      const lines = Math.min(2, wrap(slide.content || 'x', C.w - 6).length),
        top = slide.sentencePos === 'top';
      const sentence = { x: C.x, y: top ? C.y : C.y + C.h - lines, w: C.w, h: lines };
      content('content', sentence, { bold: true, centered: true });
      imageBox('imageDesc', { x: C.x, y: top ? C.y + lines + 1 : C.y, w: C.w, h: Math.max(1, C.h - lines - 1) });
    } else {
      const needed = Math.max(1, ...['beforeCap', 'afterCap'].map((f) => wrap(slide[f] || 'x', half).length));
      const capRows = Math.min(needed, C.h >= 12 ? 3 : C.h >= 8 ? 2 : 1);
      for (const [field, cap, label, x0] of [
        ['imageDesc', 'beforeCap', 'BEFORE', C.x],
        ['afterDesc', 'afterCap', 'AFTER', right],
      ]) {
        text(x0, C.y, label, half, { fg: 'secondary', bold: true });
        imageBox(field, { x: x0, y: C.y + 1, w: half, h: Math.max(1, C.h - capRows - 2) });
        content(cap, { x: x0, y: C.y + C.h - capRows, w: half, h: capRows });
      }
    }
  }

  // ---------- views ----------
  // With the outline hidden the slide and form may be wider, so the slide can be bigger.
  function contentBox(M) {
    const cw = Math.min(M.w - 4, s.columns.outlineHidden && !g.outline ? 170 : 120);
    return { cx: M.x + 2 + Math.floor((M.w - 4 - cw) / 2), cw };
  }
  // The slide stays put at the top; the form under it scrolls on its own when it does not fit.
  function buildView(M) {
    const { cx, cw } = contentBox(M),
      two = cw >= 84,
      gap = 3,
      lw = two ? Math.floor((cw - gap) / 2) : cw,
      rw = two ? cw - gap - lw : cw;
    strip(cx, M.y, cw, x);
    // A grid of fixed bands. Each row pairs a left and a right cell with one top edge; paired boxes share a height
    // and the shorter cell is padded, so every box keeps its place whatever the layout. One blank row between rows.
    // A pair's height: the one the user chose, or the taller default when the pair sits side by side.
    const rowsOf = (a, b = a) =>
        s.boxRows[pairOf(a)] ?? (two ? Math.max(BOX_ROWS[a] ?? NOTES_ROWS, BOX_ROWS[b] ?? NOTES_ROWS) : undefined),
      imageControls = [
        ...['imageDesc', 'beforeCap', 'afterDesc', 'afterCap'],
        ...['style', 'generate', 'attach', 'prompt'].flatMap((a) => [a + ':imageDesc', a + ':afterDesc']),
      ];
    const bands = [
      // Speaker notes first, right under the slide: the box's own label names it, so the band has no heading.
      { heads: [], rows: [[[slideBox(x, 'notes', s.boxRows.notes ?? NOTES_ROWS)]]] },
      // Then your review comments, for the agent to work through later.
      { heads: [], rows: [[[slideBox(x, 'comments', s.boxRows.comments ?? COMMENT_ROWS)]]] },
      {
        heads: [head('SLIDE', SLIDE_CONTROLS), head('TEACHING PLAN', ['type', 'purpose'])],
        rows: [
          [layoutCell(x, lw), [typeItem(x, rw)]],
          // The name across both columns, then the slide's text beside why the slide is there.
          [[slideBox(x, 'title', rowsOf('title'))]],
          [
            [slideBox(x, 'content', rowsOf('content', 'purpose'))],
            [slideBox(x, 'purpose', rowsOf('content', 'purpose'))],
          ],
          // One line under the pair, across both columns: only Title + image uses it.
          [[slideBox(x, 'tagline', rowsOf('tagline'))]],
        ],
      },
      {
        heads: [head('IMAGES', imageControls, two ? cw : 0)],
        rows: [
          [
            [slideBox(x, 'imageDesc', rowsOf('imageDesc', 'afterDesc'))],
            [slideBox(x, 'afterDesc', rowsOf('imageDesc', 'afterDesc'))],
          ],
          [
            [slideBox(x, 'beforeCap', rowsOf('beforeCap', 'afterCap'))],
            [slideBox(x, 'afterCap', rowsOf('beforeCap', 'afterCap'))],
          ],
        ],
      },
    ];
    const placed = [];
    let y = 0;
    const place = (items, px, pw, py) => {
      for (const it of items) {
        placed.push({ ...it, x: px, w: pw, y: py });
        py += it.h;
      }
      return py;
    };
    const rx = cx + lw + gap;
    for (const band of bands) {
      if (two) {
        if (band.heads.length) {
          place([band.heads[0]], cx, band.heads[1] ? lw : cw, y);
          if (band.heads[1]) place([band.heads[1]], rx, rw, y);
          y += 1;
        }
        for (const [left, right] of band.rows)
          y = (right ? Math.max(place(left, cx, lw, y), place(right, rx, rw, y)) : place(left, cx, cw, y)) + 1;
      } else
        for (const side of [0, 1]) {
          const cells = band.rows.map((row) => row[side]).filter(Boolean);
          if (!cells.length) continue;
          if (band.heads[side]) y = place([band.heads[side]], cx, cw, y);
          for (const cell of cells) y = place(cell, cx, cw, y) + 1;
        }
    }
    const total = y - 1,
      avail = M.h - 3,
      // The slide's height: 26 rows at most, or with the outline hidden about 16:9 at its width, up to 55% of the
      // height; more when the form is short.
      tall = s.columns.outlineHidden && !g.outline ? Math.round(cw * 0.28) : 26,
      ch = Math.max(
        Math.min(tall, Math.max(8, Math.floor(avail * (tall > 26 ? 0.55 : 0.4)))),
        Math.min(tall, avail - total),
      );
    canvas({ x: cx, y: M.y + 2, w: cw, h: ch }, x, true);
    const top = M.y + 3 + ch,
      visible = Math.max(1, M.y + M.h - top),
      most = Math.max(0, total - visible),
      focus = placed.find((p) => p.focus);
    let offset = Math.min(most, Math.max(0, s.formScroll || 0));
    if (s.formFollow && focus) {
      if (focus.y < offset) offset = focus.y;
      else if (focus.y + focus.h > offset + visible) offset = Math.min(most, focus.y + focus.h - visible);
    }
    g.formOffset = offset;
    g.formMost = most;
    clip = { top, bottom: top + visible };
    for (const p of placed) if (p.y + p.h > offset && p.y < offset + visible) p.draw(p.x, top + p.y - offset, p.w);
    clip = null;
    if (total > visible) block(cx + cw + 1, top, scrollRail({ total, visible, offset }));
    hit(cx, top, cw + 2, visible, { scroll: 'form' });
    // The form is for reading and choosing: no texture between its options; the page title row likewise.
    calm(cx - 1, top, cw + 3, visible);
    calm(cx, M.y, cw, 1);
  }
  function previewView(M) {
    const { cx, cw } = contentBox(M);
    strip(cx, M.y, cw, x, 'LEARNER PREVIEW');
    const h = Math.min(M.h - 3, 30);
    canvas({ x: cx, y: M.y + 2, w: cw, h }, x, false);
    text(cx, M.y + 2 + h, 'Notes, plan and author marks stay out of the learner view.', cw, FAINT);
  }
  // One part of the lesson plan, chosen by its top-bar tab: its name, then one box across the page.
  function planView(M) {
    const { cx, cw } = contentBox(M),
      field = PLAN_FIELDS[s.planIndex],
      rows = Math.max(1, Math.min(24, M.h - 5));
    put(
      cx,
      M.y,
      fitLine(
        [
          span(PLAN_NAMES[s.planIndex], { fg: 'primary', bold: true }),
          span('   Lesson plan: every slide follows it. The chat never changes it; leaving the box saves it.', LABEL),
        ],
        cw,
      ),
    );
    formBox({ principle: true, field }, PLAN_NAMES[s.planIndex].toUpperCase(), cx, M.y + 2, cw, rows, {
      placeholder: 'Write this part of the plan',
    });
  }

  // ---------- outline ----------
  // Rows as the spec lists them: tagged SECTION and SUB heads, each title slide on its own row, a rail
  // down a subsection, a grip on slides that can be dragged, and bracketed add buttons closing each group.
  function outlinePanel(R, focused) {
    put(
      R.x,
      R.y,
      sectionHead(
        { title: 'OUTLINE', count: String(count).padStart(2, '0'), mark: focused ? 'accent' : 'primary' },
        { width: R.w },
      ),
    );
    // In the column, a button hides it so the slide and form take its width.
    if (g.outline && R === g.outline) {
      const button = actionLabel({ label: 'o hide', kind: 'keycap', state: 'read' });
      put(R.x + R.w - widthOf(button) - 1, R.y, button);
      hit(R.x + R.w - widthOf(button) - 1, R.y, widthOf(button), 1, { act: 'outline-toggle' });
    }
    const rows = outlineRows(s),
      // Rows, then a blank row of breathing room, ADD TO, the add buttons and two rows of outline keys at the foot.
      body = R.h - 7,
      offset = Math.max(0, Math.min(s.outlineScroll, Math.max(0, rows.length - body))),
      inner = R.w - 1;
    g.outlineRows = body;
    rows.slice(offset, offset + body).forEach((row, i) => {
      const index = offset + i,
        y = R.y + 2 + i,
        slide = rowSlide(s, row),
        current = slide?.id === s.selected,
        dragged = s.drag?.id === row.id,
        dropping = s.drag && s.drag.over === index && s.drag.over !== s.drag.from,
        cursorRow = focused && s.outlineCursor === index,
        bg = cursorRow || dropping ? 'surface' : 'field',
        tint = (st) => ({ ...st, bg }),
        line = [
          span(current ? '▌' : ' ', tint({ fg: 'accent' })),
          span(dropping ? '▸' : cursorRow ? '›' : ' ', tint(ACCENT)),
        ];
      const rail = row.inSub && row.kind !== 'subsection' ? [span('  '), span('│', tint({ fg: 'structural' }))] : [];
      const indent = (n) => span(' '.repeat(n), tint({}));
      const tail = (spans, room) => fitLine(spans, Math.max(0, room), { bg });
      if (row.kind === 'section' || row.kind === 'subsection') {
        // The row is the group's title slide: its number, current mark and working mark are the slide's.
        // A locked title slide puts ▪ before its tag.
        const tag = (slide?.locked ? '▪ ' : '') + (row.kind === 'section' ? 'SECTION' : 'SUB'),
          caret = s.collapsed.includes(row.id) ? '▸' : '▾',
          ink = LEVEL[row.kind],
          number = slide ? String(slides.indexOf(slide) + 1).padStart(2, ' ') + ' ' : '',
          lead = [
            ...line,
            indent(row.kind === 'section' ? 0 : 2),
            span(caret + ' ', tint(FAINT)),
            span(number, tint(current ? ACCENT : FAINT)),
          ];
        const room = inner - widthOf(lead) - tag.length - 2;
        put(R.x, y, [
          ...lead,
          ...tail(
            fitText(display(row.title), room, { style: tint({ fg: dragged ? 'accent' : ink, bold: true }) }),
            room,
          ),
          span(' ' + tag, tint(FAINT)),
          span(slide && busy(s, slide.id) ? '▒' : ' ', tint({ fg: 'warning' })),
        ]);
        hit(R.x + widthOf(lead) - widthOf([lead.at(-1)]) - 2, y, 2, 1, { act: 'fold', index });
      } else {
        const working = busy(s, slide.id),
          number = String(slides.indexOf(slide) + 1).padStart(2, ' '),
          lead = [
            ...line,
            ...(row.inSub ? rail : []),
            indent(row.inSub ? 1 : 2),
            span(number + ' ', tint(current ? ACCENT : FAINT)),
            // A locked slide shows ▪ in place of its drag handle: it does not move.
            slide.locked ? span('▪ ', tint({ fg: 'primary' })) : span('≡ ', tint(dragged ? ACCENT : FAINT)),
          ];
        const style = dragged ? { fg: 'accent', bold: true } : current ? { fg: 'primary', bold: true } : LABEL;
        const room = inner - widthOf(lead) - 1;
        put(R.x, y, [
          ...lead,
          ...tail(fitText(display(slideName(slide)), room, { style: tint(style) }), room),
          span(working ? '▒' : ' ', tint({ fg: 'warning' })),
        ]);
      }
      hit(R.x, y, inner, 1, { act: 'outline-row', index });
      calm(R.x, y, inner, 1);
    });
    const rail = scrollRail({ total: rows.length, visible: Math.max(1, body), offset });
    block(R.x + R.w - 1, R.y + 2, rail);
    hit(R.x, R.y + 2, R.w, body, { scroll: 'outline' });
    // One set of add buttons, kept away from the rows so a click between slides never adds one.
    const parents = addParents(s),
      cur = slideById(s, s.selected),
      level = cur?.subId ? 'subsection' : 'section';
    calm(R.x, R.y + R.h - 4, R.w, 4);
    put(R.x, R.y + R.h - 4, [
      span('ADD TO ', LABEL),
      ...fitText(display(parents.name || 'the lesson'), inner - 7, { style: { fg: LEVEL[level], bold: true } }),
    ]);
    let bx = R.x;
    for (const [kind, parent] of [
      ['slide', parents.slide],
      ['subsection', parents.subsection],
      ['section', null],
    ]) {
      const button = actionLabel({ label: '+ ' + kind, kind: 'keycap', state: 'read' });
      if (bx + widthOf(button) > R.x + inner) break;
      put(bx, R.y + R.h - 3, button);
      hit(bx, R.y + R.h - 3, widthOf(button), 1, { act: 'add', parent, kind });
      bx += widthOf(button) + 1;
    }
    // `n` stays a key; the [+ …] rows are its buttons. The lock buttons name what they will do to the current slide
    // and its group.
    const group = cur ? cur.subId || cur.secId : null,
      groupLocked = group && groupContents(s, group).every((x) => x.locked);
    for (const [row, keys] of [
      [
        R.h - 2,
        [
          ['r', 'rename'],
          ['m', 'move'],
          ['u', 'undo'],
          ['d', 'delete'],
        ],
      ],
      [
        R.h - 1,
        [
          ['l', cur?.locked ? 'unlock' : 'lock'],
          ['L', groupLocked ? 'unlock all' : 'lock all'],
          ['g', 'pictures'],
        ],
      ],
    ]) {
      let ax = R.x;
      for (const [key, label] of keys) {
        const button = actionLabel({ label: `${key} ${label}`, kind: 'keycap', state: 'read' });
        put(ax, R.y + row, button);
        hit(ax, R.y + row, widthOf(button), 1, { act: 'outline-key', key });
        ax += widthOf(button) + 1;
      }
    }
  }

  // ---------- chat ----------
  function chatPanel(C) {
    const focused = s.pane === 'chat' && !s.modal,
      aim = chatAim(s),
      t = aim && slideById(s, aim.slideId),
      // The button switches between this slide and the whole lesson; outside Slides there is no slide to aim at.
      toggle = s.view === 'workspace' && slideById(s, s.selected);
    let y = C.y;
    put(C.x, y, sectionHead({ title: 'LESSON CHAT', mark: focused ? 'accent' : 'primary' }, { width: C.w }));
    const clearFocus = focused && s.chatMode === 'clear';
    const clearButton = [
      span(clearFocus ? '▸ ' : '  ', ACCENT),
      ...actionLabel({
        label: s.wholeLesson ? 'this slide' : 'whole lesson',
        kind: 'keycap',
        state: clearFocus ? 'hover' : 'read',
      }),
    ];
    const aimed = !t
      ? [span('● ', LABEL), span('Whole lesson', { fg: 'primary', bold: true })]
      : aim.field
        ? [span('◆ ', ACCENT), span(display(fieldName(t, aim.field)), { fg: 'primary', bold: true })]
        : [span('▣ ', ACCENT), span('Whole slide', { fg: 'primary', bold: true })];
    const where = t
      ? `Slide ${slides.indexOf(t) + 1} · ${slideName(t)}`
      : toggle
        ? 'May change anything in the lesson'
        : 'Open Slides to aim at a slide';
    // The chat is for reading: the texture stays out of it.
    calm(C.x, C.y + 1, C.w, C.h - 1);
    if (C.docked) {
      const head = [span('AIMED AT ', LABEL), ...aimed, span('  ' + display(where), t ? LABEL : FAINT)];
      put(C.x + 14, y, fitLine(head, C.w - 14 - (toggle ? widthOf(clearButton) : 0)));
      if (toggle) {
        put(C.x + C.w - widthOf(clearButton), y, clearButton);
        hit(C.x + C.w - widthOf(clearButton), y, widthOf(clearButton), 1, { act: 'clear-target' });
      }
      y += 1;
    } else {
      y += 2;
      text(C.x, y, 'AIMED AT', 10, LABEL);
      put(C.x + 10, y, fitLine(aimed, C.w - 10 - (toggle ? widthOf(clearButton) : 0)));
      if (toggle) {
        put(C.x + C.w - widthOf(clearButton), y, clearButton);
        hit(C.x + C.w - widthOf(clearButton), y, widthOf(clearButton), 1, { act: 'clear-target' });
      }
      text(C.x + 10, y + 1, where, C.w - 10, t ? LABEL : FAINT);
      y += 3;
    }
    // The message box grows upward with the draft, taking rows from the transcript, which keeps at least two.
    const statusY = C.y + C.h - 1,
      bodyRows = Math.max(
        C.docked ? 1 : 2,
        Math.min(wrapRows(s.chatDraft, Math.max(1, C.w - 4)).length, 10, statusY - y - 6),
      ),
      composerY = statusY - (bodyRows + 4),
      tH = Math.max(0, composerY - y);
    g.transcriptRows = Math.max(1, tH);
    g.chatWidth = C.w - 1;
    // Transcript
    let rows = chatRows(s, C.w - 1);
    if (!rows.length)
      rows = [
        'In a box, the chat rewrites that box; elsewhere it changes the whole slide. ' +
          '[whole lesson] lets it change anything.',
        s.ai.status === 'ready'
          ? `Requests run on ${s.ai.model} through Pi.`
          : s.ai.status === 'error'
            ? `AI unavailable: ${s.ai.message}`
            : s.ai.status === 'connecting'
              ? 'Connecting to Pi…'
              : 'Pi is not connected, so the chat cannot send.',
      ].flatMap((line) => wrap(line, C.w - 2).map((part) => [span(part, FAINT)]));
    const offset =
      s.chatAnchor === null || s.chatAnchor === undefined
        ? Math.max(0, rows.length - tH)
        : Math.min(s.chatAnchor, Math.max(0, rows.length - tH));
    if (tH > 0) {
      rows.slice(offset, offset + tH).forEach((line, i) => put(C.x, y + i, fitLine(line, C.w - 1)));
      if (rows.length > tH) block(C.x + C.w - 1, y, scrollRail({ total: rows.length, visible: tH, offset }));
      if (focused && s.chatMode === 'transcript') put(C.x, y, [span('›', ACCENT)]);
      if (s.chatNew && s.chatAnchor !== null && s.chatAnchor !== undefined)
        text(C.x, y + tH - 1, `↓ ${s.chatNew} new - End for latest`, C.w - 1, { fg: 'warning', bold: true });
      hit(C.x, y, C.w, tH, { act: 'transcript', scroll: 'chat' });
    }
    // Composer
    const typing = focused && s.chatMode === 'composer';
    frame(C.x, composerY + 1, C.w, bodyRows, 'MESSAGE', typing ? 'focus' : 'idle');
    // Wrapped like the form boxes, so new lines show; the window follows the caret.
    const cols = Math.max(1, C.w - 4),
      draftRows = wrapRows(s.chatDraft, cols),
      caret = caretPos(s.chatDraft, cols, s.chatCursor),
      first = Math.max(0, caret.row - bodyRows + 1);
    if (!s.chatDraft && !typing) text(C.x + 2, composerY + 2, 'Ask for a change...  Ctrl-G', cols, FAINT);
    for (let r = 0; r < bodyRows; r++) {
      const row = draftRows[first + r];
      if (row?.text) text(C.x + 2, composerY + 2 + r, row.text, cols);
    }
    if (typing) {
      marked(s.chatDraft, cols, s.chatMark, s.chatCursor, C.x + 2, composerY + 2, first, bodyRows);
      cursor = { x: C.x + 2 + Math.min(caret.col, cols - 1), y: composerY + 2 + caret.row - first };
    }
    hit(C.x, composerY, C.w, bodyRows + 4, {
      act: 'composer',
      text: { x: C.x + 2, y: composerY + 2, w: cols, rows: bodyRows, offset: first },
    });
    // Status: running requests, then the model they use
    const jobs = s.jobs.filter((j) => ['working', 'queued'].includes(j.status)),
      working = jobs.filter((j) => j.status === 'working').length;
    const modelFocus = focused && s.chatMode === 'models',
      // The model's id without its provider; the model list shows both.
      modelName =
        { ready: s.ai.model?.replace(/^[^/]*\//, ''), error: 'AI unavailable', connecting: 'connecting...' }[
          s.ai.status
        ] || 'Pi not connected',
      effortFocus = focused && s.chatMode === 'effort',
      button = [
        span(modelFocus ? '▸' : ' ', ACCENT),
        ...actionLabel({ label: display(modelName), kind: 'keycap', state: modelFocus ? 'hover' : 'read' }),
      ],
      effort = [
        span(effortFocus ? '▸' : ' ', ACCENT),
        ...actionLabel({ label: s.ai.effort, kind: 'keycap', state: effortFocus ? 'hover' : 'read' }),
      ],
      bw = Math.min(widthOf(button), Math.max(0, C.w - 12)),
      // The effort button stands left of the model's while the row has room for both and a short status.
      ew = C.w - bw - widthOf(effort) >= 12 ? widthOf(effort) : 0,
      room = Math.max(0, C.w - bw - ew - 1),
      // How much of its model's context window the last request filled; nothing compacts, each request starts fresh.
      ctx = s.ai.context ? `ctx ${Math.round(s.ai.context.percent)}%` : '',
      status = jobs.length
        ? [span(`▒ ${working} working · ${jobs.length - working} queued`, { fg: 'warning', bold: true })]
        : [span(room >= 22 + ctx.length + 3 ? '· no requests running' : '· idle', FAINT)];
    if (ctx && room >= widthOf(status) + ctx.length + 3)
      status.push(span(' · ', FAINT), span(ctx, s.ai.context.percent >= 80 ? { fg: 'primary', bold: true } : FAINT));
    put(C.x, statusY, fitLine(status, room));
    if (ew) {
      put(C.x + C.w - bw - ew, statusY, effort);
      hit(C.x + C.w - bw - ew, statusY, ew, 1, { act: 'effort' });
    }
    put(C.x + C.w - bw, statusY, fitLine(button, bw));
    hit(C.x + C.w - bw, statusY, bw, 1, { act: 'model' });
  }

  // ---------- header and footer ----------
  // Whether the lesson file has every change: saved, not saved (the schema refused it) or read-only.
  function fileStatus(roomy) {
    const f = s.file,
      name = roomy ? [span(' ' + display(f.name), { ...FAINT, bg: 'surface' })] : [],
      problems = `${f.errors.length} problem${f.errors.length === 1 ? '' : 's'}`;
    if (f.readOnly) return [...labelPlate(`READ ONLY: ${problems}`, { tone: 'warning', form: 'slab' }), ...name];
    if (f.status === 'invalid' || f.status === 'error')
      return [...labelPlate(`NOT SAVED: ${problems}`, { tone: 'critical', form: 'slab' }), ...name];
    if (!f.path) return [...labelPlate('NO FILE', { tone: 'neutral', form: 'slab' })];
    return [...labelPlate('SAVED', { tone: 'neutral', form: 'slab' }), ...name];
  }
  function header() {
    fill({ x: 0, y: 0, w: g.w, h: 1 }, 'surface');
    const viewFocus = browsing('view'),
      surface = (value, style = LABEL) => span(value, { ...style, bg: 'surface' }),
      focusable = (id, label) => (browsing(id) ? [surface('▸ ', ACCENT), surface(label, ACCENT)] : [surface(label)]);
    // A read-only file is in review for good; its file plate says so, so the review switch is not shown twice.
    const rightItems = (roomy) => [
      ...(s.file.readOnly
        ? []
        : [
            [
              'review',
              s.review
                ? [
                    surface('● ', { fg: 'warning', bold: true }),
                    ...labelPlate('REVIEW ONLY', { tone: 'warning', form: 'slab' }),
                  ]
                : focusable('review', roomy ? '○ Review only' : '○ Review'),
            ],
          ]),
      ...(roomy ? [['images', [surface(`▣ ${graphics ? 'Kitty' : 'Text'} images`, FAINT)]]] : []),
      ['help', [surface(roomy ? '? Help' : '?')]],
      ['file', fileStatus(roomy)],
    ];
    const rightWidth = (roomy) => rightItems(roomy).reduce((n, [, line]) => n + widthOf(line) + 3, 0) - 2;
    const brand = labelPlate('LESSON MAKER', { tone: 'accent', form: 'slab' });
    // The widest form that fits: brand and full names, then shorter names, then no brand, then numbered plan tabs.
    const current = tabIndex(s),
      label = (names, i) =>
        names ? `${i + 1} ${names[i]}` : i === current ? `${i + 1} ${TAB_NAMES[1][i]}` : `${i + 1}`;
    const forms = [
      { brand: true, names: TAB_NAMES[0], roomy: true },
      { brand: true, names: TAB_NAMES[0], roomy: false },
      { brand: true, names: TAB_NAMES[1], roomy: false },
      { brand: false, names: TAB_NAMES[1], roomy: false },
      { brand: true, names: null, roomy: false },
      { brand: false, names: null, roomy: false },
    ];
    const tabsWidth = (f) =>
      (f.brand ? widthOf(brand) + 2 : 0) + TABS.reduce((n, tab, i) => n + label(f.names, i).length + 2, 0);
    const form = forms.find((f) => 1 + tabsWidth(f) + 2 + rightWidth(f.roomy) <= g.w) || forms.at(-1);
    let hx = 1;
    if (form.brand) hx = put(1, 0, brand) + 2;
    if (viewFocus) put(hx - 1, 0, [span('▸', { ...ACCENT, bg: 'surface' })]);
    TABS.forEach((tab, i) => {
      const name = label(form.names, i),
        line =
          i === current
            ? labelPlate(name, { tone: viewFocus ? 'accent' : 'bright', form: 'slab' })
            : [span(` ${name} `, { fg: 'secondary', bg: 'surface' })];
      hit(hx, 0, widthOf(line), 1, { act: 'view', tab: i, view: tab.view });
      hx = put(hx, 0, line);
    });
    const items = rightItems(form.roomy);
    const total = items.reduce((n, [, line]) => n + widthOf(line) + 3, 0) - 2;
    let rx = Math.max(hx + 2, g.w - total);
    for (const [id, line] of items) {
      hit(rx, 0, widthOf(line), 1, { act: id });
      rx = put(rx, 0, line) + 3;
    }
  }
  function hints() {
    if (s.modal?.kind === 'picture')
      return [
        ['Esc', 'close'],
        ['click', 'close'],
      ];
    if (s.modal?.kind === 'prompt')
      return [
        ['Enter', 'close'],
        ['Esc', 'close'],
      ];
    if (s.modal)
      return [
        ['Enter', 'choose'],
        ['Esc', 'cancel'],
        ['click', 'option'],
      ];
    const box = focusedBox(s);
    if (box)
      return editLocked(s, box)
        ? [
            ['Tab', 'next box'],
            ['Esc', 'leave box'],
            ['Ctrl-G', 'chat'],
          ]
        : [
            ['Tab', 'save, next box'],
            ['Esc', 'save, leave box'],
            ['Enter', 'new line'],
            ['Ctrl-G', 'chat'],
          ];
    if (s.pane === 'chat')
      return s.chatMode === 'composer'
        ? [
            ['Enter', 'send'],
            ['Tab', 'transcript, model'],
            ['Ctrl-G', 'back'],
            ['Esc', 'back'],
          ]
        : [
            ['Tab', 'next'],
            ['Enter', 'choose'],
            ['PgUp/Dn', 'scroll'],
            ['Ctrl-G', 'back'],
          ];
    if (s.pane === 'outline')
      return [
        ['Up/Dn', 'move'],
        ['Enter', 'open'],
        ['Left/Right', 'fold'],
        ['n r m u', 'new rename move undo'],
        ['l L', 'lock'],
        ['Esc', 'back'],
      ];
    if (s.view === 'plan')
      return [
        ['Up/Dn', 'choose'],
        ['Tab', 'boxes'],
        ['v', 'view'],
        ['Ctrl-G', 'chat'],
      ];
    if (s.view === 'preview')
      return [
        ['[ ]', 'slide'],
        ['v', 'view'],
        ['Ctrl-G', 'chat'],
        ['?', 'help'],
        ['q', 'quit'],
      ];
    return [
      ['Tab', 'next box'],
      ['Ctrl-G', 'chat'],
      ['[ ]', 'slide'],
      ['Ctrl-O', 'outline'],
      ['v', 'view'],
      ['?', 'help'],
      ['q', 'quit'],
    ];
  }
  function footer() {
    const y = g.h - 1,
      mode = inputMode(s),
      tone = /^(TYPE|EDIT)/.test(mode) ? 'accent' : /^(WAIT|READ)/.test(mode) ? 'warning' : 'neutral';
    const fx = put(0, y, labelPlate(mode, { tone, form: 'slab' }));
    const notice = display(s.notice || ''),
      nw = Math.min(notice.length, Math.floor(g.w * 0.42));
    put(
      fx,
      y,
      keyHints(
        hints().map(([key, label]) => ({ key, label })),
        { width: Math.max(1, g.w - fx - nw - 2) },
      ),
    );
    text(g.w - nw - 1, y, notice, nw, LABEL);
  }

  // ---------- overlays ----------
  // One picture over the whole window, as large as its shape allows; any click or Esc closes it.
  function pictureView(m) {
    images.length = 0;
    cursor = null;
    const slide = slideById(s, m.slideId),
      picture = s.pictures[m.slideId]?.[m.field],
      B = { x: 0, y: 0, w: g.w, h: g.h };
    fill(B);
    calm(B.x, B.y, B.w, B.h);
    const title = `${slide ? slideName(slide) : ''}${m.field === 'afterDesc' ? ' - after' : ''}`;
    put(0, 0, popupHeader({ plate: 'PICTURE', title: display(title) }, { width: g.w }));
    hit(0, 0, g.w, g.h, { act: 'modal-dismiss', modal: true });
    // The app's footer stays on the last row and says how to close the view.
    const area = { x: 1, y: 2, width: Math.max(1, g.w - 2), height: Math.max(1, g.h - 3) };
    if (!picture?.bytes) {
      text(2, 2, 'The picture is gone.', g.w - 4, LABEL);
      return;
    }
    if (!graphics) {
      text(2, 2, 'This terminal shows no pictures here; open the file instead:', g.w - 4, LABEL);
      text(2, 3, picture.file, g.w - 4);
      return;
    }
    const rect = aspectPlacement(area, picture.width, picture.height);
    paper(rect);
    const { bytes, width, height } = picture;
    images.push({ key: `view:${m.slideId}:${m.field}:${picture.file}`, bytes, width, height, rect });
  }
  function modal(M) {
    if (s.modal.kind === 'picture') return pictureView(s.modal);
    if (s.modal.kind === 'style' && anchors[s.modal.field]) return dropdown(s.modal, anchors[s.modal.field], M);
    images.length = 0;
    cursor = null;
    const m = s.modal,
      help = m.kind === 'help' || m.kind === 'history',
      w = Math.min(M.w - 4, help ? 96 : 72),
      bodyW = w - 4;
    const keyW = 24;
    const body = (m.lines || []).flatMap((line) => {
      if ((m.kind === 'help' || m.kind === 'prompt') && line.startsWith('# '))
        return ['', [span(line.slice(2).toUpperCase(), { fg: 'primary', bold: true })]];
      if (m.kind === 'help' && line.includes('\t')) {
        const [keys, what] = line.split('\t');
        return wrap(what, bodyW - keyW).map((part, i) => [
          ...fitLine([span(i ? '' : keys, { fg: 'accent' })], keyW),
          span(part, LABEL),
        ]);
      }
      return line ? wrap(line, bodyW) : [''];
    });
    // Long option lists (the models) show a window around the chosen one.
    const optionRows = Math.min(m.options?.length || 0, Math.max(3, M.h - 14)),
      optionTop = Math.max(
        0,
        Math.min((m.index || 0) - Math.floor(optionRows / 2), (m.options?.length || 0) - optionRows),
      );
    const inputRows = m.input !== undefined ? 6 : 0,
      want = 2 + body.length + (optionRows ? optionRows + 1 : 0) + inputRows + 2,
      h = Math.min(M.h - 2, help ? M.h - 2 : Math.max(8, want)),
      B = { x: M.x + Math.floor((M.w - w) / 2), y: M.y + 1, w, h };
    fill(M);
    calm(M.x, M.y, M.w, M.h);
    put(
      B.x,
      B.y,
      popupHeader({ plate: (m.plate || m.kind).toUpperCase(), title: display(m.title || '') }, { width: B.w }),
    );
    const avail = Math.max(1, B.h - 3 - (optionRows ? optionRows + 1 : 0) - inputRows),
      scroll = Math.max(0, Math.min(m.scroll || 0, Math.max(0, body.length - avail)));
    body
      .slice(scroll, scroll + avail)
      .forEach((line, i) =>
        typeof line === 'string'
          ? text(B.x + 2, B.y + 2 + i, line, bodyW, LABEL)
          : put(B.x + 2, B.y + 2 + i, fitLine(line, bodyW)),
      );
    if (help) hit(B.x, B.y + 2, B.w, avail, { scroll: 'modal', modal: true });
    let y = B.y + 2 + Math.min(avail, body.length) + 1;
    if (m.options) {
      m.options.slice(optionTop, optionTop + optionRows).forEach((option, row) => {
        const i = optionTop + row,
          on = m.index === i;
        put(B.x + 2, y + row, [
          span(on ? '▸ ' : '  ', ACCENT),
          ...fitLine([span(display(option.label || option), on ? { fg: 'primary', bold: true } : LABEL)], bodyW - 2),
        ]);
        hit(B.x, y + row, B.w, 1, { act: 'modal-option', index: i, modal: true });
      });
      if (m.options.length > optionRows)
        block(B.x + B.w - 2, y, scrollRail({ total: m.options.length, visible: optionRows, offset: optionTop }));
    }
    if (m.input !== undefined) {
      const fy = B.y + B.h - 7;
      const label = m.pending ? 'CHECKING PNG - input locked' : m.kind === 'attach' ? 'LOCAL PNG PATH' : 'NAME';
      frame(B.x, fy + 1, B.w, 1, label, m.pending ? 'idle' : 'focus');
      const shown = display(m.input);
      text(B.x + 2, fy + 2, shown.slice(-B.w + 5), B.w - 4);
      if (!m.pending) cursor = { x: B.x + 2 + Math.min(B.w - 5, m.cursor ?? shown.length), y: fy + 2 };
      text(
        B.x + 1,
        fy + 5,
        m.error || 'Nothing changes until Enter confirms.',
        B.w - 2,
        m.error ? { fg: 'warning' } : FAINT,
      );
    }
    put(
      B.x,
      B.y + B.h - 1,
      popupFooter(
        {
          escape: m.kind === 'prompt' ? 'close' : 'cancel',
          meta: help ? 'PgUp PgDn scroll' : m.kind === 'prompt' ? 'Enter closes' : 'Enter or click to choose',
        },
        { width: B.w },
      ),
    );
  }

  // ---------- compose ----------
  header();
  // A column line can be dragged: it turns acid while the pointer is on it or it is being dragged.
  g.rules.forEach((rx, i) => {
    const side = g.sides[i],
      on =
        s.resize?.side === side || (!s.modal && !s.resize && s.hover?.x === rx && s.hover.y > 0 && s.hover.y < g.h - 1);
    block(rx, 1, verticalRule(on ? { ink: 'accent' } : {}, { height: g.h - 2 }));
    hit(rx, 1, 1, g.h - 2, { act: 'rule', side });
  });
  if (g.chat.docked) put(0, g.chat.y - 1, fitLine([span('─'.repeat(g.w), FAINT)], g.w));
  if (g.outline) outlinePanel(g.outline, s.pane === 'outline' && !s.modal);
  const M = g.chat.docked ? { ...g.main, h: g.main.h - 1 } : g.main;
  // A click on empty space (or the slide preview) leaves the focused box.
  hit(M.x, M.y, M.w, M.h, { act: 'blur' });
  if (!x) {
    text(M.x + 2, M.y, 'No slides yet - Ctrl-O, then n to create a section.', M.w - 4, LABEL);
  } else if (s.view === 'plan') planView(M);
  else if (s.view === 'preview') previewView(M);
  else buildView(M);
  chatPanel(g.chat);
  if (!g.outline && s.pane === 'outline' && !s.modal) {
    images.length = 0;
    fill(M);
    const { cx, cw } = contentBox(M);
    outlinePanel({ x: cx, y: M.y, w: Math.min(cw, 64), h: M.h }, true);
  }
  if (s.modal) modal(M);
  footer();
  for (const image of images) calm(image.rect.x, image.rect.y, image.rect.width, image.rect.height);
  const over = s.hover && hoverHit(hits, s.hover.x, s.hover.y, Boolean(s.modal));
  if (over && over.h === 1 && (HOVER.row.has(over.act) || HOVER.button.has(over.act))) {
    const row = HOVER.row.has(over.act);
    for (let x = over.x; x < over.x + over.w; x++) {
      const cell = grid[over.y][x];
      grid[over.y][x] = row
        ? { ...cell, lift: true }
        : {
            text: cell.text,
            style: { fg: 'field', bg: 'accent', bold: true },
            ...(cell.continuation ? { continuation: true } : {}),
          };
    }
    if (row) calm(over.x, over.y, over.w, 1);
  }
  return { g, lines: grid, images, cursor, hits, quiet };
}

export function plainFrame(result) {
  return result.lines.map((line) => paint(line, 'none')).join('\n');
}
