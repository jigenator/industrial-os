// The lesson file: its schema, conversion between the file and the app's state, and atomic saving.
import {
  appendFileSync,
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  writeFileSync,
} from 'node:fs';
import { open, readFile, rename, unlink, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, sep } from 'node:path';
import { compileSchema, pointer } from './schema.mjs';
import { validatePng } from './png.mjs';

export const SCHEMA_PATH = new URL('../schema/lesson.schema.json', import.meta.url);
export const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const schemaErrors = compileSchema(SCHEMA);

// Field names in the file and in the app's slides; the app keeps its own shorter names.
const TEXT = [
  ['title', 'title'],
  ['text', 'content'],
  ['tagline', 'tagline'],
  ['beforeCaption', 'beforeCap'],
  ['afterCaption', 'afterCap'],
  ['purpose', 'purpose'],
  ['speakerNotes', 'notes'],
  ['comments', 'comments'],
];
// Each image: its file key, the app's concept field and the app's style field.
const IMAGES = [
  ['image', 'imageDesc', 'imageStyle'],
  ['afterImage', 'afterDesc', 'afterStyle'],
];
const PLAN = [
  ['outcomes', 'outcomes'],
  ['prerequisites', 'prereqs'],
  ['teachingPrinciples', 'teaching'],
  ['progression', 'progression'],
];

// Schema errors, then the rule JSON Schema cannot say: every id is unique in the lesson.
export function validateLesson(doc) {
  const errors = schemaErrors(doc);
  if (errors.length) return errors;
  const seen = new Map();
  const visit = (item, path) => {
    if (seen.has(item.id))
      errors.push({
        path: pointer([...path, 'id']),
        message: `repeats id "${item.id}" first used at ${seen.get(item.id)}`,
      });
    else seen.set(item.id, pointer([...path, 'id']));
  };
  doc.sections.forEach((sec, i) => {
    const at = ['sections', i];
    visit(sec, at);
    visit(sec.titleSlide, [...at, 'titleSlide']);
    sec.slides.forEach((x, j) => visit(x, [...at, 'slides', j]));
    sec.subsections.forEach((sub, j) => {
      visit(sub, [...at, 'subsections', j]);
      visit(sub.titleSlide, [...at, 'subsections', j, 'titleSlide']);
      sub.slides.forEach((x, k) => visit(x, [...at, 'subsections', j, 'slides', k]));
    });
  });
  return errors;
}
export const formatErrors = (errors) => errors.map((e) => `${e.path === '/' ? '(the file)' : e.path} ${e.message}`);

export const blankSlide = (id, title = '', titleSlide = false) => ({
  id,
  title,
  type: titleSlide ? 'Section title' : 'Initial question',
  layout: titleSlide ? 'title' : 'points-image',
  text: '',
  tagline: '',
  imageSide: 'right',
  sentencePosition: 'top',
  image: { concept: '', style: 'generic', picture: null },
  afterImage: { concept: '', style: 'generic', picture: null },
  beforeCaption: '',
  afterCaption: '',
  purpose: '',
  speakerNotes: '',
});
const SLIDE = SCHEMA.$defs.slide.properties;
export const STYLES = SCHEMA.$defs.image.properties.style.enum;
// A displayable lesson from a file that failed validation, so it can be read while its errors are listed. Anything
// unreadable becomes a blank value; pictures are left out.
export function readableDoc(raw) {
  const str = (v) => (typeof v === 'string' ? v : ''),
    pick = (v, values, fallback) => (values.includes(v) ? v : fallback),
    list = (v) => (Array.isArray(v) ? v : []),
    used = new Set();
  let n = 0;
  const id = (v) => {
    let out = typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v) ? v : `unreadable-${++n}`;
    while (used.has(out)) out = `unreadable-${++n}`;
    used.add(out);
    return out;
  };
  const slide = (v, title = false) => ({
    ...blankSlide(id(v?.id), str(v?.title), title),
    type: pick(v?.type, SLIDE.type.enum, title ? 'Section title' : 'Initial question'),
    layout: pick(v?.layout, SLIDE.layout.enum, title ? 'title' : 'points-image'),
    text: str(v?.text),
    tagline: str(v?.tagline),
    imageSide: pick(v?.imageSide, SLIDE.imageSide.enum, 'right'),
    sentencePosition: pick(v?.sentencePosition, SLIDE.sentencePosition.enum, 'top'),
    image: { concept: str(v?.image?.concept), style: pick(v?.image?.style, STYLES, 'generic'), picture: null },
    afterImage: {
      concept: str(v?.afterImage?.concept),
      style: pick(v?.afterImage?.style, STYLES, 'generic'),
      picture: null,
    },
    beforeCaption: str(v?.beforeCaption),
    afterCaption: str(v?.afterCaption),
    purpose: str(v?.purpose),
    speakerNotes: str(v?.speakerNotes),
    ...(str(v?.comments) ? { comments: str(v?.comments) } : {}),
    ...(v?.locked === true ? { locked: true } : {}),
  });
  const sections = list(raw?.sections).map((sec) => ({
    id: id(sec?.id),
    titleSlide: slide(sec?.titleSlide, true),
    slides: list(sec?.slides).map((x) => slide(x)),
    subsections: list(sec?.subsections).map((sub) => ({
      id: id(sub?.id),
      titleSlide: slide(sub?.titleSlide, true),
      slides: list(sub?.slides).map((x) => slide(x)),
    })),
  }));
  const blank = blankLesson();
  return {
    schemaVersion: 1,
    plan: Object.fromEntries(PLAN.map(([file]) => [file, str(raw?.plan?.[file])])),
    sections: sections.length ? sections : blank.sections,
  };
}
export function blankLesson() {
  return {
    schemaVersion: 1,
    plan: { outcomes: '', prerequisites: '', teachingPrinciples: '', progression: '' },
    sections: [{ id: 'SEC-1', titleSlide: blankSlide('T-1', '', true), slides: [blankSlide('S-1')], subsections: [] }],
  };
}

