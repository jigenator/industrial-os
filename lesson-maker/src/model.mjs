import { seed, TYPES, LAYOUTS } from './seed.mjs';
import { fromDoc, toDoc, pictureRecord, slidePlaces, canonical, STYLES, validateLesson } from './lesson.mjs';
import { clean } from './text.mjs';
export const FIELD_NAMES = {
  title: 'Title / name',
  content: 'Content',
  tagline: 'Tag line',
  imageDesc: 'Image concept',
  afterDesc: 'After image concept',
  beforeCap: 'Before caption',
  afterCap: 'After caption',
  purpose: 'Teaching purpose',
  notes: 'Speaker notes',
  comments: 'Comments',
};
export const order = (s) =>
  s.sections.flatMap((sec) => [
    ...s.slides.filter((x) => x.secId === sec.id && !x.subId),
    ...sec.subs.flatMap((sub) => s.slides.filter((x) => x.subId === sub.id)),
  ]);
export const slideById = (s, id) => s.slides.find((x) => x.id === id);
export const owners = (s) => s.sections.flatMap((sec) => [sec, ...sec.subs]);
export const ownerById = (s, id) => owners(s).find((x) => x.id === id);
// Every box takes new lines, so names shown on one line (outline, headers, notices) join theirs with a space.
export const oneLine = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s*\n\s*/g, ' ');
// What a slide says aloud: its speaker notes, which are the speech; without notes, its title and text.
export const spokenText = (x) =>
  x?.notes?.trim() || [oneLine(x?.title), oneLine(x?.content)].filter(Boolean).join('. ');
export const slideName = (x) => oneLine(x?.title) || 'Untitled slide';
export const ref = (s, id) => {
  const x = slideById(s, id);
  return x ? `Slide ${order(s).indexOf(x) + 1} "${slideName(x)}"` : 'Whole lesson';
};
export const fieldName = (x, f) =>
  f === 'content'
    ? { statement: 'Statement', 'image-sentence': 'Sentence', 'points-image': 'Points', 'title-image': 'Subtitle' }[
        x.layout
      ] || 'Content'
    : f === 'imageDesc' && x.layout === 'before-after'
      ? 'Before image concept'
      : FIELD_NAMES[f] || f;
// A request's target: a box, a whole slide (no field) or, with no slide, the whole lesson.
export const targetLabel = (s, t = chatAim(s)) =>
  t && slideById(s, t.slideId)
    ? ref(s, t.slideId) + (t.field ? ` / ${fieldName(slideById(s, t.slideId), t.field)}` : '')
    : 'Whole lesson';
export const activeFields = (x) =>
  ({
    'points-image': ['title', 'content', 'imageDesc'],
    'image-sentence': ['imageDesc', 'content'],
    title: ['title'],
    'title-image': ['title', 'content', 'tagline', 'imageDesc'],
    statement: ['content'],
    'before-after': ['imageDesc', 'afterDesc', 'beforeCap', 'afterCap'],
  })[x.layout] || [];
// Layouts whose picture sits beside the text, on the side imageSide names.
export const imageSided = (x) => ['points-image', 'title-image'].includes(x?.layout);
export const imageFields = (x) => activeFields(x).filter((f) => f === 'imageDesc' || f === 'afterDesc');
export const keyOf = (id, field) => `${id}:${field}`;
export const revision = (s, id, f) => s.revisions[keyOf(id, f)] || 0;
export const pending = (j) => j.status === 'working' || j.status === 'queued';
// A whole-lesson request holds every box, the plan and the outline while it waits, and once it runs until its first
// claim (claim_slides in scheduler.mjs), or for good with an all claim.
export const lessonBusy = (s) =>
  s.jobs.some((j) => j.kind === 'lesson' && pending(j) && (!j.claim || j.claim.all));
// The running whole-lesson request's narrower claim, { ids, plan, all }: the slides and groups (by id) and whether
// the plan is what it holds. Only one whole-lesson request runs at a time.
export const lessonClaim = (s) =>
  s.jobs.find((j) => j.kind === 'lesson' && j.status === 'working' && j.claim && !j.claim.all)?.claim ?? null;
// Whether a claim covers a slide (itself, or the section or subsection it is in) or a group (itself or its section).
export function claimCovers(s, claim, id) {
  if (!claim) return false;
  if (claim.all) return true;
  const x = slideById(s, id),
    home = x ? null : s.sections.find((sec) => sec.subs.some((sub) => sub.id === id));
  return [id, x?.secId, x?.subId, home?.id].some((k) => k && claim.ids.includes(k));
}
export const claimed = (s, id) => claimCovers(s, lessonClaim(s), id);
export const planBusy = (s) => lessonBusy(s) || Boolean(lessonClaim(s)?.plan);
export const groupName = (s, id) => {
  const sec = s.sections.find((x) => x.id === id);
  return `${sec ? 'Section' : 'Subsection'} "${ownerById(s, id)?.title || 'untitled'}"`;
};
export const itemName = (s, id) => (slideById(s, id) ? ref(s, id) : groupName(s, id));
export const claimNote = (s, id) =>
  `${itemName(s, id)} is claimed by the whole-lesson request; it unlocks when the request finishes`;
// A whole-slide request (no field) holds every box of its slide; a whole-lesson request what it claimed.
export const busy = (s, id, f) =>
  lessonBusy(s) ||
  claimed(s, id) ||
  s.jobs.some((j) => j.slideId === id && (!f || !j.field || j.field === f) && pending(j));
// Why the lesson cannot be changed by hand right now, or null when it can.
export const locked = (s, what) =>
  s.review
    ? `Review-only: ${what} disabled`
    : lessonBusy(s)
      ? 'Locked: the lesson agent is changing the whole lesson'
      : null;
