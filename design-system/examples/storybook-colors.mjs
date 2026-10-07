// The foundation color stories. COLORS: IndustrialOS colors grouped by hue, and the derived shade ramp of
// each one. SIGNAL COLORS: the product colors mirrored from status-bar, grouped by use. Pure and I/O-free.
// Every swatch, hex value, name, and role is read from foundation/industrialos-colors.mjs or
// foundation/signal-colors.mjs, so the pages show the reusable data rather than copied constants.
import { fitLine, safeText, span } from '../foundation/cells.mjs';
import { INDUSTRIALOS_COLORS, shadeRamp } from '../foundation/industrialos-colors.mjs';
import { SIGNAL_COLORS } from '../foundation/signal-colors.mjs';

const strong = { fg: 'primary', bold: true };
const heading = { fg: 'secondary', bold: true };
const muted = { fg: 'secondary' };
const named = { fg: 'primary' };
const text = (value, style) => span(safeText(value), style);

const SWATCH = 6; // palette swatch cells
const STEP = 9; // ramp column: 'BLACK 75%' is the widest label
const INDENT = SWATCH + 2; // details line up under the hex value

// Hue order for the page. Record order is not a hue sort; a family missing here gets its own group
// after these, so no color can silently drop off the page.
const GROUPS = [
  ['LIME', ['lime']],
  ['RED / ORANGE', ['red-orange', 'orange']],
  ['MAGENTA', ['magenta']],
  ['VIOLET / INDIGO', ['violet', 'indigo']],
  ['BLUE', ['blue']],
  ['MINT', ['mint']],
  ['YELLOW', ['yellow']],
  ['NEUTRAL', ['neutral']],
];
const listed = new Set(GROUPS.flatMap(([, families]) => families));
const unlisted = [...new Set(INDUSTRIALOS_COLORS.map((c) => c.family))].filter((f) => !listed.has(f)).map((f) => [f.toUpperCase(), [f]]);
export const HUE_GROUPS = Object.freeze([...GROUPS, ...unlisted]
  .map(([title, families]) => Object.freeze({ title, colors: Object.freeze(INDUSTRIALOS_COLORS.filter((c) => families.includes(c.family))) }))
  .filter((g) => g.colors.length));

