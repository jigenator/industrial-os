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
