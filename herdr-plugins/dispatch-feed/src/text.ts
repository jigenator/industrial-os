// Measured display text: remote titles keep their real characters at their terminal width. The design system's
// measured slots reject controls and bidi characters, so they become one visible cell here first.
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// C0/C1 controls (ESC, newline, tab), DEL, bidi marks, embeddings, overrides and isolates, line/paragraph separators.
export const UNSAFE = /[\p{Cc}\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/gu;
// A grapheme that would attach to padding or a neighbouring column.
const DETACHED = /^[\p{Grapheme_Extend}\p{Emoji_Modifier}\u200d]/u;
export const MARK = "?";

/** Terminal cells of plain text: structural glyphs and spaces are one cell, CJK and emoji two. */
export const measure = (text: string): number => Bun.stringWidth(text);

/** Untrusted text made safe to measure: unsafe characters and graphemes wider than two cells become `?`, invisible ones go. */
export function displayText(value: string): string {
  let out = "";
  for (const { segment } of segmenter.segment(value.toWellFormed().replace(UNSAFE, MARK))) {
    const width = measure(segment);
    if (width === 0) continue;
    out += width > 2 || DETACHED.test(segment) ? MARK : segment;
  }
  return out;
}

/** The end of already-safe text in at most `n` cells, marked with a leading ellipsis when cut. */
export function fitTail(text: string, n: number): string {
  if (measure(text) <= n) return text;
  const kept: string[] = [];
  let used = 1;
  for (const { segment } of [...segmenter.segment(text)].reverse()) {
    const width = measure(segment);
    if (used + width > n) break;
    kept.unshift(segment);
    used += width;
  }
  return n > 0 ? `…${kept.join("")}` : "";
}

/** The last grapheme removed, so Backspace never splits an emoji or accented letter. */
export function dropLast(text: string): string {
  const parts = [...segmenter.segment(text)];
  return parts
    .slice(0, -1)
    .map((s) => s.segment)
    .join("");
}
