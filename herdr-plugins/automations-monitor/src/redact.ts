// The one free-text value the monitor shows is an error message (the CLI's error envelope, or an uncaught
// error after the terminal is restored). Anything path- or URL-shaped is replaced, control characters become
// spaces, and the length is bounded, so no local path reaches the screen or the pane's scrollback.
export function redact(message: unknown): string | null {
  if (typeof message !== 'string') return null;
  const clean = message
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\S*[/\\~]\S*/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, 160) : null;
}
