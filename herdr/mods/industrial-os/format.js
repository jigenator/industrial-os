// Pure text formats for the Industrial OS sidebar. No Herdr or gpui-kit imports, so Node tests load it.
// The rules are the old herdr-tui contracts' (see herdr/docs/design.md), without their fixed-cell geometry.

// Terminal and bidi controls are removed and surrounding whitespace trimmed before anything is shown.
const CONTROLS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Removes terminal and bidi controls and surrounding whitespace. Non-strings become "". */
export function clean(text) {
	return typeof text === "string" ? text.replace(CONTROLS, "").trim() : "";
}

/** pi-goal's duration format: under a minute `Ns`, under an hour `Nm`, then `HhMm`. Whole seconds, floored. */
export function formatDuration(seconds) {
	const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
	if (whole < 60) return `${whole}s`;
	const minutes = Math.floor(whole / 60);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

/** Two digits, capped at 99. */
export const twoDigits = (value) => String(Math.min(99, Math.max(0, Math.floor(value)))).padStart(2, "0");

/** `NN<unit>` capped at 99, or `??<unit>` when unknown. Unknown is never zero. */
export const countText = (value, unit) => (value === null || value === undefined ? `??${unit}` : `${twoDigits(value)}${unit}`);

/** `claude-opus-5-5` → `opus-5.5`: drop a leading `claude-`, then turn a trailing `-N-N` into `-N.N`. */
export function shortModel(id) {
	return clean(id).replace(/^claude-/, "").replace(/-(\d)-(\d)$/, "-$1.$2");
}

const THINKING = { off: "off", minimal: "mn", low: "lo", medium: "md", high: "hi", xhigh: "xh", max: "mx" };

/** Pi's thinking level, shortened; a level outside the table is shown verbatim. */
export const shortThinking = (level) => THINKING[level] ?? clean(level);

/** The model row: short model, then `/` and the short thinking level when the model reports one. */
export function modelText(model, thinking) {
	if (!model) return null;
	const name = shortModel(model.id);
	if (!name) return null;
	const level = thinking ? shortThinking(thinking) : "";
	return level ? `${name}/${level}` : name;
}

/**
 * status-bar's Active display: `~` for home, `~/name` directly under home, the full path when the parent is the
 * filesystem root, otherwise `parent/current`. `home` null (another machine's agent) skips the `~` forms.
 */
export function displayPath(path, home) {
	if (typeof path !== "string" || !path.startsWith("/")) return clean(path);
	const trimmed = path.replace(/\/+$/, "");
	if (!trimmed) return "/";
	if (typeof home === "string" && home.startsWith("/")) {
		const root = home.replace(/\/+$/, "");
		if (trimmed === root) return "~";
		if (root && trimmed.startsWith(`${root}/`)) {
			const rest = trimmed.slice(root.length + 1);
			if (!rest.includes("/")) return `~/${rest}`;
		}
	}
	const parts = trimmed.split("/").filter(Boolean);
	return parts.length <= 2 ? `/${parts.join("/")}` : `${parts.at(-2)}/${parts.at(-1)}`;
}

/** Basename of a POSIX path, or the path itself when it has none. */
export function baseName(path) {
	if (typeof path !== "string") return "";
	return path.replace(/\/+$/, "").split("/").pop() || path;
}

const BAR_CELLS = 11;

/**
 * Context used as an 11-cell text bar and two-digit percent: lit = ceil(used × 11 / 100), used = floor(usedPercent)
 * held to 0–99, so `99%` means 99% or more. Zone: `crit` from 90%, `warn` from 70%, else `ok`; `unknown` when null.
 */
export function contextBar(usedPercent) {
	if (usedPercent === null || usedPercent === undefined || !Number.isFinite(usedPercent)) {
		return { text: `${"─".repeat(BAR_CELLS)} --%`, zone: "unknown", percent: null };
	}
	const percent = Math.max(0, Math.min(99, Math.floor(usedPercent)));
	const lit = Math.ceil((percent * BAR_CELLS) / 100);
	const zone = usedPercent >= 90 ? "crit" : usedPercent >= 70 ? "warn" : "ok";
	return { text: `${"━".repeat(lit)}${"─".repeat(BAR_CELLS - lit)} ${twoDigits(percent)}%`, zone, percent };
}

/**
 * Breaks text into at most `max` lines of at most `chars` characters, at spaces where it can; a word longer than a
 * line is cut. When text is left over, the last line ends in `…`.
 */
export function wrapText(text, chars, max) {
	const words = clean(text).split(/\s+/).filter(Boolean), lines = [];
	let line = "";
	const push = () => { lines.push(line); line = ""; };
	for (let i = 0; i < words.length; i++) {
		let word = words[i];
		while (word) {
			const room = chars - line.length - (line ? 1 : 0);
			if (word.length <= room) { line += (line ? " " : "") + word; word = ""; }
			else if (!line) { line = word.slice(0, chars); word = word.slice(chars); push(); }
			else push();
			if (lines.length === max) {
				// Out of lines with text left: the last one gives its end to the ellipsis.
				if (word || i < words.length - 1 || line) lines[max - 1] = `${lines[max - 1].slice(0, chars - 1).trimEnd()}…`;
				return lines;
			}
		}
	}
	if (line) lines.push(line);
	return lines;
}

export const DAY_MS = 86_400_000;

/** How long, in one unit: `NNS` under a minute, `NM` under an hour, `NH` under a day, then `ND` capped at `99D`. */
export function ageText(ms) {
	const s = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
	if (s < 60) return `${s}S`;
	if (s < 3600) return `${Math.floor(s / 60)}M`;
	return s < 86_400 ? `${Math.floor(s / 3600)}H` : `${Math.min(99, Math.floor(s / 86_400))}D`;
}

/** The next time `ageText` of the time since `since` changes; null once it is capped. */
export function nextAgeChange(since, now) {
	const s = Math.floor(Math.max(0, now - since) / 1000);
	const step = s < 60 ? 1 : s < 3600 ? 60 : s < 86_400 ? 3600 : 86_400;
	return s >= 99 * 86_400 ? null : since + (Math.floor(s / step) + 1) * step * 1000;
}

/** Floor days, capped at `99d`. */
export const daysText = (ms) => `${Math.min(99, Math.floor(Math.max(0, ms) / DAY_MS))}d`;

/** The scanner's readout: one step, the wait before it types in, and how long the typing takes, in ms. */
export const READ_STEP_MS = 30, READ_DELAY_MS = 60, READ_TYPE_MS = 150;
const READ_STEPS = 7;
/** When a readout of `text` has settled, in ms after it started. */
/** A flicker under the pointer: the ms at which it dims, recovers, dims less and is over. Hard steps, no fades. */
export const FLICKER_AT = Object.freeze([36, 72, 132, 168]);
/** `{ opacity, fringe }` of a bar `elapsed` ms after the pointer reached it; its colour fringes show from the first dip to the end. */
export function flickerFrame(elapsed) {
	const [dim, back, dip, over] = FLICKER_AT;
	if (!(elapsed >= dim && elapsed < over)) return { opacity: 1, fringe: false };
	return { opacity: elapsed < back ? 0.2 : elapsed < dip ? 1 : 0.45, fringe: true };
}
export const readoutSettled = (text) => Math.max(READ_DELAY_MS + READ_TYPE_MS, Math.ceil(3 + text.length * 0.45) * READ_STEP_MS);
/**
 * A readout `elapsed` ms after the scanner reached its row: it types in from the right in seven steps, and its
 * digits re-read, cycling until they settle left to right. Returns what is shown so far, the end of the text.
 * `random` picks the cycling digits.
 */
export function readoutFrame(text, elapsed, random = Math.random) {
	if (elapsed >= readoutSettled(text)) return text;
	const typed = elapsed < READ_DELAY_MS ? 0 : Math.min(READ_STEPS, Math.floor((elapsed - READ_DELAY_MS) / (READ_TYPE_MS / READ_STEPS)) + 1);
	const from = text.length - Math.ceil((text.length * typed) / READ_STEPS), step = Math.floor(elapsed / READ_STEP_MS);
	return [...text].map((ch, j) => (/[0-9]/.test(ch) && step < 3 + j * 0.45 ? String(Math.floor(random() * 10)) : ch)).slice(from).join("");
}
