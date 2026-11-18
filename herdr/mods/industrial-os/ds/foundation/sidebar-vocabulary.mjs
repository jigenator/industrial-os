// Sidebar vocabulary: the values and words of the Industrial OS sidebar in the Herdr desktop app. Values and
// vocabulary only: nothing here draws terminal cells. The Herdr mod (../../herdr/mods/industrial-os) is the only
// renderer; it cannot import a package, so it reads this file from its ds/ copy, and its marks/*.svg are written
// from markFiles(), both by herdr/scripts/sync-design-system.mjs. Contract: README.md#sidebar-vocabulary.

// Colors the sidebar uses beside the Acid / Black roles, which it takes from the app theme.
export const SIDEBAR_COLORS = Object.freeze({
  // Print on a lit plate, and the glass and dots laid over the ground.
  black: '#000000',
  white: '#ffffff',
  // The crate plate: paper, its print and its hairlines.
  paper: '#dedede',
  ink: '#111111',
  paperLabel: '#6b6b6b',
  paperRule: '#cdcdcd',
  paperHair: '#a9a9a9',
  paperMark: '#9a9a9a',
  crosshair: '#6f6f6f',
  orange: '#ec6a35', // a halted zone and an alert plate, on paper
  light: '#a7dd03', // acid light falling on paper: paper × accent, channel by channel
  // The shared map on its dark board. Its acid and red start greener and redder than the theme's, because the
  // map adds its own light back over itself and lands on the theme's colors once exposed.
  mapAcid: '#78fa08',
  mapCritical: '#ee3a1c',
  mapInk: '#ffffff',
  mapDim: '#8a8a8a',
  mapZone: '#d6d6d6',
  mapHalt: '#f24723',
  mapBack: '#0b0c0d',
  mapBoard: '#090a0b',
  mapRoad: '#b4b4b4',
  mapLabel: '#8a8a8a',
  mapName: '#cfcfcf',
  // The same map printed on the plate.
  plateZone: '#111111',
  plateDim: '#6f6f6f',
  plateRoad: '#6f6f6f',
  plateLabel: '#555555',
  plateName: '#333333',
  // The list's greys, brightest first, and its lines.
  title: '#e6e6e6',
  value: '#cfcfcf',
  name: '#b4b4b4',
  titleQuiet: '#9a9a9a',
  nameIdle: '#8a8a8a',
  detail: '#7a7a7a',
  reading: '#6f6f6f',
  caret: '#6a6a6a',
  label: '#5c5c5c',
  tick: '#3a3d42',
  track: '#2e2e2e',
  ruleStrong: '#2a2a2a',
  rule: '#262626',
  // Keys and shortcut plates.
  keyText: '#f2f2f2',
  keyRest: '#8a8a8a',
  keyPressed: '#9fd300',
  // Context used from 70%; from 90% it is the theme's critical.
  warn: '#ffd400',
  // The sidebar's ground, top to bottom, and its dots.
  groundTop: '#131416',
  groundBottom: '#090a0c',
  groundDot: '#2a2b30',
  groundDotMajor: '#383a3f',
  // A flicker's colour fringes: one pixel of each on a bar's two ends.
  fringeRed: '#ff3c3c',
  fringeCyan: '#00e5ff',
});

// Opacities of the sidebar's glass, dot grids and light.
export const SIDEBAR_ALPHA = Object.freeze({
  glass: 0.07, // a space's band and the shortcut strip: white over the ground
  glassEdge: 0.14,
  glassShut: 0.035,
  glassShutEdge: 0.07,
  focusGlass: 0.026, // the focused pane's block
  focusDot: 0.17,
  focusDotLit: 0.2,
  alertGlass: 0.045, // ACTION REQUIRED, in the theme's critical
  alertDot: 0.34,
  alertDotLit: 0.42,
  currentDot: 0.27, // the current space's band, in the theme's accent
  scopeGlass: 0.035,
  lightTop: 0.76,
  lightBottom: 0.3,
  mapBack: 0.88,
  mapBoard: 0.84,
  mapRest: 0.58, // a map window that is neither focused nor hovered
  plateBack: 0.92,
  glow: 0.5, // how much of its own color a lit element bleeds
  groundDotRest: 0.42, // the ground's dots at rest; near the pointer or the sweep they come up to full
  sweep: 0.1, // the line that sweeps down the ground, in the theme's accent
  latch: 0.75, // a pane's block for the moment its state changes: the ground shows through its colour
  fringeRed: 0.35,
  fringeCyan: 0.32,
});

// A pane's state code and what its unit reports on the map.
export const UNIT_STATUS = Object.freeze({
  QNS: 'RFI',
  BLK: 'HOLD',
  DNE: 'SITREP',
  WRK: 'ON TASK',
  SUB: 'ON TASK',
  RUN: 'EXEC',
  IDL: 'STBY',
  UNK: 'NO COMMS',
});

