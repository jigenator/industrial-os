// The plate's motions, as a pure timeline: which motions a change of view starts, and each frame's lines. The
// lighting switches (T2, H1) and the reveal are native: the timeline keeps the lighting layers and the outgoing plate
// the view stacks, and the view gives each entering layer an opacity (or width) transition, so no timer draws them.
// The character-level motions (the CRT boot, the K5 serial roll, the latch and the K4 ghost) change glyphs, which a
// native transition cannot, so the view draws their frames on a timer at the motion's own step, only while one plays.
// Rates and rules: ../../docs/design.md#pane-plate-motion.

import { bankSchedule, bankSwitchDuration } from "../ds/motions/bank-switch.mjs";
import { crtBoot, crtBootDuration, CRT_BOOT_TIMING } from "../ds/motions/crt-boot.mjs";
import { ghost } from "../ds/motions/ghost.mjs";
import { latch, latchDuration } from "../ds/motions/latch.mjs";
import { revealDuration } from "../ds/motions/reveal.mjs";
import { serialRoll, serialRollDuration } from "../ds/motions/serial-roll.mjs";
import { hash } from "../ds/foundation/seeded.mjs";
import { numeralLines, textGrid } from "../ds/elements/pixel-numeral/pixel-numeral.mjs";

/** T2: focus and window changes switch a plate's lighting in four banks, 30 ms apart, 40 ms each (130 ms). */
export const BANKS = Object.freeze({ banks: 4, stagger: 30, fade: 40 });
/** H1: the pointer over an unfocused plate raises it to standby in 90 ms and lowers it in 120 ms (all banks at once). */
export const STANDBY_IN = Object.freeze({ banks: 4, stagger: 0, fade: 90 });
export const STANDBY_OUT = Object.freeze({ banks: 4, stagger: 0, fade: 120 });
/** The wipe back to the shell when Pi or an agent hands it back: 540 ms per row, rows 60 ms apart (900 ms). */
export const REVEAL = Object.freeze({ duration: 540, stagger: 60 });
/** K5: serial digits lock 50 ms apart from 120 ms, rolling every 40 ms. */
export const ROLL = Object.freeze({ tick: 40, start: 120, step: 50 });
/** K4: a registration ghost of the wordmark on the focused idle plate, every 20–60 s, 100 ms. */
export const GHOST_EVERY = Object.freeze([20_000, 60_000]);
export const GHOST_TICK = 50;
/** A native transition starts on the render after the one that drew its start: this long after it. */
export const PRIME_MS = 20;
/** At most this many lighting layers are stacked; a fourth change drops the oldest one above the base. */
export const LAYER_LIMIT = 3;
/** The strip's row. */
const STRIP_ROW = 6;
const ROWS = 7;

const HEX = "0123456789ABCDEF";
let hexGlyphs = null;
/** Each hex digit's 3×3 wordmark glyph, as the unit plate draws it: the pixel font's 3×5 digit in half blocks. */
export function wordmarkGlyphs() {
	if (hexGlyphs) return hexGlyphs;
	hexGlyphs = {};
	for (const ch of HEX) {
		const grid = textGrid(ch);
		hexGlyphs[ch] = numeralLines(grid, { width: grid.w }).map((line) => line.map((s) => s.text).join(""));
	}
	return hexGlyphs;
}

/** The delay before the `n`th ghost of a plate seeded `seed`: 20–60 s. */
export const ghostDelay = (seed, n) => GHOST_EVERY[0] + Math.floor(hash(n, 7, seed | 0) * (GHOST_EVERY[1] - GHOST_EVERY[0] + 1));

export const emptyTimeline = () => ({ view: null, layers: [], nextLayer: 0, boot: null, roll: null, reveal: null, latch: null, ghost: null, ghostAt: null, ghosts: 0 });

const switchSpec = (from, to) => (from === "dark" && to === "standby" ? STANDBY_IN : from === "standby" && to === "dark" ? STANDBY_OUT : BANKS);
/** How long a layer's entrance takes once primed. */
export const enterDuration = (layer) => (layer.enter ? bankSwitchDuration(layer.enter) : 0);
/** When a layer's (or the reveal's) entrance ends: from its priming, or, unprimed, PRIME_MS after it was pushed. */
const enterEnd = (item, duration) => (item.primedAt !== null ? item.primedAt : item.start + PRIME_MS) + duration;
const revealEnd = (r) => enterEnd(r, revealDuration(ROWS, REVEAL));
/** The current lighting: the top layer's. */
export const lightingNow = (t) => t.layers.at(-1)?.level ?? null;

/**
 * Each bank of a `cols`-column layer entering with `enter`: its first column and width, the delay and fade of its
 * opacity transition (design system bankSchedule: T2 30 ms apart, 40 ms each; H1 all at once, 90 or 120 ms).
 */
export const layerBanks = (cols, enter = BANKS) => bankSchedule(cols, enter);

