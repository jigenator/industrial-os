// Checks the industrial-os mod's pure modules: the io.signals.v1 label, every agent state and row, unknowns, caps,
// access decay, the unseen-work-finished rule, space aggregation and quiet ages. The view (main.js) and live Herdr are
// not run here; CONTRIBUTING.md records `herdr-app check` and what is not verified.
import assert from "node:assert/strict";
import test from "node:test";
import { clean, contextBar, countText, daysText, displayPath, formatDuration, modelText, shortModel } from "../mods/industrial-os/format.js";
import { LABEL, parseSignals, terminalSignals } from "../mods/industrial-os/signals.js";
import { decayStage, displayState, nextFinishedAt, paneName, piBlock } from "../mods/industrial-os/agent.js";
import { QUIET_MS, paneState, parseAheadBehind, spacePlace, spaceRow, unitsSum } from "../mods/industrial-os/spaces.js";
import { buildSidebar, emptyMemory } from "../mods/industrial-os/model.js";

// Fixtures: a SignalsSnapshot v1 label value and Herdr app data in the shapes ~/.config/herdr-app/herdr.d.ts
// documents. Every value is invented.
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HOME = "/Users/someone";

function snapshot(overrides = {}) {
	return {
		version: 1, sessionId: "session-1", seq: 7,
		launch: `${HOME}/projects/industrial-os`, active: `${HOME}/projects/industrial-os`, visible: true,
		workspace: {
			path: `${HOME}/projects/industrial-os`,
			git: { kind: "repository", active: { path: `${HOME}/projects/industrial-os`, branch: "feat/sidebar", revision: "abc1234", dirty: false }, main: null, isWorktree: false },
			github: { kind: "repository", name: "someone/industrial-os", url: "https://github.com/someone/industrial-os" },
		},
		pr: { kind: "open", number: 42, url: "https://github.com/someone/industrial-os/pull/42" },
		root: { working: false, lastSettledAt: NOW - 90_000 },
		phase: null, question: null,
		model: { provider: "anthropic", id: "claude-opus-5-5" }, thinking: "high",
		context: { tokens: 120_000, window: 200_000, reserve: 16_384, usedPercent: 67.4 },
		compactions: 18, units: 0, goal: null, backgroundTasks: 0, flag: false,
		...overrides,
	};
}
const signals = (overrides) => parseSignals(JSON.stringify(snapshot(overrides)));
const labels = (value) => ({ "herdr.space": "s1", "herdr.tab": "tb1", [LABEL]: typeof value === "string" ? value : JSON.stringify(value) });
const program = (key = "pi", name = "Pi") => ({ key, name, icon: null, tint: false, tile: null, color: null, shell: false, agent: true });
const terminal = (address, extra = {}) => ({ address, state: "live", labels: labels(snapshot()), status: "idle", ...extra });
const agent = (address, extra = {}) => ({
	address, pane: `p-${address}`, space: "s1", space_name: "release", tab: "tb1", tab_index: 1, tab_name: "1",
	status: "idle", app: "pi", program: program(), title: "π - industrial-os", seq: 1, pinned: false, focused: false, ...extra,
});
const tab = (id, extra = {}) => ({ id, index: 1, name: "1", named: false, active: true, status: null, panes: 1, zoomed: false, settled: false, settled_at: null, changed_at: null, working_since: null, ...extra });
const space = (id, tabs, extra = {}) => ({ id, index: 1, name: id, named: false, folder: HOME, machine: null, branch: null, active: false, status: null, tabs, ...extra });
const pane = (id, tabId, extra = {}) => ({ pane: id, terminal: null, tab: tabId, title: "", cwd: HOME, branch: null, status: null, app: null, program: program("shell", "zsh"), focused: false, zoomed: false, movable: false, ...extra });

// One Pi block from a snapshot and Herdr's view of it.
function block(overrides = {}, input = {}) {
	return piBlock({ agent: agent("t1"), signals: signals(overrides), herdr: "idle", seen: false, spaceName: "release", tab: tab("tb1"), now: NOW, home: HOME, ...input });
}

