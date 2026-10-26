import { composeSurface } from '../foundation/surface.mjs';
import { SURFACE_PALETTE as P } from '../foundation/surface-palette.mjs';
import { call, code, literal } from './storybook-usage.mjs';

// Synthetic locked-look fixture, not a default alpha policy. Lunalee owns this configuration.
export const SURFACE_FILLS = Object.freeze(Object.fromEntries([
  [P.accent, 1], [P.yellow, 1], [P.critical, 1], [P.criticalHover, 1],
  ...[P.answered, P.wheat, P.wheatHi, P.bone, P.structural].map((fill) => [fill, 1 - 1.5 * (1 - .74)]),
  [P.orange, .80], [P.warning, .68], [P.plateGrey, .69], [P.declined, .72],
  [P.surface, .25], [P.tint, 1 - 1.5 * (1 - .55)], [P.tintHi, 1 - 1.5 * (1 - .55)],
  [P.selection, .25], [P.hover, 1 - 1.5 * (1 - .45)],
].map(([fill, alpha]) => [fill, Object.freeze({ alpha })])));

export const SURFACE_STORY = {
  id: 'surface', kind: 'foundation', title: 'SURFACE', module: 'foundation/surface.mjs', contract: 'foundation/README.md#surface',
  summary: 'A pane-absolute charcoal gradient, hashed dot lattice, and configured translucent fills. Synthetic cells, not live output.',
  rules: [
    'Clearance is two occupied cells in the same row; authored middle dots remain content.',
    'Unknown explicit backgrounds stay opaque. Solid roles never show floor dots.',
    'The host supplies cell geometry, alpha policy, masks and NO_COLOR. No ANSI parsing or I/O.',
    'NO_COLOR removes colors and floor dots, not semantic words or markers.',
  ],
  variants: [
    { name: 'CLEAR', note: 'The current gradient and stable minor/major lattice.' },
    { name: 'FILLS', note: 'Locked strength 1.5; exact computed alphas, not rounded display figures.' },
    { name: 'SOLID', note: 'Accent, focused log, critical, critical hover; white locks and black remain opaque.' },
    { name: 'NO_COLOR', note: 'Semantic cells only: no generated colors or floor dots.' },
  ],
  specimen(variant, width, { mode = 'TRUECOLOR' } = {}) {
    const w = Math.min(width, 66);
    const bands = variant.name === 'SOLID'
      ? [['ACCENT', P.accent], ['FOCUSED LOG', P.yellow], ['CRITICAL', P.critical], ['CRITICAL HOVER', P.criticalHover], ['WHITE LOCK', P.primary], ['BLACK', P.field]]
      : variant.name === 'CLEAR' ? [['SYNTHETIC SURFACE', null], ...Array.from({ length: 11 }, () => ['', null])]
        : Object.keys(SURFACE_FILLS).map((fill, i) => [`FILL ${String(i + 1).padStart(2, '0')}`, fill]);
    const rows = bands.map(([label, bg]) => Array.from({ length: w }, (_, x) => ({ text: label[x] ?? ' ', style: { fg: bg && [P.accent, P.yellow, P.critical, P.criticalHover, P.primary].includes(bg) ? P.field : P.secondary, ...(bg ? { bg } : {}) } })));
    const options = { width: w, height: rows.length, fills: SURFACE_FILLS, color: mode === 'TRUECOLOR' && variant.name !== 'NO_COLOR' };
    const result = composeSurface(rows, options);
    return {
      lines: result.map((row) => row.map(({ text, style }) => ({ text, style }))),
      calls: [`bands = ${literal(bands)}`, `rows = bands.map(([label, bg]) => Array.from({ length: ${w} }, (_, x) => ({ text: label[x] ?? ' ', style: { fg: bg && ${literal([P.accent, P.yellow, P.critical, P.criticalHover, P.primary])}.includes(bg) ? ${literal(P.field)} : ${literal(P.secondary)}, ...(bg ? { bg } : {}) } })))`, call('composeSurface', code('rows'), options)],
      facts: [`${w} x ${rows.length} CELLS; ${options.color ? 'COLOR + FLOOR' : 'NO COLORS / NO DOTS'}`],
    };
  },
};
