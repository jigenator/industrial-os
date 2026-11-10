import { VOICES } from './speech.mjs';
import { TYPES, LAYOUTS } from './seed.mjs';
import { columnWidth } from './geometry.mjs';
import {
  slideById,
  ownerById,
  order,
  formFields,
  focusedBox,
  sameBox,
  editSource,
  editRevision,
  editLocked,
  saveEdit,
  selectSlide,
  focusField,
  TABS,
  tabIndex,
  PLAN_FIELDS,
  setChoice,
  STYLE_OF,
  STYLE_NAMES,
  EFFORTS,
  busy,
  outlineRows,
  outlineIndex,
  renameOwner,
  createItem,
  moveItem,
  undoOutline,
  deleteSlide,
  deleteGroup,
  groupContents,
  placeSlide,
  placeGroup,
  setPicture,
  pending,
  lessonBusy,
  claimed,
  claimNote,
  rowSlide,
  rowGroup,
  ref,
  fieldName,
  slideName,
  FIELD_NAMES,
  imageSided,
  setLocks,
  lockedNote,
  chatAim,
  oneLine,
  targetLabel,
} from './model.mjs';
import { editText, inputText, untypeable, graphemes, caretAt } from './text.mjs';
import { chatRows, pairOf, BOX_LIMITS, BOX_PAIRS } from './render.mjs';
import { admitPng } from './png.mjs';
import { storePicture, formatErrors, STYLES } from './lesson.mjs';
import { pictureInfo } from './prompts.mjs';
// Tab follows the fixed form: slide fields, layout, teaching plan, images with their buttons, notes, header.
// Fields the layout does not use are skipped.
const controls = (s) => {
  const x = slideById(s, s.selected);
  // A locked slide takes no focus: Tab only reaches the header.
  if (x?.locked) return ['view', 'review'];
  const used = x ? formFields(x) : [],
    image = (f) => (used.includes(f) ? [f, 'style:' + f, 'generate:' + f, 'prompt:' + f, 'attach:' + f] : []);
  return [
    'notes',
    'comments',
    ...['title', 'content', 'tagline'].filter((f) => used.includes(f)),
    'layout',
    'placement',
    'type',
    'purpose',
    ...image('imageDesc'),
    ...['beforeCap'].filter((f) => used.includes(f)),
    ...image('afterDesc'),
    ...['afterCap'].filter((f) => used.includes(f)),
    'view',
    'review',
  ];
};
export function createController(
  s,
  scheduler,
  {
    exit = () => {},
    attach = admitPng,
    store = storePicture,
    lessonPath = null,
    onChange = () => {},
    copy = () => {},
    reader = null,
  } = {},
) {
  let live = true,
    epoch = 0;
  const say = (message) => {
    s.notice = message || 'Applied';
  };
  const confirm = (title, run, lines = []) => {
    s.modal = { kind: 'confirm', title, lines, options: ['Cancel', 'Confirm'], index: 0, run };
  };
  // Opens a top-bar tab; with no tab given, the next one, as `v` does.
  function switchView(tab = TABS[(tabIndex(s) + 1) % TABS.length]) {
    s.view = tab.view;
    if (tab.view === 'plan') s.planIndex = tab.planIndex;
    s.control = null;
    s.pane = 'workbench';
  }
  function setControl(control) {
    const slide = slideById(s, s.selected);
    // Nothing on a locked slide takes focus, so the chat can never be aimed at one of its boxes either.
    if (slide?.locked && (FIELD_NAMES[control] || /^(layout|placement|type)$|^\w+:/.test(control || ''))) {
      s.control = null;
      say(lockedNote(s, slide.id));
      return;
    }
    s.control = control;
    if (control === 'type') s.choice = TYPES.indexOf(slide?.type);
    else if (control === 'layout') s.choice = LAYOUTS.indexOf(slide?.layout);
    else if (control === 'placement') {
      const first = imageSided(slide) ? slide.imageSide === 'left' : slide?.sentencePos === 'top';
      s.choice = first ? 0 : 1;
    } else s.choice = 0;
    s.formFollow = true;
    s.caretFollow = true;
    if (s.view === 'preview' || !FIELD_NAMES[control]) return;
    focusField(s, control);
    if (untypeable(slide?.[control] || ''))
      say('Some characters display as ?; the saved text keeps them until you change it.');
  }
  // Leaving a box saves what was typed in it. Returns false when it had to ask first.
  function leave() {
    const e = s.edit;
    if (!e) return true;
    s.edit = null;
    if (e.text === editSource(s, e)) return true;
    const error = saveEdit(s, e);
    if (error === 'BASE CHANGED') {
      confirm('Overwrite the new saved value?', () => say(saveEdit(s, e, true) || 'Saved'), [
        'This box changed while you were typing.',
        `Saved now: ${editSource(s, e)}`,
        'Confirm saves your text over it. Cancel keeps the saved value and drops your text.',
      ]);
      return false;
    }
    const sentences =
      !e.principle &&
      e.field === 'content' &&
      slideById(s, e.slideId)?.layout === 'image-sentence' &&
      /[.!?]\s+\S/.test(e.text);
    say(error || (sentences ? 'Saved - more than one sentence on a one-sentence layout' : 'Saved'));
    return true;
  }
  // Moves keyboard focus off a text box so printable keys act as shortcuts again.
  // [whole lesson] or 0: the chat aims at the whole lesson until a box is focused or the slide changes; again
  // returns it to the slide.
  function toggleWholeLesson() {
    s.wholeLesson = !s.wholeLesson;
    say(
      s.wholeLesson
        ? 'Chat aimed at the whole lesson until you focus a box or change slides'
        : 'Chat aimed at this slide',
    );
  }
  function blur() {
    if (focusedBox(s)) s.control = null;
  }
  function openPrompt(field) {
    const x = slideById(s, s.selected);
    if (!x) return;
    s.modal = {
      kind: 'prompt',
      title: `${ref(s, x.id)} / ${fieldName(x, field)}`,
      lines: pictureInfo(s, x.id, field),
      scroll: 0,
    };
  }
  function generate(field) {
    say(scheduler.generate(s.selected, field) || 'Generating a picture - this box is locked until it arrives');
  }
  // The lesson file's errors: why it opened read-only, or why the last change could not be saved.
  function openErrors() {
    const f = s.file;
    s.modal = {
      kind: 'prompt',
      plate: 'file',
      title: f.readOnly ? `${f.name} - read only` : f.name,
      lines: f.errors.length
        ? [
            f.readOnly
              ? 'This file does not follow the lesson schema, so it opened read-only and nothing is written to it. ' +
                'Fix these in the file, then reopen it:'
              : 'The last change was not saved, because the lesson would not follow the schema:',
            '',
            ...formatErrors(f.errors),
          ]
        : [`Every change is saved to ${f.path || 'nowhere (no file)'}.`],
      scroll: 0,
    };
  }
  // Every model Pi has logged in, in one list; the chosen one runs the chat's requests.
  function openModels() {
    if (s.ai.status !== 'ready') {
      say(s.ai.status === 'error' ? `AI unavailable: ${s.ai.message}` : 'Pi is still connecting');
      return;
    }
    s.modal = {
      kind: 'models',
      plate: 'model',
      title: 'Model for chat requests',
      options: s.ai.models.map((m) => ({ label: m.key, key: m.key })),
      index: Math.max(
        0,
        s.ai.models.findIndex((m) => m.key === s.ai.model),
      ),
    };
  }
  // The voice slides are read in: Google's 30, each with its gender and style, the current one selected.
  function openVoice() {
    s.modal = {
      kind: 'voice',
      title: 'Voice for reading slides aloud',
      lines: ["Google's Gemini voices. The slide being read starts again in the new one; the choice is kept."],
      options: VOICES.map((v) => ({ label: `${v.name.padEnd(14)}${v.gender.padEnd(8)}${v.style}`, key: v.name })),
      index: Math.max(
        0,
        VOICES.findIndex((v) => v.name === s.voice),
      ),
    };
  }
  // One effort for every request: how hard the chat model thinks and how carefully imagegen draws.
  function openEffort() {
    s.modal = {
      kind: 'effort',
      title: 'Effort for AI requests and pictures',
      lines: [
        "Sets how much the chat model thinks, and imagegen's thinking and quality. Higher is slower and makes better " +
          'pictures; low keeps imagegen at its own defaults.',
      ],
      options: EFFORTS.map((key) => ({ label: key, key })),
      index: Math.max(0, EFFORTS.indexOf(s.ai.effort)),
    };
  }
  // The picture style of one image box, as a dropdown under its button.
  function openStyle(field) {
    const x = slideById(s, s.selected),
      current = Math.max(0, STYLES.indexOf(x?.[STYLE_OF[field]]));
    s.modal = {
      kind: 'style',
      plate: 'style',
      title: 'STYLE',
      field,
      options: STYLES.map((key) => ({ label: STYLE_NAMES[key], key })),
      index: current,
      current,
    };
  }
  function quit() {
    const running = s.jobs.filter(pending).length;
    if (running)
      confirm(`Quit and stop ${running} AI request${running === 1 ? '' : 's'}?`, exit, [
        'Saved changes stay in the file; the running requests are dropped. Default: Cancel.',
      ]);
    else exit();
  }
  // New items open with their name box focused, ready to type, like the other boxes.
  function addItem(parent, kind) {
    const error = createItem(s, kind, parent, '');
    if (error) {
      say(error);
      return;
    }
    s.view = 'workspace';
    s.pane = 'workbench';
    setControl('title');
    anchorOutline(s.selected);
    say(`New ${kind} added - type its name`);
  }
  // Where a dragged slide lands when released on a row: before a slide, or first in a group (after its title slide)
  // on the group's row.
  function dropTarget(row, id) {
    if (!row) return null;
    const group = rowGroup(s, row),
      name = ownerById(s, group)?.title || 'untitled group';
    // Labels use names, not positions, because positions change as soon as the slide moves.
    if (row.kind === 'slide') return { group, before: row.id, label: `before "${slideName(slideById(s, row.id))}"` };
    const first = order(s).find((z) => (z.subId || z.secId) === group && !z.titleFor && z.id !== id);
    return { group, before: first?.id ?? null, label: `at the start of ${name}` };
  }
  // Where a dragged section or subsection lands: it takes the place of the group under the pointer (the section,
  // or for a subsection the subsection, a row belongs to); a subsection on a section's own rows goes first in it.
  function groupDrop(row, d) {
    if (!row) return null;
    const x = row.kind === 'slide' ? slideById(s, row.id) : null,
      secOf = (id) => s.sections.find((sec) => sec.id === id || sec.subs.some((sub) => sub.id === id)),
      place = (list, targetId) => {
        const name = `"${ownerById(s, targetId)?.title || 'untitled'}"`,
          from = list.findIndex((y) => y.id === d.id);
        return from >= 0 && from < list.findIndex((y) => y.id === targetId) ? `after ${name}` : `before ${name}`;
      };
    if (d.group === 'section') {
      const sec = secOf(row.kind === 'slide' ? x.secId : row.id);
      return !sec || sec.id === d.id ? null : { targetId: sec.id, label: place(s.sections, sec.id) };
    }
    const sub = row.kind === 'subsection' ? row.id : x?.subId,
      sec = secOf(sub || (row.kind === 'section' ? row.id : x?.secId));
    if (!sec || sub === d.id) return null;
    if (!sub) return { targetId: sec.id, label: `first in "${sec.title || 'untitled section'}"` };
    return { targetId: sub, label: place(sec.subs, sub) };
  }
  function openAttach(field) {
    if (s.review || busy(s, s.selected, field)) {
      say('Review-only or BUSY - attachment disabled');
      return;
    }
    s.modal = {
      kind: 'attach',
      title: 'Attach a PNG',
      input: '',
      cursor: 0,
      slideId: s.selected,
      field,
      lines: ["Enter reads the PNG and copies it into the lesson's picture folder, beside the lesson file."],
    };
  }
  function toggleChat() {
    if (s.pane === 'chat') {
      if (s.origin) {
        Object.assign(s, { pane: s.origin.pane, control: s.origin.control, choice: s.origin.choice });
        if (s.origin.modal) s.modal = s.origin.modal;
        s.origin = null;
      } else s.pane = 'workbench';
    } else {
      s.origin = { pane: s.pane, control: s.control, choice: s.choice };
      s.pane = 'chat';
      s.chatMode = 'composer';
    }
  }
  const pairLabel = (pair) =>
    BOX_PAIRS.find((p) => p[0] === pair)
      .map((field) => fieldName(slideById(s, s.selected) || {}, field).toUpperCase())
      .join(' and ');
  // Text being edited carries an optional mark: the highlight runs from it to the cursor. Shift with a move extends
  // it, and the highlighted text is copied at once; a deleting or typing key replaces it; any other move drops it.
  function input(m, event, width = 0) {
    const key = event.key === 'paste' ? 'text' : event.key,
      add = event.key === 'paste' ? inputText(event.text) : event.text;
    if (event.shift && MOVES.includes(key)) {
      m.mark ??= m.cursor;
      Object.assign(m, editText(m.text, m.cursor, key, '', width));
      copyMarked(m);
      return;
    }
    if (m.mark !== undefined && m.mark !== m.cursor && EDITS.includes(key)) {
      const g = graphemes(m.text),
        from = Math.min(m.mark, m.cursor);
      g.splice(from, Math.abs(m.cursor - m.mark));
      Object.assign(m, { text: g.join(''), cursor: from, mark: undefined });
      if (key !== 'text' && key !== 'enter' && key !== 'newline') return;
    }
    m.mark = undefined;
    if (key === 'text' && m.text.length + (add?.length || 0) > 20000) {
      say('Input exceeds 20000 characters - paste rejected; draft retained');
      return;
    }
    Object.assign(m, editText(m.text, m.cursor, key, add, width));
  }
  function copyMarked(m) {
    if (m.mark === undefined || m.mark === m.cursor) return;
    const picked = graphemes(m.text).slice(Math.min(m.mark, m.cursor), Math.max(m.mark, m.cursor)).join('');
    copy(picked);
    say(`Copied ${graphemes(picked).length} characters; Backspace deletes them, typing replaces them`);
  }
  function anchorOutline(id, visibleRows = 7) {
    const rows = outlineRows(s);
    const index = outlineIndex(rows, id);
    s.outlineCursor = index >= 0 ? index : Math.max(0, Math.min(s.outlineCursor, rows.length - 1));
    const maxScroll = Math.max(0, rows.length - visibleRows);
    s.outlineScroll = Math.min(Math.max(0, s.outlineCursor - visibleRows + 1), maxScroll);
  }
  function undo(confirmed = false) {
    const anchor = outlineRows(s)[s.outlineCursor]?.id;
    const error = undoOutline(s, confirmed, (id) => scheduler.cancel('Stopped: slide removed', id));
    if (error?.startsWith('CONFIRM:')) confirm('Undo outline - destructive consequence', () => undo(true), [error]);
    else {
      say(error || 'Outline operation undone; unrelated content retained');
      anchorOutline(anchor);
    }
  }
  // The aim check: Jev's answer decides whether the message goes as aimed or the author picks where it goes.
  let aimChain = Promise.resolve(),
    checking = 0;
  const restore = (text) => {
    s.chatDraft = s.chatDraft ? text + '\n' + s.chatDraft : text;
    s.chatCursor = graphemes(s.chatDraft).length;
  };
  async function route(text, target) {
    say('Checking where this message should go...');
    onChange();
    const suggestion = await scheduler.suggestAim(text, target);
    if (!live) return;
    if (!suggestion) {
      if (!scheduler.send(text, target)) restore(text);
      else if (/^Checking where/.test(s.notice)) s.notice = '';
      onChange();
      return;
    }
    const excerpt = oneLine(text),
      reach = suggestion.target ? ' only' : ' - may change anything';
    await new Promise((done) => {
      s.modal = {
        kind: 'aim',
        plate: 'aim',
        title: 'Where should this message go?',
        lines: [
          `"${excerpt.length > 200 ? excerpt.slice(0, 199) + '…' : excerpt}"`,
          `Jev reads it as needing ${suggestion.target ? targetLabel(s, suggestion.target) : 'the whole lesson'} ` +
            `(${Math.round(suggestion.probability * 100)}%). It was aimed at ${targetLabel(s, target)}.`,
        ],
        options: [
          {
            label: `Run on ${targetLabel(s, suggestion.target)}${reach}`,
            target: suggestion.target,
          },
          { label: `Keep on ${targetLabel(s, target)}`, target },
        ],
        index: 0,
        text,
        done,
      };
      onChange();
    });
  }
  async function activateModal(m) {
    if (m.kind === 'aim') {
      s.modal = null;
      if (!scheduler.send(m.text, m.options[m.index].target)) restore(m.text);
      m.done();
      return;
    }
    if (m.kind === 'prompt' || m.kind === 'picture') {
      s.modal = null;
      return;
    }
    if (m.kind === 'style') {
      s.modal = null;
      const error = setChoice(s, STYLE_OF[m.field], m.options[m.index].key);
      say(error || `Picture style: ${m.options[m.index].label}`);
      return;
    }
    if (m.kind === 'voice') {
      s.voice = m.options[m.index].key;
      s.modal = null;
      say(`Voice: ${s.voice}`);
      reader?.revoice();
      return;
    }
    if (m.kind === 'effort') {
      s.ai.effort = m.options[m.index].key;
      s.modal = null;
      say(`Effort: ${s.ai.effort}, for the next requests and pictures`);
      return;
    }
    if (m.kind === 'models') {
      s.ai.model = m.options[m.index].key;
      s.modal = null;
      say(`Chat requests now use ${s.ai.model}`);
      return;
    }
    if (m.kind === 'confirm') {
      if (m.index === 1) {
        s.modal = null;
        m.run();
      } else s.modal = null;
      return;
    }
    if (m.kind === 'create') {
      const kind = ['section', 'subsection', 'slide'][m.index];
      s.modal = {
        kind: 'create-name',
        title: `New ${kind}`,
        lines: [
          `Destination: ${m.destinationName}. New section appends at lesson end; ` +
            'subsection is a sibling, never deeper.',
        ],
        input: '',
        cursor: 0,
        createKind: kind,
        parent: m.parent,
      };
      return;
    }
    if (m.kind === 'move') {
      if (m.index < 2) {
        say(moveItem(s, m.id, m.index === 0 ? -1 : 1));
        anchorOutline(m.anchorId || m.id);
        s.modal = null;
      } else if (slideById(s, m.id) && !slideById(s, m.id).titleFor)
        s.modal = {
          kind: 'destinations',
          title: 'Move to group / append to destination',
          options: s.sections.flatMap((sec) => [
            { label: 'Section: ' + (sec.title || 'Untitled section'), id: sec.id },
            ...sec.subs.map((sub) => ({
              label: '  Subsection: ' + (sub.title || 'Untitled subsection') + ' / ' + sec.title,
              id: sub.id,
            })),
          ]),
          index: 0,
          id: m.id,
        };
      else say('Group moves stay within their parent; linked title cannot move alone');
      return;
    }
    if (m.kind === 'destinations') {
      say(moveItem(s, m.id, 0, m.options[m.index].id));
      anchorOutline(m.id);
      s.modal = null;
      return;
    }
    if (m.input !== undefined) {
      if (m.kind === 'rename') {
        say(renameOwner(s, m.id, m.input));
        s.modal = null;
      } else if (m.kind === 'create-name') {
        const error = createItem(s, m.createKind, m.parent, m.input);
        say(error);
        if (!error) {
          s.modal = null;
          s.pane = 'workbench';
        }
      } else if (m.kind === 'attach') {
        if (m.pending) return;
        if (s.review || busy(s, m.slideId, m.field)) {
          m.error = 'Review-only or busy: attachment disabled';
          return;
        }
        m.pending = true;
        m.error = 'PENDING - checking PNG in memory; input and confirmation locked.';
        const token = epoch;
        try {
          const image = await attach(m.input);
          if (!live || token !== epoch) return;
          if (s.modal !== m) {
            if (s.origin?.modal === m) m.error = 'Read interrupted - press Enter to retry. Previous image retained.';
            return;
          }
          if (s.review || busy(s, m.slideId, m.field)) {
            m.error = 'Review-only or busy: previous image retained';
            return;
          }
          const stem = `${m.slideId}-${m.field === 'afterDesc' ? 'after' : 'image'}`,
            file = await store(lessonPath, image.bytes, stem);
          if (!live || token !== epoch) return;
          say(setPicture(s, m.slideId, m.field, { ...image, source: 'attached', file }) || `Attached ${image.name}`);
          s.modal = null;
        } catch {
          if (live && (s.modal === m || s.origin?.modal === m))
            m.error =
              'PNG rejected - previous picture kept. Needs a regular PNG file (no symlinks), at most 16 MiB and ' +
              '4096 px a side, noninterlaced 8-bit gray/RGB/RGBA.';
        } finally {
          m.pending = false;
          if (live) onChange();
        }
      }
    }
  }
  function outline(event, visibleRows) {
    const rows = outlineRows(s),
      row = rows[s.outlineCursor],
      key = event.key,
      t = event.text;
    if (['up', 'down', 'home', 'end', 'pageup', 'pagedown'].includes(key)) {
      s.outlineCursor = Math.max(
        0,
        Math.min(
          rows.length - 1,
          key === 'home'
            ? 0
            : key === 'end'
              ? rows.length - 1
              : s.outlineCursor + { up: -1, down: 1, pageup: -8, pagedown: 8 }[key],
        ),
      );
      s.outlineScroll = Math.max(0, s.outlineCursor - 6);
      return;
    }
    if (!row && t !== 'n') return;
    if (key === 'left' || key === 'right') {
      const id = rowGroup(s, row);
      if (!id) return;
      if (key === 'left' && !s.collapsed.includes(id)) s.collapsed.push(id);
      if (key === 'right') s.collapsed = s.collapsed.filter((x) => x !== id);
      anchorOutline(key === 'left' ? id : row.id, visibleRows);
      return;
    }
    if (key === 'enter') {
      const x = rowSlide(s, row);
      if (x) {
        selectSlide(s, x.id);
        s.pane = 'workbench';
        s.view = 'workspace';
      }
      return;
    }
    if (t === 'r') {
      const x = rowSlide(s, row);
      if (x.locked) {
        say(lockedNote(s, x.id));
        return;
      }
      if (s.review || busy(s, x.id, 'title')) {
        say('Review-only or BUSY - LOCKED heading');
        return;
      }
      if (row.kind === 'slide') {
        selectSlide(s, x.id);
        s.pane = 'workbench';
        s.view = 'workspace';
        setControl('title');
      } else
        s.modal = {
          kind: 'rename',
          title: 'Rename group / heading linked both ways',
          id: row.id,
          input: x.title,
          cursor: graphemes(x.title).length,
        };
    }
    if (t === 'n') {
      if (s.review) {
        say('Review-only: creation disabled');
        return;
      }
      const parent = row ? rowGroup(s, row) : null;
      s.modal = {
        kind: 'create',
        title: 'New / all actions',
        lines: [],
        options: [
          'Section - at lesson end',
          'Subsection - in selected section (no deeper levels)',
          'Slide - at selected group end',
        ],
        index: 0,
        parent,
        destinationName: ownerById(s, parent)?.title || 'new lesson',
      };
    }
    if (t === 'm') {
      if (s.review) {
        say('Review-only: moves disabled');
        return;
      }
      const x = slideById(s, row.id),
        id = x?.titleFor || row.id;
      s.modal = {
        kind: 'move',
        title: 'Move outline item',
        lines: x?.titleFor
          ? ['Linked title cannot move alone. These actions move its owning group and descendants.']
          : [],
        options: ['Up', 'Down', 'To group - ordinary slides only'],
        index: 0,
        id,
        anchorId: row.id,
      };
    }
    if (t === 'u') undo();
    if (t === 'l' || t === 'L') {
      // l locks the row's slide (a group row is its title slide); L every slide in the row's group.
      const x = rowSlide(s, row),
        group = t === 'L' ? rowGroup(s, row) : null,
        slides = group ? groupContents(s, group) : [x],
        on = !slides.every((z) => z.locked);
      if (s.edit && slides.some((z) => z.id === s.edit.slideId) && !leave()) return;
      const error = setLocks(
        s,
        slides.map((z) => z.id),
        on,
      );
      if (!error && on && slides.some((z) => z.id === s.selected)) s.control = null;
      const what = group
        ? `all ${slides.length} slides in "${ownerById(s, group)?.title || 'untitled'}"`
        : ref(s, x.id);
      say(
        error ||
          (on
            ? `Locked ${what}: nobody can change, move or delete ${group ? 'them' : 'it'} until ${t} unlocks`
            : `Unlocked ${what}`),
      );
      return;
    }
    if ((t === 'd' || key === 'delete') && row.kind !== 'slide') {
      // A group row (its title slide) deletes the whole group, after a confirm that counts what goes with it.
      const id = row.id,
        group = ownerById(s, id),
        sec = s.sections.find((sec) => sec.id === id),
        gone = groupContents(s, id).filter((x) => !x.titleFor).length,
        subs = sec?.subs.length || 0,
        kind = sec ? 'section' : 'subsection',
        run = () => {
          const error = deleteGroup(s, id, (slideId) => scheduler.cancel('Stopped: slide deleted', slideId));
          say(error || `Deleted ${kind} "${group.title}"; u undo puts it back`);
          if (!error) anchorOutline(s.selected, visibleRows);
        };
      if (s.review) say('Review-only: delete disabled');
      else
        confirm(`Delete ${kind} "${group.title || 'untitled'}"?`, run, [
          `Removes its title slide${subs ? `, ${subs} subsection${subs > 1 ? 's' : ''}` : ''} and ` +
            `${gone} slide${gone === 1 ? '' : 's'}, with their content, notes and pictures.`,
          'u undo puts everything back. Default: Cancel.',
        ]);
      return;
    }
    if (t === 'd' || key === 'delete') {
      const x = rowSlide(s, row);
      const name = ref(s, x.id),
        error = deleteSlide(s, x.id, (id) => scheduler.cancel('Stopped: slide deleted', id));
      say(error || `Deleted ${name}; u undo puts it back`);
      if (!error) anchorOutline(s.selected, visibleRows);
    }
  }
  // Mouse: a click puts the state where the keyboard would be, then reuses the keyboard action.
  function pointer(event, g, hits) {
    const inside = (h) => event.x >= h.x && event.x < h.x + h.w && event.y >= h.y && event.y < h.y + h.h;
    if (s.select) {
      // Dragging across text from where it was pressed highlights it; the release copies the highlight.
      const { area, chat } = s.select,
        m = chat ? { text: s.chatDraft, cursor: s.chatCursor, mark: s.chatMark } : s.edit;
      if (!m) s.select = null;
      else if (event.motion && event.button === 'left') {
        const row = Math.max(0, area.offset + event.y - area.y);
        m.cursor = caretAt(m.text, area.w, row, event.x - area.x);
        if (chat) s.chatCursor = m.cursor;
        s.caretFollow = true;
      } else if (event.release || event.button !== 'left') {
        s.select = null;
        if (m.mark === m.cursor) m.mark = undefined;
        if (chat) s.chatMark = m.mark;
        copyMarked(m);
      }
      if (s.select || event.release || event.motion) return;
    }
    // Drag: motion with the button held moves the drop row; release drops there.
    if (s.boxResize) {
      // Dragging a box's bottom border: its row's height follows the pointer.
      const r = s.boxResize;
      if (event.motion && event.button === 'left')
        s.boxRows[r.pair] = Math.max(BOX_LIMITS.low, Math.min(BOX_LIMITS.high, event.y - r.top - 1));
      if (event.release || event.button !== 'left') {
        s.boxResize = null;
        if (s.boxRows[r.pair]) say(`${pairLabel(r.pair)}: ${s.boxRows[r.pair]} lines tall`);
      }
      return;
    }
    if (s.resize) {
      // Dragging a column line: the line follows the pointer; geometry keeps every column usable.
      if (event.motion && event.button === 'left')
        s.columns[s.resize.side] = columnWidth(
          g,
          s.resize.side,
          s.resize.side === 'outline' ? event.x : g.w - 1 - event.x,
        );
      if (event.release || event.button !== 'left') s.resize = null;
      return;
    }
    if (event.motion) {
      const h = s.drag && hits.find((h) => h.act === 'outline-row' && inside(h));
      if (h) {
        s.drag.over = h.index;
        const row = outlineRows(s)[h.index],
          target = s.drag.group ? groupDrop(row, s.drag) : dropTarget(row, s.drag.id),
          name = s.drag.group ? ownerById(s, s.drag.id)?.title : slideName(slideById(s, s.drag.id));
        say(target ? `Release to move "${name}" ${target.label}` : 'Release here to cancel the move');
      }
      return;
    }
    if (event.release) {
      const d = s.drag;
      s.drag = null;
      if (!d || d.over === d.from) return;
      if (d.group) {
        const target = groupDrop(outlineRows(s)[d.over], d),
          name = ownerById(s, d.id)?.title || 'untitled';
        if (!target) say('Move cancelled');
        else say(placeGroup(s, d.id, target.targetId) || `Moved ${d.group} "${name}" ${target.label}; u undoes it`);
        anchorOutline(d.id, Math.max(1, g.outlineRows || 8));
        return;
      }
      const target = dropTarget(outlineRows(s)[d.over], d.id);
      if (!target) say('Move cancelled');
      else {
        const error = placeSlide(s, d.id, target.group, target.before);
        say(
          error || `Moved "${slideName(slideById(s, d.id))}" ${target.label}; it is now ${ref(s, d.id).split(' "')[0]}`,
        );
      }
      anchorOutline(d.id, Math.max(1, g.outlineRows || 8));
      return;
    }
    if (event.button === 'other') return;
    const pool = hits.filter((h) => inside(h) && (!s.modal || h.modal));
    if (event.button === 'wheelup' || event.button === 'wheeldown') {
      // The smallest scroll area under the pointer wins. An overflowing box keeps the wheel even at its ends, so
      // scrolling inside it never moves the form around it.
      const areas = pool.filter((h) => h.scroll).sort((a, b) => a.w * a.h - b.w * b.h),
        delta = event.button === 'wheelup' ? -3 : 3;
      let area = areas[0];
      if (area?.scroll === 'box') {
        // Boxes are a few rows tall, so they move one line per notch.
        // Stored, not the frame's offset: several notches can arrive before the next frame.
        const from = Math.min(area.most, s.boxScroll[area.key] || 0),
          next = Math.max(0, Math.min(area.most, from + Math.sign(delta)));
        if (next !== from) {
          s.boxScroll[area.key] = next;
          s.caretFollow = false;
        }
        return;
      }
      if (area?.scroll === 'outline')
        s.outlineScroll = Math.max(0, Math.min(outlineRows(s).length - 1, s.outlineScroll + delta));
      else if (area?.scroll === 'chat') {
        const last = Math.max(0, chatRows(s, g.chatWidth || 40).length - Math.max(1, g.transcriptRows || 4));
        const next = Math.max(0, (s.chatAnchor ?? last) + delta);
        if (next >= last) {
          s.chatAnchor = null;
          s.chatNew = 0;
        } else s.chatAnchor = next;
      } else if (area?.scroll === 'modal') s.modal.scroll = Math.max(0, (s.modal.scroll || 0) + delta);
      else if (area?.scroll === 'form') {
        s.formScroll = Math.max(0, Math.min(g.formMost ?? Infinity, s.formScroll + delta));
        s.formFollow = false;
      }
      return;
    }
    // The smallest target wins, so a fold caret beats its row and a radio beats its panel.
    const h = pool.filter((x) => x.act).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (!h) return;
    if (h.act === 'box-edge') {
      s.boxResize = { pair: h.pair, top: h.top };
      return;
    }
    if (h.act === 'rule') {
      s.resize = { side: h.side };
      return;
    }
    // A click anywhere but the box being typed in saves that box first, like any form.
    if (s.edit && !sameBox(s.edit, h.box) && !leave()) return;
    // A locked slide's boxes, options and image buttons take no focus; they only say how to unlock it.
    const slideAct = ['choice', 'field', 'field-busy', 'field-off', 'prompt', 'attach', 'style', 'generate'];
    if (slideAct.includes(h.act) && !h.box?.principle && slideById(s, h.box?.slideId ?? s.selected)?.locked) {
      say(lockedNote(s, h.box?.slideId ?? s.selected));
      return;
    }
    const key = (k, text) => handle(text === undefined ? { key: k } : { key: 'text', text }, g, hits);
    const toWorkbench = () => {
      if (s.pane === 'chat') s.origin = null;
      s.pane = 'workbench';
    };
    if (h.act === 'modal-option') {
      s.modal.index = h.index;
      key('enter');
    } else if (h.act === 'blur') {
      toWorkbench();
      blur();
    } else if (h.act === 'view') {
      toWorkbench();
      switchView(TABS[h.tab]);
    } else if (h.act === 'review') {
      toWorkbench();
      s.control = h.act;
      key('enter');
    } else if (h.act === 'file') {
      toWorkbench();
      openErrors();
    } else if (h.act === 'help' || h.act === 'images' || h.act === 'nav') {
      toWorkbench();
      blur();
      key('text', h.act === 'help' ? '?' : h.act === 'images' ? 'i' : h.delta < 0 ? '[' : ']');
    } else if (h.act === 'choice') {
      toWorkbench();
      setControl(h.control);
      s.choice = h.index;
      key('enter');
    } else if (h.act === 'field') {
      toWorkbench();
      if (h.box.principle) Object.assign(s, { control: 'principle', caretFollow: true });
      else {
        if (s.selected !== h.box.slideId) selectSlide(s, h.box.slideId);
        setControl(h.box.field);
      }
      s.formFollow = true;
      // A click on the text rows puts the caret there: that line, at that column or the line's end. A click on the
      // frame only focuses the box.
      const area = h.text;
      if (area && event.y >= area.y && event.y < area.y + area.rows && !editLocked(s, h.box)) {
        const row = area.offset + event.y - area.y,
          col = Math.max(0, event.x - area.x),
          text = s.edit && sameBox(s.edit, h.box) ? s.edit.text : editSource(s, h.box);
        s.edit ??= { ...h.box, text, base: editRevision(s, h.box) };
        s.edit.cursor = caretAt(text, area.w, row, col);
        s.edit.mark = s.edit.cursor;
        s.select = { area };
      }
    } else if (h.act === 'add') {
      toWorkbench();
      addItem(h.parent, h.kind);
    } else if (h.act === 'field-busy') {
      const x = slideById(s, h.box.slideId);
      say(
        lessonBusy(s)
          ? 'Locked: the lesson agent is changing the whole lesson. Everything unlocks when it finishes.'
          : claimed(s, x.id)
            ? claimNote(s, x.id)
            : `${fieldName(x, h.box.field)} is locked: an AI request is working on it. It unlocks when the change lands.`,
      );
    } else if (h.act === 'field-off') {
      say(`${h.note} - choose a layout that uses it to edit it`);
    } else if (h.act === 'prompt') {
      toWorkbench();
      setControl('prompt:' + h.field);
      openPrompt(h.field);
    } else if (h.act === 'attach') {
      toWorkbench();
      setControl('attach:' + h.field);
      openAttach(h.field);
    } else if (h.act === 'style') {
      toWorkbench();
      setControl('style:' + h.field);
      openStyle(h.field);
    } else if (h.act === 'modal-dismiss') {
      s.modal = null;
    } else if (h.act === 'picture-view') {
      s.modal = { kind: 'picture', slideId: h.slideId, field: h.field };
    } else if (h.act === 'generate') {
      toWorkbench();
      setControl('generate:' + h.field);
      generate(h.field);
    } else if (h.act === 'outline-row' || h.act === 'fold') {
      const row = outlineRows(s)[h.index];
      if (!row) return;
      s.outlineCursor = h.index;
      if (h.act === 'fold') {
        if (s.collapsed.includes(row.id)) s.collapsed = s.collapsed.filter((id) => id !== row.id);
        else s.collapsed.push(row.id);
        anchorOutline(row.id, Math.max(1, g.outlineRows || 8));
        return;
      }
      const x = rowSlide(s, row);
      if (x) selectSlide(s, x.id);
      if (s.view === 'plan') s.view = 'workspace';
      if (s.pane !== 'outline' || !g.outline) toWorkbench();
      // Slides and groups drag; a group carries its title slide, slides and (a section) its subsections.
      if (!s.review)
        s.drag = { id: row.id, from: h.index, over: h.index, ...(row.kind === 'slide' ? {} : { group: row.kind }) };
    } else if (h.act === 'speak') {
      speech(h.key);
    } else if (h.act === 'outline-toggle') {
      toggleOutline(g);
    } else if (h.act === 'outline-key') {
      if (s.pane !== 'outline') {
        s.pane = 'outline';
        anchorOutline(s.selected, Math.max(1, g.outlineRows || 8));
      }
      key('text', h.key);
    } else if (h.act === 'composer' || h.act === 'transcript') {
      if (s.pane !== 'chat') toggleChat();
      s.chatMode = h.act === 'composer' ? 'composer' : 'transcript';
      // A press on the message's text puts the caret there and may start a highlight.
      const area = h.text;
      if (area && event.y >= area.y && event.y < area.y + area.rows) {
        s.chatCursor = caretAt(s.chatDraft, area.w, area.offset + event.y - area.y, event.x - area.x);
        s.chatMark = s.chatCursor;
        s.select = { area, chat: true };
      }
    } else if (h.act === 'clear-target') {
      toggleWholeLesson();
    } else if (h.act === 'model') openModels();
    else if (h.act === 'effort') openEffort();
  }
  // Every event ends with the live edit belonging to the focused box; anything else saves it.
  function handle(event, g = {}, hits = []) {
    // While the form follows focus, the shown offset becomes the base so the next focus move does not jump.
    if (s.formFollow && Number.isInteger(g.formOffset)) s.formScroll = g.formOffset;
    // Likewise the focused box's text keeps the position its caret scrolled it to.
    if (g.boxScroll && s.caretFollow) s.boxScroll[g.boxScroll.key] = g.boxScroll.offset;
    dispatch(event, g, hits);
    if (live && s.edit && !sameBox(s.edit, focusedBox(s))) leave();
    if (live) follow();
  }
  // Presenting goes on in the editor. Going into a box or the chat to type pauses it, so the voice never moves the
  // form from under the caret; choosing another slide moves the presentation there.
  function follow() {
    const r = s.reading;
    if (!reader || r?.mode !== 'present') return;
    const typing = focusedBox(s) || (s.pane === 'chat' && s.chatMode === 'composer');
    if (typing && !r.paused && r.status !== 'done' && r.status !== 'error') {
      reader.pause();
      say('Paused while you type - [resume] carries on');
    } else if (!typing && s.selected !== r.slideId) reader.present(s.selected);
  }
  // Reading aloud, from its keys and its buttons. A button pressed while typing saves the box and leaves it first.
  function speech(action) {
    if (!reader) return;
    if (['p', 'P', 'back', 'next', 'toggle'].includes(action) && focusedBox(s)) {
      if (!leave()) return;
      blur();
    }
    const r = s.reading;
    if (action === 'V') openVoice();
    else if (action === 's') say(`Voice speed ${reader.faster()}x`);
    else if (action === 'p' && r?.mode === 'slide') {
      reader.stop();
      say('Stopped reading');
    } else if (action === 'p') {
      reader.readSlide(s.selected);
      say('Reading this slide aloud - p stops');
    } else if (action === 'stop' || (action === 'P' && r?.mode === 'present')) {
      reader.stop();
      say('Stopped presenting');
    } else if (action === 'P') {
      reader.present(s.selected);
      if (s.reading) say('Presenting from this slide - Space pauses, Left/Right change slides, Esc stops');
    } else if (action === 'toggle') reader.toggle();
    else if (action === 'back' || action === 'next') reader.step(action === 'back' ? -1 : 1);
  }
  // Hides or shows the outline column, so the slide and form take its width; Ctrl-O still opens it as a panel.
  function toggleOutline(g) {
    if (!g.sides?.includes('outline') && !s.columns.outlineHidden) {
      say('The outline is a panel at this width (Ctrl-O)');
      return;
    }
    s.columns.outlineHidden = !s.columns.outlineHidden;
    if (s.pane === 'outline') s.pane = 'workbench';
    say(s.columns.outlineHidden ? 'Outline hidden - o or [o outline] shows it, Ctrl-O opens it' : 'Outline shown');
  }
  function dispatch(event, g, hits) {
    const small = Boolean(g.small),
      page = Math.max(1, g.transcriptRows || 4),
      outlineVisible = Math.max(1, g.outlineRows || 8);
    if (!live) return;
    const { key, text: t } = event;
    if (key === 'ctrl-c') {
      exit();
      return;
    }
    if (small) {
      if (key === 'text' && t === 'q') exit();
      return;
    }
    if (key === 'mouse') {
      s.hover = { x: event.x, y: event.y };
      if (!s.modal?.pending) pointer(event, g, hits);
      return;
    }
    if (s.modal) {
      const m = s.modal;
      if (key === 'ctrl-g' && m.kind !== 'confirm' && m.kind !== 'aim') {
        s.modal = null;
        toggleChat();
        s.origin.modal = m;
        return;
      }
      if (key === 'escape') {
        s.modal = null;
        epoch++;
        if (m.kind === 'aim') {
          restore(m.text);
          say('Not sent; the message is back in the box');
          m.done();
        }
        return;
      }
      if (m.pending) return;
      // Dialog inputs are one line.
      if (key === 'newline') return;
      if (key === 'enter') {
        void activateModal(m).catch(() => {
          if (live) {
            s.notice = 'Action failed safely; session retained';
            onChange();
          }
        });
        return;
      }
      if (m.input !== undefined) {
        const draft = { text: m.input, cursor: m.cursor };
        input(draft, event);
        m.input = draft.text.replace(/\n/g, ' ');
        m.cursor = draft.cursor;
        return;
      }
      if (['up', 'down', 'left', 'right', 'tab', 'shift-tab'].includes(key) && m.options) {
        const delta = ['up', 'left', 'shift-tab'].includes(key) ? -1 : 1;
        m.index = (m.index + delta + m.options.length) % m.options.length;
      }
      if (['pageup', 'pagedown', 'home', 'end'].includes(key))
        m.scroll = Math.max(
          0,
          key === 'home'
            ? 0
            : key === 'end'
              ? Math.max(0, (m.lines || []).join('\n').length)
              : (m.scroll || 0) + (key === 'pageup' ? -5 : 5),
        );
      return;
    }
    if (key === 'ctrl-g') {
      toggleChat();
      return;
    }
    if (s.pane === 'chat') {
      if (key === 'escape') {
        toggleChat();
        return;
      }
      if (key === 'tab' || key === 'shift-tab') {
        const modes = ['composer', 'transcript', 'effort', 'models', 'clear'];
        s.chatMode = modes[(modes.indexOf(s.chatMode) + (key === 'tab' ? 1 : modes.length - 1)) % modes.length];
        return;
      }
      if (s.chatMode === 'models' && key === 'enter') {
        openModels();
        return;
      }
      if (s.chatMode === 'effort' && key === 'enter') {
        openEffort();
        return;
      }
      if (s.chatMode === 'clear' && key === 'enter') {
        toggleWholeLesson();
        return;
      }
      if (s.chatMode !== 'composer' && key === 'text') {
        if (t === 'q') quit();
        else if (t === '?') s.modal = { kind: 'help', title: 'Keys and mouse', lines: helpLines, scroll: 0 };
        else if (t === '0') toggleWholeLesson();
        else if (t === 'v') switchView();
        return;
      }
      if (
        key === 'pageup' ||
        key === 'pagedown' ||
        (key === 'home' && s.chatMode === 'transcript') ||
        (key === 'end' && s.chatMode === 'transcript')
      ) {
        if (key === 'end') {
          s.chatAnchor = null;
          s.chatNew = 0;
        } else
          s.chatAnchor = Math.max(
            0,
            key === 'home'
              ? 0
              : (s.chatAnchor ?? Math.max(0, chatRows(s, g.chatWidth || 40).length - page)) +
                  (key === 'pageup' ? -1 : 1) * page,
          );
        return;
      }
      if (s.chatMode === 'transcript' && key === 'enter') {
        s.modal = {
          kind: 'history',
          title: 'Full chat history / captured send-time focus',
          lines: s.chat.flatMap((m) => [`${m.role}${m.stamp ? ' / ' + m.stamp : ''}`, m.text, '']),
          scroll: 0,
        };
        return;
      }
      if (s.chatMode !== 'composer') return;
      if (key === 'enter') {
        const text = s.chatDraft,
          target = chatAim(s);
        // Without an aim check (or while none waits) the message goes at once, as aimed.
        if (!scheduler.checksAim(target) && !checking) {
          if (scheduler.send(text, target)) Object.assign(s, { chatDraft: '', chatCursor: 0, chatMark: undefined });
          return;
        }
        const why = scheduler.refusal(text, target);
        if (why !== null) {
          if (why) say(why);
          return;
        }
        Object.assign(s, { chatDraft: '', chatCursor: 0, chatMark: undefined });
        // Checks run one at a time, so messages are sent in the order they were typed.
        checking++;
        aimChain = aimChain.then(() => route(text, target)).finally(() => checking--);
        return;
      }
      if (key === 'ctrl-s') return;
      // Enter sends; Shift-Enter (or Ctrl-J, Option-Enter) starts a new line in the message.
      const d = { text: s.chatDraft, cursor: s.chatCursor, mark: s.chatMark };
      // The message box's text width, as render wraps it.
      input(d, event, g.chatWidth ? Math.max(1, g.chatWidth - 3) : 0);
      Object.assign(s, { chatDraft: d.text, chatCursor: d.cursor, chatMark: d.mark });
      return;
    }
    // A focused box takes every key except focus moves; Enter saves single-line boxes and stays in them.
    const box = focusedBox(s);
    if (key === 'box-taller' || key === 'box-shorter') {
      const pair = box && !box.principle && pairOf(box.field);
      if (!pair) return say('Option-Up / Option-Down resize the focused form box');
      const now = s.boxRows[pair] ?? g.boxHeights?.[pair] ?? 4;
      s.boxRows[pair] = Math.max(BOX_LIMITS.low, Math.min(BOX_LIMITS.high, now + (key === 'box-taller' ? 1 : -1)));
      s.formFollow = true;
      return say(`${pairLabel(pair)}: ${s.boxRows[pair]} lines tall`);
    }
    if (box && key === 'escape') {
      blur();
      return;
    }
    if (box && !['tab', 'shift-tab', 'ctrl-o'].includes(key)) {
      // Enter is a new line in every box; Ctrl-S saves without leaving.
      if (key === 'ctrl-s') {
        leave();
        return;
      }
      if (['pageup', 'pagedown'].includes(key)) return;
      if (editLocked(s, box)) {
        say(
          s.review ? 'Review only - this box is read only' : 'An edit agent is working on this box - read only for now',
        );
        return;
      }
      const saved = editSource(s, box);
      s.edit ??= { ...box, text: saved, cursor: graphemes(saved).length, base: editRevision(s, box) };
      // The box's drawn text width, so Up/Down follow its wrapped rows.
      input(s.edit, event, hits.find((h) => h.act === 'field' && sameBox(h.box, box))?.text?.w || 0);
      s.caretFollow = true;
      return;
    }
    if (key === 'ctrl-o') {
      if (s.pane === 'outline') {
        s.pane = 'workbench';
      } else {
        s.pane = 'outline';
        const rows = outlineRows(s),
          index = outlineIndex(rows, s.selected);
        if (index >= 0) s.outlineCursor = index;
        s.outlineScroll = Math.max(0, s.outlineCursor - 6);
      }
      return;
    }
    if (key === 'escape') {
      // Esc leaves the outline, stops reading aloud, or deselects the option group or button picked in the editor.
      if (s.pane === 'outline') s.pane = 'workbench';
      else if (s.reading) speech('stop');
      else s.control = null;
      return;
    }
    if (key === 'text' && t === 'q') {
      quit();
      return;
    }
    if (key === 'text' && t === '?') {
      s.modal = { kind: 'help', title: 'Keys and mouse', lines: helpLines, scroll: 0 };
      return;
    }
    // The keyboard way to resize: { } narrow or widen the outline, < > the chat, four columns a press.
    if (key === 'text' && '{}<>'.includes(t)) {
      const side = '{}'.includes(t) ? 'outline' : 'chat';
      if (!g.sides?.includes(side)) {
        say(g.sides?.length ? 'The outline is a panel at this width (Ctrl-O)' : 'Columns resize in a wider window');
        return;
      }
      const now = (s.columns[side] = columnWidth(g, side, g[side].w + ('}>'.includes(t) ? 4 : -4)));
      say(`${side === 'outline' ? 'Outline' : 'Chat'} ${now} columns wide; drag a column line or use { } < >`);
      return;
    }
    if (key === 'text' && t === '0') {
      toggleWholeLesson();
      return;
    }
    if (key === 'text' && t === 'v') {
      switchView();
      return;
    }
    // g, z, o and the reading keys work from the outline too, where other letters are the outline's own keys.
    if (key === 'text' && t === 'o') {
      toggleOutline(g);
      return;
    }
    // p reads this slide's speaker notes aloud (p again stops); P presents from this slide in the editor (P or Esc
    // stops); V picks the voice and s the speed.
    if (key === 'text' && 'pPVs'.includes(t) && t.length === 1 && s.view !== 'plan') {
      speech(t);
      return;
    }
    // Presenting: Space pauses and resumes when no box or option group has the keyboard.
    if (key === 'text' && t === ' ' && s.reading && s.pane === 'workbench' && s.control === null) {
      speech('toggle');
      return;
    }
    if (key === 'text' && t === 'g') {
      // Every missing picture in the lesson, after one confirmation: they use the image plan's allowance.
      const count = scheduler.missingPictures().length;
      if (!count) say('Every image concept already has a picture');
      else
        confirm(`Generate ${count} picture${count === 1 ? '' : 's'}?`, () => say(scheduler.generateMissing()), [
          'Every image concept in the lesson with no picture yet gets one, ' +
            `${scheduler.picturesAtOnce} at a time, at effort ${s.ai.effort}; locked slides are left out.`,
          'Each takes about a minute, and the chat model writes its prompt first. Pictures count against the ' +
            'ChatGPT/Codex plan; an image limit stops the ones still waiting, and g later picks them up.',
        ]);
      return;
    }
    if (key === 'text' && t === 'z') {
      // The current slide's picture, large: the image box being worked on first, then the first picture it has.
      const fields = ['imageDesc', 'afterDesc'],
        near = fields.find((f) => (s.control || '').endsWith(':' + f) || focusedBox(s)?.field === f),
        field = [near, ...fields].find((f) => f && s.pictures[s.selected]?.[f]?.bytes);
      if (s.view === 'plan' || !field) say('This slide has no picture to show');
      else s.modal = { kind: 'picture', slideId: s.selected, field };
      return;
    }
    if (s.pane === 'outline') {
      outline(event, outlineVisible);
      return;
    }
    // With nothing focused, Left and Right page through slides like [ and ].
    const paging = (key === 'left' || key === 'right') && s.control === null && s.view !== 'plan';
    if ((key === 'text' && (t === '[' || t === ']')) || paging) {
      const back = t === '[' || key === 'left',
        all = order(s),
        i = all.findIndex((x) => x.id === s.selected),
        next = all[Math.max(0, Math.min(all.length - 1, i + (back ? -1 : 1)))];
      if (next) selectSlide(s, next.id);
      return;
    }
    if (key === 'text' && t === 'i') {
      s.images = !s.images;
      say('Image presentation toggled; concepts unchanged');
      return;
    }
    if (s.view === 'plan') {
      // Left and Right step through the plan's tabs; Tab or Enter enters the box.
      if (key === 'left' || key === 'right') {
        s.planIndex = (s.planIndex + (key === 'left' ? PLAN_FIELDS.length - 1 : 1)) % PLAN_FIELDS.length;
        s.control = null;
        return;
      }
      if (key === 'tab' || key === 'shift-tab' || key === 'enter')
        Object.assign(s, { control: s.control === 'principle' ? null : 'principle', caretFollow: true });
      return;
    }
    if (s.view === 'preview') return;
    if (key === 'tab' || key === 'shift-tab') {
      // Boxes an edit agent is working on are locked, with their border buttons, so Tab skips them.
      const c = controls(s),
        step = key === 'tab' ? 1 : c.length - 1,
        locked = (control) => {
          const field = control?.split(':').at(-1);
          return Boolean(FIELD_NAMES[field]) && busy(s, s.selected, field);
        };
      let i = c.indexOf(s.control);
      do i = (i + step + c.length) % c.length;
      while (locked(c[i]) && c[i] !== s.control);
      setControl(c[i]);
      return;
    }
    const choices =
      s.control === 'type'
        ? TYPES
        : s.control === 'layout'
          ? LAYOUTS
          : s.control === 'placement'
            ? imageSided(slideById(s, s.selected))
              ? ['left', 'right']
              : ['top', 'bottom']
            : null;
    if (choices && ['left', 'right', 'up', 'down'].includes(key)) {
      s.choice = (s.choice + (['left', 'up'].includes(key) ? choices.length - 1 : 1)) % choices.length;
      return;
    }
    if (key === 'enter' || (key === 'text' && t === ' ')) {
      if (choices) {
        {
          const x = slideById(s, s.selected),
            prop =
              s.control === 'type'
                ? 'type'
                : s.control === 'layout'
                  ? 'layout'
                  : imageSided(x)
                    ? 'imageSide'
                    : 'sentencePos';
          if (s.control === 'placement' && !imageSided(x) && x.layout !== 'image-sentence') {
            say('Placement disabled for this layout');
            return;
          }
          say(setChoice(s, prop, choices[s.choice]));
        }
        return;
      }
      if (s.control === 'view') switchView();
      else if (s.control === 'review') {
        if (s.file.readOnly) openErrors();
        else {
          scheduler.setReview(!s.review);
          say(s.review ? 'REVIEW ONLY - all AI requests stopped' : 'Edit mode - stopped requests do not resume');
        }
      } else if (
        /^(attach|generate|prompt|style):/.test(s.control || '') &&
        busy(s, s.selected, s.control.split(':')[1])
      )
        say(
          `${fieldName(slideById(s, s.selected), s.control.split(':')[1])} is locked: an AI request is working on it`,
        );
      else if (s.control?.startsWith('attach:')) openAttach(s.control.slice(7));
      else if (s.control?.startsWith('generate:')) generate(s.control.slice(9));
      else if (s.control?.startsWith('style:')) openStyle(s.control.slice(6));
      else if (s.control?.startsWith('prompt:')) openPrompt(s.control.slice(7));
    }
  }
  return {
    handle,
    // Saves text typed in a box without asking, for quitting.
    flush() {
      const e = s.edit;
      s.edit = null;
      if (e && e.text !== editSource(s, e)) saveEdit(s, e);
    },
    openErrors,
    dispose() {
      live = false;
      epoch++;
    },
  };
}
// Help rows: "# Heading" or "keys<TAB>what"; the renderer lays them out in two columns.
// Keys that move the cursor, which Shift turns into highlighting, and keys that replace a highlight.
const MOVES = ['left', 'right', 'up', 'down', 'home', 'end', 'word-left', 'word-right'];
const EDITS = [
  'backspace',
  'delete',
  'word-backspace',
  'word-delete',
  'kill-end',
  'kill-start',
  'text',
  'enter',
  'newline',
];
export const helpLines = [
  '# Moving around',
  'Click\tA box, option, [button], tab or outline row. The slide itself is a preview.',
  'Tab / Shift-Tab\tNext or previous box or control, saving the box you leave',
  'Esc\tLeave the box, saving it, so the keys below work again',
  '[ ]\tPrevious or next slide; Left and Right too when nothing is focused',
  'Ctrl-O\tFocus the outline (a full panel when the window is narrow)',
  '{ } / < >\tNarrow or widen the outline / the chat; or drag the line between two columns',
  "Option-Down / Up\tMake the focused box and the box beside it taller or shorter; or drag a box's bottom edge",
  'v\tNext tab: 1-4 the lesson-plan parts, 5 Slides, 6 Learner preview (or click a tab)',
  '? / q\tThis help / quit (asks first, Cancel is the default)',
  '# Editing',
  'Type\tA focused box takes typing straight away; its green outline shows it has focus',
  'Grey boxes\tFields this layout does not use; they keep their place and cannot be edited',
  'Saving\tLeaving a box saves it; Ctrl-S saves and stays in the box',
  'Enter\tA new line, in every box; Shift-Enter and Ctrl-J too',
  'Arrows, Enter or Space\tChoose a Type, layout or placement',
  '[generate]\tMakes a picture from the image concept with imagegen in Pi; the box locks until it arrives',
  "[prompt]\tShows the prompt and model behind an image box's picture, or what [generate] will send",
  "[attach PNG]\tCopies a local PNG into the lesson's picture folder and puts it in the box",
  'g\tGenerate every missing picture in the lesson, after a confirmation',
  "p\tRead this slide's speaker notes aloud (its title and text when it has none); p again stops",
  "V\tChoose the voice slides are read in, from Google's 30 (gender and style shown); kept between runs",
  's\tVoice speed: 1x, 1.5x, 2x, 3x, 4x, then 1x again; a slide being read changes speed at once',
  'P\tPresent from this slide in the editor, which follows the voice; Space pauses, Left/Right change slides, ' +
    'P or Esc stops; typing in a box or the chat pauses it',
  'o\tHide or show the outline column, so the slide and form are wider; Ctrl-O still opens the outline',
  "z or click a picture\tShow the slide's picture large; Esc or any click closes it",
  'i\tSwitch images between Kitty pictures and text descriptions',
  '# Chat',
  'Ctrl-G\tJump to the message box and back to where you were',
  'Enter\tSend to the focused box; with no box focused, to the whole slide (outside Slides, the whole lesson)',
  'Shift-Enter\tA new line in the message (Ctrl-J or Option-Enter where the terminal cannot tell Shift-Enter)',
  '0\tAim the chat at the whole lesson until you focus a box or change slides; again, back to the slide',
  'Tab (in chat)\tTranscript, effort (low, medium, high), model (Enter lists every model), [whole lesson]',
  'PgUp / PgDn, wheel\tScroll the transcript; the wheel also scrolls a long box (it shows a rail) and the form',
  '# Outline',
  "Up / Down, Enter\tMove and open a slide; a section or subsection row is that group's title slide",
  'Left / Right\tFold or unfold a section',
  'Drag\tPress on a slide row, move, release on a row: before that slide, or first in a section or subsection ' +
    "on its row. Drag a section or subsection row to take another group's place, or a subsection onto a section",
  '[+ slide]\tThe buttons at the outline foot add beside the current slide (ADD TO names where); its name box opens',
  'n r m u d\tNew, rename, move, undo, delete (also the buttons under the outline); Delete works too. ' +
    'On a section or subsection row, d deletes the group and its slides after a confirm',
  "l L\tl locks or unlocks the row's slide (a section or subsection row is its title slide); L locks or unlocks " +
    'every slide in its group. Nobody, you or the AI, can change, move or delete a locked slide',
  '# The lesson and the AI',
  'The file\tEvery change is written to the lesson file at once, if it follows the schema; the header says SAVED',
  'Read only\tA file that breaks the schema opens read only with its errors listed; fix it outside and reopen',
  'A box\tA chat request aimed at a box rewrites only that box; the box locks until the change lands',
  'Whole slide\tA request aimed at a slide may change any of its boxes, layout, type, images; they lock till it ends',
  'Whole lesson\tA request aimed at the whole lesson changes what it claims: everything locks until its first claim, ' +
    'then only the slides and groups it claimed stay locked until it finishes',
  'AI EDIT\tMarks boxes an AI changed. u in the outline undoes a whole-lesson change',
  'Review only\tStops running requests and blocks changes until switched off.',
  'Images\tKitty pictures only in Herdr or Kitty; elsewhere the box shows its concept as text.',
  'Window size\tAt least 100x24, or 80x30 in one column.',
];
