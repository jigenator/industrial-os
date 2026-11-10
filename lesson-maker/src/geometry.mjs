// The narrowest each column may be dragged to; the slide area keeps room for its form.
export const MIN_COLUMNS = { outline: 24, chat: 34, main: 52 };
// Column plan by terminal size. Heights depend only on size, never on content, so nothing jumps. columns holds the
// outline and chat widths the user chose (or null for the defaults); they are kept within MIN_COLUMNS.
export function geometry(width, height, columns = {}) {
  const w = Math.max(1, Math.min(1000, Math.floor(width))),
    h = Math.max(1, Math.min(1000, Math.floor(height)));
  // One column needs 30 rows to keep the slide, teaching plan and chat all visible.
  if (w < 80 || h < 24 || (w < 100 && h < 30)) return { w, h, small: true };
  const body = h - 2;
  if (w >= 150) {
    const { outline: mo, chat: mc, main: mm } = MIN_COLUMNS,
      chw = clamp(columns.chat ?? clamp(Math.round(w * 0.28), 44, 60), mc, w - 2 - mo - mm),
      ow = clamp(columns.outline ?? (w >= 200 ? 46 : 40), mo, w - chw - 2 - mm);
    // The outline hidden by the author (o): the slide area takes its width, and Ctrl-O opens it as a panel.
    if (columns.outlineHidden)
      return {
        w,
        h,
        small: false,
        mode: 'wide',
        outline: null,
        main: { x: 0, y: 1, w: w - chw - 1, h: body },
        chat: { x: w - chw, y: 1, w: chw, h: body },
        rules: [w - chw - 1],
        sides: ['chat'],
      };
    return {
      w,
      h,
      small: false,
      mode: 'wide',
      outline: { x: 0, y: 1, w: ow, h: body },
      main: { x: ow + 1, y: 1, w: w - ow - chw - 2, h: body },
      chat: { x: w - chw, y: 1, w: chw, h: body },
      rules: [ow, w - chw - 1],
      sides: ['outline', 'chat'],
    };
  }
  if (w >= 100) {
    const chw = clamp(columns.chat ?? clamp(Math.round(w * 0.34), 38, 48), MIN_COLUMNS.chat, w - 1 - MIN_COLUMNS.main);
    return {
      w,
      h,
      small: false,
      mode: 'mid',
      outline: null,
      main: { x: 0, y: 1, w: w - chw - 1, h: body },
      chat: { x: w - chw, y: 1, w: chw, h: body },
      rules: [w - chw - 1],
      sides: ['chat'],
    };
  }
  const dock = h >= 34 ? 11 : 8;
  return {
    w,
    h,
    small: false,
    mode: 'stack',
    outline: null,
    main: { x: 0, y: 1, w, h: body - dock },
    chat: { x: 0, y: 1 + body - dock, w, h: dock, docked: true },
    rules: [],
    sides: [],
  };
}

// The width a column may take in plan g without moving the other column: the slide area gives way, down to its minimum.
export function columnWidth(g, side, want) {
  const other = side === 'outline' ? g.chat?.w : g.outline?.w || -1;
  return clamp(Math.round(want), MIN_COLUMNS[side], g.w - 2 - (other ?? 0) - MIN_COLUMNS.main);
}

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// Fits an image of the given pixel size inside rect, assuming cells twice as tall as wide.
export function aspectPlacement(rect, pngWidth, pngHeight, cell = { width: 1, height: 2 }) {
  const scale = Math.min((rect.width * cell.width) / pngWidth, (rect.height * cell.height) / pngHeight);
  const width = Math.max(1, Math.min(rect.width, Math.floor((pngWidth * scale) / cell.width))),
    height = Math.max(1, Math.min(rect.height, Math.floor((pngHeight * scale) / cell.height)));
  return {
    ...rect,
    x: rect.x + Math.floor((rect.width - width) / 2),
    y: rect.y + Math.floor((rect.height - height) / 2),
    width,
    height,
  };
}
