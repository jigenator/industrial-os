// Pure token builder: a snapshot, Herdr's agent status for this pane, a clock and the home path in; the sidebar
// token map out. The canonical rules are in docs/token-contract.md; this module performs no I/O.
import { basename, dirname, isAbsolute, relative, sep } from "node:path";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { Phase, SidebarSnapshot } from "./snapshot.ts";

export const TOKEN_KEYS = [
	"g1", "proj", "proj_idle", "gt", "gt_off", "g2_au", "g2_au0", "bar", "bar_warn", "bar_crit", "bar_idle", "bar_unk", "cmpx", "g3", "br",
	"br_dirty", "dir", "prn", "prn_off", "g4", "mthink", "g5", "ev_act", "ask_l1", "ask_l2", "ask_l3", "ev_rdy_text", "ph_age",
] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type TokenMap = Partial<Record<TokenKey, string>>;

export type HerdrStatus = "idle" | "working" | "blocked" | "done" | "unknown";
export type SidebarInput = { snapshot: SidebarSnapshot | null; herdr: HerdrStatus | null; workspaceLabel?: string | null; now: number; home: string };

// Herdr trims ASCII whitespace but keeps U+2800, so every padding cell is U+2800.
export const BLANK = "\u2800";
const TEXT_CELLS = 24;
const LEFT_CELLS = 15;
const RIGHT_CELLS = 6;
const BAR_CELLS = 11;
const ASK_LINES = 3;
// Herdr caps a token value at 80 characters. A cut segment keeps at most this many code points, so padding and the
// ask-line indent always fit; only text with many combining marks per cell reaches it.
const SEGMENT_CODE_POINTS = 60;

const STATES = {
	working: ["◐", "WRK"], question: ["×", "QNS"], blocked: ["×", "BLK"], done: ["✓", "DNE"], idle: ["○", "IDL"], unknown: ["·", "UNK"],
} as const;
type DisplayState = keyof typeof STATES;
const THINKING: Record<string, string> = { off: "off", minimal: "mn", low: "lo", medium: "md", high: "hi", xhigh: "xh", max: "mx" };
const TOOL_CODES: Record<string, string> = { read: "RD", edit: "ED", write: "WR", bash: "SH", web_search: "WB", fetch_content: "WB", subagent: "AG" };
const PHASE_CODES = { waiting: "WAI", thinking: "THK", writing: "WRT" } as const;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const graphemes = (text: string) => Array.from(segmenter.segment(text), (part) => part.segment);
const codePoints = (text: string) => [...text].length;

/** Removes terminal and bidi controls and surrounding whitespace before anything is measured. */
export function clean(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
}

/** Cuts `text` to at most `cells` terminal cells, ending a cut with `…`. */
export function cut(text: string, cells: number): string {
	if (visibleWidth(text) <= cells && codePoints(text) <= SEGMENT_CODE_POINTS) return text;
	let kept = "", width = 0, points = 0;
	for (const grapheme of graphemes(text)) {
		const w = visibleWidth(grapheme), p = codePoints(grapheme);
		if (width + w > cells - 1 || points + p > SEGMENT_CODE_POINTS - 1) break;
		kept += grapheme; width += w; points += p;
	}
	return `${kept}…`;
}

const padEnd = (text: string, cells: number) => text + BLANK.repeat(Math.max(0, cells - visibleWidth(text)));

/** The left value beside a right value: exactly 15 cells, padded or cut to 14 plus `…` in the last cell. */
export function fitLeft(text: string): string {
	if (visibleWidth(text) <= LEFT_CELLS && codePoints(text) <= SEGMENT_CODE_POINTS) return padEnd(text, LEFT_CELLS);
	const kept = cut(text, LEFT_CELLS).slice(0, -1);
	return padEnd(kept, LEFT_CELLS - 1) + "…";
}

/** A right-aligned value in the 6-cell slot, padded on the left. A longer value is cut. */
export function rightSlot(text: string): string {
	const value = cut(text, RIGHT_CELLS);
	return BLANK.repeat(Math.max(0, RIGHT_CELLS - visibleWidth(value))) + value;
}