// A slide the author locked: nobody, the author included, changes, moves or deletes it until it is unlocked.
export const isLocked = (s, id) => Boolean(slideById(s, id)?.locked);
export const lockedNote = (s, id) => `${ref(s, id)} is locked - l in the outline unlocks it`;
// Why moving or deleting this slide or group would touch a locked slide, or null.
export function lockHold(s, id) {
  const x = slideById(s, id),
    held = x ? (x.locked ? x : null) : groupContents(s, id).find((z) => z.locked);
  return held ? lockedNote(s, held.id) : null;
}
// Locks or unlocks slides by hand; not undoable, the lock is its own switch. Refused while a request waits or runs
// on any of them, so a request never meets a lock it did not start with.
export function setLocks(s, ids, on) {
  const why = locked(s, 'locks');
  if (why) return why;
  const slides = ids.map((id) => slideById(s, id)).filter(Boolean),
    working = slides.find((x) => busy(s, x.id));
  if (working) return `${ref(s, working.id)} has an AI request on it; lock it when that finishes`;
  for (const x of slides)
    if (on) x.locked = true;
    else delete x.locked;
  return null;
}
export function createState(lesson = seed()) {
  return {
    ...lesson,
    selected: (order(lesson).find((x) => !x.titleFor) || order(lesson)[0]).id,
    review: false,
    view: 'workspace',
    pane: 'workbench',
    control: null,
    choice: 0,
    wholeLesson: false,
    chat: [],
    chatDraft: '',
    chatCursor: 0,
    chatNew: 0,
    revisions: {},
    provenance: {},
    jobs: [],
    undo: [],
    seq: 100,
    notice: 'Tab to a box; Ctrl-G to chat. Every change saves to the lesson file.',
    // The lesson file: where it is, whether the last change reached it, and any schema errors.
    file: { path: null, name: 'not saved', status: 'none', errors: [], readOnly: false },
    // The Pi connection: its models and the one the chat uses.
    // effort: how hard the model thinks and pictures render; context: the last request's share of its window.
    ai: { status: 'off', message: '', models: [], model: null, effort: 'low', context: null },
    // How fast slides are read aloud: one of SPEEDS in speech.mjs, kept with the model and effort.
    speechRate: 1,
    // The Gemini voice slides are read in: a name from VOICES in speech.mjs, kept like the speed.
    voice: 'Orus',
    edit: null,
    modal: null,
    outlineCursor: 0,
    outlineScroll: 0,
    collapsed: [],
    formScroll: 0,
    // Column widths chosen by dragging a column line or { } < > (session only); null keeps the default.
    // Session-only column widths, and whether the author hid the outline column (o).
    columns: { outline: null, chat: null, outlineHidden: false },
    resize: null,
    // Form box heights chosen by dragging a bottom border or Option-Up/Down, per side-by-side pair (session only).
    boxRows: {},
    boxResize: null,
    // Per-box text scroll, and whether the focused box follows its caret (the wheel turns that off).
    boxScroll: {},
    caretFollow: true,
    formFollow: true,
    planIndex: 0,
    images: true,
    origin: null,
  };
}
export function selectSlide(s, id) {
  if (s.selected === id) return;
  s.selected = id;
  s.wholeLesson = false;
  s.control = null;
  s.formFollow = true;
}
export function focusField(s, field) {
  const x = slideById(s, s.selected);
  if (x && FIELD_NAMES[field]) {
    s.control = field;
    s.wholeLesson = false;
  }
}
const remember = (s, entry) => {
  s.undo.push(entry);
  if (s.undo.length > 30) s.undo.shift();
};
export function setField(s, id, field, value, { agent = false, record = true } = {}) {
  if (s.review) return 'Review-only: edits disabled';
  const x = slideById(s, id);
  if (!x) return 'Slide removed';
  if (!Object.hasOwn(FIELD_NAMES, field)) return 'Unknown field';
  if (x.locked) return lockedNote(s, id);
  if (!agent && busy(s, id, field)) return 'BUSY - LOCKED; queue a chat request instead';
  value = clean(value);
  if (x[field] === value) return 'Nothing to change';
  if (field === 'title' && record && !agent)
    remember(s, { kind: 'rename', id: x.id, before: x.title, after: value, label: `Rename ${ref(s, id)}` });
  x[field] = value;
  s.revisions[keyOf(id, field)] = revision(s, id, field) + 1;
  if (field === 'title' && x.titleFor) ownerById(s, x.titleFor).title = oneLine(value);
  if (agent) s.provenance[keyOf(id, field)] = 'AI EDIT';
  return null;
}
export function setChoice(s, key, value, id = s.selected) {
  const why = locked(s, 'choices');
  if (why) return why;
  const x = slideById(s, id);
  if (!x) return 'No slide';
  if (x.locked) return lockedNote(s, x.id);
  if (claimed(s, x.id)) return claimNote(s, x.id);
  if (key === 'layout' && busy(s, x.id)) return 'Layout locked while this slide has pending jobs';
  if ((key === 'type' && !TYPES.includes(value)) || (key === 'layout' && !LAYOUTS.includes(value)))
    return 'Unknown choice';
  if (!['type', 'layout', 'imageSide', 'sentencePos', 'imageStyle', 'afterStyle'].includes(key))
    return 'Unknown choice';
  if (
    (key === 'imageSide' && !['left', 'right'].includes(value)) ||
    (key === 'sentencePos' && !['top', 'bottom'].includes(value)) ||
    (key.endsWith('Style') && !STYLES.includes(value))
  )
    return 'Unknown placement';
  x[key] = value;
  return null;
}
export const PLAN_FIELDS = ['outcomes', 'prereqs', 'teaching', 'progression'];
// The top bar's numbered tabs in authoring order: each part of the lesson plan, the workspace, then the preview.
export const TABS = [
  ...PLAN_FIELDS.map((field, planIndex) => ({ view: 'plan', planIndex })),
  { view: 'workspace' },
  { view: 'preview' },
];
export const tabIndex = (s) =>
  TABS.findIndex((t) => t.view === s.view && (t.view !== 'plan' || t.planIndex === s.planIndex));