// A tab is a zone. The first that applies: every pane blocked, any working, any needing the person, else secure.
export const ZONE_STATUS = Object.freeze({ halted: 'HALTED', active: 'ACTIVE', pending: 'PENDING', secure: 'SECURE' });

/** A zone's status from its panes' state codes. A zone without panes is secure. */
export function zoneStatus(codes) {
  if (codes.length > 0 && codes.every((code) => code === 'BLK')) return 'halted';
  if (codes.some((code) => code === 'WRK' || code === 'SUB' || code === 'RUN')) return 'active';
  if (codes.some((code) => code === 'QNS' || code === 'BLK')) return 'pending';
  return 'secure';
}

// What a unit is: a Pi droid, another agent, a plain terminal, a mod's pane.
export const UNIT_KINDS = Object.freeze({ drd: 'DRD', agt: 'AGT', trm: 'TRM', mod: 'MOD' });

/** A space's letter from its position, from 0: A–Z, then AA, AB and so on. */
export function spaceLetter(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('space index must be a non-negative safe integer');
  let text = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) text = String.fromCharCode(65 + (n % 26)) + text;
  return text;
}

const two = (n) => String(Math.min(99, n)).padStart(2, '0');

/** A tab's grid reference: its space's letter and its position, from 0, as two digits from 01. `A01`. */
export function gridReference(spaceIndex, tabIndex) {
  if (!Number.isSafeInteger(tabIndex) || tabIndex < 0) throw new RangeError('tab index must be a non-negative safe integer');
  return `${spaceLetter(spaceIndex)}${two(tabIndex + 1)}`;
}

/** A unit's designation: what it is, its tab's grid reference and its place in the tab, from 0. `DRD-A01-1`. */
export function designation(kind, spaceIndex, tabIndex, unitIndex) {
  if (!Object.hasOwn(UNIT_KINDS, kind)) throw new RangeError(`unknown unit kind: ${kind}`);
  if (!Number.isSafeInteger(unitIndex) || unitIndex < 0) throw new RangeError('unit index must be a non-negative safe integer');
  return `${UNIT_KINDS[kind]}-${gridReference(spaceIndex, tabIndex)}-${unitIndex + 1}`;
}

// State marks, drawn on a 9 × 9 grid. A mark that moves is a list of frames shown in turn, `stepMs` each, in hard
// steps. A lit mark (working or needing the person) bleeds its own color; the others are print.
const fill = (shape) => `${shape} fill="#000"/>`;
const line = (shape, width) => `${shape} fill="none" stroke="#000" stroke-width="${width}"/>`;
const round = (n) => Math.round(n * 100) / 100;
const core = fill('<rect x="3.4" y="3.4" width="2.2" height="2.2"');
const satellite = (degrees) => {
  const a = (degrees * Math.PI) / 180;
  return fill(`<circle cx="${round(4.5 + 3.6 * Math.sin(a))}" cy="${round(4.5 - 3.6 * Math.cos(a))}" r="0.95"`);
};
const box = (opacity) => line(`<rect x="0.5" y="0.5" width="8" height="8"${opacity ? ` opacity="${opacity}"` : ''}`, 1);
const cell = (x, y) => fill(`<rect x="${[0.3, 3.3, 6.3][x]}" y="${[0.3, 3.3, 6.3][y]}" width="2.4" height="2.4"`);
const diamond = fill('<path d="M4.5 2.3l2.2 2.2-2.2 2.2-2.2-2.2z"');
const grid = [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => cell(x, y))).join('');

export const STATE_MARKS = Object.freeze({
  // A ringed diamond; the ring blinks.
  QNS: Object.freeze({ lit: true, stepMs: 440, frames: Object.freeze([diamond + line('<circle cx="4.5" cy="4.5" r="3.9"', 0.9), diamond]) }),
  // A crossed box.
  BLK: Object.freeze({ lit: true, stepMs: 0, frames: Object.freeze([box() + line('<path d="M2.4 2.4l4.2 4.2M6.6 2.4L2.4 6.6"', 1.2)]) }),
  // A core with one satellite circling.
  WRK: Object.freeze({ lit: true, stepMs: 110, frames: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7].map((k) => core + satellite(k * 45))) }),
  // A core with three.
  SUB: Object.freeze({ lit: true, stepMs: 110, frames: Object.freeze([0, 1, 2, 3].map((k) => core + [0, 120, 240].map((a) => satellite(k * 30 + a)).join(''))) }),
  // A frame with a scan line.
  RUN: Object.freeze({ lit: true, stepMs: 220, frames: Object.freeze([0, 1, 2, 3].map((k) => box(0.5) + fill(`<rect x="2" y="${round(1.6 + k * 1.4)}" width="5" height="1.4"`))) }),
  // A solid grid.
  DNE: Object.freeze({ lit: false, stepMs: 0, frames: Object.freeze([grid]) }),
  // A ring.
  IDL: Object.freeze({ lit: false, stepMs: 0, frames: Object.freeze([line('<circle cx="4.5" cy="4.5" r="3.4"', 1.2)]) }),
  // One cell.
  UNK: Object.freeze({ lit: false, stepMs: 0, frames: Object.freeze([cell(1, 1)]) }),
});

