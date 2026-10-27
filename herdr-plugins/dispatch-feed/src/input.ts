export type InputEvent =
  | { type: "key"; key: string }
  | { type: "mouse"; x: number; y: number; hover: boolean }
  | { type: "focus"; on: boolean }
  | { type: "paste"; text: string };
const keys: Record<string, string> = {
  "\x1b[A": "ArrowUp",
  "\x1b[B": "ArrowDown",
  "\x1b[5~": "PageUp",
  "\x1b[6~": "PageDown",
};
export class Input {
  private buffer = "";
  private discard = false;
  private paste: string | null = null;
  feed(text: string): InputEvent[] {
    this.buffer += text;
    const events: InputEvent[] = [];
    while (this.buffer) {
      const interrupt = this.buffer.indexOf("\x03");
      if (interrupt >= 0) {
        this.buffer = this.buffer.slice(interrupt + 1);
        this.discard = false;
        this.paste = null;
        events.push({ type: "key", key: "\x03" });
        continue;
      }
      if (this.paste !== null) {
        const end = this.buffer.indexOf("\x1b[201~");
        if (end < 0) {
          const n = Math.max(0, this.buffer.length - 5);
          this.paste = (this.paste + this.buffer.slice(0, n)).slice(0, 4096);
          this.buffer = this.buffer.slice(n);
          break;
        }
        events.push({
          type: "paste",
          text: (this.paste + this.buffer.slice(0, end)).slice(0, 4096),
        });
        this.paste = null;
        this.buffer = this.buffer.slice(end + 6);
        continue;
      }
      if (this.discard) {
        if (this.buffer[0] === "\x1b") this.discard = false;
        else {
          const ch = this.buffer[0];
          this.buffer = this.buffer.slice(1);
          if (/[@-~]/.test(ch)) this.discard = false;
          continue;
        }
      }
      if (this.buffer[0] !== "\x1b") {
        const ch = String.fromCodePoint(this.buffer.codePointAt(0)!);
        this.buffer = this.buffer.slice(ch.length);
        events.push({
          type: "key",
          key:
            ch === "\r" || ch === "\n"
              ? "Enter"
              : ch === "\t"
                ? "Tab"
                : ch === "\x7f" || ch === "\b"
                  ? "Backspace"
                  : ch,
        });
        continue;
      }
      if (this.buffer.length === 1) break;
      if (this.buffer[1] !== "[") {
        events.push({ type: "key", key: "Escape" });
        this.buffer = this.buffer.slice(1);
        continue;
      }
      const final = this.buffer.slice(2).search(/[@-~]/);
      const restart = this.buffer.indexOf("\x1b", 1);
      if (restart > 0 && (final < 0 || restart < final + 3)) {
        this.buffer = this.buffer.slice(restart);
        continue;
      }
      if (final < 0) {
        if (this.buffer.length > 64) {
          this.buffer = "";
          this.discard = true;
        }
        break;
      }
      const sequence = this.buffer.slice(0, final + 3);
      this.buffer = this.buffer.slice(final + 3);
      if (sequence === "\x1b[200~") {
        this.paste = "";
        continue;
      }
      const mouse = /^.[[]<(\d{1,4});(\d{1,4});(\d{1,4})([Mm])$/.exec(sequence);
      if (mouse) {
        const b = Number(mouse[1]),
          x = Number(mouse[2]) - 1,
          y = Number(mouse[3]) - 1;
        if (x >= 0 && y >= 0 && mouse[4] === "M" && (b === 0 || b === 32 || b === 35))
          events.push({ type: "mouse", x, y, hover: b !== 0 });
      } else if (sequence === "\x1b[I" || sequence === "\x1b[O")
        events.push({ type: "focus", on: sequence === "\x1b[I" });
      else if (keys[sequence]) events.push({ type: "key", key: keys[sequence] });
    }
    return events;
  }
  flushEscape(): InputEvent[] {
    if (this.buffer === "\x1b") {
      this.buffer = "";
      this.paste = null;
      return [{ type: "key", key: "Escape" }];
    }
    return [];
  }
}