// Each slide in a file, by id, with the id of the section or subsection it sits in.
export function slidePlaces(doc) {
  const out = new Map();
  for (const sec of doc.sections) {
    for (const x of [sec.titleSlide, ...sec.slides]) out.set(x.id, { slide: x, group: sec.id });
    for (const sub of sec.subsections)
      for (const x of [sub.titleSlide, ...sub.slides]) out.set(x.id, { slide: x, group: sub.id });
  }
  return out;
}
// JSON with object keys sorted, so two slides compare equal whatever order a model wrote their keys in.
export const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );

// The app's state from a valid file: groups with their names, and one flat slide list in lesson order.
export function fromDoc(doc) {
  const slides = [],
    pictures = {};
  const add = (x, secId, subId, titleFor) => {
    const slide = { id: x.id, secId, subId, type: x.type, layout: x.layout, imageSide: x.imageSide };
    if (titleFor) slide.titleFor = titleFor;
    if (x.locked) slide.locked = true;
    slide.sentencePos = x.sentencePosition;
    // tagline is optional in the file, so older lessons read as an empty one.
    for (const [file, app] of TEXT) slide[app] = x[file] ?? '';
    for (const [file, app, style] of IMAGES) {
      slide[app] = x[file].concept;
      slide[style] = x[file].style ?? 'generic';
      if (x[file].picture) (pictures[x.id] ??= {})[app] = { ...x[file].picture };
    }
    slides.push(slide);
  };
  const name = (x) => x.title.trim().replace(/\s*\n\s*/g, ' ');
  const sections = doc.sections.map((sec) => {
    add(sec.titleSlide, sec.id, null, sec.id);
    for (const x of sec.slides) add(x, sec.id, null);
    const subs = sec.subsections.map((sub) => {
      add(sub.titleSlide, sec.id, sub.id, sub.id);
      for (const x of sub.slides) add(x, sec.id, sub.id);
      return { id: sub.id, title: name(sub.titleSlide) };
    });
    return { id: sec.id, title: name(sec.titleSlide), subs };
  });
  const principles = Object.fromEntries(PLAN.map(([file, app]) => [app, doc.plan[file]]));
  return { sections, slides, principles, pictures, ...(doc.$schema ? { schemaRef: doc.$schema } : {}) };
}

