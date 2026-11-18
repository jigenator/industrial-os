// The redesigned list as plain data: every pane as a unit, grouped by tab and space (missions) or by urgency
// (agents), what needs the person, the folded rail's lamps and the plate's counts. Pure: Herdr's lists, the agent
// blocks model.js built and a clock in; plain values out. The words and designations are the design system's
// sidebar vocabulary.
import { HERDR_ICONS } from "./agent.js";
import { PATH_START, TITLE_MARKS, ageText, clean, countText, nextAgeChange, twoDigits } from "./format.js";
import { UNIT_STATUS, designation, gridReference, spaceLetter, zoneStatus } from "./vocabulary.js";

// Herdr's status word as a state code, for agents without signals.
const HERDR_CODE = { working: "WRK", blocked: "BLK", done: "DNE", idle: "IDL", unknown: "UNK" };
/** Priority by tone: what needs the person, what finished, what works, what stands by. The map's cameras use it too. */
export const RANK = { blocked: 0, done: 1, working: 2, idle: 3, unknown: 3 };
/** The state codes of a unit that is doing or wanting something. */
export const ACTIVE = new Set(["QNS", "BLK", "WRK", "SUB", "RUN"]);
/** ACTION REQUIRED shows this many; the rest fold into `+ NN MORE`. */
export const ACTION_SHOWN = 4;
/** A row shows one icon for each of this many subagents, then `+N`. */
export const UNIT_ICONS = 12;

/** What a pane is called: its terminal's title when that says something, else the program it runs. */
export function unitName({ title, program, mod }) {
	const raw = clean(typeof title === "string" ? title.replace(TITLE_MARKS, "") : "");
	const telling = raw && !PATH_START.test(raw) && !/^\S+@\S+/.test(raw);
	return telling ? raw : clean(program?.name) || clean(mod) || raw || "terminal";
}

/** A tab's name, or `TAB NN` when nobody named it (Herdr then gives its position). */
export const tabName = (tab) => (tab?.named && clean(tab.name) ? clean(tab.name) : `TAB ${twoDigits(tab?.index ?? 0)}`);

/** Context used as a colour zone: critical from 90%, warning from 70%, else lit only while the pane is. */
export const contextZone = (percent, tone) =>
	(percent === null ? "off" : percent >= 90 ? "crit" : percent >= 70 ? "warn" : tone === "working" || tone === "blocked" ? "ok" : "off");

function unitOf({ pane, agent, block, tab, spaceIndex, tabIndex, unitIndex, spaceName, focused, now }) {
	const kind = block?.kind === "pi" ? "drd" : agent ? "agt" : pane.terminal ? "trm" : "mod";
	const code = block?.kind === "pi" ? block.state.code : agent ? HERDR_CODE[block.status.word] : "IDL";
	const tone = block?.kind === "pi" ? block.state.tone : agent ? block.status.word : "idle";
	const units = block?.kind === "pi" ? block.units.count ?? null : null;
	const since = block?.kind === "pi" ? block.since
		: agent ? (tone === "working" ? tab?.working_since : tab?.changed_at) ?? null : null;
	const percent = block?.kind === "pi" ? block.context.percent : null;
	const ask = block?.kind === "pi" && block.row5?.kind === "ask" ? block.row5.text : null;
	const unit = {
		id: pane.pane,
		address: agent?.address ?? null,
		kind,
		designation: designation(kind, spaceIndex, tabIndex, unitIndex),
		ref: gridReference(spaceIndex, tabIndex),
		code,
		// A working pane whose own subagents are working keeps WRK and shows the three-satellite mark.
		mark: code === "WRK" && (units ?? 0) >= 1 ? "SUB" : code,
		tone,
		status: UNIT_STATUS[code],
		name: unitName({ title: agent?.title ?? pane.title, program: agent?.program ?? pane.program, mod: pane.mod }),
		space: spaceName,
		tab: tabName(tab),
		flag: block?.kind === "pi" && block.flag === true,
		age: Number.isFinite(since) ? ageText(now - since) : null,
		focused,
		// Subagents: a count is all the label carries, so each icon is a working one. Unknown is never zero.
		units: kind === "drd" ? { count: units, text: countText(units, "AU") } : null,
		context: kind === "drd" ? { text: percent === null ? "--%" : `${twoDigits(percent)}%`, percent, zone: contextZone(percent, tone) } : null,
		// What a pane without Pi's signals is, in place of readings it does not have.
		note: kind === "drd" ? null : kind === "agt" ? "HERDR STATUS ONLY" : kind === "trm" ? "TERMINAL" : "MOD",
		waits: ask ?? (code === "BLK" ? "waiting on approval" : code === "DNE" ? "finished, not yet seen" : null),
		detail: block?.kind === "pi" ? {
			act: block.act,
			pr: block.pr,
			model: block.model,
			compactions: block.compactions.replace("×", " "),
			goal: block.goal ? block.goal.text.toUpperCase() : null,
			ask: ask ? { label: "ASK", text: ask } : code === "BLK" ? { label: "BLK", text: "waiting on approval" } : null,
		} : null,
	};
	return { unit, nextChangeAt: Number.isFinite(since) ? nextAgeChange(since, now) : null };
}