test("formats: pi-goal durations, two-digit caps, unknown counts, days", () => {
	assert.deepEqual([0, 59.9, 60, 3599, 3600, 9180, 360_000].map(formatDuration), ["0s", "59s", "1m", "59m", "1h0m", "2h33m", "100h0m"]);
	assert.equal(formatDuration(-5), "0s");
	assert.equal(formatDuration(Number.NaN), "0s");
	assert.deepEqual([countText(0, "AU"), countText(2, "AU"), countText(99, "AU"), countText(140, "AU"), countText(null, "AU")], ["00AU", "02AU", "99AU", "99AU", "??AU"]);
	assert.deepEqual([daysText(2 * DAY + HOUR), daysText(150 * DAY)], ["2d", "99d"]);
	assert.equal(clean("  a\u001b[31mb\u202e\n "), "a[31mb");
});

test("model row: short model and thinking, verbatim outside the table, dated IDs kept", () => {
	assert.equal(shortModel("claude-opus-5-5"), "opus-5.5");
	assert.equal(shortModel("claude-sonnet-4-20250514"), "sonnet-4-20250514");
	assert.equal(modelText({ id: "claude-opus-5-5" }, "high"), "opus-5.5/hi");
	assert.deepEqual(["off", "minimal", "low", "medium", "xhigh", "max", "turbo"].map((level) => modelText({ id: "gpt-6" }, level)),
		["gpt-6/off", "gpt-6/mn", "gpt-6/lo", "gpt-6/md", "gpt-6/xh", "gpt-6/mx", "gpt-6/turbo"]);
	assert.equal(modelText({ id: "gpt-6" }, null), "gpt-6");
	assert.equal(modelText(null, "high"), null);
});

test("Active directory: status-bar's ~, ~/child, root-near and parent/current forms", () => {
	assert.equal(displayPath(HOME, HOME), "~");
	assert.equal(displayPath(`${HOME}/notes`, HOME), "~/notes");
	assert.equal(displayPath(`${HOME}/projects/industrial-os`, HOME), "projects/industrial-os");
	assert.equal(displayPath("/work/tatsu-cli", HOME), "/work/tatsu-cli");
	assert.equal(displayPath("/a/b/c/d/", HOME), "c/d");
	assert.equal(displayPath(`${HOME}/notes`, null), "someone/notes");
	assert.equal(displayPath("/", HOME), "/");
});

test("context bar: lit cells, 70% warning, 90% critical, 99% cap, unknown", () => {
	assert.deepEqual(contextBar(0), { text: "─────────── 00%", zone: "ok" });
	assert.deepEqual(contextBar(67.4), { text: "━━━━━━━━─── 67%", zone: "ok" });
	assert.deepEqual(contextBar(70), { text: "━━━━━━━━─── 70%", zone: "warn" });
	assert.equal(contextBar(89.9).zone, "warn");
	assert.deepEqual(contextBar(90), { text: "━━━━━━━━━━─ 90%", zone: "crit" });
	assert.deepEqual(contextBar(100), { text: "━━━━━━━━━━━ 99%", zone: "crit" });
	assert.deepEqual(contextBar(null), { text: "─────────── --%", zone: "unknown" });
});

test("label: version 1 JSON only; malformed fields become unknown, never zero; unknown fields ignored", () => {
	assert.equal(parseSignals(undefined), null);
	assert.equal(parseSignals(""), null);
	assert.equal(parseSignals("{not json"), null);
	assert.equal(parseSignals("[1]"), null);
	assert.equal(parseSignals(JSON.stringify(snapshot({ version: 2 }))), null);
	const full = signals({ extra: { anything: true }, usage: { installed: true, providers: [] } });
	assert.equal(full.units, 0);
	assert.equal(full.backgroundTasks, 0);
	assert.equal("extra" in full, false);
	const bad = signals({ units: -1, compactions: 1.5, backgroundTasks: "3", flag: "yes", context: { usedPercent: "67" }, model: { id: 5 }, workspace: "x", pr: { kind: "open", number: 0 }, goal: { status: "active" } });
	assert.deepEqual([bad.units, bad.compactions, bad.backgroundTasks, bad.flag, bad.usedPercent, bad.model, bad.workspace, bad.goal], [null, null, null, false, null, null, null, null]);
	assert.deepEqual(bad.pr, { kind: "unavailable" });
	const missing = parseSignals(JSON.stringify({ version: 1 }));
	assert.deepEqual([missing.units, missing.backgroundTasks, missing.compactions, missing.usedPercent, missing.flag, missing.active], [null, null, null, null, false, null]);
	assert.equal(signals({ question: { text: "x".repeat(300), more: 2, since: NOW } }).question.text.length, 200);
	// A phase only counts while the root agent works.
	assert.equal(signals({ phase: { kind: "thinking", since: NOW } }).phase, null);
	assert.deepEqual(signals({ root: { working: true, lastSettledAt: null }, phase: { kind: "tool", tool: "bash", target: "ls", since: NOW } }).phase, { kind: "tool", since: NOW });
});