// The file from the app's state. Pictures keep only what the file records, never their pixels.
export function toDoc(s) {
  const slide = (x) => {
    const out = { id: x.id };
    for (const [file, app] of TEXT) out[file] = x[app] ?? '';
    out.type = x.type;
    out.layout = x.layout;
    out.imageSide = x.imageSide;
    out.sentencePosition = x.sentencePos;
    for (const [file, app, style] of IMAGES)
      out[file] = {
        concept: x[app] ?? '',
        style: x[style] ?? 'generic',
        picture: pictureRecord(s.pictures[x.id]?.[app]),
      };
    return Object.fromEntries(
      [
        'id',
        'title',
        'type',
        'layout',
        'text',
        'tagline',
        'imageSide',
        'sentencePosition',
        'image',
        'afterImage',
        'beforeCaption',
        'afterCaption',
        'purpose',
        'speakerNotes',
        // Written only when there are some or it is on, so other lessons keep their shape.
        ...(x.comments ? ['comments'] : []),
        ...(x.locked ? ['locked'] : []),
      ].map((k) => [k, k === 'locked' ? true : out[k]]),
    );
  };
  const titleOf = (id) => slide(s.slides.find((x) => x.titleFor === id));
  const plain = (secId, subId) =>
    s.slides.filter((x) => x.secId === secId && x.subId === subId && !x.titleFor).map(slide);
  return {
    ...(s.schemaRef ? { $schema: s.schemaRef } : {}),
    schemaVersion: 1,
    plan: Object.fromEntries(PLAN.map(([file, app]) => [file, s.principles[app] ?? ''])),
    sections: s.sections.map((sec) => ({
      id: sec.id,
      titleSlide: titleOf(sec.id),
      slides: plain(sec.id, null),
      subsections: sec.subs.map((sub) => ({ id: sub.id, titleSlide: titleOf(sub.id), slides: plain(sec.id, sub.id) })),
    })),
  };
}
export const pictureRecord = (p) =>
  !p
    ? null
    : p.source === 'generated'
      ? { source: 'generated', file: p.file, prompt: p.prompt, model: p.model }
      : { source: 'attached', file: p.file };

// Where a lesson's pictures live: a folder beside it, named after the file.
// Characters the schema does not allow in a picture path become '-'.
export const assetsFolder = (path) =>
  basename(path)
    .replace(/\.json$/i, '')
    .replace(/[^A-Za-z0-9._-]/g, '-') + '.assets';
// A picture's path as the file records it: relative to the lesson's folder, with forward slashes.
export const assetPath = (lessonPath, file) => relative(dirname(lessonPath), file).split(sep).join('/');

