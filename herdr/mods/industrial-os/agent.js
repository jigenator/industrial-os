// One agent's block: state precedence, the unseen-work-finished rule, ACT/MDL access decay and every row's
// text. Pure: Herdr's data, the parsed label, a clock and remembered state in; plain values out.
import { baseName, clean, contextBar, countText, displayPath, formatDuration, modelText } from "./format.js";

export const STATES = {
	question: { icon: "×", code: "QNS", tone: "blocked" },
	blocked: { icon: "×", code: "BLK", tone: "blocked" },
	working: { icon: "◐", code: "WRK", tone: "working" },
	subagents: { icon: "◐", code: "SUB", tone: "working" },
	background: { icon: "◐", code: "RUN", tone: "working" },
	done: { icon: "✓", code: "DNE", tone: "done" },
	idle: { icon: "○", code: "IDL", tone: "idle" },
	unknown: { icon: "·", code: "UNK", tone: "unknown" },
};

// Herdr's own status words and their icons, for agents without signals.
export const HERDR_ICONS = { blocked: "×", done: "✓", working: "◐", idle: "○", unknown: "·" };

/** Herdr's status word, or "unknown" for anything else. */
export const herdrStatus = (status) => (status in HERDR_ICONS ? status : "unknown");

/**
 * QNS > BLK > WRK > SUB (units ≥ 1) > RUN (background tasks ≥ 1) > DNE (Herdr done, or work finished unseen) >
 * IDL / UNK. Herdr tracks only Pi's root agent, so units and background tasks still mean work while it is idle.
 */
export function displayState({ signals, herdr, finishedAt }) {
	if (signals?.question) return "question";
	if (herdr === "blocked" || herdr === "working") return herdr;
	if ((signals?.units ?? 0) >= 1) return "subagents";
	if ((signals?.backgroundTasks ?? 0) >= 1) return "background";
	if (herdr === "done" || (finishedAt ?? null) !== null) return "done";
	return herdr === "idle" ? "idle" : "unknown";
}

/**
 * Work finished unseen: units or background tasks fell from ≥ 1 to 0 between consecutive observations while Herdr
 * is not working and the terminal is not seen. Unknown counts never count as zero. Seen, Herdr working or either
 * count ≥ 1 clears it.
 */
export function nextFinishedAt({ previousUnits, units, previousBackground, background, herdr, seen, finishedAt, now }) {
	if (herdr === "working" || seen) return null;
	if ((units ?? 0) >= 1 || (background ?? 0) >= 1) return null;
	if (finishedAt !== null && finishedAt !== undefined) return finishedAt;
	const unitsFinished = previousUnits !== null && previousUnits !== undefined && previousUnits >= 1 && units === 0;
	const backgroundFinished = previousBackground !== null && previousBackground !== undefined && previousBackground >= 1 && background === 0;
	return unitsFinished || backgroundFinished ? now : null;
}

export const DECAY_THRESHOLDS_MS = [3_600_000, 14_400_000, 86_400_000];

/** Access is fresh while the terminal is seen, its row shows WRK/SUB/RUN, or Herdr's status is unknown. */
export const accessIsFresh = ({ state, herdr, seen }) =>
	seen || herdr === "unknown" || state === "working" || state === "subagents" || state === "background";

/** 0 under an hour since last access, 1 from an hour, 2 from four hours, 3 from a day. A future time is 0. */
export const decayStage = (lastAccessAt, now) =>
	DECAY_THRESHOLDS_MS.filter((threshold) => Math.max(0, now - lastAccessAt) >= threshold).length;

const BLAND = /^[^\p{L}\p{N}]+/u;

/**
 * The pane name, as the shipped agents list titles a row: the tab's name when someone named it (and it is not just
 * the program's name), else the terminal's title when it says something (not the program, a path or user@host).
 * With several agents in one tab, each uses its own title. An automatic tab number is no name: null.
 */
export function paneName({ tab, title, program, sharedTab }) {
	const prog = program?.name;
	const raw = typeof title === "string" ? title : "";
	const live = clean(raw.replace(BLAND, ""));
	const path = /^[~/]|^[A-Za-z]:\\/.test(raw.replace(/^[^\p{L}\p{N}~/]+/u, ""));
	const telling = live && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== program?.key;
	const named = tab?.named && !sharedTab;
	const name = (!named || tab?.name === prog) && telling ? live : named ? clean(tab.name) : "";
	return name && !/^\d+$/.test(name) ? name : null;
}

// A running duration: `base` seconds plus the time since `start` (none before it; Infinity means stopped).
const seconds = (clock, now) => clock.base + (clock.start === Infinity ? 0 : Math.max(0, now - clock.start) / 1000);

/** The next time a pi-goal duration's text changes: the next second under a minute, then the next minute. */
export function nextDurationChange(clock, now) {
	if (clock.start === Infinity) return null;
	const s = seconds(clock, now);
	const boundary = s < 60 ? Math.floor(s) + 1 : (Math.floor(s / 60) + 1) * 60;
	return Math.ceil(clock.start + (boundary - clock.base) * 1000) + 1;
}