test("label: only a live terminal whose agent app is pi counts; any other label is stale", () => {
	assert.ok(terminalSignals(terminal("t1"), "pi"));
	assert.equal(terminalSignals(terminal("t1", { state: "finished" }), "pi"), null);
	assert.equal(terminalSignals(terminal("t1"), "claude-code"), null);
	assert.equal(terminalSignals(terminal("t1"), null), null);
	assert.equal(terminalSignals(terminal("t1", { labels: {} }), "pi"), null);
});

test("state precedence: QNS > BLK > WRK > SUB > RUN > DNE > IDL / UNK", () => {
	const s = (overrides) => signals(overrides);
	const question = { question: { text: "Ship it?", more: 0, since: NOW } };
	assert.equal(displayState({ signals: s({ ...question, units: 3, backgroundTasks: 2 }), herdr: "blocked" }), "question");
	assert.equal(displayState({ signals: s({ units: 3 }), herdr: "blocked" }), "blocked");
	assert.equal(displayState({ signals: s({ units: 3 }), herdr: "working" }), "working");
	for (const herdr of ["idle", "done", "unknown"]) {
		assert.equal(displayState({ signals: s({ units: 1, backgroundTasks: 1 }), herdr }), "subagents");
		assert.equal(displayState({ signals: s({ units: 0, backgroundTasks: 1 }), herdr }), "background");
	}
	// Unknown background state never selects RUN.
	assert.equal(displayState({ signals: s({ backgroundTasks: null }), herdr: "idle" }), "idle");
	assert.equal(displayState({ signals: s({}), herdr: "done" }), "done");
	assert.equal(displayState({ signals: s({}), herdr: "idle", finishedAt: NOW }), "done");
	assert.equal(displayState({ signals: s({}), herdr: "idle" }), "idle");
	assert.equal(displayState({ signals: s({}), herdr: "unknown" }), "unknown");
	const codes = [
		[{ question: question.question }, "blocked", "× QNS"], [{}, "blocked", "× BLK"], [{}, "working", "◐ WRK"],
		[{ units: 2 }, "idle", "◐ SUB"], [{ backgroundTasks: 2 }, "idle", "◐ RUN"], [{}, "done", "✓ DNE"],
		[{}, "idle", "○ IDL"], [{}, "unknown", "· UNK"],
	];
	for (const [overrides, herdr, code] of codes) {
		const { state } = block(overrides, { herdr }).block;
		assert.equal(`${state.icon} ${state.code}`, code);
	}
});

