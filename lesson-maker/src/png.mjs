import { deflateSync, inflateSync } from 'node:zlib';
import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, resolve, parse, sep } from 'node:path';
import { ACID_BLACK } from '@industrial-os/design-system/foundation/palette';
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const MAX_BYTES = 16 * 1024 * 1024;
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}
// Original 3x5 bitmap alphabet, project-owned; no font or asset downloads.
const glyphs = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '101111111111101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101111011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  0: '111101101101111',
  1: '010110010010111',
  2: '110001010100111',
  3: '110001010001110',
  4: '101101111001001',
  5: '111100110001110',
  6: '011100111101111',
  7: '111001010010010',
  8: '111101111101111',
  9: '111101111001110',
  '-': '000000111000000',
  '/': '001001010100100',
  ':': '000010000010000',
  '?': '110001010000010',
  '=': '000111000111000',
};
export function samplePng(kind = 'nearby', variant = 'before') {
  const width = 640,
    height = 240,
    pixels = Buffer.alloc(width * height * 3);
  const rgb = (key) =>
    ACID_BLACK[key]
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16));
  function rect(x, y, w, h, color = 'primary') {
    const c = rgb(color);
    for (let j = Math.max(0, y); j < Math.min(height, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(width, x + w); i++) {
        const at = (j * width + i) * 3;
        pixels[at] = c[0];
        pixels[at + 1] = c[1];
        pixels[at + 2] = c[2];
      }
  }
  function text(value, x, y, scale = 3, color = 'primary') {
    for (const ch of value.toUpperCase()) {
      const bits = glyphs[ch] || '000000000000000';
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 3; i++)
          if (bits[j * 3 + i] === '1') rect(x + i * scale, y + j * scale, scale, scale, color);
      x += 4 * scale;
    }
  }
  function arrow(x, y, to, color = 'accent') {
    rect(x, y, to - x, 3, color);
    for (let i = 0; i < 12; i++) rect(to - i, y - i / 2, 2, i + 2, color);
  }
  function box(label, x, y, w = 150) {
    rect(x, y, w, 3, 'secondary');
    rect(x, y + 62, w, 3, 'secondary');
    rect(x, y, 3, 65, 'secondary');
    rect(x + w - 3, y, 3, 65, 'secondary');
    text(label, x + 10, y + 24, 3);
  }
  if (kind === 'freshness') {
    text('FRESHNESS: MAX-AGE=3600', 35, 24, 4);
    arrow(40, 120, 590);
    rect(470, 85, 3, 90, 'warning');
    text('0 S', 35, 155);
    text('REUSE COPY', 110, 90, 4, 'accent');
    text('3600 S', 445, 180);
    text('MUST CHECK', 470, 58, 3, 'warning');
  } else if (kind === 'etag') {
    text('VALIDATE WITH ETAG', 40, 20, 4);
    box('BROWSER', 25, 80);
    box('SERVER', 455, 80);
    arrow(180, 95, 440);
    text('ETAG', 270, 70);
    text('304: UNCHANGED', 185, 150, 4, 'accent');
    text('200: FULL FILE', 185, 195, 4, 'warning');
  } else if (kind === 'exercise' || kind === 'policy') {
    text(
      kind === 'exercise'
        ? 'CHOOSE TRUST TIME'
        : variant === 'after'
          ? 'AFTER: MATCH CHANGE RATE'
          : 'BEFORE: ONE POLICY',
      30,
      20,
      4,
    );
    box('LOGO', 40, 75, 220);
    box('NEWS FEED', 360, 75, 220);
    text(kind === 'exercise' ? 'MAX-AGE ?' : variant === 'after' ? 'ONE YEAR' : 'ONE DAY', 50, 165, 4, 'accent');
    text(kind === 'exercise' ? 'MAX-AGE ?' : variant === 'after' ? 'VALIDATE' : 'ONE DAY', 365, 165, 4, 'warning');
  } else if (kind === 'recap') {
    text('FAST COPY / STALE COPY', 40, 25, 4);
    text('FRESHNESS', 40, 95, 4, 'accent');
    arrow(295, 104, 345);
    text('VALIDATE', 365, 95, 4, 'warning');
    text('PHONE MAP / PANTRY', 70, 190, 4);
  } else {
    text('A NEARBY COPY SKIPS THE TRIP', 20, 20, 4);
    box('BROWSER', 20, 85, 140);
    box('SAVED COPY', 205, 85, 150);
    box('SERVER', 485, 85, 130);
    arrow(165, 110, 195);
    arrow(365, 110, 475, 'warning');
    text('SHORT', 170, 175, 3, 'accent');
    text('FAR AWAY', 435, 175, 3, 'warning');
  }
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function validatePng(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length > MAX_BYTES ||
    bytes.length < 45 ||
    !bytes.subarray(0, 8).equals(signature)
  )
    throw Error('Not a bounded PNG file');
  let offset = 8,
    width,
    height,
    channels,
    idat = [],
    ended = false,
    seenData = false,
    closedData = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw Error('Truncated PNG');
    const length = bytes.readUInt32BE(offset),
      end = offset + length + 12;
    if (end > bytes.length) throw Error('Truncated PNG chunk');
    const type = bytes.toString('ascii', offset + 4, offset + 8),
      data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw Error('PNG checksum invalid');
    if (!width && type !== 'IHDR') throw Error('Missing PNG header');
    if (type === 'IHDR') {
      if (width || length !== 13) throw Error('Malformed PNG header');
      width = data.readUInt32BE();
      height = data.readUInt32BE(4);
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[data[9]];
      if (!width || !height || width > 4096 || height > 4096) throw Error('PNG dimensions must be 1-4096 per side');
      if (data[8] !== 8 || !channels || data[10] || data[11] || data[12])
        throw Error('Unsupported PNG: use noninterlaced 8-bit grayscale/RGB/RGBA');
    } else if (type === 'IDAT') {
      if (closedData) throw Error('Non-contiguous PNG data');
      idat.push(data);
      seenData = true;
    } else if (type === 'IEND') {
      if (length || !seenData || end !== bytes.length) throw Error('Malformed PNG end');
      ended = true;
    } else {
      if (seenData) closedData = true;
      if (!/^[a-zA-Z]{4}$/.test(type) || type[0] === type[0].toUpperCase())
        throw Error('Unsupported critical PNG chunk');
    }
    offset = end;
  }
  if (!ended) throw Error('Missing PNG end');
  const expected = height * (1 + width * channels),
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  if (raw.length !== expected) throw Error('Malformed PNG pixels');
  for (let y = 0; y < height; y++) if (raw[y * (width * channels + 1)] > 4) throw Error('Invalid PNG scanline filter');
  return { width, height };
}
export async function admitPng(path) {
  // shortcut: ancestor directories can be swapped after lstat and before open; O_NOFOLLOW protects only the leaf.
  // This race is acceptable for a local single-user app reading the operator's own files, not a security boundary.
  const full = resolve(path),
    root = parse(full).root;
  let current = root;
  for (const part of full.slice(root.length).split(sep)) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw Error('Symlinks are not accepted');
  }
  const file = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw Error('Choose a regular PNG file');
    if (stat.size > MAX_BYTES) throw Error('PNG exceeds 16 MiB');
    const bytes = Buffer.alloc(stat.size + 1);
    let n = 0;
    while (n < bytes.length) {
      const { bytesRead } = await file.read(bytes, n, bytes.length - n, null);
      if (!bytesRead) break;
      n += bytesRead;
    }
    if (n !== stat.size) throw Error('PNG changed while reading');
    const data = bytes.subarray(0, n);
    return { bytes: data, ...validatePng(data), name: basename(full) };
  } finally {
    await file.close();
  }
}
