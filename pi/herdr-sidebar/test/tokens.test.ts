// Contract tests for docs/token-contract.md: the pure builder, every rule and edge, with widths measured by the
// installed Pi TUI's visibleWidth.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { load, tui } from "./host.ts";

const { TOKEN_KEYS, BLANK, buildTokens, nextTokenChange, formatDuration, shortModel, wrapQuestion, cut, fitLeft, rightSlot, clean } = await load("src/tokens.ts");
const { readSnapshot } = await load("src/snapshot.ts");
const width = (text: string) => tui.visibleWidth(text);
const B = BLANK;
const NOW = 1_800_000_000_000;
const HOME = "/Users/someone";
const SESSION = "session-1";

// A full v1 snapshot as the collector publishes it, then read through the same validation the extension uses.
function raw(overrides: Record<string, unknown> = {}) {
	return {
		version: 1, sessionId: SESSION, seq: 1, launch: "/work/tatsu-cli", active: "/work/tatsu-cli",
		workspace: { path: "/work/tatsu-cli", git: { kind: "repository", active: { path: "/work/tatsu-cli", branch: "main", revision: "abc", dirty: false }, main: null, isWorktree: false }, github: { kind: "repository", name: "o/tatsu-cli", url: "https://github.com/o/tatsu-cli" } },
		pr: { kind: "none" },
		root: { working: false, lastSettledAt: null }, phase: null, question: null,
		model: { provider: "anthropic", id: "claude-opus-5-5" }, thinking: "high",
		context: { tokens: 1000, window: 200_000, reserve: 16_384, usedPercent: 67 },
		compactions: 18, units: 2, goal: null, usage: {},
		...overrides,
	};
}
const snap = (overrides: Record<string, unknown> = {}) => { const s = readSnapshot(raw(overrides), SESSION); assert.ok(s); return s; };
const build = (overrides: Record<string, unknown> = {}, herdr: string | null = "working", now = NOW) => buildTokens({ snapshot: snap(overrides), herdr, now, home: HOME });