// Form boxes under the slide: the name first on every layout, then the layout's own fields.
export const formFields = (x) => ['title', ...activeFields(x).filter((f) => f !== 'title')];
const TEACHING_FIELDS = ['purpose', 'notes', 'comments'];
// The text box that currently owns the keyboard, or null when focus is on a control or elsewhere.
export function focusedBox(s) {
  if (s.pane !== 'workbench' || s.modal) return null;
  if (s.view === 'plan') {
    return s.control === 'principle' ? { principle: true, field: PLAN_FIELDS[s.planIndex] } : null;
  }
  const x = slideById(s, s.selected);
  if (s.view !== 'workspace' || !x || x.locked) return null;
  return formFields(x).includes(s.control) || TEACHING_FIELDS.includes(s.control)
    ? { slideId: x.id, field: s.control }
    : null;
}
// What a message is aimed at, from focus alone: the whole lesson when asked for ([whole lesson]) or outside the
// Slides view; else the box being typed in (while the chat has the keyboard, the box it was opened from); else the
// current slide as a whole. Returns null for the whole lesson, { slideId } or { slideId, field }.
export function chatAim(s) {
  const x = slideById(s, s.selected);
  if (s.wholeLesson || s.view !== 'workspace' || !x) return null;
  const from =
      s.pane === 'chat' && s.origin ? { ...s, pane: s.origin.pane, control: s.origin.control, modal: null } : s,
    box = focusedBox(from);
  return box && !box.principle ? box : { slideId: x.id };
}
export const sameBox = (a, b) =>
  Boolean(a && b) && a.field === b.field && Boolean(a.principle) === Boolean(b.principle) && a.slideId === b.slideId;
export const editSource = (s, box) =>
  (box.principle ? s.principles[box.field] : slideById(s, box.slideId)?.[box.field]) ?? '';
export const editRevision = (s, box) =>
  box.principle ? s.revisions['plan:' + box.field] || 0 : revision(s, box.slideId, box.field);
export const editLocked = (s, box) =>
  s.review || (box.principle ? planBusy(s) : isLocked(s, box.slideId) || busy(s, box.slideId, box.field));
// Saves the live edit made in a box. The base revision guards against a change that landed while typing.
export function saveEdit(s, edit, overwrite = false) {
  if (editLocked(s, edit)) return 'Locked - your change was not saved';
  if (edit.base !== editRevision(s, edit) && !overwrite) return 'BASE CHANGED';
  if (!edit.principle) return setField(s, edit.slideId, edit.field, edit.text);
  s.principles[edit.field] = clean(edit.text);
  s.revisions['plan:' + edit.field] = editRevision(s, edit) + 1;
  return null;
}
export function renameOwner(s, id, name) {
  const x = s.slides.find((x) => x.titleFor === id);
  return x ? setField(s, x.id, 'title', name) : 'Group removed';
}
// A new id unused anywhere in the lesson, since a file can already hold ids like the ones made here.
function freshId(s, prefix) {
  let id;
  do id = `${prefix}-${++s.seq}`;
  while (slideById(s, id) || ownerById(s, id));
  return id;
}
function groupOf(s, id) {
  const x = slideById(s, id);
  return x ? x.subId || x.secId : null;
}
// A slide's place among its group's slides. Undo puts it back by this, not by its index in s.slides, which a
// whole-lesson change rebuilds in lesson order while it runs beside the author.
const members = (s, secId, subId) =>
  s.slides.filter((z) => z.secId === secId && (z.subId ?? null) === (subId ?? null));