test("unseen work finished: a known drop to zero while not working and not seen; cleared by seeing or work", () => {
	const base = { herdr: "idle", seen: false, finishedAt: null, now: NOW, previousBackground: 0, background: 0 };
	assert.equal(nextFinishedAt({ ...base, previousUnits: 2, units: 0 }), NOW);
	assert.equal(nextFinishedAt({ ...base, previousUnits: 0, units: 0, previousBackground: 1, background: 0 }), NOW);
	assert.equal(nextFinishedAt({ ...base, previousUnits: 2, units: 0, herdr: "done" }), NOW);
	assert.equal(nextFinishedAt({ ...base, previousUnits: 2, units: 0, seen: true }), null);
	assert.equal(nextFinishedAt({ ...base, previousUnits: 2, units: 0, herdr: "working" }), null);
	// Unknown is never zero: neither a drop from unknown nor to unknown.
	assert.equal(nextFinishedAt({ ...base, previousUnits: null, units: 0 }), null);
	assert.equal(nextFinishedAt({ ...base, previousUnits: 2, units: null }), null);
	// Ongoing work in either source prevents it; once set it holds until cleared.
	assert.equal(nextFinishedAt({ ...base, previousUnits: 2, units: 0, background: 1 }), null);
	assert.equal(nextFinishedAt({ ...base, previousUnits: 0, units: 0, finishedAt: NOW - 5000 }), NOW - 5000);
	assert.equal(nextFinishedAt({ ...base, units: 1, finishedAt: NOW - 5000 }), null);

	const finished = block({ units: 0 }, { memory: { units: 3, background: 0, finishedAt: null, lastAccessAt: NOW } });
	assert.equal(finished.block.state.code, "DNE");
	assert.deepEqual(finished.block.row5, { kind: "rdy", label: "RDY", text: "finished", age: "0s" });
	assert.equal(finished.memory.finishedAt, NOW);
	const later = block({ units: 0 }, { now: NOW + 125_000, memory: finished.memory });
	assert.equal(later.block.row5.age, "2m");
	assert.equal(block({ units: 0 }, { seen: true, memory: finished.memory }).block.state.code, "IDL");
});

test("access decay: d0 under 1 h, d1, d2 from 4 h, d3 from 1 d; seen and WRK/SUB/RUN refresh, QNS/BLK do not", () => {
	assert.deepEqual([0, HOUR - 1, HOUR, 4 * HOUR, DAY, 9 * DAY].map((age) => decayStage(NOW - age, NOW)), [0, 0, 1, 2, 3, 3]);
	assert.equal(decayStage(NOW + HOUR, NOW), 0);
	const old = { units: 0, background: 0, finishedAt: null, lastAccessAt: NOW - 5 * HOUR };
	assert.equal(block({}, { memory: old }).block.decay, 2);
	assert.equal(block({}, { memory: old, seen: true }).block.decay, 0);
	assert.equal(block({}, { memory: old, herdr: "working" }).block.decay, 0);
	assert.equal(block({ units: 1 }, { memory: { ...old, units: 1 } }).block.decay, 0);
	assert.equal(block({ backgroundTasks: 1 }, { memory: { ...old, background: 1 } }).block.decay, 0);
	assert.equal(block({}, { memory: old, herdr: "blocked" }).block.decay, 2);
	assert.equal(block({}, { memory: old, herdr: "unknown" }).block.decay, 0);
	// No memory yet: starts fresh, never guessed old.
	assert.equal(block({}).block.decay, 0);
	// The next decay boundary is scheduled.
	assert.equal(block({}, { memory: old }).nextChangeAt, NOW - 5 * HOUR + DAY);
});

test("rows 1–4: space, flag, live goal, units, context zones, compactions, ACT and MDL", () => {
	const { block: b } = block({ flag: true, goal: { status: "active", usedSeconds: 600, activeSince: NOW - 3_000_000 }, units: 2 }, { herdr: "working" });
	assert.equal(b.space, "release");
	assert.equal(b.flag, true);
	assert.deepEqual(b.goal, { text: "1h0m", active: true });
	assert.deepEqual(b.units, { text: "02AU", active: true });
	assert.deepEqual(b.context, { text: "━━━━━━━━─── 67%", zone: "ok" });
	assert.equal(b.compactions, "CMP×18");
	assert.deepEqual(b.act, { kind: "branch", text: "feat/sidebar", dirty: false });
	assert.deepEqual(b.pr, { text: "#42", known: true });
	assert.equal(b.model, "opus-5.5/hi");
	// A paused goal does not run; the SPACE falls back to Active's basename only when Herdr's name is unknown.
	const paused = block({ goal: { status: "paused", usedSeconds: 125, activeSince: null } }, { spaceName: "" }).block;
	assert.deepEqual(paused.goal, { text: "2m", active: false });
	assert.equal(paused.space, "industrial-os");
	// Idle and unknown states show the bar's shape in the idle tone; the zone still shows elsewhere.
	assert.equal(block({ context: { usedPercent: 95 } }).block.context.zone, "idle");
	assert.equal(block({ context: { usedPercent: 95 } }, { herdr: "done" }).block.context.zone, "crit");
	assert.equal(block({ context: { usedPercent: 75 } }, { herdr: "working" }).block.context.zone, "warn");
	assert.equal(block({ context: null }, { herdr: "working" }).block.context.zone, "unknown");
	// Unknown and capped counts.
	const unknown = block({ units: null, compactions: null }).block;
	assert.deepEqual([unknown.units.text, unknown.compactions], ["??AU", "CMP×??"]);
	const capped = block({ units: 140, compactions: 300 }, { herdr: "working" }).block;
	assert.deepEqual([capped.units.text, capped.compactions], ["99AU", "CMP×99"]);
});

