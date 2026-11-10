// Small changes to a lesson file's JSON, for the lesson agent's tools. Each changes the doc it is given and returns
// what it did, or throws an Error saying why it could not; the caller validates the result before applying it.
import { blankSlide } from './lesson.mjs';

const name = (slide) => slide.title.trim().replace(/\s*\n\s*/g, ' ') || 'Untitled slide';

// Every item with an id, in lesson order, with the list it sits in.
function items(doc) {
  const out = [];
  doc.sections.forEach((section, i) => {
    out.push({ kind: 'section', item: section, list: doc.sections, index: i });
    out.push({ kind: 'title slide', item: section.titleSlide, group: section });
    section.slides.forEach((x, j) => out.push({ kind: 'slide', item: x, list: section.slides, index: j }));
    section.subsections.forEach((sub, j) => {
      out.push({ kind: 'subsection', item: sub, list: section.subsections, index: j, section });
      out.push({ kind: 'title slide', item: sub.titleSlide, group: sub });
      sub.slides.forEach((x, k) => out.push({ kind: 'slide', item: x, list: sub.slides, index: k }));
    });
  });
  return out;
}
function find(doc, id, kinds) {
  const found = items(doc).find((x) => x.item.id === id);
  if (!found) throw Error(`No item has id "${id}"`);
  if (kinds && !kinds.includes(found.kind)) throw Error(`"${id}" is a ${found.kind}, not a ${kinds.join(' or ')}`);
  return found;
}
// Slides in reading order, so a description can say "Slide 4" as the outline does.
const position = (doc, id) =>
  items(doc)
    .filter((x) => x.kind === 'slide' || x.kind === 'title slide')
    .findIndex((x) => x.item.id === id) + 1;
const describe = (doc, found) =>
  found.kind === 'slide' || found.kind === 'title slide'
    ? `Slide ${position(doc, found.item.id)} "${name(found.item)}"`
    : `${found.kind} "${name(found.item.titleSlide)}"`;