test("the key list matches the canonical contract document", async () => {
	const doc = await readFile("docs/token-contract.md", "utf8");
	const line = /^Full key list: `([^`]+)` \((\d+) keys\)\.$/m.exec(doc);
	assert.ok(line, "docs/token-contract.md states the full key list");
	assert.deepEqual([...TOKEN_KEYS], line[1].split(" "));
	assert.equal(TOKEN_KEYS.length, Number(line[2]));
	assert.equal(TOKEN_KEYS.length, 27);
});

test("the spike's verified rows: state, fitted project and goal time; bar and CMP", () => {
	const t = build({ goal: { status: "active", usedSeconds: 9180 - 60, activeSince: NOW - 60_000 } });
	assert.equal(t.g1, `◐ WRK${B}`);
	assert.equal(t.proj, `tatsu-cli${B.repeat(6)}`);
	assert.equal(t.gt, `${B}2h33m`);
	assert.equal(t.bar, "━━━━─────── 33%");
	assert.equal(t.cmpx, "CMP×18");
	assert.equal(t.g2_au, "02AU");
	assert.equal(width(t.g1), 6);
	// Each row's text area: left 15 + ` · ` + right 6 = 24.
	assert.equal(width(t.proj) + 3 + width(t.gt), 24);
	assert.equal(width(t.bar) + 3 + width(t.cmpx), 24);
});

test("row 1 state codes from Herdr, QNS whenever a question is pending, and the project key per state", () => {
	const cases: [string | null, string, string][] = [
		["working", `◐ WRK${B}`, "proj"], ["blocked", `× BLK${B}`, "proj"], ["done", `✓ DNE${B}`, "proj"],
		["idle", `○ IDL${B}`, "proj_idle"], ["unknown", `· UNK${B}`, "proj_idle"], [null, `· UNK${B}`, "proj_idle"],
	];
	for (const [herdr, g1, key] of cases) {
		const t = build({}, herdr);
		assert.equal(t.g1, g1);
		assert.equal(t[key], "tatsu-cli");
		assert.equal(t[key === "proj" ? "proj_idle" : "proj"], undefined);
	}
	for (const herdr of ["idle", "blocked", "done", null]) {
		const t = build({ question: { text: "Which?", more: 0, since: NOW } }, herdr);
		assert.equal(t.g1, `× QNS${B}`);
		assert.equal(t.proj, "tatsu-cli");
	}
});

test("row 1 project: full basename, cut to 24 cells alone or fitted to 15 beside the goal", () => {
	assert.equal(build({ active: "/work/a-very-long-project-name-that-overflows" }).proj, `a-very-long-project-name…`.slice(0, 23) + "…");
	assert.equal(width(build({ active: "/work/a-very-long-project-name-that-overflows" }).proj), 24);
	const fitted = build({ active: "/work/a-very-long-project-name", goal: { status: "paused", usedSeconds: 30, activeSince: null } });
	assert.equal(fitted.proj, "a-very-long-pr…");
	assert.equal(width(fitted.proj), 15);
	assert.equal(build({ active: "/work/trailing/" }).proj, "trailing");
	assert.equal(build({ active: "/" }).proj, "/");
});

test("row 1 goal: active and paused keys, pi-goal's duration format, and no goal", () => {
	assert.equal(build({ goal: { status: "active", usedSeconds: 5, activeSince: NOW - 2_500 } }).gt, `${B.repeat(4)}7s`);
	assert.equal(build({ goal: { status: "active", usedSeconds: 59, activeSince: NOW - 1_000 } }).gt, `${B.repeat(4)}1m`);
	assert.equal(build({ goal: { status: "active", usedSeconds: 10, activeSince: null } }).gt, `${B.repeat(3)}10s`);
	const paused = build({ goal: { status: "paused", usedSeconds: 3600 * 2 + 60 * 5 + 59, activeSince: NOW } });
	assert.equal(paused.gt_off, `${B}2h5m`.padStart(6, B));
	assert.equal(paused.gt, undefined);
	assert.equal(build({ goal: { status: "budget_limited", usedSeconds: 61, activeSince: null } }).gt_off, `${B.repeat(4)}1m`);
	const none = build();
	assert.equal(none.gt, undefined); assert.equal(none.gt_off, undefined);
	assert.equal(none.proj, "tatsu-cli");
	// A future activeSince adds nothing; the clock never runs backwards.
	assert.equal(build({ goal: { status: "active", usedSeconds: 3, activeSince: NOW + 5_000 } }).gt, `${B.repeat(4)}3s`);
});

test("formatDuration is pi-goal's: floored seconds, minutes, then hours and minutes", () => {
	const cases: [number, string][] = [[0, "0s"], [0.9, "0s"], [59.99, "59s"], [60, "1m"], [3599, "59m"], [3600, "1h0m"], [9180, "2h33m"], [360_000, "100h0m"], [-5, "0s"], [Number.NaN, "0s"]];
	for (const [seconds, text] of cases) assert.equal(formatDuration(seconds), text);
});

test("row 2 units: two digits, capped at 99, unknown ??; the zero and unknown key", () => {
	const cases: [unknown, string, string][] = [[0, "g2_au0", "00AU"], [1, "g2_au", "01AU"], [42, "g2_au", "42AU"], [99, "g2_au", "99AU"], [150, "g2_au", "99AU"], [null, "g2_au0", "??AU"], [-1, "g2_au0", "??AU"], [1.5, "g2_au0", "??AU"]];
	for (const [units, key, text] of cases) {
		const t = build({ units });
		assert.equal(t[key], text, `units ${units}`);
		assert.equal(t[key === "g2_au" ? "g2_au0" : "g2_au"], undefined);
		assert.equal(width(text), 4);
	}
});

test("row 2 bar: lit cells, remaining percent, zones and unknown", () => {
	const cases: [number | null, string, string][] = [
		[0, "bar", "━━━━━━━━━━━ 99%"], [0.5, "bar", "━━━━━━━━━━━ 99%"], [1, "bar", "━━━━━━━━━━━ 99%"], [1.5, "bar", "━━━━━━━━━━━ 98%"],
		[67, "bar", "━━━━─────── 33%"], [70, "bar", "━━━━─────── 30%"], [70.01, "bar_warn", "━━━━─────── 29%"],
		[90, "bar_warn", "━━───────── 10%"], [90.5, "bar_crit", "━────────── 09%"], [99.5, "bar_crit", "─────────── 00%"],
		[100, "bar_crit", "─────────── 00%"], [130, "bar_crit", "─────────── 00%"], [-20, "bar", "━━━━━━━━━━━ 99%"],
		[null, "bar_unk", "─────────── --%"],
	];
	for (const [usedPercent, key, text] of cases) {
		const t = build({ context: { tokens: null, window: 1, reserve: null, usedPercent } });
		assert.equal(t[key], text, `used ${usedPercent}`);
		for (const other of ["bar", "bar_warn", "bar_crit", "bar_unk"]) if (other !== key) assert.equal(t[other], undefined);
		assert.equal(width(text), 15);
	}
	assert.equal(build({ context: null }).bar_unk, "─────────── --%");
	// lit = ceil(remaining × 11 / 100) at every remaining value.
	for (let used = 1; used <= 100; used++) {
		const t = build({ context: { tokens: 1, window: 1, reserve: null, usedPercent: used } });
		const text = t.bar ?? t.bar_warn ?? t.bar_crit, remaining = Math.min(99, 100 - used);
		assert.equal([...text].filter((c) => c === "━").length, Math.ceil((remaining * 11) / 100));
		assert.equal(text.slice(-3), `${String(remaining).padStart(2, "0")}%`);
	}
});

test("row 2 CMP: two digits, capped at 99, unknown ??", () => {
	const cases: [unknown, string][] = [[0, "CMP×00"], [2, "CMP×02"], [5, "CMP×05"], [99, "CMP×99"], [120, "CMP×99"], [null, "CMP×??"], ["3", "CMP×??"]];
	for (const [compactions, text] of cases) assert.equal(build({ compactions }).cmpx, text);
});

test("no snapshot: the state row and row 2's unknowns only, never zeros", () => {
	for (const herdr of ["working", null]) {
		const t = buildTokens({ snapshot: null, herdr, now: NOW, home: HOME });
		assert.deepEqual(t, { g1: herdr ? `◐ WRK${B}` : `· UNK${B}`, g2_au0: "??AU", bar_unk: "─────────── --%", cmpx: "CMP×??" });
	}
});

test("row 3: branch exactly when status-bar shows it, dirty star, otherwise the parent/current directory", () => {
	const repo = (active: object, github: object = { kind: "repository", name: "o/r", url: "u" }) => ({ workspace: { path: "/work/tatsu-cli", git: { kind: "repository", active, main: null, isWorktree: false }, github } });
	let t = build(repo({ branch: "feature/x", dirty: false }));
	assert.equal(t.g3, `ACT${B}`); assert.equal(t.br, "feature/x"); assert.equal(t.br_dirty, undefined); assert.equal(t.dir, undefined);
	t = build(repo({ branch: "feature/x", dirty: null }));
	assert.equal(t.br, "feature/x");
	t = build(repo({ branch: "feature/x", dirty: true }));
	assert.equal(t.br_dirty, "feature/x*"); assert.equal(t.br, undefined);
	// Detached HEAD, a GitHub repository not identified, no Git, or not inspected yet: the directory.
	for (const overrides of [repo({ branch: null, dirty: false }), repo({ branch: "main", dirty: false }, { kind: "unknown", reason: "x" }), repo({ branch: "main", dirty: false }, { kind: "none", reason: "x" }), { workspace: { path: "/w", git: { kind: "none" }, github: { kind: "none", reason: "" } } }, { workspace: null }]) {
		t = build(overrides);
		assert.equal(t.dir, "/work/tatsu-cli"); assert.equal(t.br, undefined); assert.equal(t.br_dirty, undefined);
		assert.equal(t.g3, `ACT${B}`);
	}
	// status-bar's display: home is ~, a direct child ~/name, a path near the root in full.
	const dir = (active: string) => build({ active, workspace: null }).dir;
	assert.equal(dir(HOME), "~");
	assert.equal(dir(`${HOME}/project`), "~/project");
	assert.equal(dir(`${HOME}/a/b`), "a/b");
	assert.equal(dir("/opt"), "/opt");
	assert.equal(dir("/opt/tool"), "/opt/tool");
	assert.equal(dir("/srv/a/b/c"), "b/c");
});

test("row 3 PR: open number and unavailable ghost in the right slot; absent otherwise", () => {
	let t = build({ pr: { kind: "open", number: 42, url: "u" } });
	assert.equal(t.prn, `${B.repeat(3)}#42`); assert.equal(t.prn_off, undefined);
	assert.equal(t.br, `main${B.repeat(11)}`);
	assert.equal(width(t.br) + 3 + width(t.prn), 24);
	t = build({ pr: { kind: "unavailable", reason: "gh missing" } });
	assert.equal(t.prn_off, `${B.repeat(4)}#?`); assert.equal(t.prn, undefined);
	for (const pr of [{ kind: "none" }, { kind: "not-applicable" }, null]) {
		t = build({ pr });
		assert.equal(t.prn, undefined); assert.equal(t.prn_off, undefined); assert.equal(t.br, "main");
	}
	assert.equal(build({ pr: { kind: "open", number: 1234567, url: "u" } }).prn, "#1234…");
	// A fitted dirty branch is cut before its star.
	t = build({ pr: { kind: "open", number: 7, url: "u" }, workspace: { path: "/w", git: { kind: "repository", active: { branch: "feature/herdr-sidebar", dirty: true } }, github: { kind: "repository" } } });
	assert.equal(t.br_dirty, "feature/herdr…*");
	assert.equal(width(t.br_dirty), 15);
	t = build({ workspace: { path: "/w", git: { kind: "repository", active: { branch: "feature/a-branch-name-longer-than-the-row", dirty: true } }, github: { kind: "repository" } } });
	assert.equal(t.br_dirty, "feature/a-branch-name-…*");
	assert.equal(width(t.br_dirty), 24);
});

