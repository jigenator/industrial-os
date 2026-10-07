// Usage text for storybook specimens: a call's source, built from the same values passed to it, so the
// storybook shows what the call returns. Pure and I/O-free.

// code('body') stands for a variable or expression rather than a literal value.
const CODE = Symbol('code');
export const code = (text) => ({ [CODE]: text });

// Strings are shown as safe ASCII: curated glyphs become \u escapes, which run unchanged.
const escape = (c) => `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}`;

export function literal(value) {
  if (value !== null && typeof value === 'object' && CODE in value) return value[CODE];
  if (typeof value === 'string') return `'${value.replace(/[\\']/g, '\\$&').replace(/[^\x20-\x7e]/gu, escape)}'`;
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    // A code value named like its key uses shorthand: { time } rather than { time: time }. Keys that are
    // not identifiers, such as '5h', are quoted.
    const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : literal(k));
    const entries = Object.entries(value).map(([k, v]) => (v?.[CODE] === k ? k : `${key(k)}: ${literal(v)}`));
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return String(value);
}

export const call = (name, ...args) => `${name}(${args.map(literal).join(', ')})`;

// An object entry that shows as a spread, such as { ...BLINK_PRESETS.lamp, region }: the usage text of a
// call made with that preset's values.
export const spread = (name) => ({ [`...${name}`]: code(`...${name}`) });