test("ACT: dirty branch keeps its star; the directory without Git, GitHub or a branch; #? when PR lookup fails", () => {
	const ws = (git, github = { kind: "repository", name: "a/b", url: "u" }) => ({ path: "/p", git, github });
	const repo = (branch, dirty) => ({ kind: "repository", active: { path: "/p", branch, revision: null, dirty }, main: null, isWorktree: false });
	assert.deepEqual(block({ workspace: ws(repo("main", true)) }).block.act, { kind: "branch", text: "main*", dirty: true });
	assert.deepEqual(block({ workspace: ws(repo("main", null)) }).block.act, { kind: "branch", text: "main", dirty: false });
	const dir = { kind: "dir", text: "projects/industrial-os", dirty: false };
	assert.deepEqual(block({ workspace: ws(repo(null, false)) }).block.act, dir);
	assert.deepEqual(block({ workspace: ws(repo("main", false), { kind: "none", reason: "no remote" }) }).block.act, dir);
	assert.deepEqual(block({ workspace: ws({ kind: "none" }) }).block.act, dir);
	assert.deepEqual(block({ workspace: null }).block.act, dir);
	assert.equal(block({ workspace: null, active: null }).block.act, null);
	assert.deepEqual(block({ pr: { kind: "unavailable", reason: "rate limited" } }).block.pr, { text: "#?", known: false });
	for (const pr of [{ kind: "none" }, { kind: "not-applicable" }, null]) assert.equal(block({ pr }).block.pr, null);
	assert.equal(block({ model: null }).block.model, null);
});

test("row 5: ASK with +N wins, then RDY finished, then the pane name with the working phase's age", () => {
	const ask = block({ question: { text: "Deploy\nnow?", more: 2, since: NOW } }, { herdr: "done" }).block.row5;
	assert.deepEqual(ask, { kind: "ask", label: "ASK", text: "Deploy now? (+2)", age: null });
	assert.deepEqual(block({}, { herdr: "done" }).block.row5, { kind: "rdy", label: "RDY", text: "finished", age: "1m" });
	assert.deepEqual(block({ root: { working: false, lastSettledAt: null } }, { herdr: "done" }).block.row5.age, null);
	const working = block({ root: { working: true, lastSettledAt: null }, phase: { kind: "writing", since: NOW - 12_000 } }, { herdr: "working" });
	assert.deepEqual(working.block.row5, { kind: "pne", label: "PNE", text: "π - industrial-os", age: "12s" });
	assert.equal(working.nextChangeAt, NOW + 1001);
	assert.deepEqual(block({}).block.row5, { kind: "pne", label: "PNE", text: "π - industrial-os", age: null });
	// A named tab names the pane; a title that says nothing and an automatic tab number do not.
	assert.equal(block({}, { tab: tab("tb1", { name: "fix login", named: true }) }).block.row5.text, "fix login");
	assert.equal(block({}, { agent: agent("t1", { title: "Pi" }) }).block.row5, null);
});

