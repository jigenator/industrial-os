// Compile-only public-subpath contracts; no Pi host, clock or runtime fixture.
import { random, pick } from '@industrial-os/design-system/foundation/seeded';
import { SIGNAL_COLORS } from '@industrial-os/design-system/foundation/signal-colors';
import { labelPlate } from '@industrial-os/design-system/elements/label-plate';
import { countPlate, COUNT_PLATES } from '@industrial-os/design-system/elements/count-plate';
import { lamp } from '@industrial-os/design-system/elements/lamp';
import { unitMarks } from '@industrial-os/design-system/elements/thread-rail';
import { numeralGrid, numeralAt, numeralLines } from '@industrial-os/design-system/elements/pixel-numeral';
import { pnytlPlateParts } from '@industrial-os/design-system/elements/mode-plate';
import { stateChipParts } from '@industrial-os/design-system/elements/state-chip';
import { providerColumnParts } from '@industrial-os/design-system/elements/segment-meter';
import { gaugeTrack, gaugeParts, gaugeScaleParts } from '@industrial-os/design-system/elements/gauge';
import { frameGeometry, frameStubs, frameCenter } from '@industrial-os/design-system/elements/instrument-frame';
import { blinkOn } from '@industrial-os/design-system/motions/blink';
import { nudgeOffset } from '@industrial-os/design-system/motions/nudge';
import { flash } from '@industrial-os/design-system/motions/flash';
import { cycle } from '@industrial-os/design-system/motions/cycle';
import { fade } from '@industrial-os/design-system/motions/fade';
import { latch } from '@industrial-os/design-system/motions/latch';
import { beacon } from '@industrial-os/design-system/motions/beacon';
import { fillIn } from '@industrial-os/design-system/motions/fill-in';
import { burnOut } from '@industrial-os/design-system/motions/burn-out';
import { edgePulse } from '@industrial-os/design-system/motions/edge-pulse';
import type { Line } from '@industrial-os/design-system/foundation/cells';
const r = random(1), seed: number = r.cursor, choice: string = pick(r, ['x']);
void [seed, choice];
const plate: Line = labelPlate('04 USG', { form: 'slab', style: { fg: 'field', bg: SIGNAL_COLORS.pink } });
countPlate(3, COUNT_PLATES.units);
lamp('working', { appearance: 'field', lit: blinkOn(500) });
unitMarks(2, { sides: [0, 1] });
const grid = numeralGrid(84);
if (grid) numeralLines(numeralAt(grid, grid, 0.5, 1), { width: grid.w });
pnytlPlateParts('lite', { active: true });
stateChipParts({ label: 'BG', state: 'running' }, { preset: { running: { shape: '◆', code: 'RUN', tone: 'primary' } }, count: 1 });
stateChipParts({ label: 'TCLI', state: 'behind', commitsBehind: NaN }, { countPolicy: 'number-text' });
providerColumnParts({ provider: 'claude', data: { windows: { wk: { usedPercent: 1 } } } }, { age: null });
gaugeTrack({ percent: 70, readout: '84k/100k' }, { cells: 60, fill: 'cell-ceil', fillInk: 'zone' });
gaugeParts('?', 'unknown');
gaugeScaleParts({ cells: 60 }, { width: 63, decilesMinCells: 50 });
frameGeometry(1200, { maxWidth: Infinity });
frameStubs({ gutter: 2, row: 1, innerRows: 5 });
frameCenter({ width: 80, titleEnd: 10, asideStart: 60, offset: nudgeOffset(100) });
flash([plate], { time: 0, solidBackground: true, invertStyle: { fg: 'field', bg: 'primary' } });
for (const motion of [cycle, fade, latch, beacon, fillIn, burnOut, edgePulse]) motion([plate], { animate: false });
// @ts-expect-error Unknown lamp appearance.
lamp('working', { appearance: 'blank' });
// @ts-expect-error Unknown frame option.
frameGeometry(80, { uncapped: true });
// @ts-expect-error Unknown gauge rounding mode.
gaugeTrack({ percent: 1 }, { cells: 10, fill: 'round' });
// @ts-expect-error Glyph poses are binary.
unitMarks(1, { sides: [2] });
// @ts-expect-error Unknown provider.
providerColumnParts({ provider: 'unknown' });
// @ts-expect-error Unknown flash option.
flash([plate], { time: 0, hideState: true });
// @ts-expect-error Unknown state-chip count policy.
stateChipParts({ label: 'TCLI', state: 'behind' }, { countPolicy: 'coerce' });
