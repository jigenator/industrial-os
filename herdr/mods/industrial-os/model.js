// The whole sidebar as plain data: Herdr's live lists, the clock and remembered state in; the spaces rows, the agent
// blocks in display order, the next remembered state and the next time any shown text changes out. Pure, so Node
// tests run it on fixtures; main.js only reads Herdr, keeps the memory and draws.
import { herdrStatus, otherLine, piBlock } from "./agent.js";
import { terminalSignals } from "./signals.js";
import { spaceRow } from "./spaces.js";
import { actionList, agentOrder, buildMissions, railLamps, roster } from "./missions.js";

// Remembered state for a terminal or space absent this long is dropped.
export const FORGET_MS = 30 * 86_400_000;
// Refreshed timestamps are saved at most this often; quiet ages are hours and days.
const SAVE_MS = 60_000;

/**
 * The header's droid count: agents the sidebar shows as working (WRK, SUB, RUN, or another agent Herdr reports
 * working) plus every Pi's known subagents. By the operator's choice, unknown subagents add nothing, so it can undercount.
 */
export const droidCount = (blocks) =>
	blocks.reduce((n, b) => n
		+ ((b.kind === "pi" ? b.state.tone : b.status.word) === "working" ? 1 : 0)
		+ (b.kind === "pi" ? (b.units.count ?? 0) : 0), 0);

/** An empty memory: per terminal address and per space ID, each with when it was last present. */
export const emptyMemory = () => ({ agents: {}, spaces: {} });

function prune(entries, present, now) {
	const kept = {};
	let dropped = false;
	for (const [key, value] of Object.entries(entries ?? {})) {
		if (present.has(key) || now - (value.present ?? 0) < FORGET_MS) kept[key] = value;
		else dropped = true;
	}
	return { kept, dropped };
}

// Whether a change is worth saving: anything other than a timestamp refreshed within the same minute.
function differs(before, after) {
	if (!before) return true;
	for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const a = before[key], b = after[key];
		if (a === b) continue;
		if (["at", "present"].includes(key) && Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) < SAVE_MS) continue;
		return true;
	}
	return false;
}

/**
 * Builds the sidebar. Inputs are what the `herdr` module returns (`spaces()`, `agents()`, `terminals()`, `panes()`),
 * plus `now` (ms), `home` (this computer's home folder), `git` (space ID → `{ ahead, behind }` or null), `fold` (space
 * ID → shut by the person, or opened), `focusedPane` (the pane with the keyboard) and `view` ("missions" or "agents").
 */
export function buildSidebar({ spaces = [], agents = [], terminals = [], panes = [], git = {}, home = null, now, memory, fold = {}, focusedPane = null, view = "missions" }) {
	const previous = memory && typeof memory === "object" ? memory : emptyMemory();
	const nextMemory = emptyMemory();
	let dirty = false;
	const changes = [];

	const terminalByAddress = new Map(terminals.filter((t) => t && typeof t.address === "string").map((t) => [t.address, t]));
	const agentByAddress = new Map(agents.map((a) => [a.address, a]));
	const spaceById = new Map(spaces.map((s) => [s.id, s]));
	const tabById = new Map(spaces.flatMap((s) => (s.tabs ?? []).map((tab) => [tab.id, { tab, space: s }])));
	const agentsPerTab = new Map();
	for (const a of agents) agentsPerTab.set(a.tab, (agentsPerTab.get(a.tab) ?? 0) + 1);

	// Every Pi terminal's signals, whether or not it has a pane: the agent status app, else the core's report.
	const appOf = (address) => agentByAddress.get(address)?.app ?? terminalByAddress.get(address)?.report?.app ?? null;
	const signalsByTerminal = new Map();
	for (const t of terminalByAddress.values()) {
		const signals = terminalSignals(t, appOf(t.address));
		if (signals) signalsByTerminal.set(t.address, signals);
	}

	// Agents, in Herdr's order (space, tab, pane).
	const piStates = new Map();
	const blocks = agents.map((a) => {
		const herdr = herdrStatus(a.status);
		const found = tabById.get(a.tab);
		const space = spaceById.get(a.space) ?? found?.space;
		// Seen: its tab is the shown tab of the shown space.
		const seen = !!(space?.active && found?.tab?.active);
		const signals = signalsByTerminal.get(a.address);
		const before = previous.agents?.[a.address];
		if (!signals) {
			// No signals: counts become unknown, so a later drop to zero is not a completion.
			const entry = { units: null, background: null, finishedAt: null, present: now };
			if (differs(before, entry)) {
				dirty = true;
				nextMemory.agents[a.address] = entry;
			} else nextMemory.agents[a.address] = { ...entry, present: before.present };
			return otherLine({ agent: a, herdr, spaceName: a.space_name ?? space?.name });
		}
		// A home folder applies only to this computer's agents; another machine's address is `machine/tN`.
		const local = !a.address.includes("/");
		const built = piBlock({
			agent: a, signals, herdr, seen, spaceName: a.space_name ?? space?.name,
			tab: found?.tab, sharedTab: (agentsPerTab.get(a.tab) ?? 0) > 1,
			now, home: local ? home : null, memory: before,
		});
		piStates.set(a.address, built.block.state.key);
		const entry = { ...built.memory, present: now };
		if (differs(before, entry)) {
			dirty = true;
			nextMemory.agents[a.address] = entry;
		} else nextMemory.agents[a.address] = { ...entry, present: before.present };
		if (built.nextChangeAt !== null) changes.push(built.nextChangeAt);
		return built.block;
	});

	// Spaces, in Herdr's order.
	const panesBySpace = new Map(spaces.map((s) => [s.id, []]));
	for (const p of panes) {
		const space = tabById.get(p.tab)?.space;
		if (space) panesBySpace.get(space.id).push(p);
	}
	const rows = spaces.map((s) => {
		const before = previous.spaces?.[s.id];
		const built = spaceRow({ space: s, panes: panesBySpace.get(s.id), piStates, signalsByTerminal, git: git[s.id] ?? null, memory: before, now });
		const entry = { ...built.memory, present: now };
		if (differs(before, entry)) {
			dirty = true;
			nextMemory.spaces[s.id] = entry;
		} else nextMemory.spaces[s.id] = { ...entry, at: before.at, present: before.present };
		if (built.nextChangeAt !== null) changes.push(built.nextChangeAt);
		return built.row;
	});

	// Keep absent terminals' and spaces' memory for a while, so a restart or a moment offline does not reset it.
	for (const [kind, present] of [["agents", new Set(agents.map((a) => a.address))], ["spaces", new Set(spaces.map((s) => s.id))]]) {
		const { kept, dropped } = prune(previous[kind], present, now);
		if (dropped) dirty = true;
		for (const [key, value] of Object.entries(kept)) if (!present.has(key)) nextMemory[kind][key] = value;
	}

	// The list: every pane as a unit, by space and tab, and what is read off it.
	const built = buildMissions({ spaces, panes, agents, blocks, rows, fold, focusedPane, now });
	if (built.nextChangeAt !== null) changes.push(built.nextChangeAt);
	const action = actionList(built.missions);

	return {
		spaces: rows,
		agents: blocks,
		missions: built.missions,
		action,
		roster: view === "agents" ? roster(built.missions) : null,
		lamps: railLamps(built.missions),
		counts: { droids: droidCount(blocks), spaces: spaces.length, need: built.missions.reduce((n, m) => n + m.need, 0) },
		order: agentOrder(built.missions, view),
		memory: nextMemory,
		dirty,
		nextChangeAt: changes.length ? Math.min(...changes) : null,
	};
}