function freshId(doc, prefix) {
  const used = new Set(items(doc).map((x) => x.item.id));
  let n = 1;
  while (used.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
// Where an item goes: before `beforeId` in `list`, or at its end.
function insert(list, item, beforeId) {
  const at = beforeId === undefined || beforeId === null ? list.length : list.findIndex((x) => x.id === beforeId);
  if (at < 0) throw Error(`"${beforeId}" is not in that list`);
  list.splice(at, 0, item);
}
// A section's own slides or a subsection's slides.
const slidesOf = (doc, groupId) => find(doc, groupId, ['section', 'subsection']).item.slides;

// A locked slide, or the first locked slide in a group: the author's locks are never deleted or moved.
function lockedIn(found) {
  const { kind, item } = found,
    groups = kind === 'section' ? [item, ...item.subsections] : kind === 'subsection' ? [item] : [];
  return kind === 'slide' || kind === 'title slide'
    ? item.locked && item
    : groups.flatMap((g) => [g.titleSlide, ...g.slides]).find((x) => x.locked);
}
function refuseLocked(doc, found, verb) {
  for (const x of found) {
    const held = lockedIn(x);
    if (held)
      throw Error(`${describe(doc, x)} cannot be ${verb}: "${name(held)}" (id ${held.id}) is locked by the author`);
  }
}

export function deleteItems(doc, { ids }) {
  if (!Array.isArray(ids) || !ids.length) throw Error('ids must list at least one id');
  const found = ids.map((id) => find(doc, id, ['slide', 'section', 'subsection'])),
    names = found.map((x) => describe(doc, x));
  if (doc.sections.every((section) => ids.includes(section.id)))
    throw Error('A lesson keeps at least one section; delete fewer sections');
  refuseLocked(doc, found, 'deleted');
  for (const x of found) x.list.splice(x.list.indexOf(x.item), 1);
  return `Deleted ${names.join(', ')}`;
}

export function addSlide(doc, { groupId, beforeId, fields = {} }) {
  const slide = blankSlide(freshId(doc, 'S'));
  setFields(slide, fields);
  insert(slidesOf(doc, groupId), slide, beforeId);
  return `Added Slide ${position(doc, slide.id)} "${name(slide)}" (id ${slide.id})`;
}

export function addGroup(doc, { kind, title, parentId, beforeId }) {
  if (typeof title !== 'string' || !title.trim()) throw Error('title must name the new group');
  if (kind === 'section') {
    const section = { id: freshId(doc, 'SEC'), titleSlide: null, slides: [], subsections: [] };
    section.titleSlide = blankSlide(freshId(doc, 'T'), title, true);
    insert(doc.sections, section, beforeId);
    return `Added section "${title}" (id ${section.id})`;
  }
  if (kind !== 'subsection') throw Error('kind must be section or subsection');
  const parent = find(doc, parentId, ['section']).item,
    sub = { id: freshId(doc, 'SUB'), titleSlide: null, slides: [] };
  sub.titleSlide = blankSlide(freshId(doc, 'T'), title, true);
  insert(parent.subsections, sub, beforeId);
  return `Added subsection "${title}" (id ${sub.id})`;
}

// Slides move into a section or subsection, subsections into a section, sections within the lesson.
export function moveItems(doc, { ids, groupId, beforeId }) {
  if (!Array.isArray(ids) || !ids.length) throw Error('ids must list at least one id');
  const found = ids.map((id) => find(doc, id, ['slide', 'section', 'subsection']));
  if (new Set(found.map((x) => x.kind)).size > 1) throw Error('Move slides, subsections or sections, one kind a call');
  refuseLocked(doc, found, 'moved');
  const kind = found[0].kind,
    target =
      kind === 'section'
        ? doc.sections
        : kind === 'subsection'
          ? find(doc, groupId, ['section']).item.subsections
          : slidesOf(doc, groupId);
  if (ids.includes(beforeId)) throw Error('beforeId cannot be one of the moved items');
  const names = found.map((x) => describe(doc, x));
  for (const x of found) x.list.splice(x.list.indexOf(x.item), 1);
  const at = beforeId === undefined || beforeId === null ? target.length : target.findIndex((x) => x.id === beforeId);
  if (at < 0) throw Error(`"${beforeId}" is not in the destination`);
  target.splice(at, 0, ...found.map((x) => x.item));
  return `Moved ${names.join(', ')}`;
}

// Fields keep the file's names and shapes; an image takes any of concept, style and picture (null removes it).
function setFields(slide, fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Error('fields must be an object');
  if (slide.locked) throw Error(`"${name(slide)}" (id ${slide.id}) is locked by the author; leave it as it is`);
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id') throw Error('A slide keeps its id');
    if (key === 'locked') throw Error('Only the author locks or unlocks slides');
    if (!(key in slide)) throw Error(`Slides have no field "${key}"`);
    if (key === 'image' || key === 'afterImage') {
      if (!value || typeof value !== 'object') throw Error(`${key} must be an object`);
      for (const part of Object.keys(value))
        if (!['concept', 'style', 'picture'].includes(part)) throw Error(`${key} has no "${part}"`);
      if (value.picture !== undefined && value.picture !== null)
        throw Error(`${key}.picture can only be set to null; use generate_picture for a new one`);
      Object.assign(slide[key], value);
    } else slide[key] = value;
  }
}
export function setSlide(doc, { id, fields }) {
  const found = find(doc, id, ['slide', 'title slide']);
  setFields(found.item, fields);
  return `Changed ${describe(doc, found)}: ${Object.keys(fields).join(', ')}`;
}

// Many slides in one call, so a change across the lesson is one model step, not one per slide; all or nothing.
export function setSlides(doc, { changes }) {
  if (!Array.isArray(changes) || !changes.length) throw Error('changes must be a list of { id, fields }');
  return changes.map((change) => setSlide(doc, change)).join('\n· ');
}

export function setPlan(doc, { fields }) {
  if (!fields || typeof fields !== 'object') throw Error('fields must be an object');
  for (const [key, value] of Object.entries(fields)) {
    if (!(key in doc.plan)) throw Error(`The plan has no "${key}"`);
    doc.plan[key] = value;
  }
  return `Changed the plan: ${Object.keys(fields).join(', ')}`;
}

// Every picture record in a lesson, read loosely: a model's lesson has not been validated yet.
const list = (v) => (Array.isArray(v) ? v : []);
const pictures = (doc) =>
  list(doc?.sections)
    .flatMap((section) => [section, ...list(section?.subsections)])
    .flatMap((group) => [group?.titleSlide, ...list(group?.slides)])
    .flatMap((x) => [x?.image?.picture, x?.afterImage?.picture])
    .filter((p) => p && typeof p === 'object');
// The whole lesson replaced by the model's version. The lesson the model sees leaves out saved picture prompts
// (prompts.mjs), so a generated picture it keeps by file without a prompt gets its saved prompt back: absent means
// unchanged.
export function updateLesson(doc, { lesson }) {
  if (!lesson || typeof lesson !== 'object') throw Error('lesson must be the complete lesson object');
  const saved = new Map(pictures(doc).map((p) => [p.file, p]));
  Object.keys(doc).forEach((key) => delete doc[key]);
  Object.assign(doc, lesson);
  for (const p of pictures(doc)) {
    const was = saved.get(p.file);
    if (p.source === 'generated' && p.prompt === undefined && was?.source === 'generated') p.prompt = was.prompt;
  }
  return 'Rewrote the lesson';
}
