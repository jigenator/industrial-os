// Runs the chat's AI requests through Pi. A request aimed at a box rewrites that box; one aimed at the whole lesson
// may change anything it claims (claim_slides), and locks the whole lesson while it waits and until its first claim.
// Pictures are generated one box at a time.
import { join, dirname, basename } from 'node:path';
import {
  slideById,
  targetLabel,
  setField,
  revision,
  pending,
  setPicture,
  applyLesson,
  ref,
  fieldName,
  STYLE_OF,
  chatAim,
  order,
  imageFields,
  claimCovers,
  claimed,
  claimNote,
  groupName,
  groupContents,
  lockHold,
  ownerById,
  itemName,
} from './model.mjs';
import * as edits from './edits.mjs';
import { XIAOHEI_SKILL } from './pi.mjs';
import {
  appendChat,
  assetsFolder,
  assetPath,
  canonical,
  formatErrors,
  loadPicture,
  slidePlaces,
  snapshotLesson,
  storePicture,
  toDoc,
  validateLesson,
} from './lesson.mjs';
import { boxPrompt, lessonPrompt, slidePrompt, pictureRequest, aimCheck, modelJson } from './prompts.mjs';

// Jev answers within this, or the message goes as aimed.
const AIM_DEADLINE_MS = 3000;
// imagegen's ChatGPT/Codex subscription publishes no limit on images at once (they count against the plan's usage);
// 8 is what the operator has run side by side there without errors. With LESSON_MAKER_IMAGE_BACKEND=api the OpenAI
// Images API's limits depend on the account's tier and are untested here; a 429 still stops a batch (LIMIT_ERROR).
export const PICTURES_AT_ONCE = 8;
// A failed picture whose message reads like an exhausted limit stops the pictures still waiting.
const LIMIT_ERROR = /\b429\b|rate.?limit|usage.?limit|too many requests/i;
import { readFile, readdir } from 'node:fs/promises';
import { readDocument, listArtifacts } from './documents.mjs';
import { projectRoot } from './start.mjs';

// What a tool call is doing, in words for the chat; args may still be missing while the model writes them.
export function toolAction(s, name, args = {}) {
  const path = (value) => {
    const text = String(value ?? '');
    return text.length > 70 ? '…' + text.slice(-69) : text;
  };
  const count = (ids, one) => `${ids?.length || ''} ${ids?.length === 1 ? one : one + 's'}`.trim();
  const slide = args.id || args.slideId;
  return (
    {
      read: () => `Reading ${path(args.path) || 'a file'}`,
      ls: () => `Listing ${path(args.path) || 'the project folder'}`,
      find: () => `Looking for files named ${path(args.pattern) || '…'}`,
      grep: () => `Searching files for "${path(args.pattern) || '…'}"`,
      read_document: () =>
        `Reading ${path(args.source) || 'a document'}` + (args.offset ? ` from character ${args.offset}` : ''),
      list_artifacts: () => 'Listing your artifacts',
      delete_items: () => `Deleting ${count(args.ids, 'item')}`,
      add_slide: () => 'Adding a slide',
      add_group: () => `Adding a ${args.kind || 'section'}${args.title ? ` "${args.title}"` : ''}`,
      move_items: () => `Moving ${count(args.ids, 'item')}`,
      set_slides: () =>
        args.changes?.length === 1 && slideById(s, args.changes[0].id)
          ? `Editing ${ref(s, args.changes[0].id)}`
          : `Editing ${count(args.changes, 'slide')}`,
      set_plan: () => 'Editing the lesson plan',
      claim_slides: () => 'Claiming the slides it will change',
      update_lesson: () => 'Rewriting the whole lesson',
      picture_prompt: () =>
        `Reading the saved prompt of ${slide && slideById(s, slide) ? ref(s, slide) : 'a slide'}'s ` +
        (args.image === 'afterImage' ? 'after picture' : 'picture'),
      generate_picture: () => `Generating a picture for ${slide && slideById(s, slide) ? ref(s, slide) : 'a slide'}`,
    }[name]?.() || `Using ${name || 'a tool'}`
  );
}
// A whole-lesson request's edit tools refuse everything until it has claimed what it will change.
const CLAIM_FIRST = 'claim the slides and groups you will change with claim_slides first';
// What a whole-lesson request holds, for its chat entry: "Claimed slides 1–51; section "Intro"; the plan".
export function claimText(s, claim) {
  if (claim.all) return 'Claimed the whole lesson';
  const numbers = order(s).flatMap((x, i) => (claim.ids.includes(x.id) ? [i + 1] : [])),
    runs = [];
  for (const n of numbers) {
    const last = runs.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  const parts = [
    ...(numbers.length
      ? [`slide${numbers.length > 1 ? 's' : ''} ${runs.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(', ')}`]
      : []),
    ...claim.ids
      .filter((id) => !slideById(s, id) && ownerById(s, id))
      .map((id) => groupName(s, id).replace(/^./, (c) => c.toLowerCase())),
    ...(claim.plan ? ['the plan'] : []),
  ];
  return parts.length ? `Claimed ${parts.join('; ')}` : '';
}
const PAST = { Read: 'Read', List: 'Listed', Search: 'Searched', Look: 'Looked' };
const READS = new Set(['read', 'ls', 'find', 'grep', 'read_document', 'list_artifacts', 'picture_prompt']);
// The live line for one activity event (see pi.mjs run); null leaves the line as it is.
function activityLine(s, a) {
  if (a.kind === 'thinking') return 'Thinking…';
  if (a.kind === 'tool') return toolAction(s, a.name, a.args) + '…';
  if (a.kind === 'writing')
    return `${toolAction(s, a.name)}: writing it, ${a.count.toLocaleString('en')} characters so far`;
  return null;
}

export function log(s, role, text, stamp = '') {
  const entry = { role, text, stamp };
  s.chat.push(entry);
  if (s.chatAnchor !== null && s.chatAnchor !== undefined) s.chatNew++;
  return entry;
}
// The reply is the box's new text; a model that wraps it in a fence or quotes anyway has that taken off.
export const boxReply = (text) =>
  text
    .trim()
    .replace(/^```[^\n]*\n([\s\S]*?)\n```$/, '$1')
    .replace(/^<<<\n?([\s\S]*?)\n?>>>$/, '$1')
    .trim();
const IMAGE_KEYS = { image: 'imageDesc', afterImage: 'afterDesc' },
  IMAGE_FIELDS = Object.values(IMAGE_KEYS);

// SKILL.md with every reference file after it: what a model needs to write one Xiaohei prompt in a single reply.
async function skillWithReferences(skill) {
  const folder = join(skill.dir, 'references'),
    names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith('.md')).sort();
  const references = await Promise.all(
    names.map(
      async (name) =>
        `<reference file="references/${name}">\n${await readFile(join(folder, name), 'utf8')}\n</reference>`,
    ),
  );
  return [await readFile(skill.file, 'utf8'), ...references].join('\n\n');
}

