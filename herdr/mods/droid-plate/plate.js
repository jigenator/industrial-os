// The pane header's seven rows: the design system's unit plate (rows 0–5) and status strip with its keycap bay
// (row 6), for a model from model.js at one width and lighting. Pure; the view turns the rows into elements.

import { fitUnitCode, unitPlate, UNIT_PLATE_ROWS } from "./ds/elements/unit-plate/unit-plate.mjs";
import { statusStrip } from "./ds/elements/status-strip/status-strip.mjs";
import { resolveStyle } from "./ds/foundation/cells.mjs";
import { glyphShape } from "./ds/foundation/glyph-shapes.mjs";

/** The droid header's title-block threshold: narrower plates have no title block, barcode or bay alignment. */
export const TITLE_BLOCK_MIN = 56;
/** Every plate's title block (and the bay under it) is this wide, so they line up across panes. */
export const BLOCK_WIDTH = 16;
/** The narrowest plate drawn; a narrower pane gets this width, cut by the pane's edge. */
export const MIN_WIDTH = 24;
/** The widest plate composed: herdr-app interrupts a task after 500–700 ms, and a plate costs about 1 ms a column there
 *  cold. A wider pane gets a plate this wide whose middle is widened: the cells from SPREAD_TAIL before its right edge
 *  move to the pane's right edge, and the gap repeats the cell before them, which is always plain ground (two cells
 *  before the title block). So the title block, barcode and bay still end on W − 3, at any width. */
export const DRAW_LIMIT = 256;
export const SPREAD_TAIL = 19;
/** The most columns a header is planned for (a sanity bound; a pane this wide is not a real terminal). */
export const MAX_COLUMNS = 20000;
/** Herdr's drag grip, the pill over the pane's top centre on top-edge hover: 28 × 18 px (measured at 2x, 56 × 36
 *  device px). The peak stays this half-width plus PEAK_CLEAR cells right of the pane's centre. */
export const GRIP_PX = 28;
export const PEAK_CLEAR = 2;
export const ROWS = UNIT_PLATE_ROWS + 1;
/** Plate rows are the terminal's row height at font 14 and line height 1 (18.5 px at 2x); the strip takes the rest of
 * the layout's 130 px header. */
export const PLATE_ROW_PX = 18.5;
export const STRIP_ROW_PX = 19;
/** The tops and heights of the seven rows, in px. */
export const ROW_TOPS = Object.freeze(Array.from({ length: ROWS }, (_, i) => i * PLATE_ROW_PX));
export const ROW_HEIGHTS = Object.freeze(Array.from({ length: ROWS }, (_, i) => (i < UNIT_PLATE_ROWS ? PLATE_ROW_PX : STRIP_ROW_PX)));

/** The keys in the bay, in order: split right, split down, zoom (unzoom while zoomed) and close. */
export const KEY_ACTIONS = Object.freeze(["split-right", "split-down", "zoom", "close"]);

export const keysFor = (zoomed) => [{ glyph: "|" }, { glyph: "-" }, { glyph: zoomed ? "v" : "^" }, { glyph: "x" }];

/**
 * The first column the peak may paint on a header `widthPx` wide with `cell`-px columns: the pane's centre plus the
 * grip's half-width, then PEAK_CLEAR whole cells. Null without a width (the peak stays centred).
 */
export function peakFromOf(widthPx, cell) {
	if (!(widthPx > 0) || !(cell > 0)) return null;
	return Math.min(MAX_COLUMNS, Math.ceil((widthPx / 2 + GRIP_PX / 2) / cell - 1e-6) + PEAK_CLEAR);
}

/** The plate input and options for a model at `width`: TERM and AGT codes fitted, or their bare prefix. */
export function plateSpec(model, width, peakFrom = null) {
	const titleBlock = width >= TITLE_BLOCK_MIN;
	if (model.kind === "droid") return { input: model.plate, options: { width, titleBlock, ...model.options, ...(model.options?.peak ? { peakFrom } : {}) } };
	const unit = fitUnitCode(model.prefix, model.code, { width, titleBlock, blockWidth: BLOCK_WIDTH });
	return { input: { ...model.plate, unit }, options: { width, titleBlock, blockWidth: BLOCK_WIDTH, ...model.options } };
}

/**
 * The header for `model` at `width` columns: `lines` (design-system lines, seven rows of `drawn` cells, at most
 * DRAW_LIMIT), the bay's `keys` (cells and hit cells), the strip's `status` cells, the plate's `regions` and the peak's
 * `paint`, all in the drawn columns; `spread` says where the plan widens the drawn rows to `width` (null when it does
 * not). A peak that would not lie wholly before the widened gap is not drawn.
 */
