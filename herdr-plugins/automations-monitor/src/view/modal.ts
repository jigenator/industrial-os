// The run modal over the pipelines screen: a title bar in the pipeline's color while it is live, its live
// runs, the selected run with a large elapsed time, phase segments and key values, recent runs and events.
// It only shows; Esc closes it. Design: ../../docs/design.md#run-modal.
import { mixOver } from '@industrial-os/design-system/foundation/signal-colors';
import type { Canvas } from '../canvas.ts';
import { age, clock, type LogEvent, type PipelineView, type Reporting } from '../model.ts';
import { CATEGORIES, cell, ink, lampOn, T, type Color } from '../theme.ts';
import { chip, head, pad2 } from './parts.ts';
import { resultGlyph, resultInk } from './pipelines.ts';

const OUTCOME_WORD = { succeeded: 'OK', failed: 'FAILED', cancelled: 'CNCL', interrupted: 'INTR', dropped: 'DROPPED' } as const;

const dimmed = new Map<string, Color>();
const dim = (color: Color): Color => {
  let d = dimmed.get(color);
  if (!d) dimmed.set(color, (d = mixOver(color, 0.25) as Color));
  return d;
};

export function runModal(c: Canvas, v: PipelineView, runIndex: number, machine: string | null, reporting: Reporting, events: readonly LogEvent[], now: number, t: number, motion: boolean): void {
  // Everything behind the modal fades toward the field.
  for (const row of c.cells) for (const q of row) Object.assign(q, { fg: dim(q.fg), bg: dim(q.bg), bold: false });
  c.hits.length = 0;
  const w = Math.min(96, c.w - 4), h = Math.min(31, c.h - 2);
  const x0 = Math.floor((c.w - w) / 2), y0 = Math.max(1, Math.floor((c.h - h) / 2));
  const bottom = y0 + h - 1;
  c.fill(x0, y0, w, h, T.field);
  c.hline(x0, y0, w, '━', T.primary);
  c.hline(x0, bottom, w, '─', T.structural);
  c.vline(x0, y0 + 1, h - 2, '│', T.structural);
  c.vline(x0 + w - 1, y0 + 1, h - 2, '│', T.structural);
  c.hit(0, 0, c.w, c.h, { kind: 'modal-close' });
  c.hit(x0, y0, w, h, { kind: 'modal-inside' });

  const X = x0 + 3, right = x0 + w - 4;
  const cat = CATEGORIES[v.category]!;
  const hot = v.live.length > 0 && reporting === 'live';
  const titleInk = hot ? cat.ink : T.primary, subInk = hot ? cat.ink : T.decorative;
  const tb = hot ? { bg: cat.fill } : {};
  if (hot) c.fill(X, y0 + 2, right - X + 1, 1, cat.fill);
  else c.put(X, y0 + 2, '█', { fg: cell(v.tone) });
  const closeX = c.rtext(right, y0 + 2, 'ESC CLOSE', { fg: subInk, ...tb });
  let tx = c.text(X + 2, y0 + 2, v.name.toUpperCase(), { fg: titleInk, bold: true, ...tb }, closeX - X - 4);
  tx = c.text(tx + 2, y0 + 2, v.word, { fg: hot ? cat.ink : ink(v.tone), bold: true, ...tb }, Math.max(0, closeX - tx - 4));
  const sub = [machine?.toUpperCase(), v.scope?.toUpperCase(), `${v.slots ?? '?'} SLOTS`].filter(Boolean).join(' · ');
  c.text(tx + 2, y0 + 2, sub, { fg: subInk, ...tb }, Math.max(0, closeX - tx - 4));

  const two = w >= 80;
  const LW = two ? 30 : 0;
  const RX = two ? X + LW + 5 : X, RW = right - RX + 1;
  const live = v.live;
  const ri = Math.min(runIndex, Math.max(0, live.length - 1));
  const r = live[ri];

  if (two) {
    for (let j = y0 + 4; j < bottom - 1; j++) c.put(RX - 3, j, '│', { fg: T.faint });
    head(c, X, y0 + 4, 'LIVE RUNS', LW, pad2(live.length));
    const liveRows = Math.max(1, Math.min(live.length, 9));
    live.slice(0, liveRows).forEach((q, i) => {
      const y = y0 + 6 + i, on = i === ri;
      const st = on ? { fg: T.field, bg: T.primary, bold: true } : null;
      if (on) c.fill(X, y, LW, 1, T.primary);
      c.text(X, y, pad2(i + 1), st ?? { fg: T.decorative });
      c.text(X + 4, y, q.issue, st ?? { fg: T.primary, bold: true }, LW - 10);
      c.rtext(X + LW - 1, y, age(now - q.start), st ?? { fg: T.secondary });
      c.hit(X, y, LW, 1, { kind: 'modal-run', index: i });
    });
    if (live.length > liveRows) c.text(X, y0 + 6 + liveRows, `+${live.length - liveRows} MORE`, { fg: T.decorative });
    if (!live.length) c.text(X, y0 + 6, 'NO LIVE RUNS', { fg: T.decorative, bold: true });
    const recentY = y0 + 6 + liveRows + 2;
    if (recentY + 2 < bottom) {
      head(c, X, recentY, 'RECENT RUNS', LW);
      v.done.slice(0, Math.max(0, bottom - recentY - 3)).forEach((q, i) => {
        const y = recentY + 2 + i;
        c.put(X, y, resultGlyph(q), { fg: resultInk(q), bold: true });
        c.text(X + 2, y, q.issue, { fg: T.secondary }, 10);
        c.text(X + 13, y, q.outcome ? OUTCOME_WORD[q.outcome] : '?', { fg: q.outcome === 'failed' ? T.critical : T.decorative }, 7);
        c.rtext(X + LW - 1, y, q.endedAt === null ? '?' : `${age(now - q.endedAt)} AGO`, { fg: T.decorative });
      });
    }
  }

  head(c, RX, y0 + 4, 'SELECTED RUN', RW, live.length ? `${pad2(ri + 1)}/${pad2(live.length)}` : '00');
  if (!r) {
    c.text(RX, y0 + 6, v.tone === 'idle' ? 'IDLE · NOTHING CLAIMED' : v.why, { fg: T.decorative, bold: true }, RW);
    return;
  }
  const frozen = reporting !== 'live';
  c.text(RX, y0 + 6, r.issue, { fg: T.primary, bold: true }, RW - 14);
  const phaseWord = frozen ? 'LAST KNOWN' : r.phase.toUpperCase();
  const chipTone = frozen ? 'idle' : r.phase === 'running' ? 'live' : r.verifying ? 'warn' : 'idle';
  chip(c, RX + RW - phaseWord.length - 2, y0 + 6, phaseWord, chipTone);

  // Elapsed since the claim (or the admission when it has no claim time), in the largest unit that fits.
  const since = r.claimedAt !== null ? 'CLAIM' : 'ADMISSION';
  const s = Math.max(0, Math.floor((now - r.start) / 1000));
  const [big, unit, rest] = s < 60 ? [pad2(s), 'SEC', `SINCE ${since}`]
    : s < 3600 ? [pad2(Math.floor(s / 60)), 'MIN', `${pad2(s % 60)}S SINCE ${since}`]
    : [`${Math.min(99, Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}`, 'H:M', `SINCE ${since}`];
  if (y0 + 13 < bottom) {
    const bw = c.tall(RX, y0 + 8, big, frozen ? T.decorative : T.primary);
    c.text(RX + bw + 2, y0 + 11, unit, { fg: T.decorative });
    c.text(RX + bw + 2, y0 + 12, rest, { fg: T.decorative }, RW - bw - 2);
  }

  // Phase segments: claim, verify, run, each with its time from the record.
  const cur = r.phase === 'claiming' ? 0 : r.phase === 'verifying' ? 1 : 2;
  const sw = Math.floor((RW - 2) / 3);
  const segY = y0 + 15;
  if (segY + 2 < bottom) {
    const segs: ReadonlyArray<readonly [string, number | null]> = [['CLAIM', r.claimedAt], ['VERIFY', r.verifiedAt], ['RUN', r.startedAt]];
    const fill = frozen ? T.decorative : cat.fill;
    segs.forEach(([lab, at], i) => {
      const x = RX + i * (sw + 1);
      const color = i < cur ? fill : i === cur && !frozen && lampOn(t, motion) ? fill : T.faint;
      c.hline(x, segY, sw, '▄', color);
      c.text(x, segY + 1, lab, { fg: i <= cur ? T.primary : T.decorative, bold: i === cur });
      c.text(x, segY + 2, at !== null ? clock(at) : i === cur ? 'IN PROGRESS' : '--:--:--', { fg: T.decorative }, sw);
    });
  }

  const kv = (y: number, k: string, val: string) => {
    if (y >= bottom - 1) return;
    c.text(RX, y, k, { fg: T.decorative });
    const vx = RX + RW - Math.min(val.length, RW - k.length - 2);
    for (let i = RX + k.length + 1; i < vx - 1; i++) c.put(i, y, '·', { fg: T.faint });
    c.text(vx, y, val, { fg: T.primary, bold: true }, RW - k.length - 2);
  };
  kv(segY + 4, 'PIPELINE', v.name.toUpperCase());
  kv(segY + 5, 'PHASE', r.phase.toUpperCase());
  kv(segY + 6, 'ADMITTED', clock(r.admittedAt));
  kv(segY + 7, 'MACHINE', machine?.toUpperCase() ?? '?');

  const evY = segY + 9;
  if (evY + 2 < bottom) {
    head(c, RX, evY, 'EVENTS', RW);
    events.filter((e) => e.pipeline === v.name).slice(0, Math.min(3, bottom - evY - 2)).forEach((e, i) => {
      const y = evY + 1 + i;
      c.text(RX, y, clock(e.at), { fg: T.decorative });
      c.text(RX + 10, y, e.verb, { fg: e.tone === 'crit' ? T.critical : e.tone === 'live' ? T.accent : e.tone === 'warn' ? T.warning : T.secondary, bold: true });
      c.text(RX + 16, y, e.ref, { fg: T.secondary }, RW - 16);
    });
  }
}
