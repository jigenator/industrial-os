// SGR cell reports at Node 22's existing keypress seam, not a second escape/key decoder.
// Node emits ESC[<, then individual payload characters. Keep at most 32 characters and consume
// invalid/overlong reports through their CSI final byte so coordinates never become shortcuts.
// No timeout: a new decoded escape key/sequence or Ctrl-C can always recover an unfinished report.
// Protocol: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
export function mouseDecoder(onClick, onEscape) {
  let packet = null;
  let invalid = false;
  let legacy = 0;
  return (sequence) => {
    // Node may combine a preceding Esc with the report prefix. Deliver that key separately;
    // repeated standalone Esc bytes must also reach the host before any following mouse payload.
    if (/^\x1b{2,}$/.test(sequence)) {
      packet = null;
      invalid = false;
      legacy = 0;
      for (const _ of sequence) onEscape();
      return true;
    }
    if (sequence === '\x1b\x1b[<' || sequence === '\x1b\x1b[M') {
      onEscape();
      sequence = sequence.slice(1);
    }
    if (sequence.startsWith('\x1b') || sequence === '\x03') {
      packet = null;
      invalid = false;
      legacy = 0;
      if (sequence === '\x1b[<') {
        packet = '';
        return true;
      }
      // A terminal ignoring 1006 may send X10's three-byte payload. Discard it, never activate.
      if (sequence === '\x1b[M') {
        legacy = 3;
        return true;
      }
      return false;
    }
    if (legacy) {
      legacy--;
      return true;
    }
    if (packet === null) return false;
    if (/^[\x40-\x7e]$/.test(sequence)) {
      const match = !invalid && /^0;([1-9]\d{0,3});([1-9]\d{0,3})$/.exec(packet);
      packet = null;
      if (sequence === 'M' && match) {
        const column = Number(match[1]);
        const row = Number(match[2]);
        if (column <= 1000 && row <= 1000) onClick({ column, row });
      }
    } else if (!invalid && /^[\d;]$/.test(sequence) && packet.length < 32) packet += sequence;
    else invalid = true;
    return true;
  };
}
