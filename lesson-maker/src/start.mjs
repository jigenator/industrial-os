// The start screen `lesson` shows when no file is given: the project's lessons, newest first, and a new lesson.
// Finding and drawing are pure apart from directory reads; the terminal loop lives in host.mjs.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { span } from '@industrial-os/design-system/foundation/cells';
import { CellGrid } from '@industrial-os/design-system/foundation/cell-grid';
import { crateBanner } from '@industrial-os/design-system/elements/crate-banner';
import { surfaceAt } from '@industrial-os/design-system/foundation/surface';
import { sectionHead } from '@industrial-os/design-system/elements/section-head';
import { keyHints } from '@industrial-os/design-system/elements/action-label';
import { display } from './text.mjs';
import { GROUND } from './ground.mjs';

// The project is the git checkout the folder is in, or the folder itself outside git.
export function projectRoot(cwd) {
  for (let at = cwd; ; at = dirname(at)) {
    if (existsSync(join(at, '.git'))) return at;
    if (dirname(at) === at) return cwd;
  }
}
// Folders that never hold lessons worth listing, and limits so a huge tree cannot stall the start.
const SKIP = new Set(['node_modules', 'dist', 'build', 'target', 'vendor']);
const MAX_DEPTH = 6,
  MAX_LESSONS = 200;