// Greedy word wrap of already-safe text into lines of at most `width` cells; long words are split, never dropped.
function wrap(value, width) {
  const lines = [];
  let current = '';
  for (let word of value.split(' ')) {
    while (word.length > width) {
      if (current) lines.push(current);
      current = '';
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ' ' + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current || lines.length === 0) lines.push(current);
  return lines;
}

const indentFor = (width, indent) => (width - indent >= 12 ? indent : 0);
function paragraph(value, width, indent = 0, style = muted) {
  const lead = indentFor(width, indent);
  return wrap(safeText(value), width - lead).map((l) => fitLine([span(' '.repeat(lead)), span(l, style)], width));
}

// Pack single-span atoms two cells apart into lines of `width`. Lines after the first start at `rest`
// (dropped below 12 free cells); an atom too wide for a fresh line wraps rather than being clipped.
function flow(atoms, width, { first = 0, rest = first } = {}) {
  const lines = [];
  let line = [];
  let used = 0;
  const open = (indent) => {
    const lead = indentFor(width, indent);
    line = lead ? [span(' '.repeat(lead))] : [];
    used = lead;
  };
  const close = () => lines.push(fitLine(line, width));
  open(first);
  let fresh = true;
  for (const atom of atoms) {
    const size = [...atom.text].length;
    if (!fresh && used + 2 + size > width) {
      close();
      open(rest);
      fresh = true;
    }
    if (!fresh) {
      line.push(span('  '));
      used += 2;
    }
    if (used + size > width) {
      const parts = wrap(atom.text, width - used);
      parts.slice(0, -1).forEach((part) => {
        line.push(span(part, atom.style));
        close();
        open(rest);
      });
      line.push(span(parts.at(-1), atom.style));
      used += parts.at(-1).length;
    } else {
      line.push(atom);
      used += size;
    }
    fresh = false;
  }
  close();
  return lines;
}

// Usage text is shown as safe ASCII, so it names the full block by its escape.
const BLOCK = "'\\u2588'";

// A solid block in the color itself: foreground and background agree, so font gaps cannot show the field.
const swatch = (hex, cells) => span('█'.repeat(cells), { fg: hex, bg: hex });

function groupHeading(group, width) {
  const n = group.colors.length;
  return flow([text(group.title, strong), text(`${n} ${n === 1 ? 'COLOR' : 'COLORS'}`, muted)], width);
}

// One color: swatch, hex, and name on one row when they fit, otherwise the name wraps under the hex
// value; then the role in a wrapped paragraph under the hex value.
function paletteEntry(color, width) {
  const head = flow([swatch(color.hex, Math.min(SWATCH, width)), text(color.hex, strong), text(color.name, named)], width, { rest: INDENT });
  return [...head, ...paragraph(`${color.role}.`, width, INDENT)];
}

const GRID = 5 * STEP + 4 * 2;

// The five ramp steps in columns when they fit; otherwise one step per line, wrapping as needed.
// Generated steps carry DERIVED under or after their label; the BASE step is the color itself.
function rampEntry(color, width) {
  const ramp = shadeRamp(color.hex);
  const head = flow([text(color.name, named), text(color.hex, strong)], width, { rest: 2 });
  if (width >= GRID) {
    const row = (cell) => fitLine(ramp.flatMap((step, i) => [...(i ? [span('  ')] : []), cell(step)]), width);
    return [
      ...head,
      row((step) => swatch(step.hex, STEP)),
      row((step) => text(step.hex.padEnd(STEP), strong)),
      row((step) => text(step.label.padEnd(STEP), step.kind === 'base' ? heading : muted)),
      row((step) => text((step.kind === 'derived' ? 'DERIVED' : '').padEnd(STEP), muted)),
    ];
  }
  const cells = Math.min(4, width);
  return [...head, ...ramp.flatMap((step) => flow([
    swatch(step.hex, cells), text(step.hex, strong), text(step.label, step.kind === 'base' ? heading : muted),
    ...(step.kind === 'derived' ? [text('DERIVED', muted)] : []),
  ], width, { rest: cells + 2 }))];
}

const PLAIN = 'PLAIN OUTPUT: swatches show position only; the hex values carry each color.';

const SHADES_LEGEND = 'BASE is the exact color above. The four DERIVED steps mix its 8-bit sRGB channels 75% and 40% toward black or white: generated here, not part of the collection, and not perceptually uniform.';

function palette(width, swatchCells) {
  const out = [];
  for (const [i, group] of HUE_GROUPS.entries()) {
    out.push(...(i ? [fitLine([], width)] : []), ...groupHeading(group, width));
    for (const color of group.colors) out.push(...paletteEntry(color, width));
  }
  out.push(fitLine([], width), ...paragraph(`${INDUSTRIALOS_COLORS.length} COLORS IN ${HUE_GROUPS.length} HUE GROUPS.`, width));
  return { out, calls: [`swatches = INDUSTRIALOS_COLORS.map((color) => span(${BLOCK}.repeat(${swatchCells}), { fg: color.hex, bg: color.hex }))`] };
}

function shades(width, swatchCells) {
  const out = [...paragraph(SHADES_LEGEND, width)];
  for (const group of HUE_GROUPS) {
    out.push(fitLine([], width), ...groupHeading(group, width));
    group.colors.forEach((color, i) => out.push(...(i ? [fitLine([], width)] : []), ...rampEntry(color, width)));
  }
  const n = INDUSTRIALOS_COLORS.length;
  out.push(fitLine([], width), ...paragraph(`${n * 5} STEPS: ${n} EXACT BASES AND ${n * 4} DERIVED. Black and white bases repeat their endpoint values; no alternates are invented.`, width));
  return {
    out,
    calls: [
      'ramps = INDUSTRIALOS_COLORS.map((color) => shadeRamp(color.hex))',
      `swatches = ramps.map((ramp) => ramp.map((step) => span(${BLOCK}.repeat(${swatchCells}), { fg: step.hex, bg: step.hex })))`,
    ],
  };
}

const VIEWS = { PALETTE: palette, SHADES: shades };

export const COLOR_STORY = Object.freeze({
  id: 'colors',
  kind: 'foundation',
  title: 'COLORS',
  summary: 'IndustrialOS colors by hue, with derived shade ramps. A reference page, not a theme: Acid / Black stays the default palette.',
  module: 'foundation/industrialos-colors.mjs',
  contract: 'foundation/README.md',
  rules: [
    'INDUSTRIALOS_COLORS holds frozen records: id, name, hex, family, and role.',
    'Keep DERIVED visible wherever a generated ramp step is shown.',
    'shadeRamp(hex) returns five steps; only the BASE step is the listed color.',
    'paint() accepts these #RRGGBB values as fg or bg; invalid colors throw TypeError.',
    'Swatches need 24-bit color. No contrast or accessibility rating is claimed.',
  ],
  variants: [
    { name: 'PALETTE', note: 'Every color grouped by hue, with its hex value, name, and role.' },
    { name: 'SHADES', note: 'The five-step shadeRamp() of every color: two darker, the exact base, two lighter.' },
  ],
  specimen(variant, width, { mode = 'TRUECOLOR' } = {}) {
    const w = Math.min(width, 76);
    const view = VIEWS[variant.name](w, Math.min(variant.name === 'PALETTE' ? SWATCH : w >= GRID ? STEP : 4, w));
    const lines = mode === 'PLAIN' ? [...paragraph(PLAIN, w), fitLine([], w), ...view.out] : view.out;
    return { lines, calls: view.calls, facts: [] };
  },
});

// Signal colors by use. Each group's note says what status-bar uses them for; a key missing here gets an
// OTHER group, so no mirrored value can silently drop off the page.
const USES = [
  ['COUNT TIERS AND MODE INKS', 'CMP count tiers, the USG plate, and PNYTL mode inks.', ['violet', 'pink', 'cobalt', 'magenta', 'teal']],
  ['GAUGE ZONE TRACKS', 'Unused track cells in the warning and high zones: 20% of the state color over the field.', ['warningZone', 'criticalZone']],
  ['LOST SEGMENT', 'A lost quota square at rest, the same grey for every provider.', ['ghost']],
  ['CHECKING FADE', 'The check fade: decorative grey lightening in four steps.', ['checkLow', 'checkMid', 'checkHigh', 'checkPeak']],
  ['WARM-UP STEPS', '25, 50, and 75% of a state color over the field.', ['accent25', 'accent50', 'accent75', 'warning25', 'warning50', 'warning75', 'critical25', 'critical50', 'critical75', 'decorative50']],
  ['USAGE PROVIDERS', 'Each provider: lit, used (20% over the field), and the burn-out mid (50%).', ['gpt', 'gptUsed', 'gptMid', 'cld', 'cldUsed', 'cldMid', 'kmi', 'kmiUsed', 'kmiMid']],
];
const used = new Set(USES.flatMap(([, , names]) => names));
const others = Object.keys(SIGNAL_COLORS).filter((name) => !used.has(name));
export const SIGNAL_GROUPS = Object.freeze([...USES, ...(others.length ? [['OTHER', 'Mirrored values not yet grouped by use.', others]] : [])]
  .map(([title, note, names]) => Object.freeze({ title, note, names: Object.freeze(names.filter((name) => Object.hasOwn(SIGNAL_COLORS, name))) }))
  .filter((g) => g.names.length));

const SIGNAL_NOTE = "Mirrored from status-bar's C palette, which is their authority. Literal #rrggbb values, not Acid / Black roles, and separate from the IndustrialOS reference collection.";

function signals(width, swatchCells) {
  const out = [...paragraph(SIGNAL_NOTE, width)];
  for (const group of SIGNAL_GROUPS) {
    const n = group.names.length;
    out.push(fitLine([], width), ...flow([text(group.title, strong), text(`${n} ${n === 1 ? 'COLOR' : 'COLORS'}`, muted)], width), ...paragraph(group.note, width, 0));
    for (const name of group.names) out.push(...flow([swatch(SIGNAL_COLORS[name], swatchCells), text(SIGNAL_COLORS[name], strong), text(name, named)], width, { rest: INDENT }));
  }
  out.push(fitLine([], width), ...paragraph(`${Object.keys(SIGNAL_COLORS).length} SIGNAL COLORS IN ${SIGNAL_GROUPS.length} GROUPS.`, width));
  return { out, calls: [`swatches = Object.entries(SIGNAL_COLORS).map(([name, hex]) => span(${BLOCK}.repeat(${swatchCells}), { fg: hex, bg: hex }))`] };
}

export const SIGNAL_STORY = Object.freeze({
  id: 'signal-colors',
  kind: 'foundation',
  title: 'SIGNAL COLORS',
  summary: "The product colors status-bar uses beside the nine Acid / Black roles, mirrored for the elements and motions modeled on it. A reference page, not a theme.",
  module: 'foundation/signal-colors.mjs',
  contract: 'foundation/README.md',
  rules: [
    'SIGNAL_COLORS is a frozen object of lowercase #rrggbb strings; paint() accepts them as fg or bg.',
    "status-bar's C palette is the authority; agreement is a review comparison, not an import or test.",
    'They are not role names: a motion never treats a literal color as a warning or critical cell.',
    'mixOver(color, p) gives p of a color over the field; mirrored mixes are returned exactly.',
    'Swatches need 24-bit color. No contrast or accessibility rating is claimed.',
  ],
  variants: [{ name: 'BY USE', note: 'Every signal color grouped by what status-bar uses it for, with its hex value and key.' }],
  specimen(variant, width, { mode = 'TRUECOLOR' } = {}) {
    const w = Math.min(width, 76);
    const view = signals(w, Math.min(SWATCH, w));
    const lines = mode === 'PLAIN' ? [...paragraph(PLAIN, w), fitLine([], w), ...view.out] : view.out;
    return { lines, calls: view.calls, facts: [] };
  },
});
