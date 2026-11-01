// The droid header's pure render core: state, width and intro time in, styled cell lines out. No Pi, clock, timer or
// I/O; the host supplies the grapheme measurer and owns ANSI emission. Only layout and data live here: the plate,
// the surface and the intro come from the design system. Layouts and the intro are in ../docs/design.md.
import { resolveStyle } from "@industrial-os/design-system/foundation/cells";
import { PI_CHROME } from "@industrial-os/design-system/foundation/signal-colors";
import { composeSurface } from "@industrial-os/design-system/foundation/surface";
import { FROST_ALPHA, SURFACE_PALETTE } from "@industrial-os/design-system/foundation/surface-palette";
import { UNIT_PLATE_ROWS, unitPlate } from "@industrial-os/design-system/elements/unit-plate";
import { crtBoot, crtBootDuration } from "@industrial-os/design-system/motions/crt-boot";
import type { Line as DsLine, Style } from "@industrial-os/design-system/foundation/cells";

export type Measure = (text: string) => number;
export interface Span { text: string; fg: string; bg: string; bold: boolean }
export type Line = Span[];

export type Manifest =
	| { status: "pending" }
	| { status: "unavailable"; reason: string }
	| { status: "ready"; context: string[]; skills: string[]; prompts: string[]; extensions: string[]; steering?: boolean };

export interface HeaderState {
	/** The last four hex digits of the session ID, or `????` when it has none. */
	unit: string;
	/** The first eight hex digits of the session ID, or `????????`. */
	session: string;
	/** Seeds the barcode and the intro from the session. */
	seed: number;
	core: string;
	version: string;
	sector: string;
	pane: string;
	deployed: string;
	assignment: string;
	manifest: Manifest;
	/** Intro time at which a ready manifest arrived while the intro was still playing. */
	manifestAt?: number;
	hints: ReadonlyArray<readonly [key: string, action: string]>;
}

/** Width thresholds: the hanging ledger from 100 columns, the plate's title block and peak from 56, the plate from 40. */
export const HANGING_WIDTH = 100;
export const TITLE_BLOCK_WIDTH = 56;
export const PLATE_WIDTH = 40;
/** The design system draws at most 1000 cells; a wider terminal gets the 1000-cell header padded with the field. */
const MAX_WIDTH = 1000;
/** The ledger's table: equal columns of at least 20 cells (18 below 44 columns, where two must fit). */
const MIN_COLUMN = 20;
/** The chat pane's surface gradient, run down to black on the header's last row; dots fade out below lightness 9. */
const FADE = { top: 19, drop: 19, edge: 3 };
const DOT_FLOOR = 9;

const pad = (n: number, digits: number) => String(n).padStart(digits, "0");

// --- Text: untrusted values become one-cell or two-cell graphemes; nothing else reaches the grid.

interface Glyph { s: string; w: number }
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/gu;

/** Display form of caller text: controls and bidi marks become `?`; graphemes wider than two cells become `?`. */
function glyphs(text: string, measure: Measure): Glyph[] {
	const out: Glyph[] = [];
	for (const { segment } of segmenter.segment(text.replace(UNSAFE, "?"))) {
		const w = measure(segment);
		if (w === 1 || w === 2) out.push({ s: segment, w });
		else if (w > 2) out.push({ s: "?", w: 1 });
	}
	return out;
}
const widthOf = (gs: Glyph[]) => gs.reduce((n, g) => n + g.w, 0);
/** At most `max` cells; an overflow keeps a whole-grapheme prefix and ends in `…`. */
function fit(gs: Glyph[], max: number): Glyph[] {
	if (max <= 0) return [];
	if (widthOf(gs) <= max) return gs;
	const out: Glyph[] = [];
	let used = 0;
	for (const g of gs) {
		if (used + g.w > max - 1) break;
		out.push(g);
		used += g.w;
	}
	return [...out, { s: "…", w: 1 }];
}
const plain = (text: string): Glyph[] => [...text].map((s) => ({ s, w: 1 }));

// --- The ledger's cell grid. A wide grapheme fills its cell and leaves an empty continuation cell after it.

interface Cell { s: string; style: Style }
class Grid {
	readonly rows: Cell[][] = [];
	readonly width: number;
	constructor(width: number) { this.width = width; }
	row(bg?: Style["bg"]): number {
		this.rows.push(Array.from({ length: this.width }, () => ({ s: " ", style: bg ? { bg } : {} })));
		return this.rows.length - 1;
	}
	/** Writes graphemes from `col`, clipped at the grid's edge; never splits a wide one. */
	put(row: number, col: number, gs: Glyph[], style: Style) {
		const cells = this.rows[row];
		let c = col;
		for (const g of gs) {
			if (c + g.w > this.width) break;
			if (c >= 0) {
				cells[c] = { s: g.s, style: { ...cells[c].style, ...style } };
				for (let k = 1; k < g.w; k++) cells[c + k] = { s: "", style: cells[c].style };
			}
			c += g.w;
		}
		return c;
	}
	/** Right-aligns `gs` so its last cell is `end`. */
	putEnd(row: number, end: number, gs: Glyph[], style: Style) { return this.put(row, end - widthOf(gs) + 1, gs, style); }
}

