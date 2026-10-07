import { GLYPHS, cells, safeText, span } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

const GREY = { fg: 'primary', bg: 'structural', bold: true };

// status-bar's two count plates (pi/status-bar/src/footer.ts): the CMP compaction plate (cmpPlate, cmpStyle) and
// the AU active-units badge (unitBadge, badgeStyle). A tier applies to counts up to and including `upTo`.
export const COUNT_PLATES = Object.freeze({
  compactions: Object.freeze({
    label: 'CMP', side: 'before', joiner: '×', cap: 99, unknown: '??', unknownStyle: GREY,
    tiers: Object.freeze([
      { upTo: 0, style: GREY },
      { upTo: 2, style: { fg: 'primary', bg: SIGNAL_COLORS.violet, bold: true } },
      { upTo: 4, style: { fg: 'field', bg: SIGNAL_COLORS.pink, bold: true } },
      { upTo: Infinity, style: { fg: 'field', bg: 'critical', bold: true } },
    ]),
  }),
  units: Object.freeze({
    label: 'AU', side: 'after', joiner: ' ', cap: null, unknown: '?', unknownStyle: GREY,
    tiers: Object.freeze([
      { upTo: 0, style: { fg: 'secondary', bg: 'surface', bold: false } },
      { upTo: Infinity, style: { fg: 'field', bg: 'primary', bold: true } },
    ]),
  }),
});

const DIGITS = 2;

function check(spec) {
  if (spec === null || typeof spec !== 'object') throw new TypeError('count plate spec must be an object');
  const { label, side, joiner, cap, unknown, unknownStyle, tiers } = spec;
  if (typeof label !== 'string') throw new TypeError('count plate label must be a string');
  if (side !== 'before' && side !== 'after') throw new RangeError(`count plate side must be 'before' or 'after', got ${side}`);
  if (typeof joiner !== 'string' || cells(joiner) !== 1 || !(joiner === ' ' || GLYPHS.includes(joiner))) {
    throw new RangeError('count plate joiner must be a space or one curated glyph');
  }
  if (cap !== null && (!Number.isSafeInteger(cap) || cap < 1)) throw new RangeError(`count plate cap must be a positive integer or null, got ${cap}`);
  if (typeof unknown !== 'string' || !/^\?{1,2}$/.test(unknown)) throw new RangeError("count plate unknown must be '?' or '??'");
  if (unknownStyle === null || typeof unknownStyle !== 'object') throw new TypeError('count plate unknownStyle must be a style');
  if (!Array.isArray(tiers) || tiers.length === 0 || tiers.at(-1).upTo !== Infinity) {
    throw new RangeError('count plate tiers must be a non-empty array ending at upTo: Infinity');
  }
  tiers.forEach((tier, i) => {
    if (tier === null || typeof tier !== 'object' || tier.style === null || typeof tier.style !== 'object') throw new TypeError('each count tier must be { upTo, style }');
    const ok = (tier.upTo === Infinity || (Number.isSafeInteger(tier.upTo) && tier.upTo >= 0)) && (i === 0 || tier.upTo > tiers[i - 1].upTo);
    if (!ok) throw new RangeError('count tiers need ascending non-negative integer upTo values');
  });
}

function known(count) {
  if (count === null || count === undefined) return undefined;
  if (typeof count !== 'number') throw new TypeError(`count must be a number, null or undefined, got ${typeof count}`);
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError(`count must be a non-negative integer, got ${count}`);
  return count;
}

// A fixed-width count plate: ` CMP×03 `, ` CMP×99+`, ` CMP×?? `, ` 03 AU `, `  ? AU `, ` 120 AU `.
// Counts are zero-padded to two digits; unknown (null or undefined) keeps its `?` mark and is never zero. Above
// `cap` the value reads `${cap}+`: with the label before, the `+` takes the trailing pad cell so the plate keeps
// its width. Without a cap the plate widens to show the exact value. One filled span no wider than maxWidth:
// below the natural width the pads go first, then the plate shows `#` cells rather than partial digits.
export function countPlate(count, spec = COUNT_PLATES.compactions, { maxWidth = Infinity } = {}) {
  check(spec);
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0)) {
    throw new RangeError(`maxWidth must be a non-negative integer, got ${maxWidth}`);
  }
  const n = known(count);
  const label = safeText(spec.label);
  const over = n !== undefined && spec.cap !== null && n > spec.cap;
  const digits = n === undefined ? spec.unknown.padStart(DIGITS) : over ? `${spec.cap}+` : String(n).padStart(DIGITS, '0');
  const style = n === undefined ? spec.unknownStyle : spec.tiers.find((tier) => n <= tier.upTo).style;
  const bare = spec.side === 'before' ? `${label}${spec.joiner}${digits}` : `${digits}${spec.joiner}${label}`;
  const full = spec.side === 'before' && over ? ` ${bare}` : ` ${bare} `;
  const shown = cells(full) <= maxWidth ? full : cells(bare.trim()) <= maxWidth ? bare.trim() : '#'.repeat(maxWidth);
  return shown ? [span(shown, style)] : [];
}
