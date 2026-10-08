import { assertCells, fitLine, lineWidth, resolveColor, safeText, span } from '../../foundation/cells.mjs';
import { SIGNAL_COLORS } from '../../foundation/signal-colors.mjs';

// footer.ts:211-215: declared layout is independent of whether a provider has answered.
export const USAGE_PROVIDERS = Object.freeze(Object.fromEntries(Object.entries({
  codex: { tag: 'GPT', ink: SIGNAL_COLORS.gpt, declared: Object.freeze(['wk']) },
  claude: { tag: 'CLD', ink: SIGNAL_COLORS.cld, declared: Object.freeze(['5h', 'wk']) },
  kimi: { tag: 'KMI', ink: SIGNAL_COLORS.kmi, declared: Object.freeze(['5h', 'wk']) },
}).map(([key, value]) => [key, Object.freeze(value)])));
const WINDOWS = ['5h', 'wk'];
const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
function segmentCount(n) { assertCells(n, 'segment count'); }
function timestamp(n, name) {
  if (n !== null && n !== undefined && (typeof n !== 'number' || !Number.isFinite(n))) throw new RangeError(`${name} must be finite or null`);
}
// footer.ts:234-237: lit means some quota remains in that slice, NOT a precise floored fill.
export function litSegments(remaining, segments = 8) {
  segmentCount(segments);
  if (typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining < 0 || remaining > 100) throw new RangeError('remaining must be 0–100');
  return remaining <= 0 ? 0 : Math.max(1, Math.ceil(remaining / (100 / segments) - 1e-6));
}
export function segmentMeter({ remaining, state = remaining == null ? 'unknown' : 'known', ink = 'primary' }, { segments = 8, maxWidth = Infinity } = {}) {
  segmentCount(segments);
  if (!['known', 'pending', 'failure', 'none', 'unknown', 'absent'].includes(state)) throw new RangeError('unknown meter state');
  if (maxWidth !== Infinity && (!Number.isInteger(maxWidth) || maxWidth < 0 || maxWidth > 1000)) throw new RangeError('maxWidth must be 0–1000 or Infinity');
  resolveColor(ink);
  if (remaining !== null && remaining !== undefined) litSegments(remaining, segments);
  let line;
  if (state === 'known') {
    const lit = litSegments(remaining, segments);
    line = Array.from({ length: segments }, (_, i) => span('■', { fg: i < lit ? ink : SIGNAL_COLORS.ghost }));
  } else if (state === 'none') line = fitLine([span('none', { fg: 'secondary' })], segments);
  else line = [span((state === 'pending' ? '·' : state === 'absent' ? ' ' : '?').repeat(segments), { fg: 'decorative' })];
  return fitLine(line, Math.min(maxWidth, segments));
}
// footer.ts:244-249: positive spans round up to whole minutes; no capped day count.
export function countdown(resetsAt, now, { overflow = 'throw' } = {}) {
  if (!['throw', 'text'].includes(overflow)) throw new RangeError('countdown overflow must be throw or text');
  timestamp(resetsAt, 'resetsAt'); timestamp(now, 'now');
  if (resetsAt == null || now == null) return '?';
  if (resetsAt <= now) return 'reset';
  if (overflow === 'throw' && !Number.isFinite(resetsAt - now)) throw new RangeError('countdown duration must be finite');
  const m = Math.ceil((resetsAt - now) / MINUTE), h = Math.floor(m / 60), d = Math.floor(m / 1440);
  return m < 60 ? `${m}m` : m < 600 ? `${h}h${String(m % 60).padStart(2, '0')}m` : m < 1440 ? `${h}h` : m < 14400 ? `${d}d${Math.floor(m % 1440 / 60)}h` : `${d}d`;
}
// footer.ts:253-258: three-cell stale ages, minutes ceil, hours/days floor, then 99+.
export function staleAge(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) throw new RangeError('age must be a finite non-negative duration');
  if (ms === 0) return '0m';
  if (ms <= 59 * MINUTE) return `${Math.ceil(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.max(1, Math.floor(ms / HOUR))}h`;
  return ms < 100 * DAY ? `${Math.floor(ms / DAY)}d` : '99+';
}
function columnParts(input, { segments = 8, now, natural = false, age: suppliedAge, countdownOverflow = 'throw' } = {}) {
  segmentCount(segments); timestamp(now, 'now');
  const { provider, data, failure } = input;
  if (failure !== undefined && !['timeout', 'failed'].includes(failure)) throw new RangeError('failure must be timeout or failed');
  if (provider !== undefined && !Object.hasOwn(USAGE_PROVIDERS, provider)) throw new RangeError('unknown provider');
  const look = provider === undefined ? input : USAGE_PROVIDERS[provider];
  const tag = safeText(look.tag);
  if (tag.length !== 3) throw new RangeError('provider tag must be three display cells');
  resolveColor(look.ink);
  if (!Array.isArray(look.declared) || !look.declared.length || look.declared.some((k) => !WINDOWS.includes(k)) || new Set(look.declared).size !== look.declared.length) throw new RangeError('declared must contain unique 5h/wk window keys');
  if (data !== undefined && (!data || typeof data !== 'object' || !data.windows || typeof data.windows !== 'object' || Array.isArray(data.windows))) throw new TypeError('data must contain windows');
  const windows = data?.windows ?? {};
  if (Object.keys(windows).some((k) => !WINDOWS.includes(k))) throw new RangeError('only 5h/wk windows may be supplied');
  if (data) {
    timestamp(data.updatedAt, 'updatedAt'); timestamp(data.fetchedAt, 'fetchedAt');
    for (const window of Object.values(windows)) {
      if (!window || typeof window !== 'object') throw new TypeError('window must be an object');
      if (window.usedPercent !== null) litSegments(100 - window.usedPercent, segments);
      if (window.usedPercent !== null && typeof window.usedPercent !== 'number') throw new RangeError('usedPercent must be 0–100 or null');
      timestamp(window.resetsAt, 'resetsAt');
    }
  }
  const stamp = data?.updatedAt ?? data?.fetchedAt;
  const elapsed = now == null || stamp == null ? undefined : now - stamp;
  if (elapsed !== undefined && (!Number.isFinite(elapsed) || elapsed < 0)) throw new RangeError('sample time must not be later than now');
  const stale = data && (failure !== undefined || (elapsed !== undefined && elapsed > 15 * MINUTE));
  if (suppliedAge !== undefined && suppliedAge !== null && (typeof suppliedAge !== 'string' || !/^(?:\d{1,2}[mhd]|99\+|\?)$/.test(suppliedAge))) throw new RangeError('age must be a compact age string or null');
  const age = suppliedAge === undefined ? stale ? elapsed === undefined ? '?' : staleAge(elapsed) : '' : suppliedAge ?? '';
  const isStale = suppliedAge === undefined ? stale : suppliedAge !== null;
  const part = (top, bottom, width, kind = 'slot', window) => natural ? { top, bottom, width, bottomWidth: lineWidth(bottom), kind, window } : { top: fitLine(top, width), bottom: fitLine(bottom, width), width };
  const parts = [part([span(tag, isStale ? { fg: 'decorative' } : { fg: look.ink, bold: true })], age ? [span(age, { fg: 'warning' })] : [], 3, 'tag')];
  const slot = Math.max(segments, 7); // Reserve pending/timeout text in custom short meters, in EVERY state.
  const keys = WINDOWS.filter((k) => look.declared.includes(k) || windows[k]);
  const none = data && !Object.keys(windows).length;
  if (none) {
    parts.push(part([span('none', { fg: 'secondary' })], [], slot * keys.length + keys.length - 1));
    return parts;
  }
  keys.forEach((key, i) => {
    const window = windows[key];
    const state = !data ? failure ? 'failure' : 'pending' : !window ? 'absent' : window.usedPercent === null ? 'unknown' : 'known';
    const word = !data ? i ? '' : failure ?? 'pending' : !window ? '' : state === 'unknown' ? '?' : countdown(window.resetsAt, now, { overflow: countdownOverflow });
    const top = natural && state === 'absent' ? [] : segmentMeter({ state, remaining: state === 'known' ? 100 - window.usedPercent : null, ink: look.ink }, { segments });
    parts.push(part(top, word ? [span(word, { fg: !data && failure ? 'warning' : 'secondary' })] : [], Math.max(slot, word.length), 'slot', key));
  });
  return parts;
}
export function providerColumnWidth(input, options = {}) {
  const parts = columnParts(input, options);
  return parts.reduce((n, p) => n + p.width, 0) + parts.length - 1;
}
// footer.ts:1230-1268: fixed tags/slots/countdown row. At narrow widths split only between parts, then
// wrap oversized slots (paired top/text slices), so no square or state word is silently clipped.
export function providerColumn(input, { width, segments = 8, now } = {}) {
  assertCells(width, 'provider column width');
  const parts = columnParts(input, { segments, now }), out = [];
  let top = [], bottom = [];
  const flush = () => { if (top.length) { out.push(fitLine(top, width), fitLine(bottom, width)); top = []; bottom = []; } };
  for (const p of parts) {
    if (lineWidth(top) + (top.length ? 1 : 0) + p.width > width) flush();
    if (p.width <= width) {
      if (top.length) { top.push(span(' ')); bottom.push(span(' ')); }
      top.push(...p.top); bottom.push(...p.bottom); continue;
    }
    const cells = (line) => line.flatMap((s) => [...s.text].map((ch) => span(ch, s.style)));
    const a = cells(p.top), b = cells(p.bottom);
    for (let x = 0; x < p.width; x += width) out.push(fitLine(a.slice(x, x + width), width), fitLine(b.slice(x, x + width), width));
  }
  flush();
  return out;
}

// Natural, unpadded text and glyph boundaries; hosts own multi-provider packing and opaque emission.
// `age` is an optional already-formatted clock-correction display: null=current, otherwise stale.
export function providerColumnParts(input, { segments = 8, now, age, countdownOverflow = 'throw' } = {}) {
  if (!['throw', 'text'].includes(countdownOverflow)) throw new RangeError('countdownOverflow must be throw or text');
  return columnParts(input, { segments, now, age, countdownOverflow, natural: true });
}
