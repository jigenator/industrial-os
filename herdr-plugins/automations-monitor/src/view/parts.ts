// Drawing parts both screens share: section heads, readouts, chips, the event log, failure wording and the
// centred message box.
import type { Canvas } from '../canvas.ts';
import { age, clock, type LogEvent } from '../model.ts';
import type { ReadFailure } from '../reader.ts';
import { cell, chip as chipColors, ink, T, type Color, type Tone } from '../theme.ts';
import { LOG_WIDTH, type Layout } from './layout.ts';

export const pad2 = (n: number): string => String(n).padStart(2, '0');

// `■ TITLE  count ──────` across `w` cells.
export function head(c: Canvas, x: number, y: number, title: string, w: number, count?: string, tone: Tone = 'live'): void {
  c.put(x, y, '■', { fg: tone === 'live' ? T.primary : cell(tone) });
  let nx = c.text(x + 2, y, title, { fg: T.primary, bold: true });
  if (count !== undefined) nx = c.text(nx + 2, y, count, { fg: T.decorative });
  for (let i = nx + 2; i < x + w; i++) c.put(i, y, '─', { fg: T.faint });
}

// A group heading inside a list: state cell, title, count, rule to `right`.
export function groupHead(c: Canvas, y: number, title: string, tone: Tone, count: number, right: number): void {
  c.put(2, y, '■', { fg: cell(tone) });
  const nx = c.text(4, y, title, { fg: T.primary, bold: true });
  const cx = c.text(nx + 2, y, pad2(count), { fg: T.decorative });
  for (let i = cx + 2; i < right; i++) c.put(i, y, '─', { fg: T.faint });
}

export function chip(c: Canvas, x: number, y: number, word: string, tone: Tone): number {
  const [fg, bg] = chipColors(tone);
  return c.text(x, y, ` ${word} `, { fg, bg, bold: true });
}

export interface Readout {
  readonly label: string;
  readonly value: string;
  readonly valueInk: Color;
  readonly unit: ReadonlyArray<readonly [string, Color]>;
  readonly sub?: readonly [string, Color];
  // The same reading as words, for the one-line form.
  readonly line: ReadonlyArray<readonly [string, Color]>;
  // Row under the numerals, such as slot cells or the outcome bar.
  readonly strip?: (c: Canvas, x: number, y: number, w: number) => void;
}

// Four readouts across the list width: numbered label, rule, tall numerals with their unit, then a sub-line.
export function tallReadouts(c: Canvas, lay: Layout, readouts: readonly Readout[]): void {
  const w = Math.min(27, lay.readoutStep - 1);
  readouts.forEach((r, i) => {
    const x = 2 + i * lay.readoutStep, y = lay.readY;
    c.text(x, y, pad2(i + 1), { fg: T.decorative });
    c.text(x + 3, y, r.label, { fg: T.primary, bold: true }, w - 3);
    for (let k = 0; k < w; k++) c.put(x + k, y + 1, k < 3 ? '━' : '─', { fg: k < 3 ? T.primary : T.faint });
    const vw = c.tall(x, y + 2, r.value, r.valueInk);
    let ux = x + vw + 2;
    for (const [s, fg] of r.unit) if (s) ux = c.text(ux, y + 6, s, { fg, bold: fg !== T.decorative }, x + w - ux) + 1;
    if (r.strip) r.strip(c, x, y + 7, w);
    else if (r.sub) c.text(x, y + 7, r.sub[0], { fg: r.sub[1] }, w);
  });
}

// The readouts as one line, for panes too small for numerals.
export function lineReadouts(c: Canvas, y: number, right: number, readouts: readonly Readout[]): void {
  let x = 2;
  readouts.forEach((r, i) => {
    if (i) x = c.text(x, y, '·', { fg: T.structural }, right - x) + 2;
    for (const [s, fg] of r.line) x = c.text(x, y, s, { fg, bold: fg !== T.decorative }, right - x) + 1;
    x += 1;
  });
}

export const unknownReadout = (label: string, short: string): Readout =>
  ({ label, value: '?', valueInk: T.structural, unit: [], line: [[short, T.decorative], ['?', T.structural]] });

export const countdown = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 3600 ? `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}` : `${pad2(Math.min(99, Math.floor(s / 3600)))}:${pad2(Math.floor((s % 3600) / 60))}`;
};
export const countdownUnit = (ms: number): string => (ms < 3600_000 ? 'M:S' : 'H:M');