/**
 * The timeline after a render's `view`: `{ kind, state, known, seed, lighting, idle, lit }` plus `durations` from the
 * header (`boot`, `roll`). `outgoing` is the top layer's lines as last drawn, for the reveal. The first view starts
 * nothing. A lighting change pushes a layer at the new level that enters over the ones below; settle() drops them.
 */
export function advance(timeline, view, now, { outgoing = null, durations = {} } = {}) {
	const t = { ...timeline, layers: [...timeline.layers] };
	const prev = t.view;
	t.view = view;
	if (!prev || !t.layers.length) {
		t.layers = [{ id: t.nextLayer++, level: view.lighting, enter: null, start: now, primedAt: now }];
	} else {
		const top = t.layers.at(-1);
		if (view.lighting !== top.level) {
			t.layers.push({ id: t.nextLayer++, level: view.lighting, enter: switchSpec(top.level, view.lighting), start: now, primedAt: null });
			// Too many: drop the oldest layer above the base, which has always finished entering (so nothing shows through).
			if (t.layers.length > LAYER_LIMIT) t.layers.splice(1, 1);
		}
		const handback = (prev.kind === "droid" || prev.kind === "agent") && view.kind === "terminal" && !view.pi;
		if (handback) {
			t.boot = t.roll = t.ghost = null;
			t.reveal = outgoing ? { id: t.nextLayer++, start: now, primedAt: null, outgoing } : null;
		} else if (view.kind === "droid" && prev.kind !== "droid") {
			t.reveal = null;
			t.boot = { start: now, seed: view.seed };
			t.roll = view.known ? { start: now + (durations.boot ?? 0) } : null;
		} else if (view.kind === "droid" && view.known && !prev.known) {
			const bootEnd = t.boot ? t.boot.start + (durations.boot ?? 0) : -Infinity;
			t.roll = { start: Math.max(now, bootEnd) };
		}
		if (view.state !== prev.state && view.kind === prev.kind && !handback) t.latch = { start: now };
	}
	// K4: only on the lit (focused, window active) idle plate; each plate keeps its own seeded schedule. A ghost that
	// falls due while another motion plays waits for it to end: its time moves to that end, never left in the past.
	if (view.lit && view.idle) {
		if (t.ghostAt === null) t.ghostAt = now + ghostDelay(view.seed, t.ghosts);
		if (now >= t.ghostAt) {
			const busy = playingUntil(t, durations);
			if (busy > now) t.ghostAt = busy;
			else {
				t.ghost = { start: now, seed: (view.seed | 0) + t.ghosts };
				t.ghosts += 1;
				t.ghostAt = now + ghostDelay(view.seed, t.ghosts);
			}
		}
	} else {
		t.ghostAt = null;
	}
	return t;
}

/** Marks every unprimed layer (and the reveal) primed at `now`: the view drew their start; their transitions run. */
export function prime(timeline, now) {
	const unprimed = timeline.layers.some((l) => l.primedAt === null) || (timeline.reveal && timeline.reveal.primedAt === null);
	if (!unprimed) return timeline;
	return {
		...timeline,
		layers: timeline.layers.map((l) => (l.primedAt === null ? { ...l, primedAt: now } : l)),
		reveal: timeline.reveal && timeline.reveal.primedAt === null ? { ...timeline.reveal, primedAt: now } : timeline.reveal,
	};
}
export const needsPrime = (t) => t.layers.some((l) => l.primedAt === null) || (!!t.reveal && t.reveal.primedAt === null);

/** Drops what is covered: every layer under the highest one whose entrance has ended, and a finished reveal. */
export function settle(timeline, now) {
	let t = timeline;
	for (let i = t.layers.length - 1; i > 0; i--) {
		const l = t.layers[i];
		if (l.primedAt !== null && now >= enterEnd(l, enterDuration(l))) {
			t = { ...t, layers: t.layers.slice(i) };
			break;
		}
	}
	if (t.reveal && t.reveal.primedAt !== null && now >= revealEnd(t.reveal)) t = { ...t, reveal: null };
	return t;
}

const DURATION = {
	boot: (_m, d) => d.boot ?? 0,
	roll: (_m, d) => d.roll ?? 0,
	latch: () => latchDuration(),
	ghost: () => 2 * GHOST_TICK,
};
const CHARACTER = ["boot", "roll", "latch", "ghost"];
/** When the last character-level motion ends (or -Infinity): the frame timer's end. */
export function charactersUntil(t, durations = {}) {
	let end = -Infinity;
	for (const key of CHARACTER) if (t[key]) end = Math.max(end, t[key].start + DURATION[key](t[key], durations));
	return end;
}
/** When the last motion of any kind ends (or -Infinity), the native ones included. */
export function playingUntil(t, durations = {}) {
	let end = charactersUntil(t, durations);
	for (const l of t.layers.slice(1)) end = Math.max(end, enterEnd(l, enterDuration(l)));
	if (t.reveal) end = Math.max(end, revealEnd(t.reveal));
	return end;
}
export const playing = (t, now, durations = {}) => now < playingUntil(t, durations);