export function composeHeader(model, { width, lighting = "lit", hover = null, pressed = null, zoomed = false, peakFrom = null }) {
	const W = plannedColumns(width);
	const drawn = Math.min(W, DRAW_LIMIT);
	const spread = spreadOf(drawn, W);
	// unitPlate keeps the peak three cells before the title block, so before the gap; a later start has no room.
	const from = peakFrom === null ? null : Math.min(peakFrom, drawn);
	const { input, options } = plateSpec(model, drawn, from);
	const plate = unitPlate(input, { ...options, lighting });
	const strip = statusStrip(model.strip, { width: drawn, keys: keysFor(zoomed), lighting, hover, pressed });
	return { width: W, drawn, spread, lines: [...plate.lines, strip.line], keys: strip.keys, status: strip.status, regions: plate.regions, paint: plate.paint };
}

/** How rows `drawn` cells wide widen to `columns` (null when they need not). */
export const spreadOf = (drawn, columns) => (columns > drawn ? { at: drawn - SPREAD_TAIL, by: columns - drawn } : null);
/** The columns a header is planned for: at least MIN_WIDTH, at most MAX_COLUMNS. */
export const plannedColumns = (cols) => Math.min(MAX_COLUMNS, Math.max(MIN_WIDTH, Number.isFinite(cols) ? Math.floor(cols) : MIN_WIDTH));
/** A drawn column's column in the widened header. */
export const spreadCol = (col, spread) => (spread && col >= spread.at ? col + spread.by : col);

/** The most pieces one render draws, shared by every layer on screen: about 2,000 elements render in 15–20 ms in
 *  herdr-app, and a lighting switch stacks two or three plates. A plan over its share is coarsened. */
export const PIECE_BUDGET = 2400;
// Per channel; 16 at most, so the peak's acid, the strip's frost and the bay's ground never join the plate's ground.
const TOLERANCES = [2, 4, 8, 16];
const parsed = new Map();
function channels(hex) {
	let value = parsed.get(hex);
	if (value === undefined) {
		value = typeof hex === "string" && /^#[0-9a-f]{6}/i.test(hex) ? [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) : null;
		if (parsed.size > 4096) parsed.clear();
		parsed.set(hex, value);
	}
	return value;
}
function near(a, b, tolerance) {
	if (a === b) return true;
	const x = channels(a), y = channels(b);
	return !!x && !!y && x.every((v, i) => Math.abs(v - y[i]) <= tolerance);
}
// Joins each run of touching pieces in one row and bank whose colors differ by at most `tolerance` per channel.
function join(pieces, tolerance, joinable) {
	const out = [];
	let last = null, copied = false;
	for (const piece of pieces) {
		if (last && joinable(last, piece) && last.row === piece.row && last.bank === piece.bank && last.y === piece.y && last.h === piece.h
			&& Math.abs(last.x + last.w - piece.x) < 1e-6 && near(last.color, piece.color, tolerance)) {
			if (!copied) { last = { ...last }; out[out.length - 1] = last; copied = true; }
			last.w = piece.x + piece.w - last.x;
		} else {
			out.push(piece);
			last = piece;
			copied = false;
		}
	}
	return out;
}

/**
 * A plan within `budget` pieces where it can be: the ground's runs and its hairlines are joined across cells whose
 * colors differ by a growing tolerance (2, 4, 8, then 16 per channel) until it fits; each joined run takes its first
 * cell's color, so the brushed texture coarsens while every ink, the peak's paint, the strip and the bay keep their
 * own runs. Under budget, unchanged.
 */
export function coarsen(plan, budget = PIECE_BUDGET) {
	const count = (p) => p.bgs.length + p.rects.length + p.texts.length;
	if (count(plan) <= budget) return plan;
	let out = plan;
	for (const tolerance of TOLERANCES) {
		out = { ...plan, bgs: join(plan.bgs, tolerance, () => true), rects: join(plan.rects, tolerance, (a, b) => a.kind === "line" && b.kind === "line"), coarse: tolerance };
		if (count(out) <= budget) break;
	}
	return out;
}

// Herdr's display scales tried, most likely first, when the cell width is inferred.
const SCALES = [2, 1, 3, 4];
const EPSILON = 1e-6;

/**
 * The terminal's cell width in px. Herdr places terminal cells as Ghostty does: the font's advance times the
 * `terminal_cell_width` multiplier, rounded up to a whole device pixel. A mod measures the advance (a run of the
 * terminal's font at its size) but is not told the display's scale, so the scale whose cell gives Herdr's column
 * count across the header's width is taken: at 2x, JetBrains Mono 14's 8.406 px advance is an 8.5 px cell, 198
 * columns in 1684 px. Without a match, the width over the columns; without a width or columns, the advance times the
 * multiplier. Returns `{ cell, scale }`; `scale` is null when it was not inferred.
 */