// --- The table: one set of equal columns per width, which every value, hold item and hint starts on.

interface Table { L: number; R: number; hanging: boolean; stops: number[]; colW: number; count: (grid: Grid, row: number, gs: Glyph[], style: Style) => void }
function table(width: number): Table {
	const L = 2, R = width - 3, hanging = width >= HANGING_WIDTH, C = hanging ? L + 16 : L;
	const room = R - C + 1, n = Math.max(2, Math.floor(room / MIN_COLUMN)), colW = Math.floor(room / n);
	const stops = Array.from({ length: n }, (_, i) => C + i * colW);
	// Counts right-align on the gutter's last label cell when hanging, or start on the second column line.
	const count = hanging
		? (grid: Grid, row: number, gs: Glyph[], style: Style) => { grid.putEnd(row, C - 3, gs, style); }
		: (grid: Grid, row: number, gs: Glyph[], style: Style) => { grid.put(row, stops[1], gs, style); };
	return { L, R, hanging, stops, colW, count };
}

/**
 * The most columns whose span holds every item with two cells to spare before the next column line: `cols` columns
 * each `floor(n / cols)` column lines wide, starting on every span-th line (any lines left over stay empty at the
 * right). One column always spans the whole table. Items fill the columns top to bottom; `room` is the cells an item
 * may use, and an item wider than the whole table is clipped to it.
 */
function fitColumns(widths: number[], t: Table) {
	const n = t.stops.length;
	const roomOf = (span: number) => span * t.colW - (span === n ? 0 : 2);
	for (let cols = n; cols >= 1; cols--) {
		const span = cols === 1 ? n : Math.floor(n / cols);
		if (cols < n && cols > 1 && Math.floor(n / (cols + 1)) === span) continue; // more columns already tried this span
		if (Math.max(0, ...widths) > roomOf(span)) continue;
		const used = Math.min(cols, widths.length);
		return { rows: used ? Math.ceil(widths.length / used) : 0, starts: Array.from({ length: used }, (_, c) => t.stops[c * span]), room: roomOf(span) };
	}
	return { rows: widths.length, starts: [t.stops[0]], room: roomOf(n) };
}

// --- Styles. Plate colors come with the unit plate; the ledger prints in Acid / Black roles on the surface.

const HEAD: Style = { fg: "primary", bold: true };
const HOLD: Style = { fg: "secondary", bold: true };
const LABEL: Style = { fg: "secondary" };
const VALUE: Style = { fg: "primary", bold: true };
const ITEM: Style = { fg: "primary" };
const HOLDS = [["CONTEXT", "context"], ["SKILLS", "skills"], ["PROMPTS", "prompts"], ["EXTENSIONS", "extensions"]] as const;

