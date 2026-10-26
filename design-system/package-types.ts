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
