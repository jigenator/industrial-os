// Compile-only public contract specimen; uses the existing claude-interrupt compiler, no DS toolchain.
import { cells, fit, fitLine, fitText, lineWidth, paint, resolveStyle, span, textSlot } from '@industrial-os/design-system/foundation/cells';
import { composeSurface, blendFill, dotAt, surfaceAt } from '@industrial-os/design-system/foundation/surface';
import { SURFACE_PALETTE } from '@industrial-os/design-system/foundation/surface-palette';
import { INDUSTRIALOS_COLORS, shadeRamp } from '@industrial-os/design-system/foundation/industrialos-colors';
import { labelPlate } from '@industrial-os/design-system/elements/label-plate';
import { lamp } from '@industrial-os/design-system/elements/lamp';
import { stateChip } from '@industrial-os/design-system/elements/state-chip';
import { drawIn, drawInDuration } from '@industrial-os/design-system/motions/draw-in';
import { reveal, revealDuration } from '@industrial-os/design-system/motions/reveal';

const measure = (text: string): number => text.length; // synthetic measurer; hosts supply actual cell widths
const slot = textSlot([span('fixture', { italic: true, underline: true })], 7, { measure });
const plate = labelPlate(slot, { form: 'slab', measure, maxWidth: 12 });
const word = stateChip({ state: 'answered' }, { form: 'word', preset: { answered: { code: slot, shape: '', tone: 'accent' } }, measure });
const light = lamp('working', { appearance: 'round', style: { fg: SURFACE_PALETTE.accent } });
fit('fixture', 3, { measure });
cells('fixture', { measure });
lineWidth(plate, { measure });
fitLine(word, 12, {}, { measure });
fitText(slot, 6, { measure });
paint(light, 'truecolor');
resolveStyle({ italic: true }).italic satisfies boolean | undefined;
const surface = composeSurface([[{ text: ' ', style: { bg: SURFACE_PALETTE.wheat } }]], {
  width: 1, height: 1, fills: { [SURFACE_PALETTE.wheat]: { alpha: .61 } },
  exclude: [{ x: 0, y: 0, width: 1, height: 1, mode: 'floor' }], color: false,
});
blendFill(surfaceAt(0, 0, { width: 1, height: 1 }), 'field', .5);
dotAt(2, 1);
surface[0][0].text satisfies string;
shadeRamp(INDUSTRIALOS_COLORS[0].hex);
drawInDuration([plate]);
drawIn([plate], { animate: false });
revealDuration(1, { veil: 'dim' });
reveal([plate], { animate: false });
// @ts-expect-error invalid surface mode
composeSurface([[{ text: ' ' }]], { width: 1, height: 1, color: 'false' });
// @ts-expect-error style attributes are booleans
span('fixture', { underline: 'yes' });
// @ts-expect-error invalid lamp appearance
lamp('working', { appearance: 'circle' });
// @ts-expect-error slot width is numeric
textSlot([], '7', { measure });
// @ts-expect-error word form does not accept a Tatsu count input
stateChip({ state: 'answered', commitsBehind: 1 }, { form: 'word' });
// @ts-expect-error round lamps require explicit style
lamp('working', { appearance: 'round' });

// Plain strings remain usable without a measurer; every slot-bearing path requires one.
labelPlate('fixture');
fitText('fixture', 6);
stateChip({ state: 'answered' }, { form: 'word', preset: { answered: { code: 'answered', shape: '', tone: 'accent' } } });
stateChip({ label: slot, state: 'current' }, { form: 'word', measure });
// @ts-expect-error slots require a measurer even with otherwise default plate options
labelPlate(slot);
// @ts-expect-error slot plate options must include a measurer
labelPlate(slot, { form: 'slab' });
// @ts-expect-error fitText slots require a measurer
fitText(slot, 6);
// @ts-expect-error styling is not a substitute for a slot measurer
fitText(slot, 6, { style: { bold: true } });
// @ts-expect-error slot labels require a measurer
stateChip({ label: slot, state: 'current' }, { form: 'word' });
// @ts-expect-error slot preset words require a measurer
stateChip({ state: 'answered' }, { form: 'word', preset: { answered: { code: slot, shape: '', tone: 'accent' } } });
const hostCells = composeSurface([[{ text: ' ', raw: 'original', link: { id: 'fixture' } }]], { width: 1, height: 1 });
hostCells[0][0].raw satisfies string;
hostCells[0][0].link.id satisfies string;

import { tabRule, nameRule, neatline } from './elements/tab-rule/tab-rule.mjs';
import { actionLabel, keyHints } from './elements/action-label/action-label.mjs';
import { popupHeader, popupFooter } from './elements/popup-header/popup-header.mjs';
import { noticeRow } from './elements/notice-row/notice-row.mjs';
import { scopeMeter } from './elements/scope-meter/scope-meter.mjs';
import { soundingMeter } from './elements/sounding-meter/sounding-meter.mjs';
import { feedBezel, imageLabel, imageInset } from './elements/feed-bezel/feed-bezel.mjs';
import { inputFrame } from './elements/input-frame/input-frame.mjs';
import { scopeTrace, blipPass, blipRest } from './motions/scope-trace.mjs';
import { soundingSweep } from './motions/sounding-sweep.mjs';
import { feedScan } from './motions/feed-scan.mjs';
import { cornerSnap } from './motions/corner-snap.mjs';
tabRule({ focused: true }, { width: 40 });
nameRule({ meter: soundingMeter() }, { width: 40 });
neatline({ label: 'START' }, { width: 40 });
actionLabel({ state: 'read' }); keyHints([{ key: '^O', label: 'open' }], { width: 40 });
popupHeader({ plate: 'IMAGE' }, { width: 40 }); popupFooter({}, { width: 40 });
noticeRow({ text: 'synthetic notice' }, { width: 40 });
const rect = { x: 3, y: 1, width: 32, height: 16 };
feedBezel({ imageRect: rect, meter: scopeMeter() }, { width: 40, height: 20 });
imageInset(rect, { width: 40, height: 20 }); imageLabel({ label: 'sample' });
cornerSnap(inputFrame({ state: 'focused' }, { width: 40 }), { time: 80 });
feedScan([], { rails: [2, 35], time: 40 }); scopeTrace([scopeMeter()], { time: 80, previousKey: blipPass(0).key });
soundingSweep([soundingMeter()], { time: 40 });
// @ts-expect-error rich slots require a measurer
popupHeader({ plate: { spans: [], width: 0 } }, { width: 40 });
// @ts-expect-error rich slots require a measurer
inputFrame({ label: { spans: [], width: 0 } }, { width: 40 });