/** The status-bar rule: the branch shows exactly when Git and GitHub are both known and HEAD is on a branch. */
function actText(signals, home) {
	const ws = signals.workspace;
	if (ws?.repository && ws.branch !== null && ws.github) {
		const branch = clean(ws.branch);
		return { kind: "branch", text: ws.dirty === true ? `${branch}*` : branch, dirty: ws.dirty === true };
	}
	if (signals.active) return { kind: "dir", text: displayPath(signals.active, home), dirty: false };
	return null;
}

function prText(pr) {
	if (pr?.kind === "open") return { text: `#${pr.number}`, known: true };
	if (pr?.kind === "unavailable") return { text: "#?", known: false };
	return null;
}

/**
 * The block for one Pi agent with signals. `memory` is what the mod remembered for this terminal
 * ({ units, background, finishedAt, lastAccessAt }); the result carries the next memory and the next time any
 * shown text changes on its own (a running clock or a decay boundary).
 */
export function piBlock({ agent, signals, herdr, seen, spaceName, tab, sharedTab = false, now, home, memory = {} }) {
	const finishedAt = nextFinishedAt({
		previousUnits: memory.units, units: signals.units,
		previousBackground: memory.background, background: signals.backgroundTasks,
		herdr, seen, finishedAt: memory.finishedAt ?? null, now,
	});
	const state = displayState({ signals, herdr, finishedAt });
	const fresh = accessIsFresh({ state, herdr, seen });
	const lastAccessAt = fresh || !Number.isFinite(memory.lastAccessAt) ? now : memory.lastAccessAt;
	const decay = decayStage(lastAccessAt, now);
	const clocks = [];

	// Row 1: state, SPACE (Active basename while unknown), the manual flag, goal time.
	let goal = null;
	if (signals.goal) {
		const clock = signals.goal.active && signals.goal.activeSince !== null
			? { base: signals.goal.usedSeconds, start: signals.goal.activeSince }
			: { base: signals.goal.usedSeconds, start: Infinity };
		clocks.push(clock);
		goal = { text: formatDuration(seconds(clock, now)), active: signals.goal.active };
	}
	const space = clean(spaceName) || clean(baseName(signals.active ?? ""));

	// Row 2: units, context used, compactions. Unknown is never zero.
	const bar = contextBar(signals.usedPercent);
	const idle = state === "idle" || state === "unknown";

	// Row 5: question, finished marker, otherwise the pane name with the working phase's age.
	let row5 = null;
	if (signals.question) {
		const more = signals.question.more > 0 ? ` (+${signals.question.more})` : "";
		row5 = { kind: "ask", label: "ASK", text: `${clean(signals.question.text.replace(/\s+/g, " "))}${more}`, age: null };
	} else if (state === "done") {
		const since = finishedAt ?? signals.lastSettledAt;
		const clock = since === null ? null : { base: 0, start: since };
		if (clock) clocks.push(clock);
		row5 = { kind: "rdy", label: "RDY", text: "finished", age: clock ? formatDuration(seconds(clock, now)) : null };
	} else {
		const name = paneName({ tab, title: agent.title, program: agent.program, sharedTab });
		if (name) {
			const clock = signals.phase ? { base: 0, start: signals.phase.since } : null;
			if (clock) clocks.push(clock);
			row5 = { kind: "pne", label: "PNE", text: name, age: clock ? formatDuration(seconds(clock, now)) : null };
		}
	}

	const changes = clocks.map((clock) => nextDurationChange(clock, now)).filter((at) => at !== null);
	if (!fresh && decay < DECAY_THRESHOLDS_MS.length) changes.push(lastAccessAt + DECAY_THRESHOLDS_MS[decay]);
	const model = modelText(signals.model, signals.thinking);
	return {
		block: {
			kind: "pi",
			address: agent.address,
			pane: agent.pane,
			state: { key: state, ...STATES[state] },
			space,
			idle,
			flag: signals.flag,
			goal,
			units: { text: countText(signals.units, "AU"), active: (signals.units ?? 0) >= 1 },
			context: { text: bar.text, zone: bar.zone === "unknown" ? "unknown" : idle ? "idle" : bar.zone },
			compactions: `CMP×${countText(signals.compactions, "")}`,
			act: actText(signals, home),
			pr: prText(signals.pr),
			model,
			decay,
			row5,
		},
		memory: { units: signals.units, background: signals.backgroundTasks, finishedAt, lastAccessAt },
		nextChangeAt: changes.length ? Math.min(...changes) : null,
	};
}

/** One line for an agent without signals: Herdr's own status, the space and the title. */
export function otherLine({ agent, herdr, spaceName }) {
	const title = clean(agent.title) || clean(agent.program?.name) || agent.address;
	return { kind: "other", address: agent.address, pane: agent.pane, status: { word: herdr, icon: HERDR_ICONS[herdr] }, space: clean(spaceName), title };
}