test("pane name: the shipped agents list's title rule, without automatic tab numbers", () => {
	const pi = program();
	assert.equal(paneName({ tab: tab("a", { name: "fix login", named: true }), title: "⠋ busy", program: pi }), "fix login");
	assert.equal(paneName({ tab: tab("a", { name: "Pi", named: true }), title: "⠋ Updating docs", program: pi }), "Updating docs");
	assert.equal(paneName({ tab: tab("a"), title: "~/projects/x", program: pi }), null);
	assert.equal(paneName({ tab: tab("a"), title: "someone@host: ~", program: pi }), null);
	assert.equal(paneName({ tab: tab("a"), title: "pi", program: pi }), null);
	// Several agents in one tab: each uses its own title.
	assert.equal(paneName({ tab: tab("a", { name: "shared", named: true }), title: "Reviewing", program: pi, sharedTab: true }), "Reviewing");
});

test("spaces: SUB and RUN count as working; Herdr's order; no panes is unknown", () => {
	const piStates = new Map([["t1", "subagents"], ["t2", "background"]]);
	assert.equal(paneState({ terminal: "t1", status: "idle" }, piStates), "working");
	assert.equal(paneState({ terminal: "t2", status: "done" }, piStates), "working");
	assert.equal(paneState({ terminal: "t1", status: "blocked" }, piStates), "blocked");
	assert.equal(paneState({ terminal: "t3", status: null }, piStates), "unknown");
	const row = (states, extra = {}) => spaceRow({
		space: space("s1", [tab("tb1")], { active: true }),
		panes: states.map((status, i) => pane(`p${i}`, "tb1", { terminal: `x${i}`, status, app: status ? "claude-code" : null })),
		piStates: new Map(), signalsByTerminal: new Map(), git: null, memory: undefined, now: NOW, ...extra,
	}).row;
	assert.equal(row([]).icon, "·");
	assert.equal(row([null]).icon, "·");
	assert.equal(row(["idle", null]).icon, "○");
	assert.equal(row(["idle", "working"]).icon, "◐");
	assert.equal(row(["working", "done"]).icon, "✓");
	assert.equal(row(["done", "blocked", "working"]).icon, "×");
	const r = row(["idle", "working", null]);
	assert.deepEqual([r.panes, r.agents.text, r.units.text], ["03PN", "02AG", "00AU"]);
	assert.equal(row(Array(120).fill(null)).panes, "99PN");
});

test("spaces: Pi units sum; no Pi is 00AU; a Pi without known units makes ??AU; other agents do not count", () => {
	const pis = [{ terminal: "t1" }, { terminal: "t2" }];
	assert.equal(unitsSum([], new Map()), 0);
	assert.equal(unitsSum(pis, new Map([["t1", { units: 2 }], ["t2", { units: 5 }]])), 7);
	assert.equal(unitsSum(pis, new Map([["t1", { units: 2 }], ["t2", { units: null }]])), null);
	assert.equal(unitsSum(pis, new Map([["t1", { units: 2 }]])), null);
	const built = spaceRow({
		space: space("s1", [tab("tb1")], { active: true }),
		panes: [pane("p1", "tb1", { terminal: "t1", status: "idle", app: "pi" }), pane("p2", "tb1", { terminal: "t2", status: "working", app: "claude-code" })],
		piStates: new Map(), signalsByTerminal: new Map([["t1", { units: 120 }]]), git: { ahead: 2, behind: 7 }, memory: undefined, now: NOW,
	}).row;
	assert.deepEqual(built.units, { text: "99AU", active: true });
	assert.deepEqual([built.ahead, built.behind], [2, 7]);
});