export function createScheduler(state, { lessonPath = null, onChange = () => {}, now = Date.now } = {}) {
  let sequence = 0,
    disposed = false,
    ai = null,
    lastPaint = 0;
  const controllers = new Map(),
    // Relative paths in requests are read from the lesson's project.
    cwd = lessonPath ? projectRoot(dirname(lessonPath)) : process.cwd();
  // The history beside the lesson file (lesson.mjs): none without a file or for one opened read-only.
  const history = () => Boolean(lessonPath && !state.file?.readOnly);
  // Each chat entry goes into the history once it is final; a failed write leaves the chat as it is, with a notice.
  function keep(entry, scope) {
    if (!history() || entry.kept) return;
    entry.kept = true;
    const { role, text, stamp } = entry;
    try {
      appendChat(lessonPath, { time: new Date(now()).toISOString(), role, scope, stamp, text });
    } catch (error) {
      state.notice = `Chat history not saved (${error.code || error.message})`;
    }
  }
  // A copy of the saved lesson before a request that can change it, or why it could not be made: the request then
  // does not run.
  function snapshot() {
    if (!history()) return null;
    try {
      snapshotLesson(lessonPath, new Date(now()));
      return null;
    } catch (error) {
      return `Not run: the lesson's history copy could not be written (${error.code || error.message}); nothing changed`;
    }
  }
  // Reference reading every request gets beside Pi's read-only file tools: documents and Tatsu artifacts.
  const readingTools = [
    {
      name: 'read_document',
      description:
        'Read an HTML or Markdown document as plain text, a page at a time: a file path, or a Tatsu artifact link ' +
        '(an artifacts.tatsu.systems link) or 12-character id. Use it for HTML, which read shows as raw markup.',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'A file path (absolute, ~/..., or relative to the project) or an artifact.',
          },
          offset: { type: 'number', description: 'Character to start at, from the previous page.' },
        },
        required: ['source'],
      },
      execute: (params) => readDocument(params, cwd),
    },
    {
      name: 'list_artifacts',
      description: "List the user's own Tatsu artifacts, newest first: link, file name, type and upload date.",
      parameters: { type: 'object', properties: { limit: { type: 'number' } } },
      execute: (params) => listArtifacts(params),
    },
  ];
  const paint = () => {
    // Streaming text arrives many times a second; the screen keeps up ten times a second.
    if (now() - lastPaint < 100) return;
    lastPaint = now();
    onChange();
  };
  function trim() {
    state.jobs = state.jobs.filter((job) => pending(job) || job.id > sequence - 100);
  }
  // A whole-lesson request runs alone until it claims what it changes; then requests on other slides run beside it.
  // Whole-lesson requests run one at a time; a whole-slide request holds every box of its slide; box requests run
  // side by side, one at a time per box. Requests that clash run in the order they were sent.
  const holds = (lesson, other) =>
    other.kind === 'lesson' ||
    lesson.status !== 'working' ||
    !lesson.claim ||
    claimCovers(state, lesson.claim, other.slideId);
  const clash = (a, b) =>
    a.kind === 'lesson'
      ? holds(a, b)
      : b.kind === 'lesson'
        ? holds(b, a)
        : a.slideId === b.slideId && (!a.field || !b.field || a.field === b.field);
  function pump() {
    if (disposed || state.review || !ai) return;
    let pictures = state.jobs.filter((j) => j.kind === 'picture' && j.status === 'working').length;
    for (const job of state.jobs) {
      if (job.status !== 'queued') continue;
      if (job.kind === 'picture' && pictures >= PICTURES_AT_ONCE) continue;
      const ahead = state.jobs.slice(0, state.jobs.indexOf(job));
      const free =
        !state.jobs.some((j) => j.status === 'working' && clash(j, job)) &&
        !ahead.some((j) => pending(j) && clash(j, job));
      if (free) {
        start(job);
        if (job.kind === 'picture') pictures++;
      }
    }
  }
  function start(job) {
    job.status = 'working';
    if (job.ask) job.ask.queued = false;
    // Messages sent to the whole lesson while it was busy are one brief: they run together as one request.
    if (job.kind === 'lesson') {
      const later = state.jobs.slice(state.jobs.indexOf(job) + 1).filter((j) => j.status === 'queued');
      const merged = later.slice(0, (later.findIndex((j) => j.kind !== 'lesson') + 1 || later.length + 1) - 1);
      for (const j of merged) {
        j.status = 'merged';
        if (j.ask) j.ask.queued = false;
      }
      if (merged.length) job.text = [job.text, ...merged.map((j) => j.text)].join('\n\n');
    }
    const control = new AbortController();
    controllers.set(job.id, control);
    const run =
      job.kind === 'lesson' || job.kind === 'slide' ? runLesson : job.kind === 'picture' ? runPicture : runBox;
    // A batch picture was covered by the copy made when its batch started.
    const unsafe = job.batch ? null : snapshot();
    if (unsafe) job.live = log(state, 'Edit agent', '', job.stamp);
    (unsafe ? Promise.reject(Error(unsafe)) : run(job, control.signal))
      .then((message) => finish(job, 'done', message))
      .catch((error) => finish(job, control.signal.aborted ? 'stopped' : 'failed', error.message));
  }
  function finish(job, status, message) {
    controllers.delete(job.id);
    if (disposed || job.status !== 'working') return;
    job.status = status;
    if (job.live) {
      job.live.live = false;
      job.live.text = status === 'done' ? message : `${status === 'stopped' ? 'Stopped' : 'Failed'}: ${message}`;
      job.live.role =
        status !== 'done'
          ? 'Edit agent'
          : job.kind === 'lesson'
            ? 'Lesson AI'
            : job.kind === 'slide'
              ? 'Slide AI'
              : 'Edit agent';
      // A picture's start notice says the box is locked until it arrives, so its end replaces that notice.
      if (job.kind === 'picture') state.notice = job.live.text;
      keep(job.live, job.kind);
    }
    if (job.batch) batchDone(job, status, message);
    pump();
    trim();
    onChange();
  }
  // Each live request shows one transcript entry that streams the model's text, then says how it ended.
  // Until text streams, it says what the model is doing (thinking, reading a file).
  function liveEntry(job, role, text) {
    job.live = log(state, role, text, job.stamp);
    job.live.live = true;
    let streaming = false;
    const onText = (streamed) => {
      streaming = true;
      job.live.text = streamed.length > 600 ? '…' + streamed.slice(-600) : streamed;
      paint();
    };
    onText.activity = (a) => {
      const line = !streaming && activityLine(state, a);
      if (!line) return;
      job.live.text = line;
      paint();
    };
    return onText;
  }

  async function runBox(job, signal) {
    const onText = liveEntry(job, 'Edit agent', 'Working…');
    // Taken when the request starts, so a request queued behind another works on that one's result.
    const from = revision(state, job.slideId, job.field);
    const { text } = await ask({
      prompt: boxPrompt(state, job, cwd),
      tools: readingTools,
      reading: true,
      signal,
      onText,
      onActivity: onText.activity,
    });
    const slide = slideById(state, job.slideId);
    if (!slide) throw Error('slide removed; nothing applied');
    if (revision(state, slide.id, job.field) !== from) throw Error('the box changed meanwhile; nothing applied');
    const value = boxReply(text);
    if (!value) throw Error('the model returned no text; nothing applied');
    const error = setField(state, slide.id, job.field, value, { agent: true });
    if (error && error !== 'Nothing to change') throw Error(error);
    const said = error ? 'no change was needed' : `${fieldName(slide, job.field)} rewritten`;
    if (!IMAGE_FIELDS.includes(job.field)) return `Done: ${said}.`;
    // An image box request ends with its picture, made from the new concept in the same request.
    if (!state.ai.imagegen) return `Done: ${said}; Pi has no imagegen extension, so no picture was made.`;
    const xiaohei = slide[STYLE_OF[job.field]] === 'xiaohei';
    const next = xiaohei ? 'writing a Xiaohei prompt, then generating' : 'generating';
    job.live.text = `${said[0].toUpperCase() + said.slice(1)}; ${next} the picture… this takes a while.`;
    onChange();
    await makePicture(slide.id, job.field, signal);
    return `Done: ${said}, and a new picture generated.`;
  }

  // A whole-lesson request edits through tools; a whole-slide request runs the same way with only set_slide on its
  // slide and generate_picture for it. Each tool changes a copy of the lesson file, which must pass the
  // schema before it is applied; every change in one request is one undo.
  async function runLesson(job, signal) {
    const notes = [],
      consulted = [],
      // The lesson as the model was given it, so a claim can show what the author changed since.
      given = toDoc(state),
      givenSlides = slidePlaces(given);
    let streamed = '',
      now = '';
    const slideOnly = job.kind === 'slide',
      entry = log(state, slideOnly ? 'Slide AI' : 'Lesson AI', 'Working…', job.stamp);
    Object.assign(job, { live: entry });
    entry.live = true;
    const show = () => {
      const tail = streamed.length > 600 ? '…' + streamed.slice(-600) : streamed;
      entry.text =
        [...consulted, claimLine(), ...notes, now ? '▸ ' + now : '', tail].filter(Boolean).join('\n') || 'Working…';
      paint();
    };
    const claimLine = () => (job.claim ? '· ' + claimText(state, job.claim) : '');
    const covered = () => new Set(order(state).filter((x) => claimCovers(state, job.claim, x.id)).map((x) => x.id));
    // Takes what the request asks for, item by item: refused when the author locked it, another request is on it or
    // the author is typing in it. Nothing is given back before the request ends.
    function claim(ids, plan, all) {
      const mine = job.claim ?? { ids: [], plan: false, all: false },
        had = covered(),
        hadPlan = mine.plan || mine.all,
        others = state.jobs.filter((j) => j !== job && pending(j) && j.slideId),
        edit = state.edit,
        took = [],
        refused = [];
      if (all) {
        if (job.claim) refused.push('all: only as your first claim, since the author may have changed slides since');
        else if (others.length) refused.push(`all: ${targetLabel(state, others[0])} has another request on it`);
        else if (edit)
          refused.push(`all: the author is editing ${edit.principle ? 'the plan' : ref(state, edit.slideId)}`);
        else {
          mine.all = true;
          took.push('all');
        }
      }
      for (const id of ids) {
        const slide = slideById(state, id);
        if (!slide && !ownerById(state, id)) {
          refused.push(`${id}: no slide, subsection or section has this id`);
          continue;
        }
        const inside = new Set((slide ? [slide] : groupContents(state, id)).map((x) => x.id)),
          other = others.find((j) => inside.has(j.slideId));
        const why = slide?.locked
          ? 'locked by the author'
          : !slide && lockHold(state, id)
            ? `it holds a slide locked by the author (${lockHold(state, id).replace(/ is locked.*/, '')})`
            : other
              ? `${targetLabel(state, other)} has another request on it`
              : edit && !edit.principle && inside.has(edit.slideId)
                ? `the author is editing ${ref(state, edit.slideId)}`
                : null;
        if (why) refused.push(`${id} (${itemName(state, id)}): ${why}`);
        else {
          if (!mine.ids.includes(id)) mine.ids.push(id);
          took.push(id);
        }
      }
      if (plan && !mine.all) {
        if (edit?.principle) refused.push('plan: the author is editing it');
        else {
          mine.plan = true;
          took.push('plan');
        }
      }
      if (took.length) job.claim = mine;
      if (!took.length && !refused.length) return 'Nothing claimed: give ids, plan or all.';
      // Slides the author changed after the lesson was given to you: their current JSON, to work from.
      const now = slidePlaces(toDoc(state)),
        fresh = [...covered()].filter(
          (id) => !had.has(id) && canonical(now.get(id)?.slide) !== canonical(givenSlides.get(id)?.slide),
        ),
        plainPlan = toDoc(state).plan;
      return [
        job.claim ? `${claimText(state, job.claim)}.` : 'Nothing claimed yet: until you claim, nothing can change.',
        ...(refused.length
          ? ['Refused (leave these as they are and work around them):', ...refused.map((r) => `- ${r}`)]
          : []),
        ...(fresh.length
          ? [
              'Changed by the author since the lesson you were given; work from this:',
              ...fresh.map((id) => modelJson(now.get(id).slide)),
            ]
          : []),
        ...(!hadPlan && job.claim?.plan && canonical(plainPlan) !== canonical(given.plan)
          ? ['The plan as it is now:', modelJson(plainPlan)]
          : []),
      ].join('\n');
    }
    const commit = (doc, done) => {
      const errors = validateLesson(doc);
      if (errors.length) return 'Not applied. Fix these and try again:\n' + formatErrors(errors).join('\n');
      const result = applyLesson(state, doc, { group: job.id, claim: slideOnly ? null : job.claim });
      if (Array.isArray(result)) return 'Not applied:\n' + result.join('\n');
      notes.push('· ' + done);
      now = '';
      show();
      onChange();
      return `Done: ${done}.`;
    };
    const ID = { type: 'string', description: 'An id from the lesson JSON.' };
    const FIELDS = {
      type: 'object',
      description: 'Only the fields to change, named and shaped as in the lesson JSON Schema.',
    };
    const tool = (name, description, properties, required, edit) => ({
      name,
      description,
      parameters: { type: 'object', properties, required },
      async execute(params) {
        if (signal.aborted) throw Error('Stopped');
        // Every change starts from the lesson as it is now, so the author's edits beside the request stay.
        const doc = toDoc(state);
        let result;
        try {
          if (!slideOnly && !job.claim) throw Error(CLAIM_FIRST);
          if (name === 'update_lesson' && !job.claim.all)
            throw Error(
              'update_lesson replaces the whole lesson, so it needs claim_slides {"all": true} as your first claim; ' +
                'use the small tools for what you claimed',
            );
          result = commit(doc, edit(doc, params));
        } catch (error) {
          result = `Not applied: ${error.message}`;
        }
        // A refused change shows on the live line while the model retries; only applied changes are listed.
        if (result.startsWith('Not applied')) {
          now = `${toolAction(state, name, params)}: refused by the lesson's rules, the AI is fixing it`;
          show();
        }
        return result;
      },
    });
    const tools = [
      tool(
        'delete_items',
        'Delete slides, subsections or sections; a group goes with its title slide and slides. Title slides are ' +
          'deleted only with their group.',
        { ids: { type: 'array', items: ID, description: 'Ids of the slides, subsections or sections.' } },
        ['ids'],
        edits.deleteItems,
      ),
      tool(
        'add_slide',
        "Add a slide to a section's own slides or to a subsection, before beforeId or at the end. Fields not " +
          'given start blank. Returns the new id.',
        { groupId: ID, beforeId: ID, fields: FIELDS },
        ['groupId'],
        edits.addSlide,
      ),
      tool(
        'add_group',
        'Add a section (to the lesson) or a subsection (to parentId, a section) with its title slide, before ' +
          'beforeId or at the end. Returns the new ids.',
        { kind: { enum: ['section', 'subsection'] }, title: { type: 'string' }, parentId: ID, beforeId: ID },
        ['kind', 'title'],
        edits.addGroup,
      ),
      tool(
        'move_items',
        'Move slides into a section or subsection (groupId), subsections into a section (groupId), or sections ' +
          'within the lesson (no groupId); placed in the given order before beforeId, or at the end.',
        { ids: { type: 'array', items: ID }, groupId: ID, beforeId: ID },
        ['ids'],
        edits.moveItems,
      ),
      tool(
        'set_slides',
        'Change fields of slides or title slides: put every slide you change in one call, e.g. {"changes": [{"id": ' +
          '"S-1", "fields": {"title": "…"}}, {"id": "S-2", "fields": {"image": {"concept": "…", "style": ' +
          '"xiaohei"}}}]}. All apply together or none do. An image picture can only be set to null.',
        {
          changes: {
            type: 'array',
            items: { type: 'object', properties: { id: ID, fields: FIELDS }, required: ['id', 'fields'] },
          },
        },
        ['changes'],
        edits.setSlides,
      ),
      tool(
        'set_slide',
        'Change fields of this slide, every field you change in one call, e.g. {"fields": {"title": "…", "image": ' +
          '{"concept": "…"}}}. An image picture can only be set to null.',
        { fields: FIELDS },
        ['fields'],
        (doc, { fields }) => edits.setSlide(doc, { id: job.slideId, fields }),
      ),
      tool(
        'set_plan',
        'Change parts of the lesson plan: outcomes, prerequisites, teachingPrinciples, progression.',
        { fields: FIELDS },
        ['fields'],
        edits.setPlan,
      ),
      tool(
        'update_lesson',
        'Replace the whole lesson with a complete new version that follows the lesson JSON Schema. Slow: use it ' +
          'only to rewrite most of the lesson.',
        { lesson: { type: 'object', description: 'The complete new lesson.' } },
        ['lesson'],
        edits.updateLesson,
      ),
      {
        name: 'claim_slides',
        description:
          'Claim what you will change before changing it: slides, subsections or sections by id (a group claim ' +
          'holds its title slide, slides and subsections), the plan, or all of the lesson. Claims add up; call ' +
          'again to claim more. Returns what was claimed and what was refused, and why.',
        parameters: {
          type: 'object',
          properties: {
            ids: { type: 'array', items: ID, description: 'Ids of the slides, subsections or sections.' },
            plan: { type: 'boolean', description: 'Claim the lesson plan, for set_plan.' },
            all: {
              type: 'boolean',
              description: 'Claim the whole lesson, for update_lesson; only as your first claim.',
            },
          },
        },
        async execute({ ids = [], plan = false, all = false }) {
          if (signal.aborted) throw Error('Stopped');
          const result = claim(Array.isArray(ids) ? ids : [ids], plan === true, all === true);
          if (job.claim) pump();
          show();
          onChange();
          return result;
        },
      },
      {
        name: 'picture_prompt',
        description:
          "Read the prompt and model a slide's generated picture was made from; the lesson JSON leaves prompts out.",
        parameters: {
          type: 'object',
          properties: {
            slideId: ID,
            image: { enum: ['image', 'afterImage'], description: 'Which image of the slide.' },
          },
          required: ['slideId', 'image'],
        },
        async execute({ slideId, image }) {
          const field = IMAGE_KEYS[image];
          if (!slideById(state, slideId) || !field) return 'No such slide or image';
          const p = state.pictures[slideId]?.[field],
            which = image === 'afterImage' ? 'after picture' : 'picture';
          if (!p) return `${ref(state, slideId)} has no ${which}`;
          if (p.source !== 'generated') return `${ref(state, slideId)}'s ${which} is an attached file: it has no prompt`;
          return `Model: ${p.model}\nPrompt:\n${p.prompt}`;
        },
      },
      {
        name: 'generate_picture',
        description:
          "Generate a new picture for a slide's image, replacing any picture it has. Without a prompt, one is " +
          "built from the image's concept and style.",
        parameters: {
          type: 'object',
          properties: {
            slideId: ID,
            image: { enum: ['image', 'afterImage'], description: 'Which image of the slide.' },
            prompt: { type: 'string', description: 'Your own complete prompt for the image tool, used as is.' },
          },
          required: ['slideId', 'image'],
        },
        async execute({ slideId, image, prompt }) {
          const field = IMAGE_KEYS[image];
          if (!slideById(state, slideId) || !field) return 'Not made: no such slide or image';
          if (slideById(state, slideId).locked) return `Not made: ${ref(state, slideId)} is locked by the author`;
          if (slideOnly && slideId !== job.slideId)
            return `Not made: this request may only change ${ref(state, job.slideId)}`;
          if (!slideOnly && !claimCovers(state, job.claim, slideId))
            return `Not made: ${ref(state, slideId)} is not claimed - claim it first with claim_slides`;
          await makePicture(slideId, field, signal, { prompt, group: job.id });
          notes.push(`· Generated a picture for ${ref(state, slideId)}`);
          show();
          onChange();
          return `Generated the picture for ${ref(state, slideId)}.`;
        },
      },
      ...readingTools,
    ];
    const skill = ai.xiaohei ? { file: ai.xiaohei.file, text: await readFile(ai.xiaohei.file, 'utf8') } : null;
    const { text } = await ask({
      prompt: slideOnly ? slidePrompt(state, job, skill, cwd) : lessonPrompt(state, job, skill, cwd),
      tools: tools.filter((t) =>
        slideOnly
          ? ['set_slide', 'generate_picture', 'picture_prompt'].includes(t.name) || readingTools.includes(t)
          : t.name !== 'set_slide',
      ),
      reading: true,
      signal,
      onText: (value) => {
        streamed = value;
        show();
      },
      onActivity: (a) => {
        // Files and artifacts it consulted stay listed, apart from its changes.
        if (a.kind === 'tool-done' && READS.has(a.name))
          consulted.push(
            `· ${toolAction(state, a.name, a.args).replace(/^(Read|List|Search|Look)ing/, (_, verb) => PAST[verb])}` +
              (a.error ? ' (failed)' : ''),
          );
        const line = a.kind === 'tool-done' ? '' : activityLine(state, a);
        if (line === null) return;
        now = line;
        show();
      },
    });
    // What it read is listed apart from what it changed: only changes can be undone.
    const changes = notes.length ? `\n${notes.join('\n')}\n[u in the outline undoes all of these]` : '';
    return [text.trim() || 'Done.', ...consulted, claimLine()].filter(Boolean).join('\n') + changes;
  }

  async function runPicture(job, signal) {
    // A batch picture reports in the batch's one entry, not an entry of its own.
    if (job.batch) {
      showBatch();
      await makePicture(job.slideId, job.field, signal);
      return 'done';
    }
    const xiaohei = slideById(state, job.slideId)?.[STYLE_OF[job.field]] === 'xiaohei';
    liveEntry(
      job,
      'Edit agent',
      xiaohei
        ? 'Writing a Xiaohei prompt, then generating… this takes a while.'
        : 'Generating a picture… this takes a while.',
    );
    await makePicture(job.slideId, job.field, signal);
    return `Done: picture generated for ${targetLabel(state, job)}.`;
  }
  // A Xiaohei picture's prompt, written by the chat model following the skill and its references.
  // Every model request runs at the chosen model and effort; its context use is kept for the status row.
  async function ask(request) {
    const reply = await ai.run({ model: state.ai.model, effort: state.ai.effort, ...request });
    if (reply.context?.percent != null) state.ai.context = { ...reply.context, model: state.ai.model };
    return reply;
  }
  // The chat model writes each picture's prompt from the whole lesson, so pictures fit the deck.
  async function writePicturePrompt(slideId, field, xiaohei, signal) {
    if (xiaohei && !ai.xiaohei) throw Error(`Pi does not have the ${XIAOHEI_SKILL} skill installed`);
    const skill = xiaohei ? await skillWithReferences(ai.xiaohei) : null;
    const { text } = await ask({
      prompt: pictureRequest(state, slideId, field, skill),
      signal,
    });
    const prompt = boxReply(text);
    if (!prompt) throw Error('the model wrote no prompt; nothing generated');
    return prompt;
  }
  // Generates into the lesson's picture folder with imagegen's default model, recording the prompt and model.
  async function makePicture(slideId, field, signal, { prompt: given = '', group = null } = {}) {
    if (!lessonPath) throw Error('the lesson has no file to keep pictures beside');
    const slide = slideById(state, slideId);
    if (!slide[field].trim() && !given?.trim()) throw Error('write the image concept first');
    // A prompt given by a request's own model (which saw the lesson) is used as it is.
    const prompt =
        given?.trim() || (await writePicturePrompt(slideId, field, slide[STYLE_OF[field]] === 'xiaohei', signal)),
      folder = join(dirname(lessonPath), assetsFolder(lessonPath)),
      outputPath = join(folder, `${slideId}-${field === 'afterDesc' ? 'after' : 'image'}-${now().toString(36)}.png`);
    const made = await ai.generateImage({ prompt, outputPath, signal, effort: state.ai.effort });
    let file = assetPath(lessonPath, made.file);
    // imagegen normally saves where asked; anything else is copied in, so the lesson's paths stay inside its folder.
    if (file.startsWith('..') || file.includes('/../'))
      file = await storePicture(lessonPath, await readFile(made.file), basename(outputPath, '.png'));
    const picture = await loadPicture(lessonPath, {
      source: 'generated',
      file,
      prompt: made.prompt || prompt,
      model: made.model,
    });
    if (signal?.aborted) throw Error('Stopped');
    const error = setPicture(state, slideId, field, picture, { group });
    if (error) throw Error(error);
  }

  // Every image concept in the lesson with no picture yet, on slides that are unlocked and not busy.
  function missingPictures() {
    return order(state).flatMap((x) =>
      x.locked
        ? []
        : imageFields(x)
            .filter(
              (field) =>
                x[field].trim() &&
                !state.pictures[x.id]?.[field] &&
                !state.jobs.some((j) => pending(j) && j.slideId === x.id && (!j.field || j.field === field)),
            )
            .map((field) => ({ slideId: x.id, field })),
    );
  }
  // One press: every missing picture, PICTURES_AT_ONCE at a time, reported in one chat entry.
  let batch = null;
  function generateMissing() {
    if (state.review) return 'Review-only: generation disabled';
    const why = notReady();
    if (why) return why;
    if (!state.ai.imagegen) return 'Pi has no imagegen extension installed';
    const missing = missingPictures();
    if (!missing.length) return 'Every image concept already has a picture';
    // One copy of the lesson for the whole batch: each picture that lands changes the file again.
    const unsafe = snapshot();
    if (unsafe) {
      keep(log(state, 'Edit agent', `Failed: ${unsafe}`, 'Whole lesson'), 'picture');
      return unsafe;
    }
    if (batch?.entry.live) batch.total += missing.length;
    else {
      batch = {
        entry: log(state, 'Edit agent', '', 'Whole lesson'),
        total: missing.length,
        done: 0,
        failed: [],
        held: 0,
      };
      batch.entry.live = true;
    }
    for (const box of missing) add({ kind: 'picture', ...box, batch: true });
    pump();
    showBatch();
    return `Generating ${missing.length} picture${missing.length === 1 ? '' : 's'}, ${PICTURES_AT_ONCE} at a time`;
  }
  function showBatch() {
    if (!batch) return;
    const jobs = state.jobs.filter((j) => j.batch && pending(j)),
      working = jobs.filter((j) => j.status === 'working').length,
      failed = batch.failed.length;
    const counts = `${batch.done} done${failed ? `, ${failed} failed` : ''}`;
    batch.entry.text = jobs.length
      ? `Generating ${batch.total} missing pictures, ${PICTURES_AT_ONCE} at a time: ${counts}, ${working} working, ` +
        `${jobs.length - working} waiting.`
      : [
          `Pictures: ${batch.done} of ${batch.total} generated${failed ? `, ${failed} failed` : ''}.`,
          ...batch.failed.slice(0, 10).map((line) => `· ${line}`),
          ...(failed > 10 ? [`· and ${failed - 10} more`] : []),
          ...(batch.held ? [`${batch.held} not started after the image limit; g generates them later.`] : []),
        ].join('\n');
    batch.entry.live = jobs.length > 0;
    if (!jobs.length) {
      state.notice = batch.entry.text.split('\n')[0];
      keep(batch.entry, 'picture');
    }
  }
  function batchDone(job, status, message) {
    if (status === 'done') batch.done++;
    else batch.failed.push(`${targetLabel(state, job)}: ${status === 'stopped' ? 'stopped' : message}`);
    // An exhausted limit fails every picture after it, so the waiting ones are not started.
    if (status === 'failed' && LIMIT_ERROR.test(message)) {
      const waiting = state.jobs.filter((j) => j.batch && j.status === 'queued');
      for (const j of waiting) j.status = 'stopped';
      batch.held += waiting.length;
    }
    showBatch();
  }

  function add(fields) {
    const job = { id: ++sequence, status: 'queued', ...fields };
    job.stamp = job.kind === 'lesson' ? 'Whole lesson' : targetLabel(state, job);
    state.jobs.push(job);
    return job;
  }
  const notReady = () =>
    state.ai.status === 'ready'
      ? null
      : state.ai.status === 'error'
        ? `AI unavailable: ${state.ai.message}`
        : 'AI is still connecting to Pi - try again in a moment';
  // Why a message cannot be sent to a target now, or null; an empty message has no reason, and is not sent.
  function refusal(text, target) {
    if (disposed || !text.trim()) return '';
    if (text.trim().length > 4000) return 'Message exceeds 4000 characters; draft retained';
    if (state.review) return 'Review-only: no AI requests; draft retained';
    const why = notReady();
    if (why) return why + '; draft retained';
    if (target && slideById(state, target.slideId).locked)
      return `${ref(state, target.slideId)} is locked - l in the outline unlocks it; draft retained`;
    return null;
  }
  // The scopes a message aimed at target could go to instead, keyed by scope, or null when there is no other.
  function aimChoices(target) {
    if (target?.field) return { box: target, slide: { slideId: target.slideId }, lesson: null };
    if (target) return { slide: target, lesson: null };
    const x = slideById(state, state.selected);
    return state.wholeLesson && state.view === 'workspace' && x ? { lesson: null, slide: { slideId: x.id } } : null;
  }
  const scopeOf = (target) => (!target ? 'lesson' : target.field ? 'box' : 'slide');
  // Asks Jev whether the message needs another scope: { target, label, probability }, or null when the aim fits, Jev
  // is unsure or missing, or the check fails (the message then goes as aimed, with a notice).
  async function suggestAim(text, target) {
    const choices = aimChoices(target);
    if (!choices || !ai?.judge) return null;
    try {
      const { answers } = await ai.judge({
        ...aimCheck(state, text, target, Object.keys(choices)),
        signal: AbortSignal.timeout(AIM_DEADLINE_MS),
      });
      // Jev's top pick, or the whole lesson when it reads the message as reaching beyond this slide; a wrong ask
      // costs the author one key, a wrong send a whole request.
      let { choice } = answers.scope,
        probability = answers.scope.probabilities?.[choice];
      if (choice !== 'lesson' && 'lesson' in choices && answers.beyond?.noul >= 0.5)
        [choice, probability] = ['lesson', answers.beyond.noul];
      if (choice === scopeOf(target) || !(choice in choices) || typeof probability !== 'number') return null;
      return { scope: choice, target: choices[choice], probability };
    } catch (error) {
      state.notice = `Aim check unavailable (${error.message}); sent as aimed`;
      return null;
    }
  }
  // Aimed at the focused box, else the current slide, else (asked for) the whole lesson; or where the aim check
  // sent it.
  function send(text, target = chatAim(state)) {
    const why = refusal(text, target);
    if (why !== null) {
      if (why) state.notice = why;
      return false;
    }
    text = text.trim();
    const ask = log(state, 'You', text, targetLabel(state, target)),
      job = add(
        !target ? { kind: 'lesson', text, ask } : { kind: target.field ? 'box' : 'slide', ...target, text, ask },
      );
    keep(ask, job.kind);
    pump();
    // A request that has to wait says so under the message until it starts.
    if (job.status === 'queued') ask.queued = true;
    trim();
    return true;
  }
  // The [generate] button: one picture for one image box.
  function generate(slideId, field) {
    if (state.review) return 'Review-only: generation disabled';
    const why = notReady();
    if (why) return why;
    if (!state.ai.imagegen) return 'Pi has no imagegen extension installed';
    if (!IMAGE_FIELDS.includes(field)) return 'Not an image box';
    if (claimed(state, slideId)) return claimNote(state, slideId);
    if (!slideById(state, slideId)?.[field]?.trim()) return 'Write the image concept first';
    if (state.jobs.some((j) => pending(j) && j.slideId === slideId && (!j.field || j.field === field)))
      return 'This box is already busy';
    add({ kind: 'picture', slideId, field });
    pump();
    return null;
  }
  function cancel(reason = 'Stopped', slideId = null) {
    for (const job of state.jobs) {
      if (!pending(job) || (slideId && job.slideId !== slideId)) continue;
      controllers.get(job.id)?.abort();
      controllers.delete(job.id);
      job.status = 'stopped';
      if (job.ask) job.ask.queued = false;
      if (job.live) keep(Object.assign(job.live, { live: false, text: reason }), job.kind);
      else if (job.batch) batch.failed.push(`${targetLabel(state, job)}: ${reason}`);
      else keep(log(state, 'Edit agent', reason, job.stamp), job.kind);
    }
    showBatch();
    trim();
  }
  return {
    send,
    refusal,
    missingPictures,
    generateMissing,
    picturesAtOnce: PICTURES_AT_ONCE,
    suggestAim,
    // Whether a message aimed at target waits for the aim check before it is sent.
    checksAim: (target) => Boolean(ai?.judge && aimChoices(target)),
    generate,
    cancel,
    // Hands over the Pi bridge once it has connected; queued requests start then.
    connect(bridge) {
      ai = bridge;
      pump();
    },
    setReview(value) {
      state.review = value;
      if (value) cancel('Stopped by review-only; nothing further applied');
      else pump();
      onChange();
    },
    dispose() {
      cancel('Stopped: session ended');
      disposed = true;
    },
    get running() {
      return controllers.size;
    },
  };
}
