// The droid header's pure render core: state, width and intro time in, styled cell lines out. No Pi, clock, timer or
// I/O; the host supplies the grapheme measurer and owns ANSI emission. Layouts and the intro timeline are in
// ../docs/design.md.
import { ACID_BLACK } from "@industrial-os/design-system/foundation/palette";
import { PI_CHROME, SIGNAL_COLORS } from "@industrial-os/design-system/foundation/signal-colors";
import { hash, pick, random } from "@industrial-os/design-system/foundation/seeded";
import { numeralAt, numeralLines, textGrid } from "@industrial-os/design-system/elements/pixel-numeral";

export type Measure = (text: string) => number;
export interface Span { text: string; fg: string; bg: string }
export type Line = Span[];

export type Manifest =
	| { status: "pending" }
	| { status: "unavailable"; reason: string }
	| { status: "ready"; context: string[]; skills: string[]; prompts: string[]; extensions: string[] };

export interface HeaderState {
	/** The last four hex digits of the session ID, or `????` when it has none. */
	unit: string;
	/** The first eight hex digits of the session ID, or `????????`. */
	session: string;
	/** Seeds the barcode, pixel dither and decode from the session. */
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

const C = {
	field: ACID_BLACK.field, primary: ACID_BLACK.primary, secondary: ACID_BLACK.secondary, accent: ACID_BLACK.accent,
	decorative: ACID_BLACK.decorative, structural: ACID_BLACK.structural, critical: ACID_BLACK.critical,
	lamp: PI_CHROME.lamp,
};
const WARM = [SIGNAL_COLORS.accent25, SIGNAL_COLORS.accent50, SIGNAL_COLORS.accent75, ACID_BLACK.accent];

/** Width thresholds: the full panel from 100 columns, the compact one from 40, one line below. */
export const FULL_WIDTH = 100;
export const COMPACT_WIDTH = 40;
/** The intro's end when the manifest prints from 1200 ms; a later manifest extends it, see introEnd. */
export const INTRO_MS = 2900;
const PRINT_AT = 1200, PRINT_MS = 1500, TYPE_TAIL = 80, HINTS_MS = 400;
/** Decode follows dispatch-feed's scramble-and-settle: a glyph step every 70 ms, every value true within 500 ms. */
export const DECODE_STEP_MS = 70;
const DECODE_MS = 500;
const SCRAMBLE = "▓▒░#%&*+=<>/\\|ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
const BARS = ["▌", "▐", "█", "▏", "▎", "▍"];
const HOLDS = [["CTX", "CONTEXT", "context"], ["SKL", "SKILLS", "skills"], ["PRM", "PROMPTS", "prompts"], ["EXT", "MODULES", "extensions"]] as const;

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const progress = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
const pad = (n: number, digits: number) => String(n).padStart(digits, "0");

/** When the intro settles: 2.9 s, or later when a manifest that arrived mid-intro still has to print. */
export function introEnd(state: HeaderState): number {
	return state.manifest.status === "ready" ? Math.max(INTRO_MS, printStart(state) + PRINT_MS + 200) : INTRO_MS;
}
const printStart = (state: HeaderState) => Math.max(PRINT_AT, state.manifestAt ?? 0);

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
const typed = (gs: Glyph[], p: number) => gs.slice(0, Math.floor(gs.length * p));

// Mirrors dispatch-feed's decodeGlyph: each column settles at its own seeded time within the duration, blank first,
// then a scramble glyph that changes every DECODE_STEP_MS. Wide graphemes appear whole at their settle time.
function decode(gs: Glyph[], seed: number, time: number, duration: number): Glyph[] {
	if (time >= duration) return gs;
	return gs.map((g, column) => {
		if (time < 0) return { s: " ".repeat(g.w), w: g.w };
		const r = hash(column, seed, 17);
		if (time >= r * duration || g.s === " ") return g;
		if (g.w !== 1 || time < r * duration * 0.35) return { s: " ".repeat(g.w), w: g.w };
		return { s: SCRAMBLE[Math.floor(hash(Math.floor(time / DECODE_STEP_MS), column, seed + 1) * SCRAMBLE.length)], w: 1 };
	});
}

// --- The cell grid. A wide grapheme fills its cell and leaves an empty continuation cell after it.

interface Cell { s: string; fg: string; bg: string }
class Grid {
	readonly rows: Cell[][];
	readonly height: number;
	readonly width: number;
	constructor(height: number, width: number) {
		this.height = height;
		this.width = width;
		this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ s: " ", fg: C.primary, bg: C.field })));
	}
	/** Writes graphemes from `col`, clipped before `limit` (default the grid's width); never splits a wide one. */
	put(row: number, col: number, gs: Glyph[], fg: string, bg?: string, limit = this.width) {
		if (row < 0 || row >= this.height) return;
		let c = col;
		for (const g of gs) {
			if (c + g.w > Math.min(limit, this.width)) break;
			if (c >= 0) {
				this.rows[row][c] = { s: g.s, fg, bg: bg ?? this.rows[row][c].bg };
				for (let k = 1; k < g.w; k++) this.rows[row][c + k] = { s: "", fg, bg: bg ?? this.rows[row][c + k].bg };
			}
			c += g.w;
		}
	}
	text(row: number, col: number, text: string, fg: string, bg?: string) { this.put(row, col, plain(text), fg, bg); }
	lines(): Line[] {
		return this.rows.map((cells) => {
			const line: Line = [];
			for (const cell of cells) {
				const last = line.at(-1);
				if (last && last.fg === cell.fg && last.bg === cell.bg) last.text += cell.s;
				else line.push({ text: cell.s, fg: cell.fg, bg: cell.bg });
			}
			return line;
		});
	}
}

