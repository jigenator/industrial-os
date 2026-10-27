// Drawing parts both screens share: section heads, readouts, chips, the event log, failure wording and the
// centred message box.
import type { Line } from '@industrial-os/design-system/foundation/cells';
import { boardTone } from '@industrial-os/design-system/foundation/board-tones';
import { eventRow } from '@industrial-os/design-system/elements/event-row';
import { labelPlate } from '@industrial-os/design-system/elements/label-plate';
import { numeralLines, textGrid } from '@industrial-os/design-system/elements/pixel-numeral';
import { readoutBlock, readoutLine } from '@industrial-os/design-system/elements/readout';
import { sectionHead } from '@industrial-os/design-system/elements/section-head';
import { verticalRule } from '@industrial-os/design-system/elements/tab-rule';
import { cleanText, CUT, measure, type Canvas } from '../canvas.ts';
import { age, clock, type LogEvent } from '../model.ts';
import type { ReadFailure } from '../reader.ts';
import { cell, T, type Color, type Tone } from '../theme.ts';
import { LOG_WIDTH, type Layout } from './layout.ts';

export const pad2 = (n: number): string => String(n).padStart(2, '0');

// `■ TITLE  count ──────` across `w` cells.
export function head(c: Canvas, x: number, y: number, title: string, w: number, count?: string, tone: Tone = 'live'): void {
  c.blit(x, y, sectionHead({ title: cleanText(title), ...(count === undefined ? {} : { count }), mark: tone === 'live' ? T.primary : cell(tone) }, { width: w, ...CUT }));
}

// A group heading inside a list: state cell, title, count, rule to `right`.
export function groupHead(c: Canvas, y: number, title: string, tone: Tone, count: number, right: number): void {
  c.blit(2, y, sectionHead({ title: cleanText(title), count: pad2(count), mark: cell(tone) }, { width: right - 2, ...CUT }));
}

export function chip(c: Canvas, x: number, y: number, word: string, tone: Tone): number {
  return c.blit(x, y, labelPlate(cleanText(word), { form: 'slab', style: boardTone(tone).chip, measure }));
}

// Pixel numerals in the instrument (three rows) or tall (five rows) face. Returns the width in cells.
export function numeral(c: Canvas, x: number, y: number, value: string, color: Color, face: 'instrument' | 'tall'): number {
  const grid = textGrid(value, { ink: color, face });
  numeralLines(grid, { width: grid.w }).forEach((line, j) => c.blit(x, y + j, line));
  return grid.w;
}

export interface ReadoutPart { readonly text: string; readonly ink: Color }
export const part = (text: string, ink: Color): ReadoutPart => ({ text: cleanText(text), ink });

export interface Readout {
  readonly label: string;
  readonly value: string;
  readonly valueInk: Color;
  readonly unit: readonly ReadoutPart[];
  readonly sub?: ReadoutPart;
  // The same reading as words, for the one-line form.
  readonly line: readonly ReadoutPart[];
  // Row under the numerals, such as slot cells or the outcome bar, for a readout `w` cells wide.
  readonly strip?: (w: number) => Line;
}


// Four readouts across the list width: numbered label, rule, tall numerals with their unit, then a sub-line.
export function tallReadouts(c: Canvas, lay: Layout, readouts: readonly Readout[]): void {
  const w = Math.min(27, lay.readoutStep - 1);
  readouts.forEach((r, i) => {
    const block = readoutBlock({
      number: i + 1, label: cleanText(r.label), value: r.value, ink: r.valueInk, unit: r.unit, sub: r.sub ?? null, strip: r.strip ? r.strip(w) : null,
    }, { width: w, ...CUT });
    block.forEach((line, j) => c.blit(2 + i * lay.readoutStep, lay.readY + j, line));
  });
}

// The readouts as one line, for panes too small for numerals.
export function lineReadouts(c: Canvas, y: number, right: number, readouts: readonly Readout[]): void {
  c.blit(2, y, readoutLine(readouts.map((r) => r.line), { width: right - 2, ...CUT }));
}

export const unknownReadout = (label: string, short: string): Readout =>
  ({ label, value: '?', valueInk: T.structural, unit: [], line: [part(short, T.decorative), part('?', T.structural)] });

export const countdown = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 3600 ? `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}` : `${pad2(Math.min(99, Math.floor(s / 3600)))}:${pad2(Math.floor((s % 3600) / 60))}`;
};
export const countdownUnit = (ms: number): string => (ms < 3600_000 ? 'M:S' : 'H:M');

// The event log beside the list, newest first, cut at the position row.
export function eventLog(c: Canvas, lay: Layout, title: string, events: readonly LogEvent[] | null): void {
  if (!lay.log) return;
  const { x, y } = lay.log;
  verticalRule({ ink: T.faint }, { height: lay.posY - y + 1 }).forEach((line, j) => c.blit(x - 3, y + j, line));
  head(c, x, y, 'EVENT LOG', LOG_WIDTH, title);
  if (events === null) {
    c.text(x, y + 2, 'NO DATA', { fg: T.decorative, bold: true });
    return;
  }
  if (!events.length) c.text(x, y + 2, 'NO EVENTS', { fg: T.decorative, bold: true });
  events.slice(0, Math.max(0, lay.posY - y - 1)).forEach((e, i) => {
    c.blit(x, y + 2 + i, eventRow({ time: clock(e.at, false), tone: e.tone, verb: e.verb, ref: cleanText(e.ref), text: cleanText(e.text) }, { width: LOG_WIDTH, ...CUT }));
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