test("spaces: quiet after 48 h without activity while not shown, with days; activity rules", () => {
	const quietSpace = (memory, extra = {}) => spaceRow({
		space: space("s1", [tab("tb1", { active: false })], { active: false }), panes: [pane("p1", "tb1", { terminal: "t9", status: "idle", app: "codex" })],
		piStates: new Map(), signalsByTerminal: new Map(), git: { ahead: 0, behind: 3 }, memory, now: NOW, ...extra,
	});
	const idle = { at: NOW - QUIET_MS - 3 * DAY, panes: 1, agents: 1 };
	const quiet = quietSpace(idle);
	assert.equal(quiet.row.quiet, "5d");
	assert.equal(quiet.row.agents, null);
	assert.equal(quiet.row.units, null);
	assert.equal(quiet.row.behind, 3);
	assert.equal(quiet.nextChangeAt, idle.at + 6 * DAY);
	// First seen: no inferred old age.
	assert.equal(quietSpace(undefined).row.quiet, null);
	assert.equal(quietSpace({ at: NOW - QUIET_MS + 1, panes: 1, agents: 1 }).nextChangeAt, NOW + 1);
	// Shown, a pane change, an agent change or work count as activity.
	assert.equal(spaceRow({ ...quietArgs(), space: space("s1", [tab("tb1")], { active: true }), memory: idle }).row.quiet, null);
	assert.equal(quietSpace({ ...idle, panes: 2 }).row.quiet, null);
	assert.equal(quietSpace({ ...idle, agents: 0 }).row.quiet, null);
	assert.equal(quietSpace(idle, { panes: [pane("p1", "tb1", { terminal: "t9", status: "working", app: "codex" })] }).row.quiet, null);
	assert.equal(quietSpace(idle, { piStates: new Map([["t9", "background"]]) }).row.quiet, null);
	// A clock step backwards clamps to now.
	assert.equal(quietSpace({ ...idle, at: NOW + DAY }).memory.at, NOW);
	function quietArgs() {
		return { panes: [], piStates: new Map(), signalsByTerminal: new Map(), git: null, now: NOW };
	}
});

test("git: ahead/behind parsing and a space's place", () => {
	assert.deepEqual(parseAheadBehind("2\t7\n"), { ahead: 2, behind: 7 });
	assert.equal(parseAheadBehind("fatal: no upstream"), null);
	assert.equal(parseAheadBehind(undefined), null);
	const s = space("s1", [tab("tb1")], { folder: "/made/here" });
	assert.equal(spacePlace(s, [pane("p0", "other", { cwd: "/elsewhere" }), pane("p1", "tb1", { cwd: "/now/here" })]), "/now/here");
	assert.equal(spacePlace(s, []), "/made/here");
});

// A world: two spaces; a working Pi, a Pi without a label, a Claude agent, a stale label on a non-Pi terminal.
function world(overrides = {}) {
	const spaces = [
		space("s1", [tab("tb1", { active: true }), tab("tb2", { active: false, index: 2 })], { name: "release", active: true }),
		space("s2", [tab("tb3", { active: true })], { name: "tooling" }),
	];
	const agents = [
		agent("t1", { status: "working", tab: "tb1" }),
		agent("t2", { status: "idle", tab: "tb2", title: "π - notes" }),
		agent("t3", { status: "blocked", space: "s2", space_name: "tooling", tab: "tb3", app: "claude-code", program: program("claude", "Claude Code"), title: "Fixing tests" }),
	];
	const terminals = [
		terminal("t1", { labels: labels(snapshot({ units: 2, root: { working: true, lastSettledAt: null }, phase: { kind: "thinking", since: NOW - 4000 } })) }),
		terminal("t2", { labels: { "herdr.space": "s1" } }),
		terminal("t3", { labels: labels(snapshot({ units: 9 })) }),
	];
	const panes = [
		pane("p-t1", "tb1", { terminal: "t1", status: "working", app: "pi" }),
		pane("p-shell", "tb1", { terminal: "t4" }),
		pane("p-t2", "tb2", { terminal: "t2", status: "idle", app: "pi" }),
		pane("p-t3", "tb3", { terminal: "t3", status: "blocked", app: "claude-code" }),
	];
	return { spaces, agents, terminals, panes, git: { s1: { ahead: 1, behind: 0 } }, home: HOME, now: NOW, memory: emptyMemory(), ...overrides };
}