// --- Shared pieces.

interface Plate { label: string; value: string }
function plates(state: HeaderState): Plate[] {
	const m = state.manifest;
	const count = (n: number | undefined, noun: string) => `${n === undefined ? "--" : pad(n, 3)} ${noun}`;
	return [
		{ label: "01 CLS", value: "PI AGENT DROID" },
		{ label: "02 COR", value: state.core },
		{ label: "03 FRM", value: `PI ${state.version}` },
		{ label: "04 SCT", value: state.sector },
		{ label: "05 MOD", value: count(m.status === "ready" ? m.extensions.length : undefined, "MODULES") },
		{ label: "06 SKL", value: count(m.status === "ready" ? m.skills.length : undefined, "SKILLS") },
	];
}

/** Plate `i` warms up through the accent steps from its start; its value decodes after it. */
function drawPlate(grid: Grid, state: HeaderState, plate: Plate, i: number, row: number, col: number, valueMax: number, t: number, measure: Measure) {
	const at = 500 + i * 170;
	const warm = t < at ? undefined : WARM[Math.min(3, Math.floor((t - at) / 60))];
	grid.text(row, col, ` ${plate.label} `, warm ? C.field : C.decorative, warm ?? C.structural);
	const value = fit(glyphs(plate.value, measure), valueMax);
	grid.put(row, col + plate.label.length + 3, decode(value, state.seed + i, t - at - 200, DECODE_MS), C.primary);
}

function drawTop(grid: Grid, state: HeaderState, t: number) {
	const W = grid.width, drawn = progress(t, 0, 500) * W;
	const lamp = t < 1500 && Math.floor(t / 80) % 2 ? "○" : "●";
	const parts: Array<[string, string]> = [["┏━ ", C.structural], [`DRD-${state.unit}`, C.accent], [` ${"━".repeat(W - 17)}`, C.structural], [` ${lamp} `, C.lamp], ["━┓", C.structural]];
	let col = 0;
	for (const [text, fg] of parts) for (const ch of text) {
		if (col < drawn) grid.text(0, col, ch, fg);
		col++;
	}
}