export function findLessons(root) {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= MAX_LESSONS) return;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          depth < MAX_DEPTH &&
          !entry.name.startsWith('.') &&
          !SKIP.has(entry.name) &&
          !entry.name.endsWith('.assets') &&
          // A lesson's history holds copies of it, not lessons of their own.
          !entry.name.endsWith('.history')
        )
          walk(path, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.lesson.json'))
        found.push({ path, name: relative(root, path), modified: statSync(path).mtimeMs });
    }
  };
  walk(root, 0);
  return found.sort((a, b) => b.modified - a.modified);
}
// A new lesson's file from the name typed: lower case, words joined by '-', in the project's lessons folder.
export function newLessonPath(root, name) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? join(root, 'lessons', `${slug}.lesson.json`) : null;
}
export function age(ms, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 60 / 24)}d ago`;
}

export const startState = (root, lessons) => ({ root, lessons, index: 0, naming: null });
// Row 0 is "+ New lesson…", then one row per lesson.
const rowCount = (m) => m.lessons.length + 1;

// One key or click; returns { open: path } or { quit: true } when the screen is done.
export function startKey(m, event, hits = []) {
  if (event.key === 'ctrl-c') return { quit: true };
  if (m.naming) {
    const n = m.naming;
    if (event.key === 'escape') m.naming = null;
    else if (event.key === 'backspace') n.text = n.text.slice(0, -1);
    else if (event.key === 'text' && n.text.length < 80) n.text += event.text;
    else if (event.key === 'paste') n.text = (n.text + event.text.replace(/\s+/g, ' ')).slice(0, 80);
    else if (event.key === 'enter') {
      const path = newLessonPath(m.root, n.text);
      if (path) return { open: path };
      n.error = 'Type a name with at least one letter or digit';
    }
    return null;
  }
  if (event.key === 'mouse') {
    m.hover = { x: event.x, y: event.y };
    if (event.button === 'wheelup' || event.button === 'wheeldown')
      m.index = Math.max(0, Math.min(rowCount(m) - 1, m.index + (event.button === 'wheeldown' ? 1 : -1)));
    else if (event.button === 'left' && !event.release && !event.motion) {
      const hit = hits.find((h) => event.y === h.y && event.x >= h.x && event.x < h.x + h.w);
      if (hit) return choose(m, hit.row);
    }
    return null;
  }
  if (event.key === 'escape' || (event.key === 'text' && event.text === 'q')) return { quit: true };
  if (event.key === 'up') m.index = (m.index + rowCount(m) - 1) % rowCount(m);
  if (event.key === 'down' || event.key === 'tab') m.index = (m.index + 1) % rowCount(m);
  if (event.key === 'enter') return choose(m, m.index);
  return null;
}
function choose(m, row) {
  m.index = row;
  if (row > 0) return { open: m.lessons[row - 1].path };
  m.naming = { text: '', error: '' };
  return null;
}

const ACCENT = { fg: 'accent' },
  FAINT = { fg: 'decorative' },
  LABEL = { fg: 'secondary' };
const home = (path) => (path.startsWith(homedir()) ? '~' + path.slice(homedir().length) : path);
// The maker's plate's serial: a stable mark for the project folder, the same on every run.
const serialOf = (root) => {
  let hash = 2166136261;
  for (const char of root) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  const hex = hash.toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
};
const clockOf = (now) => {
  const d = new Date(now);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// Lines, click targets, quiet areas and the cursor for one frame. The ground and its texture are the host's.
export function renderStart(m, w, h, now = Date.now()) {
  const grid = new CellGrid(w, h),
    hits = [],
    quiet = [];
  let cursor = null;
  // The Pi startup header's brushed-aluminium plate: the project's lesson count in HOLD, the time, the folder.
  // As wide as the list under it (and Pi's header at 100 columns), so a wide pane does not stretch it empty.
  const bw = Math.min(w, 96),
    full = h >= 16 && bw >= 40,
    plate = {
      maker: 'LESSON MAKER',
      registered: false,
      division: display(basename(m.root) || m.root).toUpperCase(),
      unit: 'LM-01',
      serial: serialOf(m.root),
      hold: m.lessons.length,
      clock: clockOf(now),
    },
    stripBackdrop = full
      ? Array.from({ length: bw }, (_, x) => surfaceAt(x, 6, { width: w, height: h, gradient: GROUND }))
      : null,
    banner = crateBanner(plate, { width: bw, form: full ? 'full' : 'compact', stripBackdrop }).lines;
  grid.place(0, 0, banner);
  const top = banner.length + 1,
    x = 2,
    width = Math.max(1, Math.min(w - 4, 92));
  grid.place(x, top, [
    sectionHead(m.naming ? { title: 'NEW LESSON' } : { title: 'OPEN A LESSON', count: String(m.lessons.length) }, {
      width,
    }),
  ]);
  grid.text(x, top + 1, display(home(m.root)), FAINT, width);
  if (m.naming) {
    const path = newLessonPath(m.root, m.naming.text);
    grid.text(x, top + 3, 'Name', LABEL, width);
    const shown = display(m.naming.text).slice(-(width - 4));
    grid.text(x + 2, top + 4, shown, { fg: 'primary', bold: true }, width - 2);
    cursor = { x: x + 2 + shown.length, y: top + 4 };
    grid.text(
      x,
      top + 6,
      path ? `Saves to ${relative(m.root, path)}` : 'Saves to lessons/<name>.lesson.json',
      FAINT,
      width,
    );
    if (m.naming.error) grid.text(x, top + 7, m.naming.error, { fg: 'warning' }, width);
    quiet.push({ x, y: top + 3, width, height: 5 });
  } else {
    const first = top + 3,
      rows = Math.max(1, h - first - 2),
      scroll = Math.max(0, Math.min(m.index - Math.floor(rows / 2), rowCount(m) - rows));
    for (let row = scroll; row < Math.min(rowCount(m), scroll + rows); row++) {
      const y = first + row - scroll,
        on = row === m.index,
        lesson = m.lessons[row - 1],
        when = lesson ? age(lesson.modified, now) : '';
      grid.place(x, y, [[span(on ? '› ' : '  ', ACCENT)]]);
      grid.text(
        x + 2,
        y,
        lesson ? display(lesson.name) : '+ New lesson...',
        on ? { fg: 'primary', bold: true } : lesson ? LABEL : ACCENT,
        width - 4 - when.length - 2,
      );
      if (when) grid.text(x + width - when.length, y, when, FAINT, when.length);
      hits.push({ x, y, w: width, row });
    }
    quiet.push({ x, y: first, width, height: Math.min(rows, rowCount(m)) });
    if (!m.lessons.length) grid.text(x, first + 2, 'No lessons in this project yet.', FAINT, width);
  }
  const keys = m.naming
    ? [
        { key: 'Enter', label: 'create' },
        { key: 'Esc', label: 'back' },
      ]
    : [
        { key: 'Enter', label: 'open' },
        { key: '↑↓', label: 'choose' },
        { key: 'q', label: 'quit' },
      ];
  grid.place(0, h - 1, [keyHints(keys, { width: w, measure: (value) => [...value].length })]);
  const lines = grid.lines(),
    over =
      m.hover &&
      !m.naming &&
      hits.find((hit) => hit.y === m.hover.y && m.hover.x >= hit.x && m.hover.x < hit.x + hit.w);
  // The row under the pointer brightens a step (the host lifts its ground), as rows do in the editor.
  if (over && over.y < h) for (let i = over.x; i < Math.min(w, over.x + over.w); i++) lines[over.y][i].lift = true;
  return { lines, hits, cursor, quiet };
}
