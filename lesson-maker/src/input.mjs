// Incremental decoder: unknown terminal replies are consumed, never interpreted as shortcuts.
export function createDecoder() {
  let pending = '',
    paste = false,
    pasted = '';
  return {
    feed(chunk) {
      pending += chunk;
      const events = [];
      while (pending) {
        if (paste) {
          const end = pending.indexOf('\x1b[201~');
          if (end < 0) {
            if (pending.length > 6) {
              pasted += pending.slice(0, -6);
              pending = pending.slice(-6);
              if (pasted.length > 24000) pasted = pasted.slice(0, 24000);
            }
            break;
          }
          pasted += pending.slice(0, end);
          pending = pending.slice(end + 6);
          events.push({ key: 'paste', text: pasted });
          pasted = '';
          paste = false;
          continue;
        }
        if (pending.startsWith('\x1b[200~')) {
          pending = pending.slice(6);
          paste = true;
          continue;
        }
        if (pending[0] === '\x1b') {
          if (pending.length === 1) break;
          if (pending[1] === ']' || pending[1] === '_') {
            const end = pending.indexOf('\x1b\\', 2),
              bel = pending.indexOf('\x07', 2);
            const n = bel >= 0 && (end < 0 || bel < end) ? bel + 1 : end >= 0 ? end + 2 : -1;
            if (n < 0) {
              if (pending.length > 24000) pending = '';
              break;
            }
            pending = pending.slice(n);
            continue;
          }
          // SGR mouse report (modes 1003 + 1006): ESC [ < button ; column ; row M|m, one-based.
          // Bit 32 marks motion: with the left button held it is a drag, with none (button 3) a hover.
          const mouse = pending.match(/^\x1b\[<(\d{1,4});(\d{1,5});(\d{1,5})([Mm])/);
          if (mouse) {
            const b = Number(mouse[1]);
            const button = b & 64 ? (b & 1 ? 'wheeldown' : 'wheelup') : (b & 3) === 0 ? 'left' : 'other';
            events.push({
              key: 'mouse',
              button,
              x: Number(mouse[2]) - 1,
              y: Number(mouse[3]) - 1,
              release: mouse[4] === 'm',
              ...(b & 32 && !(b & 64) ? { motion: true } : {}),
            });
            pending = pending.slice(mouse[0].length);
            continue;
          }
          // Kitty keyboard protocol, disambiguate mode (the host turns it on): ESC [ code ; modifiers u. Shift (or any
          // modifier) with Enter is a new line; the rest are rewritten as the legacy bytes they stand for.
          const csiU = pending.match(/^\x1b\[(\d{1,7})(?:;(\d{1,3})(?::\d+)?)?u/);
          if (csiU) {
            const code = Number(csiU[1]),
              mods = Math.max(0, Number(csiU[2] || 1) - 1),
              rest = pending.slice(csiU[0].length);
            if (code === 13 && mods) events.push({ key: 'newline' });
            else if (code === 27) events.push({ key: 'escape' });
            else if (code === 9 && mods & 1) events.push({ key: 'shift-tab' });
            else {
              const letter = (code >= 97 && code <= 122) || (code >= 64 && code <= 95);
              const legacy =
                mods & 4 && letter
                  ? String.fromCharCode(code & 0x1f)
                  : code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
                    ? String.fromCodePoint(code)
                    : '';
              pending = (mods & 2 && legacy ? '\x1b' : '') + legacy + rest;
              continue;
            }
            pending = rest;
            continue;
          }
          const m = pending.match(/^\x1b(?:\[([0-9;?]*)([ -/]*[@-~])|O([A-Z]))/);
          if (m) {
            const code = m[3] || m[2],
              n = m[1];
            let key = { A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end', Z: 'shift-tab' }[code];
            // Modified arrows (ESC [ 1 ; mod D): Option or Ctrl moves by word, Cmd to the line's ends; Shift extends
            // the highlight.
            const mod = Number(n?.split(';')[1]) - 1;
            // Option-Up / Option-Down make the focused box shorter or taller.
            if (mod > 0 && mod & 2 && !(mod & 4) && (code === 'A' || code === 'B'))
              key = code === 'A' ? 'box-shorter' : 'box-taller';
            if (mod > 0 && (code === 'C' || code === 'D')) {
              if (mod & 8) key = code === 'C' ? 'end' : 'home';
              else if (mod & 6) key = code === 'C' ? 'word-right' : 'word-left';
            }
            if (code === '~')
              key = { 1: 'home', 2: 'insert', 3: 'delete', 4: 'end', 5: 'pageup', 6: 'pagedown', 7: 'home', 8: 'end' }[
                n
              ];
            if (key) events.push(mod > 0 && mod & 1 && 'ABCDHF'.includes(code) ? { key, shift: true } : { key });
            pending = pending.slice(m[0].length);
            continue;
          }
          // Option as Meta: ESC b / ESC f move by word, ESC d and ESC Backspace delete a word; ESC Enter is a new line.
          const meta = { b: 'word-left', f: 'word-right', d: 'word-delete', '\x7f': 'word-backspace', '\r': 'newline' }[
            pending[1]
          ];
          if (meta) {
            events.push({ key: meta });
            pending = pending.slice(2);
            continue;
          }
          if (/^\x1b\[<?[0-9;?]*$/.test(pending) || pending === '\x1bO') {
            if (pending.length > 24000) pending = '';
            break;
          }
          events.push({ key: 'escape' });
          pending = pending.slice(1);
          continue;
        }
        const ch = [...pending][0];
        pending = pending.slice(ch.length);
        const key = {
          '\x03': 'ctrl-c',
          // Readline editing keys, for the boxes and inputs.
          '\x01': 'home',
          '\x05': 'end',
          '\x02': 'left',
          '\x06': 'right',
          '\x04': 'delete',
          '\x0b': 'kill-end',
          '\x15': 'kill-start',
          '\x17': 'word-backspace',
          '\x07': 'ctrl-g',
          '\x0f': 'ctrl-o',
          '\x13': 'ctrl-s',
          '\x09': 'tab',
          '\x0d': 'enter',
          // Ctrl-J: a new line in any terminal, for when Shift-Enter cannot be told from Enter.
          '\x0a': 'newline',
          '\x7f': 'backspace',
          '\x08': 'backspace',
        }[ch];
        if (key) events.push({ key });
        // Any printable character, not only ASCII: C0 and C1 controls and DEL are never text.
        else if (ch >= ' ' && ch !== '\x7f' && !(ch >= '\x80' && ch <= '\x9f')) events.push({ key: 'text', text: ch });
      }
      return events;
    },
    flushEscape() {
      if (pending === '\x1b') {
        pending = '';
        return [{ key: 'escape' }];
      }
      return [];
    },
    get waitingEscape() {
      return pending === '\x1b';
    },
  };
}