function drawSides(grid: Grid, bottom: number, t: number) {
	const drawn = progress(t, 100, 900) * bottom;
	for (let r = 1; r < bottom; r++) if (drawn > r) { grid.text(r, 0, "┃", C.structural); grid.text(r, grid.width - 1, "┃", C.structural); }
}

function drawBottom(grid: Grid, state: HeaderState, row: number, t: number, measure: Measure) {
	const W = grid.width;
	const coords = fit(glyphs(` SES-${state.session}│PNE-${state.pane}│PI-${state.version} `, measure), W - 4);
	const rule = Array.from({ length: W - 4 - widthOf(coords) }, (_, i) => (i % 12 === 5 ? "┻" : "━")).join("");
	const shown = Math.round(progress(t, 250, 800) * W);
	const cells: Array<[Glyph, string]> = [
		...plain("┗━").map((g): [Glyph, string] => [g, C.structural]),
		...coords.map((g): [Glyph, string] => [g, g.s === " " ? C.structural : C.decorative]),
		...plain(`${rule}━┛`).map((g): [Glyph, string] => [g, C.structural]),
	];
	let col = 0;
	for (const [g, fg] of cells) {
		if (col >= W - shown) grid.put(row, col, [g], fg);
		col += g.w;
	}
}

function drawDivider(grid: Grid, row: number, t: number) {
	const shown = Math.round(progress(t, 900, 1300) * grid.width);
	[...`┣━ MANIFEST ${"━".repeat(grid.width - 14)}━┫`].forEach((ch, i) => {
		if (i < shown) grid.text(row, i, ch, /[A-Z]/.test(ch) ? C.secondary : C.structural);
	});
}

interface HoldLayout { code: string; name: string; count: number; rows: Glyph[][][] }
const ITEM_COL = 17;
/** Items flow `▪ name` with two cells between them and wrap inside the frame, as the approved mock does. */
function layoutHolds(manifest: Extract<Manifest, { status: "ready" }>, width: number, measure: Measure): HoldLayout[] {
	const room = width - 3 - ITEM_COL;
	return HOLDS.map(([code, name, key]) => {
		const rows: Glyph[][][] = [[]];
		let used = 0;
		for (const item of manifest[key]) {
			const gs = fit(glyphs(item, measure), room - 4);
			const w = widthOf(gs) + 4;
			if (used + w > room && rows.at(-1)!.length) { rows.push([]); used = 0; }
			rows.at(-1)!.push(gs);
			used += w;
		}
		return { code, name, count: manifest[key].length, rows: rows.at(-1)!.length ? rows : [] };
	});
}
const holdHeight = (hold: HoldLayout) => Math.max(2, hold.rows.length) + 1;

/** Rows the manifest section needs below the divider's blank row. */
function manifestRows(state: HeaderState, width: number, measure: Measure): number {
	const m = state.manifest;
	if (m.status === "ready") return layoutHolds(m, width, measure).reduce((n, hold) => n + holdHeight(hold), 0);
	return m.status === "unavailable" ? 2 : 0;
}

function drawManifest(grid: Grid, state: HeaderState, top: number, t: number, settled: boolean, measure: Measure) {
	const m = state.manifest;
	if (m.status === "unavailable") {
		// A failure is never animated or scrambled.
		const word = plain("MANIFEST UNAVAILABLE");
		grid.put(top, 4, word, C.critical);
		grid.put(top, 4 + word.length, fit(glyphs(` · ${m.reason}`, measure), grid.width - 6 - word.length), C.secondary);
		return;
	}
	if (m.status !== "ready") return;
	const start = printStart(state);
	const total = Math.max(1, m.context.length + m.skills.length + m.prompts.length + m.extensions.length);
	const at = (n: number) => start + (n / total) * PRINT_MS;
	let row = top, n = 0;
	for (const hold of layoutHolds(m, grid.width, measure)) {
		if (t > at(n)) {
			grid.text(row, 3, ` ${hold.code} `, C.field, t < at(n) + 120 && !settled ? C.accent : C.secondary);
			grid.text(row, 9, pad(hold.count, 2), C.primary);
			grid.text(row + 1, 4, hold.name, C.decorative);
		}
		hold.rows.forEach((items, r) => {
			let col = ITEM_COL;
			for (const item of items) {
				const shown = progress(t, at(n), at(n + 1) + TYPE_TAIL);
				if (shown > 0) {
					grid.text(row + r, col, "▪", C.decorative);
					grid.put(row + r, col + 2, typed(item, shown), C.primary, undefined, grid.width - 3);
				}
				col += widthOf(item) + 4;
				n++;
			}
		});
		row += holdHeight(hold);
	}
}