// The event log beside the list, newest first, cut at the position row.
export function eventLog(c: Canvas, lay: Layout, title: string, events: readonly LogEvent[] | null): void {
  if (!lay.log) return;
  const { x, y } = lay.log;
  for (let j = y; j <= lay.posY; j++) c.put(x - 3, j, '│', { fg: T.faint });
  head(c, x, y, 'EVENT LOG', LOG_WIDTH, title);
  if (events === null) {
    c.text(x, y + 2, 'NO DATA', { fg: T.decorative, bold: true });
    return;
  }
  if (!events.length) c.text(x, y + 2, 'NO EVENTS', { fg: T.decorative, bold: true });
  events.slice(0, Math.max(0, lay.posY - y - 1)).forEach((e, i) => {
    const row = y + 2 + i;
    c.text(x, row, clock(e.at, false), { fg: T.decorative });
    c.put(x + 6, row, '█', { fg: cell(e.tone) });
    c.text(x + 8, row, e.verb.padEnd(5), { fg: e.tone === 'crit' || e.tone === 'warn' ? ink(e.tone) : T.secondary, bold: e.tone === 'crit' || e.tone === 'warn' });
    let tx = x + 14;
    if (e.ref) tx = c.text(tx, row, e.ref, { fg: T.primary }, x + LOG_WIDTH - tx) + 1;
    c.text(tx, row, e.text, { fg: T.decorative }, x + LOG_WIDTH - tx);
  });
}

// A failure's own title and what to do, so each kind reads differently.
export function describeFailure(f: ReadFailure, intervalMs: number): { title: string; detail: string[] } {
  const every = `RETRYING EVERY ${Math.round(intervalMs / 1000)}S`;
  switch (f.kind) {
    case 'missing': return { title: 'TATSU NOT FOUND', detail: ['`tatsu` is not on this pane\'s PATH.', 'Start Herdr from a shell where `tatsu` runs,', 'or set AUTOMATIONS_MONITOR_TATSU.', every] };
    case 'spawn-failed': return { title: 'CANNOT START TATSU', detail: [`The system refused to run it (${f.code}).`, every] };
    case 'timeout': return { title: 'READ TIMED OUT', detail: [`No answer within ${Math.round(f.timeoutMs / 1000)}s; the read was stopped.`, every] };
    case 'too-large': return { title: 'OUTPUT TOO LARGE', detail: [`More than ${Math.round(f.maxBytes / 1048576)} MiB; the read was stopped.`, every] };
    case 'error-envelope': return { title: `TATSU ERROR ${f.code}`, detail: [f.message ?? 'No message.', `Exit ${f.exitCode ?? '?'}.`, every] };
    case 'exit': return { title: `TATSU EXITED ${f.exitCode ?? '?'}`, detail: ['No readable answer was printed.', every] };
    case 'unsupported': return { title: 'UNSUPPORTED SCHEMA', detail: [`schema_version ${f.version ?? '?'}; this monitor reads 2.`, every] };
    case 'garbage': return { title: 'UNREADABLE OUTPUT', detail: [f.at ? `The reply does not match schema 2 at ${f.at}.` : 'Tatsu printed something that is not the JSON envelope.', every] };
  }
}

// A centred box with a chip title and wrapped lines, over an area.
export function message(c: Canvas, area: { x: number; y: number; w: number; h: number }, title: string, lines: readonly string[], tone: Tone): void {
  const inner = Math.max(4, Math.min(area.w - 4, Math.max(title.length + 2, ...lines.map((l) => l.length))));
  const wrapped = lines.flatMap((l) => wrap(l, inner));
  const w = inner + 4, h = wrapped.length + 4;
  const x = area.x + Math.max(0, Math.floor((area.w - w) / 2));
  const y = area.y + Math.max(0, Math.floor((area.h - h) / 2));
  c.fill(x, y, w, h, T.field);
  chip(c, x + 2, y + 1, title, tone);
  wrapped.forEach((l, i) => c.text(x + 2, y + 3 + i, l, { fg: T.secondary }, inner));
}

function wrap(text: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > w) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

export const ago = (ms: number | null): string => (ms === null ? '?' : `${age(ms)} AGO`);