test("row 4: short model and short thinking level", () => {
	const levels: [string | null, string][] = [["off", "opus-5.5/off"], ["minimal", "opus-5.5/mn"], ["low", "opus-5.5/lo"], ["medium", "opus-5.5/md"], ["high", "opus-5.5/hi"], ["xhigh", "opus-5.5/xh"], ["max", "opus-5.5/mx"], [null, "opus-5.5"], ["turbo", "opus-5.5/turbo"]];
	for (const [thinking, text] of levels) {
		const t = build({ thinking });
		assert.equal(t.mthink, text); assert.equal(t.g4, `MDL${B}`);
	}
	assert.equal(shortModel("claude-opus-5-5"), "opus-5.5");
	assert.equal(shortModel("claude-haiku-4-5"), "haiku-4.5");
	assert.equal(shortModel("claude-sonnet-4-20250514"), "sonnet-4-20250514");
	assert.equal(shortModel("gpt-5.1-codex"), "gpt-5.1-codex");
	assert.equal(shortModel("my-claude-model-1-2"), "my-claude-model-1.2");
	const t = build({ model: null });
	assert.equal(t.mthink, undefined); assert.equal(t.g4, undefined);
	assert.equal(build({ model: { provider: "p", id: "an-extremely-long-model-identifier-name" }, thinking: null }).mthink, "an-extremely-long-model…");
});