/** pi-goal's duration format: under a minute `Ns`, under an hour `Nm`, then `HhMm`. Whole seconds, floored. */
export function formatDuration(seconds: number): string {
	const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
	if (whole < 60) return `${whole}s`;
	const minutes = Math.floor(whole / 60);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

const twoDigits = (value: number) => String(Math.min(99, value)).padStart(2, "0");
const gutter = (label: string) => padEnd(label, 4);

/** `claude-opus-5-5` → `opus-5.5`: drop a leading `claude-`, then turn a trailing `-N-N` into `-N.N`. */
export function shortModel(id: string): string {
	return id.replace(/^claude-/, "").replace(/-(\d)-(\d)$/, "-$1.$2");
}

/** Word-wraps to 24 cells, at most three lines; the last is cut with `…` when text remains. */
export function wrapQuestion(text: string): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/).map(clean).filter(Boolean)) {
		const joined = line ? `${line} ${word}` : word;
		if (visibleWidth(joined) <= TEXT_CELLS) { line = joined; continue; }
		if (line) lines.push(line);
		line = "";
		// A word wider than the line is broken by cells.
		let rest = word;
		while (visibleWidth(rest) > TEXT_CELLS) {
			let head = "", width = 0;
			for (const grapheme of graphemes(rest)) {
				const w = visibleWidth(grapheme);
				if (width + w > TEXT_CELLS) break;
				head += grapheme; width += w;
			}
			if (!head) break;
			lines.push(head);
			rest = rest.slice(head.length);
		}
		line = rest;
	}
	if (line) lines.push(line);
	if (lines.length > ASK_LINES) return [...lines.slice(0, ASK_LINES - 1), cut(lines.slice(ASK_LINES - 1).join(" "), TEXT_CELLS)];
	return lines.map((value) => cut(value, TEXT_CELLS));
}

// status-bar's Active display: `~` and `~/child` under home, the full path near the root, otherwise parent/current.
function displayPath(path: string, home: string): string {
	if (!isAbsolute(path) || !basename(path)) return path;
	if (isAbsolute(home)) {
		const suffix = relative(home, path);
		if (!suffix) return "~";
		if (!isAbsolute(suffix) && suffix !== ".." && !suffix.includes(sep)) return `~${sep}${suffix}`;
	}
	const parent = dirname(path), elided = dirname(parent);
	return dirname(elided) === elided ? path : `${basename(parent)}${sep}${basename(path)}`;
}

function displayState(input: SidebarInput): DisplayState {
	if (input.snapshot?.question) return "question";
	return input.herdr ?? "unknown";
}

// A running duration: `base` seconds plus the time since `start` (none before it).
type Clock = { base: number; start: number };
const seconds = (clock: Clock, now: number) => clock.base + Math.max(0, now - clock.start) / 1000;

function goalClock(snapshot: SidebarSnapshot): Clock | null {
	const goal = snapshot.goal;
	if (!goal) return null;
	return goal.status === "active" && goal.activeSince !== null ? { base: goal.usedSeconds, start: goal.activeSince } : { base: goal.usedSeconds, start: Infinity };
}

// Row 5's age clock: the phase's start while working, the last settle when Herdr reports done.
function ageClock(input: SidebarInput): Clock | null {
	const snapshot = input.snapshot;
	if (!snapshot || snapshot.question) return null;
	if (snapshot.phase) return { base: 0, start: snapshot.phase.since };
	if (displayState(input) === "done" && snapshot.lastSettledAt !== null) return { base: 0, start: snapshot.lastSettledAt };
	return null;
}

function phaseCode(phase: Phase): string {
	return phase.kind === "tool" ? TOOL_CODES[phase.tool] ?? "TL" : PHASE_CODES[phase.kind];
}

function phaseText(phase: Phase): string {
	const target = phase.kind === "tool" && phase.target !== null ? clean(phase.target) : "";
	if (target) return target;
	return phase.kind === "tool" ? clean(phase.tool) || "tool" : phase.kind;
}

// A left value: fitted to 15 cells beside a right value, otherwise cut to the 24-cell text area.
const left = (text: string, right: string | undefined) => (right === undefined ? cut(text, TEXT_CELLS) : fitLeft(text));