const groupIndex = (s, x) => members(s, x.secId, x.subId).indexOf(x);
function putBack(s, x, { secId, subId, at }) {
  Object.assign(x, { secId, subId });
  const near = members(s, secId, subId).filter((z) => z !== x),
    next = near[at];
  const to = next ? s.slides.indexOf(next) : near.length ? s.slides.indexOf(near.at(-1)) + 1 : s.slides.length;
  s.slides.splice(to, 0, x);
}
export function createItem(s, kind, parent, name) {
  const why = locked(s, 'creation');
  if (why) return why;
  const sec = s.sections.find((sec) => sec.id === parent || sec.subs.some((sub) => sub.id === parent)) || s.sections[0];
  if (kind !== 'section' && !sec) return 'Create a section first';
  if (kind !== 'section' && parent && !ownerById(s, parent)) return 'Unknown destination';
  const into = kind === 'slide' && parent ? parent : sec?.id;
  if (kind !== 'section' && claimed(s, into)) return claimNote(s, into);
  const id = freshId(s, 'new');
  let group;
  if (kind === 'section') {
    group = { id, title: name, subs: [] };
    s.sections.push(group);
  } else if (kind === 'subsection') {
    group = { id, title: name };
    sec.subs.push(group);
  } else if (kind !== 'slide') return 'Unknown creation';
  const slide = {
    id: freshId(s, 'slide'),
    secId: kind === 'section' ? id : sec.id,
    subId: kind === 'subsection' ? id : kind === 'slide' && sec.id !== parent ? parent : null,
    titleFor: group?.id,
    title: name,
    type: group ? 'Section title' : TYPES[0],
    layout: group ? 'title' : LAYOUTS[0],
    content: '',
    tagline: '',
    imageDesc: '',
    afterDesc: '',
    beforeCap: '',
    afterCap: '',
    notes: '',
    comments: '',
    purpose: '',
    imageSide: 'right',
    sentencePos: 'top',
  };
  s.slides.push(slide);
  remember(s, { kind: 'create', id: group?.id, slideId: slide.id, label: `Create ${kind} "${name || 'untitled'}"` });
  selectSlide(s, slide.id);
  return null;
}
export function moveItem(s, id, delta, destination = null) {
  const why = locked(s, 'moves');
  if (why) return why;
  const x = slideById(s, id),
    o = ownerById(s, id);
  if (x?.titleFor) return 'Linked title stays first; move its owning group instead';
  if (!x && !o) return 'Selection removed';
  const held = lockHold(s, id);
  if (held) return held;
  if (destination && x) {
    const dest = ownerById(s, destination);
    if (!dest) return 'Unknown destination';
    if (groupOf(s, id) === destination) return 'Same group - nothing to change';
    const hold = [id, destination].find((k) => claimed(s, k));
    if (hold) return claimNote(s, hold);
    const sec = s.sections.find((sec) => sec.id === destination || sec.subs.some((sub) => sub.id === destination));
    remember(s, {
      kind: 'transfer',
      id,
      before: { secId: x.secId, subId: x.subId, at: groupIndex(s, x) },
      label: `Move ${ref(s, id)} to ${dest.title}`,
    });
    x.secId = sec.id;
    x.subId = sec.id === destination ? null : destination;
    s.slides.splice(s.slides.indexOf(x), 1);
    s.slides.push(x);
    return null;
  }
  let arr = x
    ? s.slides.filter((z) => groupOf(s, z.id) === groupOf(s, id))
    : s.sections.includes(o)
      ? s.sections
      : s.sections.find((sec) => sec.subs.includes(o)).subs;
  const obj = x || o,
    i = arr.indexOf(obj),
    j = i + delta;
  if (j < 0 || j >= arr.length || arr[j].titleFor) return 'At group boundary - title remains first';
  const other = arr[j],
    hold = [id, other.id].find((k) => claimed(s, k));
  if (hold) return claimNote(s, hold);
  remember(s, { kind: 'swap', id, other: other.id, label: `Move "${obj.title}" ${delta < 0 ? 'up' : 'down'}` });
  const actual = x ? s.slides : arr;
  const a = actual.indexOf(obj),
    b = actual.indexOf(other);
  [actual[a], actual[b]] = [actual[b], actual[a]];
  return null;
}
// Puts an ordinary slide into a group, before one of its slides or at its end. Undo restores the old place.
export function placeSlide(s, id, groupId, beforeId = null) {
  const why = locked(s, 'moves');
  if (why) return why;
  const x = slideById(s, id),
    dest = ownerById(s, groupId);
  if (!x) return 'Selection removed';
  if (x.titleFor) return 'Linked title stays first; move its owning group instead';
  if (!dest) return 'Unknown destination';
  if (x.locked) return lockedNote(s, id);
  const hold = [id, groupId].find((k) => claimed(s, k));
  if (hold) return claimNote(s, hold);
  const sec = s.sections.find((sec) => sec.id === groupId || sec.subs.some((sub) => sub.id === groupId));
  const before = { secId: x.secId, subId: x.subId, index: s.slides.indexOf(x), at: groupIndex(s, x) };
  s.slides.splice(before.index, 1);
  x.secId = sec.id;
  x.subId = sec.id === groupId ? null : groupId;
  const anchor = beforeId && beforeId !== id ? slideById(s, beforeId) : null,
    members = s.slides.filter((z) => groupOf(s, z.id) === groupId);
  const at = anchor ? s.slides.indexOf(anchor) : s.slides.indexOf(members.at(-1)) + 1;
  s.slides.splice(at, 0, x);
  if (x.secId === before.secId && x.subId === before.subId && at === before.index) return 'Same place - nothing moved';
  remember(s, { kind: 'transfer', id, before, label: `Move ${ref(s, id)} to ${dest.title || 'untitled group'}` });
  return null;
}
// Moves a section or subsection, with its title slide and slides, to target's place: a section takes another
// section's place, a subsection another subsection's (in any section), or goes first in a section given its id.
// Taking a later item's place puts it after that item, so a group can reach the end. Undo restores the old order.
export function placeGroup(s, id, targetId) {
  const why = locked(s, 'moves');
  if (why) return why;
  const sec = s.sections.find((x) => x.id === id),
    home = s.sections.find((x) => x.subs.some((sub) => sub.id === id));
  if (!sec && !home) return 'Selection removed';
  const held = lockHold(s, id);
  if (held) return held;
  const hold = [id, targetId].find((k) => claimed(s, k));
  if (hold) return claimNote(s, hold);
  const was = beforeChange(s);
  if (sec) {
    const from = s.sections.indexOf(sec),
      to = s.sections.findIndex((x) => x.id === targetId);
    if (to < 0) return 'A section moves among sections';
    if (to === from) return 'Same place - nothing moved';
    s.sections.splice(from, 1);
    s.sections.splice(to, 0, sec);
    noteChange(s, null, `Move section "${sec.title}"`, was);
    return null;
  }
  const sub = home.subs.find((x) => x.id === id),
    dest = s.sections.find((x) => x.id === targetId || x.subs.some((y) => y.id === targetId));
  if (!dest) return 'Unknown destination';
  const from = home.subs.indexOf(sub),
    to = dest.id === targetId ? 0 : dest.subs.findIndex((y) => y.id === targetId);
  if (dest === home && to === from) return 'Same place - nothing moved';
  home.subs.splice(from, 1);
  dest.subs.splice(to, 0, sub);
  for (const x of s.slides) if (x.subId === id) x.secId = dest.id;
  noteChange(s, null, `Move subsection "${sub.title}"`, was);
  return null;
}
// Deletes an ordinary slide; undo puts it back where it was with its pictures and edit marks.
export function deleteSlide(s, id, cancelSlides = () => {}) {
  const x = slideById(s, id);
  if (!x) return 'Pick a slide to delete';
  const why = locked(s, 'delete');
  if (why) return why;
  if (x.titleFor) return 'A title slide belongs to its group and cannot be deleted alone';
  if (x.locked) return lockedNote(s, id);
  if (busy(s, id)) return `BUSY - an edit agent is working on ${ref(s, id)}`;
  const label = `Delete ${ref(s, id)}`,
    oldIndex = order(s).indexOf(x),
    marks = Object.fromEntries(Object.entries(s.provenance).filter(([k]) => k.startsWith(id + ':')));
  cancelSlides(id);
  remember(s, { kind: 'delete', slide: x, at: groupIndex(s, x), pictures: s.pictures[id], marks, label });
  s.slides.splice(s.slides.indexOf(x), 1);
  delete s.pictures[id];
  for (const k of Object.keys(marks)) delete s.provenance[k];
  if (s.edit?.slideId === id) s.edit = null;
  if (s.selected === id) s.selected = order(s)[Math.min(oldIndex, order(s).length - 1)]?.id;
  return '';
}
// What deleting a group takes with it: a section's subsections, and every slide in them.
export function groupContents(s, id) {
  const sec = s.sections.find((sec) => sec.id === id),
    ids = [id, ...(sec ? sec.subs.map((sub) => sub.id) : [])];
  return s.slides.filter((x) => ids.includes(x.subId) || (sec && x.secId === id));
}
// Deletes a section or subsection with its slides; undo restores the group, its slides, pictures and marks.
export function deleteGroup(s, id, cancelSlides = () => {}) {
  const group = ownerById(s, id);
  if (!group) return 'Pick a section or subsection to delete';
  const why = locked(s, 'delete');
  if (why) return why;
  const sec = s.sections.find((sec) => sec.id === id),
    parent = sec ? null : s.sections.find((p) => p.subs.includes(group));
  if (sec && s.sections.length === 1) return 'A lesson needs at least one section';
  const held = lockHold(s, id);
  if (held) return held;
  const gone = groupContents(s, id);
  if (gone.some((x) => busy(s, x.id))) return `BUSY - an edit agent is working on a slide in "${group.title}"`;
  const oldIndex = order(s).indexOf(slideById(s, s.selected)),
    ids = new Set(gone.map((x) => x.id)),
    marks = Object.fromEntries(Object.entries(s.provenance).filter(([k]) => ids.has(k.split(':')[0])));
  for (const x of gone) cancelSlides(x.id);
  remember(s, {
    kind: 'delete-group',
    group,
    parentId: parent?.id ?? null,
    index: parent ? parent.subs.indexOf(group) : s.sections.indexOf(group),
    slides: gone.map((x) => ({ slide: x, index: s.slides.indexOf(x), pictures: s.pictures[x.id] })),
    marks,
    label: `Delete ${sec ? 'section' : 'subsection'} "${group.title}"`,
  });
  s.slides = s.slides.filter((x) => !ids.has(x.id));
  if (parent) parent.subs.splice(parent.subs.indexOf(group), 1);
  else s.sections.splice(s.sections.indexOf(group), 1);
  for (const x of gone) delete s.pictures[x.id];
  for (const k of Object.keys(marks)) delete s.provenance[k];
  if (ids.has(s.edit?.slideId)) s.edit = null;
  if (ids.has(s.selected)) s.selected = order(s)[Math.min(Math.max(0, oldIndex), order(s).length - 1)]?.id;
  return '';
}
export function undoOutline(s, confirmed = false, cancelSlides = () => {}) {
  const why = locked(s, 'undo');
  if (why) return why;
  const u = s.undo.at(-1);
  if (!u) return 'Nothing to undo';
  const held = undoHold(s, u);
  if (held) return `Cannot undo ${u.label}: ${held}`;
  if (u.kind === 'create') {
    const oldIndex = order(s).findIndex((x) => x.id === s.selected);
    const group = ownerById(s, u.id),
      gone = s.slides.filter((x) => x.id === u.slideId || (group && (x.secId === group.id || x.subId === group.id)));
    if (!confirmed)
      return (
        `CONFIRM: Undo ${u.label}; removes ${gone.length} slides (${gone.map(slideName).join(', ')}), ` +
        'including content, notes and pictures.'
      );
    for (const x of gone) {
      cancelSlides(x.id);
      delete s.pictures[x.id];
      if (s.edit?.slideId === x.id) s.edit = null;
    }
    s.slides = s.slides.filter((x) => !gone.includes(x));
    s.sections = s.sections.filter((sec) => sec.id !== u.id);
    for (const sec of s.sections) sec.subs = sec.subs.filter((sub) => sub.id !== u.id);
    if (!slideById(s, s.selected)) s.selected = order(s)[Math.min(Math.max(0, oldIndex), order(s).length - 1)]?.id;
  } else if (u.kind === 'rename') {
    const x = slideById(s, u.id);
    if (!x) {
      s.undo.pop();
      return 'Renamed slide removed';
    }
    if (busy(s, x.id, 'title')) return 'BUSY - LOCKED linked heading';
    if (x.title !== u.after && !confirmed)
      return `CONFIRM: Newer name "${x.title}" will be overwritten by "${u.before}"`;
    setField(s, u.id, 'title', u.before, { record: false });
  } else if (u.kind === 'swap') {
    const x = slideById(s, u.id),
      o = ownerById(s, u.id),
      arr = x ? s.slides : s.sections.includes(o) ? s.sections : s.sections.find((sec) => sec.subs.includes(o)).subs;
    const a = arr.findIndex((x) => x.id === u.id),
      b = arr.findIndex((x) => x.id === u.other);
    [arr[a], arr[b]] = [arr[b], arr[a]];
  } else if (u.kind === 'delete-group') {
    if (u.parentId) s.sections.find((sec) => sec.id === u.parentId).subs.splice(u.index, 0, u.group);
    else s.sections.splice(u.index, 0, u.group);
    for (const { slide, index, pictures } of u.slides) {
      s.slides.splice(Math.min(index, s.slides.length), 0, slide);
      if (pictures) s.pictures[slide.id] = pictures;
    }
    Object.assign(s.provenance, u.marks);
    s.selected = u.slides.find((x) => x.slide.titleFor === u.group.id)?.slide.id ?? s.selected;
  } else if (u.kind === 'delete') {
    putBack(s, u.slide, { secId: u.slide.secId, subId: u.slide.subId, at: u.at });
    if (u.pictures) s.pictures[u.slide.id] = u.pictures;
    Object.assign(s.provenance, u.marks);
    s.selected = u.slide.id;
  } else if (u.kind === 'lesson') {
    const next = fromDoc(lessonUndo(s, u).doc),
      pictures = { ...s.pictures },
      provenance = { ...s.provenance };
    for (const id of Object.keys(u.was)) {
      if (u.pictures[id]) pictures[id] = u.pictures[id];
      else delete pictures[id];
      for (const key of Object.keys(provenance)) if (key.startsWith(id + ':')) delete provenance[key];
      Object.assign(provenance, u.marks[id]);
      for (const field of Object.keys(FIELD_NAMES)) s.revisions[keyOf(id, field)] = revision(s, id, field) + 1;
    }
    for (const [field, value] of Object.entries(next.principles))
      if (s.principles[field] !== value) s.revisions['plan:' + field] = (s.revisions['plan:' + field] || 0) + 1;
    const { sections, slides, principles } = next;
    Object.assign(s, { sections, slides, principles, pictures, provenance });
    if (!slideById(s, s.selected)) s.selected = order(s)[0]?.id;
  } else if (u.kind === 'picture') {
    if (!slideById(s, u.slideId)) {
      s.undo.pop();
      return 'Slide removed';
    }
    s.pictures[u.slideId] ??= {};
    if (u.before) s.pictures[u.slideId][u.field] = u.before;
    else delete s.pictures[u.slideId][u.field];
  } else if (u.kind === 'transfer') {
    const x = slideById(s, u.id);
    s.slides.splice(s.slides.indexOf(x), 1);
    putBack(s, x, u.before);
  }
  s.undo.pop();
  return null;
}
// Why undoing this entry would change a locked slide, or null. Deletes are fine: a locked slide is never deleted.
// Why undoing this entry would change a locked slide or what a running whole-lesson request claimed, or null.
// Deletes are fine: a locked slide is never deleted.
function undoHold(s, u) {
  const hold = (ids) => {
    const id = ids.find((k) => k && claimed(s, k));
    return id ? claimNote(s, id) : null;
  };
  if (u.kind === 'create') {
    const held = s.slides.find((x) => x.locked && (x.id === u.slideId || x.secId === u.id || x.subId === u.id));
    return held ? lockedNote(s, held.id) : hold([u.slideId, u.id]);
  }
  if (u.kind === 'swap') return lockHold(s, u.id) || hold([u.id, u.other]);
  if (u.kind === 'transfer') return lockHold(s, u.id) || hold([u.id, u.before.subId || u.before.secId]);
  if (u.kind === 'rename') return lockHold(s, u.id);
  if (u.kind === 'delete') return hold([u.slide.subId || u.slide.secId]);
  if (u.kind === 'delete-group') return hold([u.parentId]);
  if (u.kind === 'picture') return isLocked(s, u.slideId) ? lockedNote(s, u.slideId) : hold([u.slideId]);
  if (u.kind === 'lesson') return lessonUndo(s, u).error ?? null;
  return null;
}
// Each list in the outline by the group holding it ('' for the lesson's sections): its title slide, slides and,
// for a section, subsections, by id.
function outlineLists(doc) {
  const lists = new Map([['', doc.sections.map((sec) => sec.id)]]);
  for (const sec of doc.sections) {
    const own = { title: sec.titleSlide.id, slides: sec.slides.map((x) => x.id) };
    lists.set(sec.id, { ...own, subs: sec.subsections.map((sub) => sub.id) });
    for (const sub of sec.subsections)
      lists.set(sub.id, { title: sub.titleSlide.id, slides: sub.slides.map((x) => x.id) });
  }
  return lists;
}
// The author's locks hold against every agent change and undo: a locked slide stays exactly as it is, in its group.
function lockErrors(s, now, then) {
  const before = slidePlaces(now),
    after = slidePlaces(then),
    errors = [];
  for (const [id, { slide, group }] of before)
    if (slide.locked && (after.get(id)?.group !== group || canonical(after.get(id).slide) !== canonical(slide)))
      errors.push(id);
  return errors;
}
// The lesson with one whole-lesson entry undone: what that change changed (each slide, outline list and plan part
// it touched) goes back to how it was, and everything else stays as it is now, so changes made beside it or since
// survive. Refused, as { error }, when any of that was changed again since, is held by a running request or would
// move or change a locked slide.
function lessonUndo(s, u) {
  const doc = toDoc(s),
    places = slidePlaces(doc),
    lists = outlineLists(doc);
  const slide = Object.keys(u.now).find((id) => canonical(places.get(id)?.slide ?? null) !== canonical(u.now[id]));
  if (slide) return { error: `${places.has(slide) ? ref(s, slide) : 'a slide it changed'} changed since` };
  const list = Object.keys(u.lists).find((g) => canonical(lists.get(g) ?? null) !== canonical(u.lists[g].now));
  if (list !== undefined)
    return {
      error: `${!list ? 'the order of sections' : lists.has(list) ? groupName(s, list) : 'a group'} changed since`,
    };
  if (Object.keys(u.plan).some((key) => doc.plan[key] !== u.plan[key].now))
    return { error: 'the lesson plan changed since' };
  const held =
    Object.keys(u.now).find((id) => slideById(s, id) && claimed(s, id)) ??
    Object.keys(u.lists).find((g) => (g ? claimed(s, g) : lessonClaim(s)));
  if (held !== undefined) return { error: held ? claimNote(s, held) : 'a whole-lesson request is running' };
  if (Object.keys(u.plan).length && planBusy(s)) return { error: 'the lesson plan is claimed by a running request' };
  for (const [g, { was }] of Object.entries(u.lists))
    if (was === null) lists.delete(g);
    else lists.set(g, was);
  const take = (id) => (id in u.was ? u.was[id] : places.get(id)?.slide);
  const group = (id) => {
    const { title, slides, subs } = lists.get(id);
    return { id, titleSlide: take(title), slides: slides.map(take), ...(subs ? { subsections: subs.map(group) } : {}) };
  };
  let out;
  try {
    out = { ...doc, plan: { ...doc.plan }, sections: lists.get('').map(group) };
    for (const [key, { was }] of Object.entries(u.plan)) out.plan[key] = was;
    if (validateLesson(out).length) throw Error('invalid');
  } catch {
    return { error: 'the lesson changed too much since to put it back' };
  }
  const locked = lockErrors(s, doc, out)[0];
  return locked ? { error: lockedNote(s, locked) } : { doc: out };
}
// Puts a generated or attached picture in an image box; undo brings back the one before.
export function setPicture(s, slideId, field, picture, { group = null } = {}) {
  if (!slideById(s, slideId)) return 'Slide removed';
  if (isLocked(s, slideId)) return lockedNote(s, slideId);
  const before = s.pictures[slideId]?.[field],
    was = group && beforeChange(s);
  if (!group) remember(s, { kind: 'picture', slideId, field, before, label: `Replace picture on ${ref(s, slideId)}` });
  // A fresh object per slide, so an undo entry made earlier keeps the pictures it had.
  s.pictures[slideId] = { ...s.pictures[slideId] };
  s.pictures[slideId][field] = picture;
  if (group) noteChange(s, group, LESSON_UNDO, was);
  return null;
}
// Replaces the whole lesson with a valid file from the lesson agent. Pictures cannot be invented: each must be one
// the lesson already has, or null. Every box that changed is marked as an AI edit; undo restores the lesson before.
// The image box each style field belongs to, so a changed style marks that box.
export const STYLE_OF = { imageDesc: 'imageStyle', afterDesc: 'afterStyle' };
export const EFFORTS = ['low', 'medium', 'high'];
export const STYLE_NAMES = { generic: 'Generic', xiaohei: 'Xiaohei' };
const LESSON_UNDO = "Undo the lesson agent's change";
// What a whole-lesson change needs to be undone: the lesson file before it, with its pictures and edit marks.
const beforeChange = (s) => ({ doc: toDoc(s), pictures: { ...s.pictures }, provenance: { ...s.provenance } });
// One undo entry for everything one request (group) changes, however many steps and whatever the author changed
// between them: per slide, outline list and plan part it changed, how it was before the request first changed it
// (was) and how the request last left it (now; null when gone). A change without a group is an entry of its own.
function noteChange(s, group, label, from) {
  const found = group && s.undo.find((u) => u.kind === 'lesson' && u.group === group),
    u = found || { kind: 'lesson', group, label, was: {}, now: {}, lists: {}, plan: {}, pictures: {}, marks: {} },
    to = toDoc(s);
  const a = slidePlaces(from.doc),
    b = slidePlaces(to);
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id)?.slide ?? null,
      y = b.get(id)?.slide ?? null;
    if (canonical(x) === canonical(y)) continue;
    if (!(id in u.was)) {
      u.was[id] = x;
      u.pictures[id] = from.pictures[id];
      u.marks[id] = Object.fromEntries(Object.entries(from.provenance).filter(([k]) => k.startsWith(id + ':')));
    }
    u.now[id] = y;
  }
  const la = outlineLists(from.doc),
    lb = outlineLists(to);
  for (const g of new Set([...la.keys(), ...lb.keys()])) {
    const x = la.get(g) ?? null,
      y = lb.get(g) ?? null;
    if (canonical(x) === canonical(y)) continue;
    u.lists[g] ??= { was: x };
    u.lists[g].now = y;
  }
  for (const key of Object.keys(to.plan))
    if (from.doc.plan[key] !== to.plan[key]) {
      u.plan[key] ??= { was: from.doc.plan[key] };
      u.plan[key].now = to.plan[key];
    }
  if (!found) remember(s, u);
}
// Why a whole-lesson request's change reaches outside its claim, as messages for the model: slides it has not
// claimed keep their content, groups it has not claimed keep their slides and subsections, sections it has not
// claimed keep their order, and the plan stays unless claimed. New groups need no claim.
function claimErrors(s, now, then, claim) {
  if (claim.all) return [];
  const errors = [],
    covers = (id) => claimCovers(s, claim, id),
    first = ' - claim it first with claim_slides';
  const a = slidePlaces(now),
    b = slidePlaces(then);
  for (const [id, { slide }] of a) {
    const y = b.get(id)?.slide;
    if (y && canonical(y) !== canonical(slide) && !covers(id))
      errors.push(`${ref(s, id)} (id ${id}) is not claimed${first}`);
  }
  const la = outlineLists(now),
    lb = outlineLists(then);
  for (const [g, list] of la)
    if (g && canonical(lb.get(g) ?? null) !== canonical(list) && !covers(g))
      errors.push(
        `${groupName(s, g)} (id ${g}) is not claimed, so its slides${list.subs ? ' and subsections' : ''} ` +
          `stay as they are${first}`,
      );
  const fixed = (ids) => ids.filter((g) => la.has(g) && !covers(g));
  if (canonical(fixed(la.get(''))) !== canonical(fixed(lb.get(''))))
    errors.push(`Sections you have not claimed keep their places and stay${first}`);
  if (!claim.plan && canonical(now.plan) !== canonical(then.plan))
    errors.push('The lesson plan is not claimed - claim it first with claim_slides {"plan": true}');
  return errors;
}
// claim: a whole-lesson request's claim ({ ids, plan, all }); the change must stay inside it, and the groups it adds
// join it. Every change is applied to the lesson as it is now, so the author's edits beside it stay.
export function applyLesson(s, doc, { group = null, claim = null } = {}) {
  const known = Object.values(s.pictures).flatMap((byField) => Object.values(byField));
  const errors = [],
    next = fromDoc(doc);
  for (const [id, byField] of Object.entries(next.pictures))
    for (const [field, picture] of Object.entries(byField)) {
      // Key order does not matter: update_lesson adds back a saved prompt after the keys the model wrote.
      const same = known.find((p) => canonical(pictureRecord(p)) === canonical(picture));
      if (same) byField[field] = same;
      else errors.push(`Slide ${id}: picture ${picture.file} is not one this lesson has; keep it exactly or set null`);
    }
  // The author's locks hold against every agent change, and only the author locks a slide.
  const from = beforeChange(s),
    now = slidePlaces(from.doc);
  for (const id of lockErrors(s, from.doc, doc))
    errors.push(`${ref(s, id)} (id ${id}) is locked by the author: keep it exactly as it is, in the same group`);
  for (const [id, { slide }] of slidePlaces(doc))
    if (slide.locked && !now.get(id)?.slide.locked)
      errors.push(`${id}: only the author locks slides; leave out "locked"`);
  if (claim) errors.push(...claimErrors(s, from.doc, doc, claim));
  if (errors.length) return errors;
  let changed = 0;
  const mark = (key) => {
    s.revisions[key] = (s.revisions[key] || 0) + 1;
    s.provenance[key] = 'AI EDIT';
    changed++;
  };
  for (const x of next.slides) {
    const old = slideById(s, x.id);
    for (const field of Object.keys(FIELD_NAMES))
      if (
        ((old?.[field] ?? '') !== x[field] && (old || x[field])) ||
        (STYLE_OF[field] && old && old[STYLE_OF[field]] !== x[STYLE_OF[field]])
      )
        mark(keyOf(x.id, field));
  }
  for (const [field, value] of Object.entries(next.principles))
    if (s.principles[field] !== value) {
      s.revisions['plan:' + field] = (s.revisions['plan:' + field] || 0) + 1;
      changed++;
    }
  Object.assign(s, {
    sections: next.sections,
    slides: next.slides,
    principles: next.principles,
    pictures: next.pictures,
  });
  noteChange(s, group, LESSON_UNDO, from);
  if (claim && !claim.all) {
    const had = outlineLists(from.doc);
    for (const g of outlineLists(doc).keys()) if (g && !had.has(g) && !claimCovers(s, claim, g)) claim.ids.push(g);
  }
  if (!slideById(s, s.selected)) s.selected = order(s).find((x) => !x.titleFor)?.id ?? order(s)[0]?.id;
  return { changed };
}
// The outline as the spec lists it: section, its title slide and slides, an add row, then each subsection
// the same way, and a final add-section row.
export function outlineRows(s) {
  const rows = [];
  // A group's linked title slide has no row of its own: the section or subsection row is that slide.
  const slideRow = (x, depth, inSub) => ({ kind: 'slide', id: x.id, depth, inSub });
  const ownerRow = (owner, kind, depth) => ({
    kind,
    id: owner.id,
    title: owner.title || (kind === 'section' ? 'Untitled section' : 'Untitled subsection'),
    depth,
    inSub: kind === 'subsection',
    slideId: s.slides.find((x) => x.titleFor === owner.id)?.id,
  });
  for (const sec of s.sections) {
    rows.push(ownerRow(sec, 'section', 0));
    if (s.collapsed.includes(sec.id)) continue;
    for (const x of s.slides.filter((x) => x.secId === sec.id && !x.subId && !x.titleFor))
      rows.push(slideRow(x, 1, false));
    for (const sub of sec.subs) {
      rows.push(ownerRow(sub, 'subsection', 1));
      if (s.collapsed.includes(sub.id)) continue;
      for (const x of s.slides.filter((x) => x.subId === sub.id && !x.titleFor)) rows.push(slideRow(x, 2, true));
    }
  }
  return rows;
}
// Where the outline's add buttons put new items: beside the current slide.
export function addParents(s) {
  const x = slideById(s, s.selected),
    group = x ? x.subId || x.secId : s.sections.at(-1)?.id;
  return { slide: group, subsection: x?.secId ?? s.sections.at(-1)?.id, name: ownerById(s, group)?.title || '' };
}
// The slide a row opens: its own slide, or a group's linked title slide.
export const rowSlide = (s, row) => (!row ? null : slideById(s, row.kind === 'slide' ? row.id : row.slideId));
// The group a row belongs to, for folding and dropping.
export const rowGroup = (s, row) => (row.kind === 'section' || row.kind === 'subsection' ? row.id : groupOf(s, row.id));
// Row index for an id: a slide's row, a group's row, or for a title slide its group's row.
export const outlineIndex = (rows, id) => {
  const exact = rows.findIndex((row) => row.id === id);
  return exact >= 0 ? exact : rows.findIndex((row) => row.slideId === id);
};