test("row 5 question: wrapped to 24 cells, (+N), three lines at most, continuation indent", () => {
	let t = build({ question: { text: "Proceed?", more: 0, since: NOW } });
	assert.equal(t.g5, `ASK${B}`); assert.equal(t.ask_l1, "Proceed?"); assert.equal(t.ask_l2, undefined); assert.equal(t.ask_l3, undefined);
	t = build({ question: { text: "Which branch should the release be cut from today?", more: 2, since: NOW } });
	assert.equal(t.ask_l1, "Which branch should the");
	assert.equal(t.ask_l2, `${B.repeat(7)}release be cut from`);
	assert.equal(t.ask_l3, `${B.repeat(7)}today? (+2)`);
	t = build({ question: { text: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen", more: 3, since: NOW } });
	assert.equal(t.ask_l1, "one two three four five");
	assert.equal(t.ask_l2, `${B.repeat(7)}six seven eight nine ten`);
	assert.equal(t.ask_l3, `${B.repeat(7)}eleven twelve thirteen …`);
	for (const key of ["ask_l1", "ask_l2", "ask_l3"]) assert.ok(width(t[key]) <= (key === "ask_l1" ? 24 : 31));
	assert.equal(width(t.ask_l3), 31);
	// A word wider than the line breaks by cells; controls are stripped and line breaks separate words.
	assert.deepEqual(wrapQuestion("abcdefghijklmnopqrstuvwxyz0123456789"), ["abcdefghijklmnopqrstuvwx", "yz0123456789"]);
	assert.deepEqual(wrapQuestion("first\nsecond\tthird \x1b[1mx\x07"), ["first second third [1mx"]);
	assert.deepEqual(wrapQuestion("漢字漢字漢字漢字漢字漢字漢字"), ["漢字漢字漢字漢字漢字漢字", "漢字"]);
	// The question replaces phase and finished rows.
	t = build({ question: { text: "Go?", more: 0, since: NOW }, root: { working: true, lastSettledAt: NOW - 1000 }, phase: { kind: "thinking", since: NOW } }, "done");
	assert.equal(t.ev_act, undefined); assert.equal(t.ph_age, undefined); assert.equal(t.ev_rdy_text, undefined);
	t = build({ question: { text: "", more: 4, since: NOW } });
	assert.equal(t.ask_l1, "(+4)");
});

test("row 5 phase: codes, targets and fallbacks, and the age in the right slot", () => {
	const working = (phase: object) => build({ root: { working: true, lastSettledAt: null }, phase });
	const tools: [string, string][] = [["read", "RD"], ["edit", "ED"], ["write", "WR"], ["bash", "SH"], ["web_search", "WB"], ["fetch_content", "WB"], ["subagent", "AG"], ["grep", "TL"]];
	for (const [tool, code] of tools) {
		const t = working({ kind: "tool", tool, target: null, since: NOW - 5_000 });
		assert.equal(t.g5, code.padEnd(4, B));
		assert.equal(t.ev_act, tool.padEnd(15, B));
		assert.equal(t.ph_age, `${B.repeat(4)}5s`);
	}
	for (const [kind, code] of [["waiting", "WAI"], ["thinking", "THK"], ["writing", "WRT"]]) {
		const t = working({ kind, since: NOW - 125_000 });
		assert.equal(t.g5, `${code}${B}`);
		assert.equal(t.ev_act, kind.padEnd(15, B));
		assert.equal(t.ph_age, `${B.repeat(4)}2m`);
	}
	let t = working({ kind: "tool", tool: "read", target: "src/extension.ts", since: NOW });
	assert.equal(t.ev_act, "src/extension.…");
	assert.equal(t.ph_age, `${B.repeat(4)}0s`);
	t = working({ kind: "tool", tool: "bash", target: "\x1b[2Jnpm\ttest", since: NOW });
	assert.equal(t.ev_act, `[2Jnpmtest${B.repeat(5)}`);
	t = working({ kind: "tool", tool: "edit", target: "\x07", since: NOW });
	assert.equal(t.ev_act, "edit".padEnd(15, B));
	// No phase while the root is not working, whatever the payload says.
	t = build({ root: { working: false, lastSettledAt: null }, phase: { kind: "thinking", since: NOW } });
	assert.equal(t.g5, undefined); assert.equal(t.ev_act, undefined);
});

test("row 5 done: RDY and finished, with the settle age when known", () => {
	let t = build({ root: { working: false, lastSettledAt: NOW - 61_000 } }, "done");
	assert.equal(t.g5, `RDY${B}`); assert.equal(t.ev_rdy_text, `finished${B.repeat(7)}`); assert.equal(t.ph_age, `${B.repeat(4)}1m`);
	t = build({ root: { working: false, lastSettledAt: null } }, "done");
	assert.equal(t.ev_rdy_text, "finished"); assert.equal(t.ph_age, undefined);
	for (const herdr of ["idle", "working", "blocked", "unknown", null]) {
		t = build({ root: { working: false, lastSettledAt: NOW } }, herdr);
		for (const key of ["g5", "ev_act", "ev_rdy_text", "ph_age", "ask_l1"]) assert.equal(t[key], undefined, `${herdr} ${key}`);
	}
});

test("fitting, cutting and the right slot measure terminal cells, keep graphemes and pad with U+2800", () => {
	assert.equal(fitLeft("abc"), `abc${B.repeat(12)}`);
	assert.equal(fitLeft("abcdefghijklmno"), "abcdefghijklmno");
	assert.equal(fitLeft("abcdefghijklmnop"), "abcdefghijklmn…");
	assert.equal(fitLeft("漢字漢字漢字漢字"), "漢字漢字漢字漢…");
	assert.equal(fitLeft("a漢字漢字漢字漢字"), `a漢字漢字漢字${B}…`);
	assert.equal(fitLeft("e\u0301".repeat(20)), `${"e\u0301".repeat(14)}…`);
	for (const text of ["", "x", "漢", "🙂🙂🙂🙂🙂🙂🙂🙂🙂", "a".repeat(40), "e\u0301".repeat(40)]) assert.equal(width(fitLeft(text)), 15, text);
	assert.equal(cut("a".repeat(24), 24), "a".repeat(24));
	assert.equal(cut("a".repeat(25), 24), `${"a".repeat(23)}…`);
	assert.equal(cut("漢".repeat(13), 24), `${"漢".repeat(11)}…`);
	assert.equal(rightSlot("#?"), `${B.repeat(4)}#?`);
	assert.equal(rightSlot("2h33m"), `${B}2h33m`);
	assert.equal(rightSlot("123h45m"), "123h4…");
	// Many combining marks in few cells stay under Herdr's 80-character cap.
	const zalgo = `a${"\u0301".repeat(200)}b`;
	assert.ok([...cut(zalgo, 24)].length <= 61);
	assert.ok([...fitLeft(zalgo)].length <= 80);
	assert.equal(clean("  \x1b[31mred\x07\u0085 "), "[31mred");
	assert.equal(clean(`${B}x${B}`), `${B}x${B}`);
});

test("every built value fits its cell budget and Herdr's limits", () => {
	const long = "x".repeat(200), wide = "漢".repeat(100);
	const snapshots = [
		raw({ active: `/w/${long}`, goal: { status: "active", usedSeconds: 1e7, activeSince: NOW }, question: { text: `${wide} ${long}`, more: 999, since: NOW } }),
		raw({ active: `/w/${wide}`, workspace: { git: { kind: "repository", active: { branch: wide, dirty: true } }, github: { kind: "repository" } }, pr: { kind: "open", number: 9_999_999 }, model: { provider: "p", id: long }, thinking: long, root: { working: true, lastSettledAt: 0 }, phase: { kind: "tool", tool: long, target: wide, since: 0 } }),
	];
	for (const data of snapshots) {
		const t = buildTokens({ snapshot: readSnapshot(data, SESSION), herdr: "done", now: NOW, home: HOME });
		for (const [key, value] of Object.entries(t) as [string, string][]) {
			assert.ok(TOKEN_KEYS.includes(key), key);
			assert.ok([...value].length <= 80, key);
			const cells = key === "g1" ? 6 : /^g\d/.test(key) ? 4 : key.startsWith("ask_l") && key !== "ask_l1" ? 31 : 24;
			assert.ok(width(value) <= cells, `${key} ${width(value)}`);
			assert.equal(value, value.trim(), key);
		}
	}
});

test("nextTokenChange: when a shown duration's text next changes", () => {
	const at = (overrides: Record<string, unknown>, herdr = "working", now = NOW) => nextTokenChange({ snapshot: snap(overrides), herdr, now, home: HOME });
	assert.equal(at({}), null);
	assert.equal(at({ goal: { status: "paused", usedSeconds: 10, activeSince: null } }), null);
	assert.equal(at({ goal: { status: "active", usedSeconds: 10, activeSince: NOW - 400 } }), NOW + 601);
	assert.equal(at({ goal: { status: "active", usedSeconds: 3599, activeSince: NOW } }), NOW + 1001);
	assert.equal(at({ goal: { status: "active", usedSeconds: 125, activeSince: NOW } }), NOW + 55_001);
	assert.equal(at({ goal: { status: "active", usedSeconds: 5, activeSince: NOW + 2000 } }), NOW + 3001);
	assert.equal(at({ root: { working: true, lastSettledAt: null }, phase: { kind: "thinking", since: NOW - 59_500 } }), NOW + 501);
	assert.equal(at({ root: { working: false, lastSettledAt: NOW - 3_600_000 } }, "done"), NOW + 60_001);
	assert.equal(at({ root: { working: false, lastSettledAt: NOW } }, "idle"), null);
	assert.equal(at({ question: { text: "q", more: 0, since: NOW }, root: { working: true, lastSettledAt: null }, phase: { kind: "thinking", since: NOW } }), null);
	// The earliest of the goal and the phase.
	assert.equal(at({ goal: { status: "active", usedSeconds: 600, activeSince: NOW }, root: { working: true, lastSettledAt: null }, phase: { kind: "writing", since: NOW - 100 } }), NOW + 901);
	// The text at that time has changed, and a millisecond before it has not.
	const overrides = { goal: { status: "active", usedSeconds: 59, activeSince: NOW - 300 } };
	const due = at(overrides)!;
	const text = (now: number) => buildTokens({ snapshot: snap(overrides), herdr: "working", now, home: HOME }).gt;
	assert.notEqual(text(due), text(NOW));
	assert.equal(text(due - 2), text(NOW));
});

test("readSnapshot accepts only v1 snapshots for this session and treats malformed fields as unknown", () => {
	assert.equal(readSnapshot(raw({ version: 2 }), SESSION), undefined);
	assert.equal(readSnapshot(raw({ sessionId: "other" }), SESSION), undefined);
	assert.equal(readSnapshot(raw({ seq: "1" }), SESSION), undefined);
	for (const value of [null, undefined, "x", []]) assert.equal(readSnapshot(value, SESSION), undefined);
	const s = readSnapshot(raw({ extra: true, units: "2", compactions: -1, context: { usedPercent: Infinity }, model: { id: 5 }, thinking: "", goal: { status: "active", usedSeconds: "1" }, question: { text: 3 }, pr: { kind: "open", number: 0 }, workspace: { git: {}, github: {} }, root: { working: true, lastSettledAt: "x" }, phase: { kind: "tool", since: 1 } }), SESSION);
	assert.deepEqual({ ...s, seq: undefined }, {
		sessionId: SESSION, seq: undefined, active: "/work/tatsu-cli", workspace: { git: { kind: "other" }, githubRepository: false }, pr: { kind: "unavailable" },
		lastSettledAt: null, phase: null, question: null, model: null, thinking: null, usedPercent: null, compactions: null, units: null, goal: null,
	});
	const bounded = readSnapshot(raw({ question: { text: "q".repeat(500), more: 1 } }), SESSION);
	assert.equal(bounded.question.text.length, 200);
	assert.equal(readSnapshot(raw({ goal: { status: "paused", usedSeconds: 5, activeSince: NOW } }), SESSION).goal.activeSince, null);
});