/** The ledger below the strip: SPECIFICATIONS, MANIFEST and its holds, then the row that reaches black. */
function ledger(state: HeaderState, t: Table, width: number, measure: Measure) {
	const grid = new Grid(width), text = (value: string) => glyphs(value, measure);
	const { L, R, stops } = t;
	const specs: Array<[string, string]> = [
		["MODEL", state.core], ["FRAMEWORK", `PI ${state.version}`], ["DEPLOYED", state.deployed],
		["SECTOR", state.sector], ["PANE", state.pane], ["ASSIGNMENT", state.assignment],
	];
	// A value runs to the next group's label column, two cells short, or to the right margin.
	const spec = (row: number, [label, value]: [string, string], at: number, next: number | undefined) => {
		grid.put(row, stops[at], plain(label), LABEL);
		grid.put(row, stops[at + 1], fit(text(value), (next === undefined ? R + 1 : next - 2) - stops[at + 1]), VALUE);
	};
	grid.row();
	if (t.hanging) {
		for (let r = 0; r < 3; r++) {
			const row = grid.row();
			if (r === 0) grid.put(row, L, plain("SPECIFICATIONS"), HEAD);
			spec(row, specs[r], 0, stops[2]);
			spec(row, specs[3 + r], 2, undefined);
		}
	} else {
		grid.put(grid.row(), L, plain("SPECIFICATIONS"), HEAD);
		for (const s of specs) spec(grid.row(), s, 0, undefined);
	}

	// MANIFEST with the total in the count column, `--` until the manifest is ready.
	const m = state.manifest;
	grid.row(); grid.row();
	const head = grid.row();
	grid.put(head, L, plain("MANIFEST"), HEAD);
	const total = m.status === "ready" ? HOLDS.reduce((n, [, key]) => n + m[key].length, 0) : undefined;
	t.count(grid, head, plain(total === undefined ? "--" : pad(total, 2)), ITEM);
	const first = grid.rows.length;
	if (m.status === "unavailable") {
		// A failure is never animated: its critical word keeps the whole row settled through the intro.
		grid.row();
		const row = grid.row(), word = plain("MANIFEST UNAVAILABLE");
		const end = grid.put(row, stops[0], word, { fg: "critical" });
		grid.put(row, end, fit(text(` · ${m.reason}`), R + 1 - end), LABEL);
	} else if (m.status === "ready") {
		HOLDS.forEach(([name, key], h) => {
			grid.row(); // a blank row before each hold
			const items = m[key].map(text), layout = fitColumns(items.map(widthOf), t);
			const label = (row: number) => { grid.put(row, L, plain(name), HOLD); t.count(grid, row, plain(pad(items.length, 2)), LABEL); };
			if (!t.hanging) label(grid.row());
			for (let r = 0; r < Math.max(t.hanging ? 1 : 0, layout.rows); r++) {
				const row = grid.row();
				if (t.hanging && r === 0) label(row);
				layout.starts.forEach((start, c) => {
					const item = items[c * layout.rows + r];
					if (item) grid.put(row, start, fit(item, layout.room), ITEM);
				});
			}
		});
	}
	grid.row();
	return { rows: grid.rows, first: m.status === "ready" ? first : undefined };
}

/** The frosted strip under the plate: each key hint starts on a column line, laid out like a hold. */
function strip(state: HeaderState, t: Table, width: number, measure: Measure): Cell[][] {
	const hints = state.hints.map(([key, action]) => [glyphs(key, measure), glyphs(` ${action}`, measure)]);
	const layout = fitColumns(hints.map(([k, a]) => widthOf(k) + widthOf(a)), t);
	const grid = new Grid(width);
	for (let r = 0; r < Math.max(1, layout.rows); r++) grid.row("primary");
	hints.forEach(([key, action], i) => {
		const row = i % layout.rows, start = layout.starts[Math.floor(i / layout.rows)];
		const keyCells = fit(key, layout.room);
		const end = grid.put(row, start, keyCells, { fg: "primary", bold: true });
		grid.put(row, end, fit(action, layout.room - widthOf(keyCells)), { fg: SURFACE_PALETTE.frostLamp });
	});
	for (const cells of grid.rows) for (const cell of cells) cell.style = { fg: SURFACE_PALETTE.frostLamp, ...cell.style, bg: "primary" };
	return grid.rows;
}

// --- The frame.

type SurfaceCell = { text: string; style: Style; continuation?: boolean };
const toSurface = (row: Cell[]): SurfaceCell[] => row.map((c) => (c.s === "" ? { text: "", style: c.style, continuation: true } : { text: c.s, style: c.style }));
const sameStyle = (a: Style, b: Style) => a.fg === b.fg && a.bg === b.bg && !!a.bold === !!b.bold;
function toLine(row: SurfaceCell[]): DsLine {
	const out: DsLine = [];
	for (const c of row) {
		const last = out.at(-1);
		if (last && sameStyle(last.style, c.style)) last.text += c.text;
		else out.push({ text: c.text, style: c.style });
	}
	return out;
}

/** A width's settled header, with the plate's paint, the floor's dots and a late manifest's rows for the intro. */
export interface Frame {
	width: number;
	lines: DsLine[];
	/** Below the plate width the header is one settled line and has no intro. */
	minimal: boolean;
	seed: number;
	paint: Array<{ row: number; start: number; end: number }>;
	ground: Array<{ row: number; start: number; end: number }>;
	late?: { row: number; time: number };
	measure: Measure;
}

/** One settled line: the ID, the lamp, the version and the counts, clipped with `…`. */
function minimal(state: HeaderState, W: number, measure: Measure): DsLine {
	const grid = new Grid(W);
	grid.row();
	const m = state.manifest, count = (key: "extensions" | "skills") => (m.status === "ready" ? pad(m[key].length, 3) : "--");
	grid.put(0, 0, fit(plain(`DRD-${state.unit}`), W), { fg: "accent" });
	grid.put(0, 9, plain("●"), { fg: PI_CHROME.lamp });
	grid.put(0, 10, fit(glyphs(` PI-${state.version} · ${count("extensions")} MOD · ${count("skills")} SKL`, measure), W - 10), { fg: "secondary" });
	return toLine(toSurface(grid.rows[0]));
}