blipRest(blipPass(1), 8000);
noticeRow({ plate: 'LINK', plateFirst: true, glyph: '⠋', glyphInk: 'accent', plateStyle: { fg: 'field', bg: 'structural' }, detail: [{ kind: 'command', text: '$ cd synthetic-project', label: 'SH' }] }, { width: 66 });
noticeRow({ detail: [{ kind: 'command', text: { spans: [], width: 0 }, label: { spans: [], width: 0 } }] }, { width: 66, measure: text => text.length });
// @ts-expect-error command text slots require a measurer
noticeRow({ detail: [{ kind: 'command', text: { spans: [], width: 0 } }] }, { width: 66 });
// @ts-expect-error the mockup has no focused open-action state
actionLabel({ state: 'focused' });
import { callout, subtitle, timestampLeader } from './elements/callout/callout.mjs';
import { documentHeading, listRow, quoteRows, linkLines, codeBand, inlineCode, specTable } from './elements/document-block/document-block.mjs';
import { cardState, cardHeading, sheetCard, stackCard, stackRow, sheetListRow } from './elements/sheet-card/sheet-card.mjs';
import { deskStrip, deskHeading, questionTitle, questionBody, deskFooter } from './elements/desk-tray/desk-tray.mjs';
import { operationHeading, operationRow, operationDetail } from './elements/operation-row/operation-row.mjs';
import { calloutEntrance, calloutEntranceDuration } from './motions/callout-entrance.mjs';
import { phosphorHead } from './motions/phosphor-head.mjs';
const contentOptions = { width: 40, measure };
callout({ name: slot, body: [slot], readout: slot, reference: slot }, contentOptions);
subtitle({ body: [slot], marker: slot, aside: true }, contentOptions);
timestampLeader({ readout: slot }, contentOptions);
documentHeading({ text: slot, level: 2 }, contentOptions);
listRow({ body: slot, marker: slot }, contentOptions);
quoteRows({ body: [slot] }, contentOptions);
linkLines({ label: slot, url: slot }, contentOptions);
codeBand({ language: slot, body: [slot] }, contentOptions);
inlineCode(slot, { measure });
specTable({ headings: [slot], rows: [[slot]], align: ['right'] }, contentOptions);
cardState({ state: 'answered', answer: slot }, { measure });
cardHeading({ number: slot, time: slot, state: 'waiting' }, contentOptions);
sheetCard({ heading: { number: slot }, gist: [slot], title: slot, button: slot }, contentOptions);
stackCard({ heading: slot, rows: [{ label: slot, title: slot, state: 'read' }] }, contentOptions);
stackRow({ label: slot, title: slot, state: 'read' }, contentOptions);
sheetListRow({ title: slot, updated: slot }, contentOptions);
deskStrip({ count: slot, hint: slot }, contentOptions);
deskHeading({ count: slot, hint: slot }, contentOptions);
questionTitle({ label: slot, title: slot, meta: slot }, contentOptions);
questionBody({ prompt: [slot], options: [{ label: slot, body: slot, pick: true }] }, contentOptions);
deskFooter({ text: slot, detail: slot }, contentOptions);
operationHeading({ label: slot, code: slot, count: slot }, contentOptions);
operationRow({ time: slot, category: slot, detail: slot, duration: slot }, { ...contentOptions, color: false });
operationDetail({ label: slot, value: slot }, contentOptions);
calloutEntrance(callout({ body: ['fixture'] }, { width: 40 }), { time: 200, gutter: { top: 1, left: 1, rows: 1, cols: 1 } });
calloutEntranceDuration([], { mode: 'register', gutter: { rows: 5, cols: 5 } }) satisfies number;
phosphorHead([plate], { time: 0, head: { row: 0, col: 0 }, measure });
SURFACE_PALETTE.code satisfies `#${string}`;
// @ts-expect-error rich body slots require a measurer
callout({ body: [slot] }, { width: 40 });
// @ts-expect-error nested card slots require a measurer
sheetCard({ heading: { number: slot } }, { width: 40 });
// @ts-expect-error nested table slots require a measurer
specTable({ headings: ['fixture'], rows: [[slot]] }, { width: 40 });
// @ts-expect-error question option slots require a measurer
questionBody({ options: [{ body: slot }] }, { width: 40 });
// @ts-expect-error operation detail slots require a measurer
operationRow({ detail: slot }, { width: 40 });
// @ts-expect-error invalid operation state
operationRow({ state: 'missing' }, { width: 40 });
// @ts-expect-error invalid entrance mode
calloutEntrance([], { time: 0, mode: 'other' });