/**
 * The frame timer's step at `now`: the serial roll's 40 ms tick while it rolls, else 50 ms (the CRT boot's chunk, the
 * latch's and the ghost's tick) while a character-level motion plays; null when none does.
 */
export function frameStep(t, now, durations = {}) {
	const active = (key) => t[key] && now >= t[key].start && now < t[key].start + DURATION[key](t[key], durations);
	if (active("roll")) return ROLL.tick;
	if (CHARACTER.some(active)) return CRT_BOOT_TIMING.chunk;
	return null;
}

/**
 * The next time the plate changes by itself, after `now`: a clock or STARTING (`nextAt` from the model), the next
 * ghost, a character motion starting later (a roll after the boot), a layer or reveal to settle. Null for none.
 */
export function nextWake(t, nextAt, now, durations = {}) {
	const times = [nextAt, t.ghostAt, t.roll?.start];
	for (const l of t.layers.slice(1)) if (l.primedAt !== null) times.push(enterEnd(l, enterDuration(l)));
	if (t.reveal?.primedAt != null) times.push(revealEnd(t.reveal));
	const end = charactersUntil(t, durations);
	if (end > now) times.push(end);
	const future = times.filter((x) => typeof x === "number" && Number.isFinite(x) && x > now);
	return future.length ? Math.min(...future) : null;
}

/** A header's durations: its boot over the pre-session plate, and its serial roll. */
export function headerDurations(unknownHeader, header) {
	return {
		boot: unknownHeader ? crtBootDuration(unknownHeader.lines, { paint: unknownHeader.paint }) : 0,
		roll: header ? serialRollDuration(rollOptions(header)) : 0,
	};
}

function rollOptions(header, hold = null) {
	const { serial, wordmark } = header.regions;
	// Only the serial's hex digits roll: the `-` stays.
	const chars = [...header.lines[serial.top].map((s) => s.text).join("")];
	const textSlots = [];
	for (let col = serial.left; col < serial.left + serial.cols; col++) {
		if (/[0-9A-F]/.test(chars[col] ?? "")) textSlots.push({ kind: "text", row: serial.top, col, lock: textSlots.length });
	}
	// The four unit digits' glyphs lock on the odd steps, between the serial's digits.
	const pixelSlots = wordmark ? wordmark.glyphs.slice(4, 8).map((col, i) => ({ kind: "pixel", row: wordmark.top, col, lock: 2 * i + 1, ink: inkAt(header.lines, wordmark.top, col) })) : [];
	return { ...ROLL, slots: [...textSlots, ...pixelSlots], glyphs: wordmarkGlyphs(), ...(hold ? { hold } : {}) };
}

// The wordmark's ink: the first inked cell's foreground in its row from `col`.
function inkAt(lines, row, col) {
	let x = 0;
	for (const span of lines[row]) for (const ch of span.text) {
		if (x >= col && ch !== " ") return span.style.fg;
		x++;
	}
	return undefined;
}

/**
 * The lines of one lighting layer at `now`: the header at `level` with the character-level motions playing over it.
 * `get(level)` returns the header at a lighting level, `getUnknown(level)` the pre-session droid header (DRD-????) for
 * the boot and the roll's held barcode.
 */
export function frame(t, now, level, get, getUnknown, durations = {}) {
	const target = get(level);
	let lines = target.lines;
	const active = (m, key) => m && now >= m.start && now < m.start + DURATION[key](m, durations);
	if (t.view?.kind === "droid" && active(t.boot, "boot")) {
		const unknown = getUnknown(level);
		lines = crtBoot(unknown.lines, { time: now - t.boot.start, seed: t.boot.seed | 0, paint: unknown.paint });
	} else if (t.view?.kind === "droid" && t.roll && now < t.roll.start) {
		lines = getUnknown(level).lines;
	} else if (t.view?.kind === "droid" && active(t.roll, "roll") && target.regions.barcode) {
		const unknown = getUnknown(level);
		lines = serialRoll(lines, { ...rollOptions(target, { region: target.regions.barcode, lines: unknown.lines }), time: now - t.roll.start });
	} else if (t.view?.kind === "droid" && active(t.roll, "roll")) {
		lines = serialRoll(lines, { ...rollOptions(target), time: now - t.roll.start });
	}
	if (active(t.latch, "latch") && target.status) {
		lines = latch(lines, { time: now - t.latch.start, region: { top: STRIP_ROW, left: target.status.col, rows: 1, cols: target.status.len }, stateCells: true });
	}
	if (active(t.ghost, "ghost") && target.regions.wordmark) {
		const { top, left, rows, cols } = target.regions.wordmark;
		lines = ghost(lines, { mode: "offset", region: { top, left, rows, cols }, time: now - t.ghost.start, seed: t.ghost.seed | 0, tick: GHOST_TICK });
	}
	return lines;
}