function drawHints(grid: Grid, state: HeaderState, row: number, t: number, end: number, measure: Measure) {
	const groups = state.hints.slice(0, Math.ceil(state.hints.length * progress(t, end - HINTS_MS, end)));
	let col = 1;
	for (const [i, [key, action]] of groups.entries()) {
		const k = glyphs(key, measure), a = glyphs(action, measure);
		// Hints that do not fit are dropped whole from the end.
		if (col + (i ? 3 : 0) + widthOf(k) + 1 + widthOf(a) > grid.width) break;
		if (i) { grid.text(row, col, " · ", C.structural); col += 3; }
		grid.put(row, col, k, C.decorative); col += widthOf(k) + 1;
		grid.put(row, col, a, C.secondary); col += widthOf(a);
	}
}

// --- Layouts.

function full(state: HeaderState, W: number, t: number, settled: boolean, end: number, measure: Measure): Grid {
	const DIVIDER = 8, bottom = DIVIDER + 2 + manifestRows(state, W, measure);
	const grid = new Grid(bottom + 3, W);
	drawTop(grid, state, t);
	drawSides(grid, bottom, t);
	drawBottom(grid, state, bottom, t, measure);

	// The unit number assembles from dithered pixels: numeralAt's Bayer and hash thresholds, unarrived pixels left off.
	const target = textGrid(state.unit, { ink: state.unit.includes("?") ? "decorative" : "primary" });
	const empty = { w: target.w, g: target.g.map((row) => row.map(() => null)) };
	const built = numeralAt(target, empty, 0.25 + 0.75 * progress(t, 300, 1000), state.seed);
	const shown = { w: target.w, g: built.g.map((row, y) => row.map((ink, x) => (ink === target.g[y][x] ? ink : null))) };
	numeralLines(shown, { width: target.w }).forEach((line, r) => {
		let col = 3;
		for (const span of line) {
			const fg = span.style?.fg ? ACID_BLACK[span.style.fg as keyof typeof ACID_BLACK] : C.primary;
			grid.text(2 + r, col, span.text, fg);
			col += [...span.text].length;
		}
	});
	// A two-row barcode under it, seeded from the session, scanning in.
	const rng = random(state.seed);
	const bars = Array.from({ length: target.w }, () => pick(rng, BARS)).join("");
	const scanned = bars.slice(0, Math.round(bars.length * progress(t, 700, 1100)));
	grid.text(5, 3, scanned, C.primary);
	grid.text(6, 3, scanned, C.primary);

	// Six plates in two columns; values between the plate and the next column or the starburst.
	const LEFT = 22, RIGHT = 62, STAR = W - 10;
	plates(state).forEach((plate, i) => {
		const col = i < 3 ? LEFT : RIGHT, value = col + plate.label.length + 3;
		drawPlate(grid, state, plate, i, 2 + (i % 3), col, i < 3 ? RIGHT - 1 - value : STAR - 1 - value, t, measure);
	});

	// Dot grid, the DEPLOYED leader to the assignment, and the assignment under the right values.
	if (t > 1100) { grid.text(5, 23, "•••••", C.decorative); grid.text(6, 23, "•••••", C.decorative); }
	const leadAt = LEFT + 9, assignAt = RIGHT + 9, tee = assignAt - 3;
	const lead = plain(`DEPLOYED ${state.deployed} `);
	const leader = [...lead, ...plain("─".repeat(Math.max(0, tee - leadAt - lead.length))), ...plain("┤")];
	grid.put(5, leadAt, typed(leader, progress(t, 1200, 1600)), C.primary);
	const ap = progress(t, 1500, 2000);
	grid.put(5, assignAt, typed(plain("ASSIGNMENT"), ap), C.decorative);
	if (ap > 0) grid.text(6, tee, "│", C.primary);
	grid.put(6, assignAt, typed(fit(glyphs(state.assignment, measure), W - 2 - assignAt), ap), C.primary);

	// The acid starburst spins until the intro settles, then rests on `*`.
	if (t > 1300) {
		const hub = settled ? "*" : "|/-\\"[Math.floor(t / 70) % 4];
		grid.text(3, STAR, "\\|/", C.accent); grid.text(4, STAR, `-${hub}-`, C.accent); grid.text(5, STAR, "/|\\", C.accent);
	}

	drawDivider(grid, DIVIDER, t);
	drawManifest(grid, state, DIVIDER + 2, t, settled, measure);
	drawHints(grid, state, bottom + 2, t, end, measure);
	return grid;
}