// Reads a lesson file. A missing file is not an error: the caller starts a blank lesson there.
export async function readLesson(path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { missing: true };
    throw error;
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return { errors: [{ path: '/', message: `is not JSON: ${error.message}` }] };
  }
  const moved = moveKeyPoints(doc),
    errors = validateLesson(doc);
  return { doc, moved, ...(errors.length ? { errors } : {}) };
}
// Lessons from before KEY POINTS was removed: each slide's key points move to the top of its speaker notes, under a
// "Key points:" line, so nothing is lost. Returns how many slides had some.
export function moveKeyPoints(doc) {
  let moved = 0;
  const list = (v) => (Array.isArray(v) ? v : []);
  for (const sec of list(doc?.sections))
    for (const group of [sec, ...list(sec?.subsections)])
      for (const x of [group?.titleSlide, ...list(group?.slides)]) {
        if (!x || typeof x !== 'object' || !('keyPoints' in x)) continue;
        const points = typeof x.keyPoints === 'string' ? x.keyPoints.trim() : '',
          notes = typeof x.speakerNotes === 'string' ? x.speakerNotes : '';
        if (points) {
          x.speakerNotes = `Key points:\n${points}` + (notes.trim() ? `\n\n${notes}` : '');
          moved++;
        }
        delete x.keyPoints;
      }
  return moved;
}
// Opens a lesson for the app: a missing file is created blank; an invalid one comes back readable, with its errors.
export async function openLesson(path) {
  const read = await readLesson(path);
  if (read.missing) {
    const doc = blankLesson();
    // A new lesson may start a folder, such as a project's first lessons/.
    await mkdir(dirname(path), { recursive: true });
    await writeLesson(path, doc);
    return { doc, created: true };
  }
  if (read.errors) return { doc: readableDoc(read.doc), errors: read.errors, moved: read.moved };
  // Moved key points are written back at once, so the file matches what the app shows.
  if (read.moved) await writeLesson(path, read.doc);
  return { doc: read.doc, moved: read.moved };
}
// The app's own settings (the chat model and effort), kept across restarts outside any lesson.
export const SETTINGS_FILE = join(homedir(), '.config', 'lesson-maker', 'settings.json');
// A missing or broken settings file reads as no settings; callers check each value.
export async function readSettings(path = SETTINGS_FILE) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
export async function writeSettings(settings, path = SETTINGS_FILE) {
  await mkdir(dirname(path), { recursive: true });
  await writeWhole(path, JSON.stringify(settings, null, 2) + '\n');
}
// Writes the whole file or nothing: a temporary file beside it, flushed to disk, then renamed over it.
export async function writeLesson(path, doc) {
  const errors = validateLesson(doc);
  if (errors.length) return errors;
  await writeWhole(path, JSON.stringify(doc, null, 2) + '\n');
  return null;
}
async function writeWhole(path, data) {
  const temp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  const file = await open(temp, 'w', 0o644);
  try {
    await file.writeFile(data);
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temp, path);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}
// The lesson's history, a folder beside it named after the file: copies of the file from before AI requests, and
// the chat. Written here only, never deleted from.
export const historyFolder = (path) => join(dirname(path), basename(path).replace(/\.json$/i, '') + '.history');
// A local time that sorts as it reads and is safe in a file name: 2026-11-10T14-55-07-123.
const pad = (n, width = 2) => String(n).padStart(width, '0');
const stampName = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-` +
  `${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
// Copies the saved lesson file into its history before an AI request runs; returns the copy's path, or null when
// there is no saved file yet or the newest copy is byte-identical. Synchronous, so the copy lands before the request
// starts and requests starting together cannot race for a name.
export function snapshotLesson(path, date = new Date()) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const folder = historyFolder(path);
  mkdirSync(folder, { recursive: true });
  const newest = readdirSync(folder)
    .filter((name) => name.endsWith('.lesson.json'))
    .sort()
    .at(-1);
  if (newest && readFileSync(join(folder, newest)).equals(bytes)) return null;
  // A name already taken moves on a millisecond, so names keep sorting in the order the copies were made.
  for (let at = date.getTime(); ; at++) {
    const file = join(folder, `${stampName(new Date(at))}.lesson.json`);
    try {
      writeFileSync(file, bytes, { flag: 'wx', mode: 0o644 });
      return file;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}
// Adds one finished chat entry to the history's chat.jsonl, on a line of its own even after a cut-off last line.
export function appendChat(path, entry) {
  const folder = historyFolder(path),
    file = join(folder, 'chat.jsonl');
  mkdirSync(folder, { recursive: true });
  let lead = '';
  try {
    const fd = openSync(file, 'r');
    try {
      const { size } = fstatSync(fd),
        last = Buffer.alloc(1);
      if (size && readSync(fd, last, 0, 1, size - 1) === 1 && last[0] !== 0x0a) lead = '\n';
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  appendFileSync(file, lead + JSON.stringify(entry) + '\n', { mode: 0o644 });
}
// The chat kept in the history, oldest first, marked earlier: display only, never sent to a model. Lines that do not
// read as an entry (such as one cut off mid-write) are skipped.
// shortcut: only the last 200 entries come back, because the transcript rewraps every entry each frame; page the
// file if older ones are needed.
export function readChat(path, limit = 200) {
  let text;
  try {
    text = readFileSync(join(historyFolder(path), 'chat.jsonl'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const entries = text.split('\n').flatMap((line) => {
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      return [];
    }
    return typeof m?.role === 'string' && typeof m.text === 'string'
      ? [{ role: m.role, text: m.text, stamp: typeof m.stamp === 'string' ? m.stamp : '', earlier: true }]
      : [];
  });
  return entries.slice(-limit);
}
// Loads a picture's pixels; a missing or broken file leaves the record and says why.
export async function loadPicture(lessonPath, picture) {
  try {
    const bytes = await readFile(join(dirname(lessonPath), picture.file));
    Object.assign(picture, { bytes, ...validatePng(bytes), name: basename(picture.file), error: null });
  } catch (error) {
    Object.assign(picture, {
      bytes: null,
      name: basename(picture.file),
      error: error.code === 'ENOENT' ? 'file missing' : error.message,
    });
  }
  return picture;
}
// Copies an attached PNG into the lesson's picture folder so the lesson keeps working without the original.
export async function storePicture(lessonPath, bytes, stem) {
  const folder = join(dirname(lessonPath), assetsFolder(lessonPath));
  await mkdir(folder, { recursive: true });
  const file = join(folder, `${stem}-${Date.now().toString(36)}.png`);
  const handle = await open(file, 'wx', 0o644);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  return assetPath(lessonPath, file);
}