/**
 * Missions: one per space, in Herdr's order, each with its tabs and each tab with its panes as units.
 * `blocks` are model.js's agent blocks; `rows` its space rows; `fold` maps a space ID to whether the person shut
 * (true) or opened (false) it, a quiet space being shut until they say; `focusedPane` is the pane with the keyboard.
 */
export function buildMissions({ spaces = [], panes = [], agents = [], blocks = [], rows = [], fold = {}, focusedPane = null, now }) {
	const agentByPane = new Map(agents.map((a, i) => [a.pane, { agent: a, block: blocks[i] }]));
	const rowById = new Map(rows.map((r) => [r.id, r]));
	const panesByTab = new Map();
	for (const p of panes) panesByTab.set(p.tab, [...(panesByTab.get(p.tab) ?? []), p]);
	const changes = [];
	const missions = spaces.map((space, spaceIndex) => {
		const row = rowById.get(space.id);
		const name = clean(space.name) || space.id;
		const tabs = (space.tabs ?? []).map((tab, tabIndex) => {
			const units = (panesByTab.get(tab.id) ?? []).map((pane, unitIndex) => {
				const found = agentByPane.get(pane.pane);
				const built = unitOf({
					pane, agent: found?.agent, block: found?.block, tab, spaceIndex, tabIndex, unitIndex, spaceName: name,
					focused: focusedPane !== null && pane.pane === focusedPane, now,
				});
				if (built.nextChangeAt !== null) changes.push(built.nextChangeAt);
				return built.unit;
			});
			return {
				id: tab.id,
				ref: gridReference(spaceIndex, tabIndex),
				name: tabName(tab),
				// A tab none of whose panes is lit is quieter.
				quiet: units.every((u) => u.tone === "idle" || u.tone === "unknown"),
				status: zoneStatus(units.map((u) => u.code)),
				units,
			};
		});
		const units = tabs.flatMap((t) => t.units);
		return {
			id: space.id,
			index: spaceIndex,
			letter: spaceLetter(spaceIndex),
			name,
			// The space the window shows: the one you are in.
			current: space.active === true,
			open: Object.hasOwn(fold, space.id) ? fold[space.id] !== true : !row?.quiet,
			need: units.filter((u) => u.tone === "blocked").length,
			behind: row?.behind ?? 0,
			tabs,
		};
	});
	return { missions, nextChangeAt: changes.length ? Math.min(...changes) : null };
}

const everyUnit = (missions) => missions.flatMap((m) => m.tabs.flatMap((t) => t.units));

/** What needs the person, most urgent first: questions and blocks, then work finished unseen. */
export function actionList(missions) {
	const list = everyUnit(missions).filter((u) => u.code === "QNS" || u.code === "BLK" || u.code === "DNE");
	return list.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}

/**
 * The agents view: every pane in one fixed order. What is active first, then by priority, and within each of those
 * the panes of one space together under its name; a space with panes at two levels is listed once at each.
 */
export function roster(missions) {
	const level = (u) => `${ACTIVE.has(u.code) ? 0 : 1}${RANK[u.tone]}`;
	const sorted = everyUnit(missions)
		.map((u, i) => ({ u, i, k: level(u) }))
		.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.u.space < b.u.space ? -1 : a.u.space > b.u.space ? 1 : a.i - b.i));
	const groups = [];
	for (const { u, k } of sorted) {
		const key = `${k}|${u.space}`, last = groups.at(-1);
		if (last?.key === key) last.units.push(u);
		else groups.push({ key, name: u.space, units: [u] });
	}
	return groups;
}

// The folded rail's lamp per tone: a lit cell for working, the plain signs otherwise.
const LAMP_GLYPH = { working: "█", blocked: HERDR_ICONS.blocked, done: HERDR_ICONS.done, idle: HERDR_ICONS.idle, unknown: HERDR_ICONS.unknown };

/** The folded rail: one lamp per pane, grouped by mission, in the list's order; `gap` opens each later mission. */
export const railLamps = (missions) => missions.flatMap((m, mi) => m.tabs.flatMap((t) => t.units).map((u, k) => ({
	id: u.id, address: u.address, name: u.name, tone: u.tone, code: u.code, lamp: LAMP_GLYPH[u.tone], focused: u.focused, gap: mi > 0 && k === 0,
})));

/** The agents the shown view lists, in its order, for `agent.next` and `agent.prev`. */
export const agentOrder = (missions, view) =>
	(view === "agents" ? roster(missions).flatMap((g) => g.units) : everyUnit(missions)).map((u) => u.address).filter(Boolean);