export function cellWidthOf({ advance = null, multiplier = 1, width = null, cols = null }) {
	const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
	const known = (v) => Number.isFinite(v) && v > 0;
	if (known(advance) && known(width) && Number.isSafeInteger(cols) && cols > 0) {
		for (const scale of SCALES) {
			const cell = Math.ceil(advance * m * scale - EPSILON) / scale;
			if (Math.floor(width / cell + EPSILON) === cols) return { cell, scale };
		}
	}
	if (known(width) && Number.isSafeInteger(cols) && cols > 0) return { cell: width / cols, scale: null };
	if (known(advance)) return { cell: advance * m, scale: null };
	return { cell: null, scale: null };
}

/** How many whole cells fit across `width` px. */
export const columnsOf = (width, cell) => Math.max(1, Math.floor(width / cell + EPSILON));

/**
 * A convex polygon in a unit cell, filled into the box `{ x, y, w, h }` as horizontal bands one device pixel tall
 * (one px when the scale is unknown), each as wide as the polygon at the band's middle, and bands of one extent
 * joined. A host whose shapes keep their aspect ratio (Herdr's svg) cannot stretch a triangle to a cell, so the
 * triangle is drawn from rectangles; its edge steps one device pixel at a time.
 */
export function scanPolygon(points, box, snap = (v) => v, scale = null) {
	const step = scale ? 1 / scale : 1, bands = [];
	const rows = Math.max(1, Math.round(box.h / step));
	for (let i = 0; i < rows; i++) {
		const y0 = snap(box.y + (i * box.h) / rows), y1 = snap(box.y + ((i + 1) * box.h) / rows);
		const v = (i + 0.5) / rows; // the band's middle, in the unit cell
		let lo = Infinity, hi = -Infinity;
		points.forEach(([ax, ay], k) => {
			const [bx, by] = points[(k + 1) % points.length];
			if ((ay <= v && by >= v) || (by <= v && ay >= v)) {
				const xs = ay === by ? [ax, bx] : [ax + ((v - ay) * (bx - ax)) / (by - ay)];
				for (const xv of xs) { lo = Math.min(lo, xv); hi = Math.max(hi, xv); }
			}
		});
		if (!(hi > lo)) continue;
		const x0 = snap(box.x + lo * box.w), x1 = snap(box.x + hi * box.w);
		if (x1 <= x0) continue;
		const last = bands.at(-1);
		if (last && last.x === x0 && last.w === x1 - x0 && last.y + last.h === y0) last.h = y1 - last.y;
		else bands.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
	}
	return bands;
}

/**
 * The header's seven lines as positioned pieces for a pixel host, every cell at x = col × cell and every row at its
 * top in ROW_TOPS: background rectangles (adjacent cells of one color merged), shape rectangles for the
 * glyphs a terminal draws itself (GLYPH_SHAPES: block elements, light lines, and the Powerline triangles in device-pixel
 * bands, see scanPolygon), and one text piece
 * per text cell, so no glyph's own advance can move the grid. `width` px past the last column takes each row's last
 * color. Positions are snapped to the device pixel when the scale is known. `keys` (the strip's bay keys) become hit
 * areas over row 6. Colors are hex.
 */