test("sidebar: Pi blocks for valid labels, one line otherwise, Herdr's order, stale labels ignored", () => {
	const result = buildSidebar(world());
	assert.deepEqual(result.order, ["t1", "t2", "t3"]);
	assert.deepEqual(result.agents.map((b) => b.kind), ["pi", "other", "other"]);
	const [pi, unlabeled, claude] = result.agents;
	assert.equal(`${pi.state.icon} ${pi.state.code}`, "◐ WRK");
	assert.deepEqual(pi.row5, { kind: "pne", label: "PNE", text: "π - industrial-os", age: "4s" });
	assert.deepEqual(unlabeled, { kind: "other", address: "t2", pane: "p-t2", status: { word: "idle", icon: "○" }, space: "release", title: "π - notes" });
	assert.deepEqual(claude.status, { word: "blocked", icon: "×" });
	assert.equal(claude.title, "Fixing tests");
	const [release, tooling] = result.spaces;
	// The unlabeled Pi makes the release AU unknown; the Claude terminal's stale label adds nothing to tooling.
	assert.deepEqual([release.icon, release.panes, release.agents.text, release.units.text, release.ahead], ["◐", "03PN", "02AG", "??AU", 1]);
	assert.deepEqual([tooling.icon, tooling.panes, tooling.agents.text, tooling.units.text], ["×", "01PN", "01AG", "00AU"]);
	assert.equal(result.nextChangeAt, NOW + 1001);
});

test("sidebar: a Pi SUB lifts its space to working; another machine's agent gets no home folder", () => {
	const w = world();
	w.agents[0] = agent("t1", { status: "idle", tab: "tb1" });
	w.panes[0] = pane("p-t1", "tb1", { terminal: "t1", status: "idle", app: "pi" });
	w.terminals[1] = terminal("t2");
	const result = buildSidebar(w);
	assert.equal(result.agents[0].state.code, "SUB");
	assert.equal(result.spaces[0].icon, "◐");
	assert.equal(result.spaces[0].units.text, "02AU");
	const remote = buildSidebar({
		...w,
		agents: [agent("vps/t5", { tab: "tb1" })],
		terminals: [terminal("vps/t5", { labels: labels(snapshot({ workspace: null, active: `${HOME}/notes` })) })],
	});
	assert.equal(remote.agents[0].act.text, "someone/notes");
});

test("sidebar memory: the finished rule survives a re-render; timestamps alone save once a minute; absent entries kept 30 days", () => {
	const w = world();
	w.agents[0] = agent("t1", { status: "idle", tab: "tb2" });
	const first = buildSidebar(w);
	assert.equal(first.dirty, true);
	w.terminals[0] = terminal("t1", { labels: labels(snapshot({ units: 0 })) });
	const second = buildSidebar({ ...w, now: NOW + 5000, memory: first.memory });
	assert.equal(second.agents[0].state.code, "DNE");
	assert.equal(second.dirty, true);
	const third = buildSidebar({ ...w, now: NOW + 10_000, memory: second.memory });
	assert.equal(third.agents[0].state.code, "DNE");
	assert.equal(third.dirty, false);
	// Seeing it clears it.
	w.spaces[0].tabs[1].active = true;
	assert.equal(buildSidebar({ ...w, now: NOW + 15_000, memory: third.memory }).agents[0].state.code, "IDL");
	// Absent terminals and spaces are remembered for 30 days, then dropped.
	const gone = buildSidebar({ ...w, agents: [], spaces: [], panes: [], now: NOW + 20 * DAY, memory: third.memory });
	assert.ok(gone.memory.agents.t1 && gone.memory.spaces.s1);
	const forgotten = buildSidebar({ ...w, agents: [], spaces: [], panes: [], now: NOW + 31 * DAY, memory: gone.memory });
	assert.deepEqual(forgotten.memory, emptyMemory());
	assert.equal(forgotten.dirty, true);
});

test("sidebar: a label lost between running and zero loses that completion", () => {
	const w = world();
	w.agents[0] = agent("t1", { status: "idle", tab: "tb2" });
	w.terminals[0] = terminal("t1", { labels: labels(snapshot({ units: 2 })) });
	const running = buildSidebar(w);
	w.terminals[0] = terminal("t1", { labels: {} });
	const lost = buildSidebar({ ...w, now: NOW + 1000, memory: running.memory });
	assert.equal(lost.agents[0].kind, "other");
	w.terminals[0] = terminal("t1", { labels: labels(snapshot({ units: 0 })) });
	assert.equal(buildSidebar({ ...w, now: NOW + 2000, memory: lost.memory }).agents[0].state.code, "IDL");
});