/** The sidebar tokens for this pane. Keys absent from the map do not apply and are cleared by the sender. */
export function buildTokens(input: SidebarInput): TokenMap {
	const { snapshot, now } = input;
	const tokens: TokenMap = {};
	const set = (key: TokenKey, value: string | undefined) => { if (value) tokens[key] = value; };
	const state = displayState(input);
	const [icon, code] = STATES[state];

	// Row 1: state, Herdr SPACE (Active basename while unknown), goal time.
	tokens.g1 = `${icon} ${code}${BLANK}`;
	const goal = snapshot && goalClock(snapshot);
	const goalTime = goal ? rightSlot(formatDuration(seconds(goal, now))) : undefined;
	if (goalTime) set(snapshot!.goal!.status === "active" ? "gt" : "gt_off", goalTime);
	const project = clean(input.workspaceLabel ?? "") || (snapshot?.active ? clean(basename(snapshot.active) || snapshot.active) : "");
	if (project) set(state === "idle" || state === "unknown" ? "proj_idle" : "proj", left(project, goalTime));

	// Row 2: units, used context, compactions. Always all three; unknown is never zero.
	const units = snapshot?.units ?? null;
	set(units !== null && units >= 1 ? "g2_au" : "g2_au0", units === null ? "??AU" : `${twoDigits(units)}AU`);
	const used = snapshot?.usedPercent ?? null;
	if (used === null) set("bar_unk", `${"─".repeat(BAR_CELLS)} --%`);
	else {
		const percent = Math.max(0, Math.min(99, Math.floor(used)));
		const lit = Math.ceil((percent * BAR_CELLS) / 100);
		set(state === "idle" || state === "unknown" ? "bar_idle" : used >= 90 ? "bar_crit" : used >= 70 ? "bar_warn" : "bar", `${"━".repeat(lit)}${"─".repeat(BAR_CELLS - lit)} ${twoDigits(percent)}%`);
	}
	const compactions = snapshot?.compactions ?? null;
	set("cmpx", `CMP×${compactions === null ? "??" : twoDigits(compactions)}`);

	if (!snapshot) return tokens;

	// Row 3: branch or directory, PR number.
	const pr = snapshot.pr;
	const prText = pr?.kind === "open" ? rightSlot(`#${pr.number}`) : pr?.kind === "unavailable" ? rightSlot("#?") : undefined;
	if (prText) set(pr!.kind === "open" ? "prn" : "prn_off", prText);
	// status-bar shows `⑂ branch` exactly when Git and GitHub are both known and HEAD is on a branch.
	const git = snapshot.workspace?.git;
	if (git?.kind === "repository" && git.branch !== null && snapshot.workspace!.githubRepository) {
		const branch = clean(git.branch);
		// A cut dirty branch keeps its `*`, so the state never rests on color alone.
		if (git.dirty === true) set("br_dirty", prText === undefined ? `${cut(branch, TEXT_CELLS - 1)}*` : fitLeft(`${cut(branch, LEFT_CELLS - 1)}*`));
		else set("br", left(branch, prText));
	} else if (snapshot.active) set("dir", left(clean(displayPath(snapshot.active, input.home)), prText));
	if (tokens.br || tokens.br_dirty || tokens.dir) tokens.g3 = gutter("ACT");

	// Row 4: model and thinking level.
	if (snapshot.model) {
		const model = clean(shortModel(snapshot.model.id));
		const thinking = snapshot.thinking === null ? "" : THINKING[snapshot.thinking] ?? clean(snapshot.thinking);
		set("mthink", model && cut(thinking ? `${model}/${thinking}` : model, TEXT_CELLS));
		if (tokens.mthink) tokens.g4 = gutter("MDL");
	}

	// Row 5: the pending question, the working phase, or the finished marker.
	const age = ageClock(input);
	const ageText = age ? rightSlot(formatDuration(seconds(age, now))) : undefined;
	if (snapshot.question) {
		tokens.g5 = gutter("ASK");
		const more = snapshot.question.more > 0 ? ` (+${snapshot.question.more})` : "";
		const [l1, l2, l3] = wrapQuestion(`${snapshot.question.text}${more}`);
		set("ask_l1", l1);
		set("ask_l2", l2 && BLANK.repeat(7) + l2);
		set("ask_l3", l3 && BLANK.repeat(7) + l3);
	} else if (snapshot.phase) {
		tokens.g5 = gutter(phaseCode(snapshot.phase));
		set("ev_act", left(phaseText(snapshot.phase), ageText));
		set("ph_age", ageText);
	} else if (state === "done") {
		tokens.g5 = gutter("RDY");
		set("ev_rdy_text", left("finished", ageText));
		set("ph_age", ageText);
	}
	return tokens;
}

// The next whole second under a minute, then the next whole minute: when a pi-goal duration's text changes.
function nextChange(clock: Clock, now: number): number | null {
	if (clock.start === Infinity) return null;
	const s = seconds(clock, now);
	const boundary = s < 60 ? Math.floor(s) + 1 : (Math.floor(s / 60) + 1) * 60;
	return Math.ceil(clock.start + (boundary - clock.base) * 1000) + 1;
}

/** The epoch time at which a displayed duration next changes its text, or null when nothing shown is running. */
export function nextTokenChange(input: SidebarInput): number | null {
	const clocks = [input.snapshot && goalClock(input.snapshot), ageClock(input)].filter((clock): clock is Clock => !!clock);
	const times = clocks.map((clock) => nextChange(clock, input.now)).filter((time): time is number => time !== null);
	return times.length ? Math.min(...times) : null;
}