/** The settled header at `width` cells, and what the intro needs to animate it. Every line is exactly `width` cells. */
export function settledFrame(state: HeaderState, width: number, measure: Measure): Frame {
	const base = { width, seed: state.seed | 0, paint: [], ground: [], measure };
	if (!Number.isInteger(width) || width < 1) return { ...base, lines: [], minimal: true };
	const W = Math.min(width, MAX_WIDTH);
	if (W < PLATE_WIDTH) return { ...base, lines: [padded(minimal(state, W, measure), width)], minimal: true };

	const unit = `DRD-${state.unit.replace(/[^0-9A-F?]/g, "?")}`;
	const session = state.session.replace(/[^0-9A-F?]/g, "?").padEnd(8, "?");
	const plate = unitPlate({ unit, serial: `${session.slice(0, 4)}-${session.slice(4, 8)}`, seed: state.seed | 0 }, { width: W, titleBlock: W >= TITLE_BLOCK_WIDTH });
	const t = table(W), hints = strip(state, t, W, measure), body = ledger(state, t, W, measure);

	// The strip is frosted white over the gradient's top row; the ledger takes the gradient, its last row black, and a
	// dot floor where a blank cell has no ink beside it. The surface height counts the strip as one row.
	const height = Math.min(MAX_WIDTH, body.rows.length + 1), frost = { primary: { alpha: FROST_ALPHA } };
	const stripRows = hints.map((row) => composeSurface([toSurface(row)], { width: W, height, origin: { x: 0, y: 0 }, gradient: FADE, fills: frost, exclude: [{ x: 0, y: 0, width: W, height: 1, mode: "floor" }] })[0]);
	const surfaced = body.rows.slice(0, height - 1).map(toSurface);
	const floor = composeSurface(surfaced, { width: W, height, origin: { x: 0, y: 1 }, gradient: FADE, dotClearance: 1, dotFloor: DOT_FLOOR });
	// Rows past the surface's 1000-cell height, only for an enormous manifest, print on the field.
	const beyond = body.rows.slice(height - 1).map((row) => toSurface(row).map((c) => ({ ...c, style: { ...c.style, bg: "field" as const } })));

	const top = UNIT_PLATE_ROWS + stripRows.length;
	const ground = floor.flatMap((row, i) => row.flatMap((c, x) => (c.text === "·" && surfaced[i][x].text === " " ? [{ row: top + i, start: x, end: x + 1 }] : [])));
	const lines = [...plate.lines, ...stripRows.map(toLine), ...floor.map(toLine), ...beyond.map(toLine)].map((line) => padded(line, width));
	const late = body.first !== undefined && state.manifestAt !== undefined ? { row: top + body.first, time: state.manifestAt } : undefined;
	return { ...base, lines, minimal: false, paint: plate.paint, ground, late };
}
const padded = (line: DsLine, width: number): DsLine => (width > MAX_WIDTH ? [...line, { text: " ".repeat(width - MAX_WIDTH), style: { bg: "field" } }] : line);

const bootOptions = (frame: Frame) => ({ seed: frame.seed, paint: frame.paint, ground: frame.ground, late: frame.late, measure: frame.measure });
// A frame's intro end, computed once per frame: every intro frame and the host's tick ask for it.
const ends = new WeakMap<Frame, number>();
/** When the intro settles for this frame: at once below the plate width. */
export function introEnd(frame: Frame): number {
	if (frame.minimal) return 0;
	let end = ends.get(frame);
	if (end === undefined) {
		try { end = crtBootDuration(frame.lines, bootOptions(frame)); } catch { end = 0; }
		ends.set(frame, end);
	}
	return end;
}

/** The frame `t` milliseconds into the intro; at or after introEnd (or `Infinity`), the settled frame. */
export function frameAt(frame: Frame, t: number): Line[] {
	let lines = frame.lines;
	if (!frame.minimal && t < introEnd(frame)) {
		// The design system's CRT boot; if it ever rejects a frame, the settled frame is shown instead.
		try { lines = crtBoot(frame.lines, { ...bootOptions(frame), time: Math.max(0, t) }); } catch { lines = frame.lines; }
	}
	return lines.map((line) => line.map((s) => {
		const { fg, bg, bold } = resolveStyle(s.style);
		return { text: s.text, fg, bg, bold };
	}));
}

/**
 * Renders the header at `width` cells, `t` milliseconds into the intro (`Infinity` for the settled frame). Every line
 * is exactly `width` cells wide by `measure`.
 */
export function renderHeader(state: HeaderState, width: number, t: number, measure: Measure): Line[] {
	return frameAt(settledFrame(state, width, measure), t);
}