export function cellPlan(lines, { cell, scale = null, width = null, keys = [], banks = [], spread = null }) {
	// Runs break at bank edges, so every piece lies in one bank; `bank` is its index (0 without banks).
	const breaks = new Set(banks.map((b) => b.left).filter((c) => c > 0));
	const bankOf = (col) => { let k = 0; banks.forEach((b, i) => { if (col >= b.left) k = i; }); return k; };
	const snap = scale ? (v) => Math.round(v * scale) / scale : (v) => v;
	const thin = scale ? Math.max(1, Math.round(scale)) / scale : 1; // a light line: one logical px, whole device px
	const bgs = [], rects = [], texts = [];
	let cols = 0;
	lines.forEach((line, row) => {
		const top = ROW_TOPS[row], height = ROW_HEIGHTS[row];
		const cells = [];
		for (const span of line) {
			const style = resolveStyle(span.style);
			for (const ch of span.text) cells.push({ ch, fg: style.fg ?? null, bg: style.bg ?? null, bold: style.bold === true });
		}
		// Widened: the gap repeats the cell before it, its ground and any line or block shape, never its text.
		if (spread && spread.at > 0 && spread.at <= cells.length) {
			const before = cells[spread.at - 1];
			const fill = before.ch === " " || glyphShape(before.ch) ? before : { ...before, ch: " " };
			cells.splice(spread.at, 0, ...Array.from({ length: spread.by }, () => fill));
		}
		cols = Math.max(cols, cells.length);
		const x = (col) => snap(col * cell);
		let run = null;
		const flush = () => { if (run && run.bg) bgs.push({ row, bank: bankOf(run.col), x: x(run.col), y: top, w: x(run.col + run.len) - x(run.col), h: height, color: run.bg }); run = null; };
		let shapeRun = null;
		const flushShape = () => {
			if (!shapeRun) return;
			const { col, len, part, color } = shapeRun;
			if (part.line === "h") rects.push({ row, bank: bankOf(col), kind: "line", x: x(col), y: snap(top + (height - thin) / 2), w: x(col + len) - x(col), h: thin, color });
			else {
				const [, ry, , rh] = part.rect, y0 = snap(top + ry * height);
				rects.push({ row, bank: bankOf(col), kind: "block", x: x(col), y: y0, w: x(col + len) - x(col), h: snap(top + (ry + rh) * height) - y0, color });
			}
			shapeRun = null;
		};
		cells.forEach((c, col) => {
			if (breaks.has(col)) { flush(); flushShape(); }
			if (run && run.bg === c.bg) run.len++;
			else { flush(); run = { col, len: 1, bg: c.bg }; }
			if (c.ch === " ") { flushShape(); return; }
			const shape = glyphShape(c.ch);
			if (!shape) { flushShape(); texts.push({ row, bank: bankOf(col), x: x(col), y: top, w: x(col + 1) - x(col), h: height, ch: c.ch, color: c.fg, bold: c.bold }); return; }
			// Whole-width rectangles and horizontal lines of one color join across cells; anything else is per cell.
			const part = shape.length === 1 ? shape[0] : null;
			const joins = part && ((part.rect && part.rect[0] === 0 && part.rect[2] === 1) || part.line === "h");
			const same = joins && shapeRun && shapeRun.color === c.fg && shapeRun.ch === c.ch && shapeRun.col + shapeRun.len === col;
			if (same) { shapeRun.len++; return; }
			flushShape();
			if (joins) { shapeRun = { col, len: 1, part, color: c.fg, ch: c.ch }; return; }
			const bank = bankOf(col);
			for (const p of shape) {
				const x0 = x(col), w = x(col + 1) - x0;
				if (p.rect) {
					const [rx, ry, rw, rh] = p.rect;
					rects.push({ row, bank, kind: "block", x: snap(x0 + rx * w), y: snap(top + ry * height), w: snap(x0 + (rx + rw) * w) - snap(x0 + rx * w), h: snap(top + (ry + rh) * height) - snap(top + ry * height), color: c.fg });
				} else if (p.line === "v") {
					rects.push({ row, bank, kind: "line", x: snap(x0 + (w - thin) / 2), y: top, w: thin, h: height, color: c.fg });
				} else if (p.polygon) {
					for (const band of scanPolygon(p.polygon, { x: x0, y: top, w, h: height }, snap, scale)) rects.push({ row, bank, kind: "band", ...band, color: c.fg });
				} else if (p.line === "h") {
					rects.push({ row, bank, kind: "line", x: x0, y: snap(top + (height - thin) / 2), w, h: thin, color: c.fg });
				}
			}
		});
		flushShape();
		flush();
		const end = x(cells.length);
		if (width !== null && width > end && cells.length) bgs.push({ row, bank: bankOf(cells.length - 1), x: end, y: top, w: width - end, h: height, color: cells.at(-1).bg ?? "#000000" });
	});
	const strip = ROWS - 1, hits = keys.map((k0) => ({ ...k0, hitCol: spreadCol(k0.hitCol, spread) })).map((k) => ({ x: snap(k.hitCol * cell), y: ROW_TOPS[strip], w: snap((k.hitCol + k.hitLen) * cell) - snap(k.hitCol * cell), h: ROW_HEIGHTS[strip] }));
	// Each bank's left edge and width in px; the last runs to the header's edge.
	const xAt = (col) => snap(col * cell);
	const edges = banks.map((b) => xAt(b.left));
	const bankBoxes = banks.map((b, i) => ({ x: edges[i], w: (i + 1 < banks.length ? edges[i + 1] : Math.max(xAt(cols), width ?? 0)) - edges[i] }));
	return { cell, cols, bgs, rects, texts, hits, banks: bankBoxes };
}
