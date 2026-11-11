// One row per space: state icon, panes, agents, Pi units, name, ahead/behind and quiet age. Pure: Herdr's data,
// each Pi terminal's parsed signals and display state, a clock and remembered activity in; plain values out.
import { DAY_MS, clean, countText, daysText } from "./format.js";
import { HERDR_ICONS } from "./agent.js";

export const QUIET_MS = 48 * 3_600_000;

// Herdr's aggregate order, most urgent first; a space without panes is unknown.
const ORDER = ["blocked", "done", "working", "idle", "unknown"];

/**
 * A pane's state: Herdr's own status, except that a Pi terminal showing SUB or RUN counts as working, because
 * Herdr derives status only from Pi's root agent. Panes without an agent are unknown.
 */
export function paneState(pane, piStates) {
	const own = ORDER.includes(pane.status) ? pane.status : "unknown";
	const shown = pane.terminal ? piStates.get(pane.terminal) : undefined;
	if ((shown === "subagents" || shown === "background") && own !== "blocked" && own !== "working") return "working";
	return own;
}

/** The highest pane state, or unknown when there are none. */
export const spaceState = (states) => ORDER.find((state) => states.includes(state)) ?? "unknown";

/**
 * Sum of Pi terminals' units: no Pi is `00AU`; any Pi whose units are missing or unknown makes `??AU`.
 * Other agents do not contribute.
 */
export function unitsSum(piPanes, signalsByTerminal) {
	let sum = 0;
	for (const pane of piPanes) {
		const units = signalsByTerminal.get(pane.terminal)?.units ?? null;
		if (units === null) return null;
		sum += units;
	}
	return sum;
}

/**
 * Activity, for quiet ages. A space is active when first seen (no inferred old age), while shown, when its pane or
 * agent count changes, while a pane is working or blocked (Pi SUB and RUN included), or while a Pi reports units.
 * A clock step backwards clamps to now.
 */
export function nextActivity({ memory, shown, panes, agents, busy, now }) {
	const at = Number.isFinite(memory?.at) ? Math.min(memory.at, now) : null;
	const changed = memory && (memory.panes !== panes || memory.agents !== agents);
	return at === null || shown || changed || busy ? now : at;
}

/** Quiet: not shown and at least 48 hours since activity. */
export const isQuiet = (shown, at, now) => !shown && now - at >= QUIET_MS;

function nextQuietChange(shown, at, now) {
	if (shown) return null;
	const age = now - at;
	if (age < QUIET_MS) return at + QUIET_MS;
	const days = Math.floor(age / DAY_MS);
	return days >= 99 ? null : at + (days + 1) * DAY_MS;
}

/**
 * The row for one space. `panes` are this space's panes, `piStates` maps a Pi terminal to its display state,
 * `signalsByTerminal` to its parsed signals, `git` is `{ ahead, behind }` or null, `memory` the remembered activity.
 */
export function spaceRow({ space, panes, piStates, signalsByTerminal, git, memory, now }) {
	const states = panes.map((pane) => paneState(pane, piStates));
	const state = spaceState(states);
	const agentPanes = panes.filter((pane) => pane.terminal && (pane.status != null || pane.app != null));
	const piPanes = agentPanes.filter((pane) => pane.app === "pi");
	const units = unitsSum(piPanes, signalsByTerminal);
	const busy = states.some((s) => s === "working" || s === "blocked")
		|| piPanes.some((pane) => (signalsByTerminal.get(pane.terminal)?.units ?? 0) >= 1);
	const at = nextActivity({ memory, shown: space.active, panes: panes.length, agents: agentPanes.length, busy, now });
	const quiet = isQuiet(space.active, at, now);
	const ahead = Number.isSafeInteger(git?.ahead) && git.ahead > 0 ? git.ahead : 0;
	const behind = Number.isSafeInteger(git?.behind) && git.behind > 0 ? git.behind : 0;
	return {
		row: {
			kind: "space",
			id: space.id,
			name: clean(space.name) || space.id,
			active: space.active,
			state,
			icon: HERDR_ICONS[state],
			panes: countText(panes.length, "PN"),
			// Quiet spaces show only their panes, name, age and ahead/behind.
			agents: quiet ? null : { text: countText(agentPanes.length, "AG"), active: agentPanes.length > 0 },
			units: quiet ? null : { text: countText(units, "AU"), active: (units ?? 0) >= 1 },
			ahead,
			behind,
			quiet: quiet ? daysText(now - at) : null,
		},
		memory: { at, panes: panes.length, agents: agentPanes.length },
		nextChangeAt: nextQuietChange(space.active, at, now),
	};
}

/** `git rev-list --left-right --count HEAD...@{upstream}` output: ahead, then behind. Anything else is null. */
export function parseAheadBehind(stdout) {
	const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(stdout ?? "");
	return match ? { ahead: Number(match[1]), behind: Number(match[2]) } : null;
}

/** Where a space is now: its first terminal's live folder, else where it was made. */
export function spacePlace(space, panes) {
	const tabs = new Set((space.tabs ?? []).map((tab) => tab.id));
	return panes.find((pane) => tabs.has(pane.tab) && pane.cwd)?.cwd || space.folder || null;
}
