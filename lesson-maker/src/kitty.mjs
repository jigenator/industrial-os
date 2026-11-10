import { randomInt } from 'node:crypto';
import { aspectPlacement } from './geometry.mjs';
const ESC = '\x1b';

export function imageMode({ mode = 'auto', plain = false, env = process.env, tty = false } = {}) {
  if (plain || env.NO_COLOR !== undefined || mode === 'text') return false;
  if (mode === 'kitty') return true;
  if (!tty || env.TMUX || env.STY || /tmux|screen|dumb/i.test(env.TERM || '')) return false;
  return (
    env.TERM_PROGRAM === 'herdr' ||
    env.TERM_PROGRAM === 'kitty' ||
    Boolean(env.KITTY_WINDOW_ID) ||
    /kitty/i.test(env.TERM || '')
  );
}

export function transmit(bytes, id, placement, rect) {
  const b64 = bytes.toString('base64');
  const chunks = [];
  for (let offset = 0; offset < b64.length; offset += 4096) {
    const last = offset + 4096 >= b64.length;
    const metadata = offset === 0 ? `a=T,f=100,t=d,q=2,i=${id},p=${placement},c=${rect.width},r=${rect.height},` : '';
    chunks.push(`${ESC}_G${metadata}m=${last ? 0 : 1};${b64.slice(offset, offset + 4096)}${ESC}\\`);
  }
  return `${ESC}7${ESC}[${rect.y + 1};${rect.x + 1}H${chunks.join('')}${ESC}8`;
}

export const deleteImage = (id) => `${ESC}_Ga=d,d=I,i=${id},q=2;${ESC}\\`;

export function createImageTransport(write, { cell } = {}) {
  let current = [];
  let sequence = randomInt(1, 0x3fffffff);
  const unchanged = (images) =>
    images.length === current.length &&
    images.every((image, index) => {
      const previous = current[index];
      return (
        image.key === previous.key &&
        image.bytes === previous.bytes &&
        JSON.stringify(image.rect) === JSON.stringify(previous.rect)
      );
    });
  function clear() {
    for (const image of current) write(deleteImage(image.id));
    current = [];
  }
  return {
    clear,
    dispose: clear,
    // Host calls this before repaint, then sync after text is painted.
    prepare(images) {
      if (!unchanged(images)) clear();
    },
    sync(images) {
      if (unchanged(images)) return;
      clear();
      for (const image of images) {
        const id = ++sequence;
        const placement = ++sequence;
        current.push({ ...image, id, placement });
        const rect = aspectPlacement(image.rect, image.width, image.height, cell);
        write(transmit(image.bytes, id, placement, rect));
      }
    },
    get placements() {
      return current;
    },
  };
}