function compact(state: HeaderState, W: number, t: number, settled: boolean, end: number, measure: Measure): Grid {
	const DIVIDER = 12, bottom = DIVIDER + 2 + manifestRows(state, W, measure);
	const grid = new Grid(bottom + 3, W);
	drawTop(grid, state, t);
	drawSides(grid, bottom, t);
	drawBottom(grid, state, bottom, t, measure);
	// One column of plates, values to the frame.
	plates(state).forEach((plate, i) => drawPlate(grid, state, plate, i, 2 + i, 3, W - 3 - 12, t, measure));
	// DEPLOYED and ASSIGNMENT start under the plate labels.
	grid.put(9, 4, typed(plain(`DEPLOYED ${state.deployed}`), progress(t, 1200, 1600)), C.primary);
	const ap = progress(t, 1500, 2000);
	grid.put(10, 4, typed(plain("ASSIGNMENT"), ap), C.decorative);
	grid.put(10, 16, typed(fit(glyphs(state.assignment, measure), W - 3 - 16), ap), C.primary);
	drawDivider(grid, DIVIDER, t);
	drawManifest(grid, state, DIVIDER + 2, t, settled, measure);
	drawHints(grid, state, bottom + 2, t, end, measure);
	return grid;
}

/** One settled line: the ID, the lamp, the version and the counts, clipped with `…`. */
function minimal(state: HeaderState, W: number, measure: Measure): Line[] {
	const grid = new Grid(1, W);
	const plateValues = plates(state);
	const rest = fit(glyphs(` PI-${state.version} · ${plateValues[4].value.replace(" MODULES", " MOD")} · ${plateValues[5].value.replace(" SKILLS", " SKL")}`, measure), W - 10);
	grid.put(0, 0, fit(plain(`DRD-${state.unit}`), W), C.accent);
	grid.text(0, 9, "●", C.lamp);
	grid.put(0, 10, rest, C.secondary);
	return grid.lines();
}

/**
 * Renders the header at `width` cells, `t` milliseconds into the intro (`Infinity` for the settled frame). Every line
 * is exactly `width` cells wide by `measure`.
 */
export function renderHeader(state: HeaderState, width: number, t: number, measure: Measure): Line[] {
	if (!Number.isInteger(width) || width < 1) return [];
	if (width < COMPACT_WIDTH) return minimal(state, width, measure);
	const end = introEnd(state), settled = t >= end, time = settled ? Infinity : Math.max(0, t);
	return (width >= FULL_WIDTH ? full : compact)(state, width, time, settled, end, measure).lines();
}
