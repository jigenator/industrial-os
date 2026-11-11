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
		return { text: `${"─".repeat(BAR_CELLS)} --%`, zone: "unknown" };
	}
	const percent = Math.max(0, Math.min(99, Math.floor(usedPercent)));
	const lit = Math.ceil((percent * BAR_CELLS) / 100);
	const zone = usedPercent >= 90 ? "crit" : usedPercent >= 70 ? "warn" : "ok";
	return { text: `${"━".repeat(lit)}${"─".repeat(BAR_CELLS - lit)} ${twoDigits(percent)}%`, zone };
}

export const DAY_MS = 86_400_000;

/** Floor days, capped at `99d`. */
export const daysText = (ms) => `${Math.min(99, Math.floor(Math.max(0, ms) / DAY_MS))}d`;