/** Which frame of a state mark shows at `ms` on any clock. A still mark is frame 0. */
export function markFrame(code, ms) {
  const mark = STATE_MARKS[code];
  if (!mark) throw new RangeError(`unknown state code: ${code}`);
  return mark.stepMs > 0 ? Math.floor(Math.max(0, ms) / mark.stepMs) % mark.frames.length : 0;
}

// A drawn mark is a one-color mask, tinted by whoever draws it. It sits in the middle of a box `MARK_BOX` wide,
// `MARK_PAD` clear on each side, so a lit mark's halo has room.
export const MARK_PAD = 4;
export const MARK_BOX = 9 + 2 * MARK_PAD;

const HALO = `<defs><filter id="g" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.25"/></filter></defs>`;
const svgDocument = (inner, size, lit) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 2 * MARK_PAD}" height="${size + 2 * MARK_PAD}" viewBox="${-MARK_PAD} ${-MARK_PAD} ${size + 2 * MARK_PAD} ${size + 2 * MARK_PAD}">`
  + `${lit ? `${HALO}<g filter="url(#g)" opacity="0.75">${inner}</g>` : ''}${inner}</svg>\n`;

/** One frame of a state mark as an SVG document. */
export function markSvg(code, frame = 0) {
  const mark = STATE_MARKS[code];
  if (!mark) throw new RangeError(`unknown state code: ${code}`);
  if (!Number.isSafeInteger(frame) || frame < 0 || frame >= mark.frames.length) throw new RangeError('no such frame');
  return svgDocument(mark.frames[frame], 9, mark.lit);
}

// The sidebar's other drawn signs, each on a 9 × 9 grid (the 24-unit drawings are scaled to it).
const scaled = (inner) => `<g transform="scale(0.375)">${inner}</g>`;
export const SIDEBAR_ICONS = Object.freeze({
  // The Industrial OS mark, for droids.
  droid: scaled(line('<path d="M12 2.5 22 21H2z"', 3) + line('<path d="M12 11.5 15.5 18h-7z"', 3)),
  // A benzene ring, for the machine.
  machine: scaled(line('<path d="M12 1.8 20.8 6.9v10.2L12 22.2 3.2 17.1V6.9z"', 2.7) + line('<circle cx="12" cy="12" r="3.9"', 2.7)),
  // Four dots, for spaces.
  spaces: scaled(fill('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"')),
  // The command key's sign.
  command: scaled(line('<path d="M9 9V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"', 2.6)),
  // A square lens, for search.
  search: scaled(line('<path d="M3 3h13v13H3zM16 16l5 5" stroke-linecap="square"', 3)),
  // The manual flag.
  flag: line('<path d="M1.5 0.5v8"', 1.3) + fill('<path d="M2 1h6L6.3 3.1 8 5.2H2z"'),
  // The view ruler's index pointer.
  pointer: fill('<path d="M0.5 7L4.5 2l4 5z"'),
});

// The signs that are lit wherever they are drawn in a state color.
const LIT_ICONS = Object.freeze(['flag', 'pointer', 'search']);

/** A sign as an SVG document; `lit` adds the halo (default: the flag, the pointer and the search lens). */
export function iconSvg(name, lit = LIT_ICONS.includes(name)) {
  if (!Object.hasOwn(SIDEBAR_ICONS, name)) throw new RangeError(`unknown sidebar icon: ${name}`);
  return svgDocument(SIDEBAR_ICONS[name], 9, lit);
}

/** Every drawn file the mod ships: `[file name, SVG document]`, in a fixed order. */
export function markFiles() {
  const files = [];
  for (const [code, mark] of Object.entries(STATE_MARKS)) {
    mark.frames.forEach((_frame, k) => files.push([`${code.toLowerCase()}-${k}.svg`, markSvg(code, k)]));
  }
  for (const name of Object.keys(SIDEBAR_ICONS)) {
    files.push([`${name}.svg`, iconSvg(name, false)]);
    if (LIT_ICONS.includes(name)) files.push([`${name}-lit.svg`, iconSvg(name, true)]);
  }
  return files;
}
