// Checks the droid-plate pane header (the industrial-os mod's `part: "plate"`, in mods/industrial-os/plate/): its
// pure rules (unit, strip, lighting, the signals label, the header's rows and the motion timeline), its folder, and
// that the mod's ds/ folder is exactly the design-system files it imports.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { addressSeed, agentCode, clockText, commandText, emptyMemory, homePath, isAgent, isPi, lightingOf, observe, paneModel, PI_HINTS, presession, shellCode, STARTING_GRACE_MS, timeOfDay } from "../mods/industrial-os/plate/model.js";
import { LABEL, parseSignals, terminalSignals } from "../mods/industrial-os/signals.js";
import { BLOCK_WIDTH, cellPlan, cellWidthOf, coarsen, columnsOf, composeHeader, PIECE_BUDGET, DRAW_LIMIT, GRIP_PX, KEY_ACTIONS, MIN_WIDTH, PEAK_CLEAR, peakFromOf, ROW_HEIGHTS, ROW_TOPS, ROWS, scanPolygon } from "../mods/industrial-os/plate/plate.js";
import { glyphShape } from "../mods/industrial-os/ds/foundation/glyph-shapes.mjs";
import { advance, BANKS, emptyTimeline, frame, frameStep, ghostDelay, GHOST_EVERY, headerDurations, LAYER_LIMIT, layerBanks, needsPrime, nextWake, playingUntil, prime, PRIME_MS, REVEAL, ROLL, settle, STANDBY_IN, STANDBY_OUT, wordmarkGlyphs } from "../mods/industrial-os/plate/motion.js";
import { LabelPublisher, PLATE_LABEL, RETRY_LIMIT, WRITE_TIMEOUT_MS } from "../mods/industrial-os/plate/labels.js";
import { Scheduler } from "../mods/industrial-os/plate/clock.js";
import { check, closure, modEntries, relativeImports } from "../scripts/sync-design-system.mjs";
// The mod's own copy: the package name resolves through the root install, which may link another checkout.
import { unitPlate } from "../mods/industrial-os/ds/elements/unit-plate/unit-plate.mjs";

const MOD = new URL("../mods/industrial-os/plate/", import.meta.url);
const MOD_ROOT = new URL("../mods/industrial-os/", import.meta.url);
const SESSION = "01a1e81c-27f3-70f3-b278-150c4f01fa03";
const NOW = 1_794_909_494_000;
const text = (line) => line.map((s) => s.text).join("");
// A fake clock for the scheduler: every(ms, fn) and after(ms, fn) as cx.timer gives them, run by run(until).
function fakeClock(start) {
	let now = start, seq = 0;
	const timers = new Map();
	const add = (ms, fn, repeat) => { const id = seq++; timers.set(id, { at: now + ms, ms, fn, repeat }); return { cancel: () => timers.delete(id) }; };
	return {
		now: () => now,
		set: (t) => { now = t; },
		every: (ms, fn) => add(ms, fn, true),
		after: (ms, fn) => add(ms, fn, false),
		pending: () => timers.size,
		run(until) {
			for (let guard = 0; guard < 10_000; guard++) {
				let next = null;
				for (const [id, timer] of timers) if (timer.at <= until && (!next || timer.at < next[1].at)) next = [id, timer];
				if (!next) break;
				const [id, timer] = next;
				now = timer.at;
				if (timer.repeat) timer.at += timer.ms; else timers.delete(id);
				timer.fn({});
			}
			now = until;
		},
	};
}

const pane = (over = {}) => ({
	pane: "p1", terminal: "t3h", tab: "tb", title: "zsh", cwd: "/Users/u/projects/lunalee", branch: "main",
	status: null, app: null, program: { key: "shell", name: "zsh", shell: true, agent: false }, focused: true, zoomed: false, movable: true, ...over,
});
const PI = { app: "pi", status: "idle", program: { key: "pi", name: "Pi", shell: false, agent: true } };
const term = (labels = {}) => ({ address: "t3h", argv: ["/bin/zsh", "-l"], cols: 99, state: "live", labels });
const signals = (over = {}) => parseSignals(JSON.stringify({ version: 1, sessionId: SESSION, root: { working: false, lastSettledAt: null }, ...over }));
const model = (p, extra = {}) => paneModel({ pane: p, terminal: term(), signals: null, memory: observe(emptyMemory(), p, NOW - 10_000), now: NOW, home: "/Users/u", ...extra });

test("units: DRD from the session, AGT from the app, TERM from the shell; unknown degrades, never guesses", () => {
	const droid = model(pane(PI), { signals: signals() });
	assert.equal(droid.kind, "droid");
	assert.deepEqual(droid.plate, { unit: "DRD-FA03", serial: "150C-4F01", seed: 0x4f01fa03 | 0 });
	assert.deepEqual(droid.options, { barcode: true, peak: true });
	// No label after the grace: the pre-session plate, its barcode seeded from the terminal address.
	const unknown = model(pane(PI), { memory: { ...emptyMemory(), pi: true, piSince: NOW - STARTING_GRACE_MS } });
	assert.deepEqual([unknown.kind, unknown.known, unknown.plate], ["droid", false, { unit: "DRD-????", serial: "????-????", seed: addressSeed("t3h") }]);
	assert.deepEqual(presession(droid).plate, unknown.plate);
	// The address seed is the mod's hash as a signed 32-bit number, as the barcode has always been seeded.
	assert.deepEqual([addressSeed("t3h"), addressSeed("t1")], [-1233379576, 138734806]);

	const agent = model(pane({ app: "claude-code", status: "idle", program: { key: "claude", name: "Claude Code", agent: true, shell: false } }));
	assert.deepEqual([agent.kind, agent.prefix, agent.code, agent.plate.serial, agent.plate.seed], ["agent", "AGT", "CLAUDE", "~/projects/lunalee", addressSeed("t3h")]);
	assert.deepEqual(agent.plate.division, ["EXTERNAL", "AGENT"]);
	assert.deepEqual(agent.options, { barcode: true, peak: false });
	assert.equal(agentCode(null, "Codex"), "CODEX");
	assert.equal(agentCode("", ""), "");

	const shell = model(pane());
	assert.deepEqual([shell.kind, shell.prefix, shell.code, shell.plate.serialLabel, shell.plate.division], ["terminal", "TERM", "ZSH", "DIR", ["BRANCH", "MAIN"]]);
	assert.deepEqual(shell.options, { barcode: false, peak: false });
	assert.equal(model(pane({ branch: null, cwd: null })).plate.division[1], "--");
	assert.equal(model(pane({ cwd: null })).plate.serial, "--");
	assert.equal(shellCode("-zsh"), "ZSH");
	assert.equal(shellCode("/usr/local/bin/fish --login"), "FISH");
	assert.equal(shellCode(undefined), "");
	assert.equal(homePath("/Users/u", "/Users/u"), "~");
	assert.equal(homePath("/Users/uu/x", "/Users/u"), "/Users/uu/x");
	assert.ok(isPi({ app: "pi" }) && isPi({ program: { key: "pi" } }) && !isPi({ app: "claude-code" }));
	assert.ok(isAgent({ app: "codex" }) && isAgent({ program: { agent: true } }) && !isAgent(PI) && !isAgent({ program: { shell: true } }));
});

test("the plate's code fits whole or falls back to its prefix, and every unit's block and bay line up", () => {
	for (const W of [MIN_WIDTH, 40, 55, 56, 64, 80, 99, 160, 200]) {
		const cases = [
			model(pane(PI), { signals: signals() }),
			model(pane(PI), { memory: { ...emptyMemory(), pi: true, piSince: NOW - STARTING_GRACE_MS } }),
			model(pane({ app: "claude-code", status: "working", program: { key: "claude", name: "Claude Code", agent: true } })),
			model(pane()),
		];
		for (const m of cases) for (const lighting of ["lit", "standby", "dark"]) for (const zoomed of [false, true]) {
			const h = composeHeader(m, { width: W, lighting, zoomed, hover: 1, pressed: 2 });
			assert.equal(h.lines.length, ROWS);
			for (const line of h.lines) assert.equal([...text(line)].length, W, `${m.kind} ${W} ${lighting}`);
			assert.deepEqual(h.keys.map((k) => text(h.lines[6]).slice(k.col, k.col + k.len)), ["[|]", "[-]", zoomed ? "[v]" : "[^]", "[x]"]);
			// The bay spans the title block's 16 columns, W − 18 … W − 3.
			assert.deepEqual([h.keys[0].hitCol, h.keys.at(-1).hitCol + h.keys.at(-1).hitLen], [W - 2 - BLOCK_WIDTH, W - 2]);
			if (W >= 56 && h.regions.block) assert.deepEqual([h.regions.block.left, h.regions.block.cols], [W - 2 - BLOCK_WIDTH, BLOCK_WIDTH]);
		}
	}
	const at64 = composeHeader(model(pane({ app: "opencode", program: { key: "opencode", name: "OpenCode", agent: true } })), { width: 64 });
	assert.match(text(at64.lines[2]), /^ {2}[█▀▄ ]+/); // AGT alone: OPENCODE does not fit at 64
	assert.equal(at64.regions.wordmark.glyphs.length, 3);
	assert.equal(composeHeader(model(pane()), { width: 99 }).regions.wordmark.glyphs.length, 8); // TERM-ZSH
	assert.equal(composeHeader(model(pane()), { width: 10 }).width, MIN_WIDTH);
});

test("the cell width: the font's advance rounded up to the device pixel whose scale gives Herdr's columns", () => {
	// Measured live (Herdr 0.1.16, 2x display, JetBrains Mono 14): a 64-character probe 538 px, the header 1684 px, 198 columns.
	assert.deepEqual(cellWidthOf({ advance: 538 / 64, width: 1684, cols: 198 }), { cell: 8.5, scale: 2 });
	assert.deepEqual(cellWidthOf({ advance: 8.4, width: 900, cols: 100 }), { cell: 9, scale: 1 });
	assert.deepEqual(cellWidthOf({ advance: 8.4, multiplier: 1.1, width: 1700, cols: 183 }), { cell: 9.25, scale: 4 });
	// No scale gives the columns: the width over the columns; nothing measured: the advance; nothing at all: null.
	assert.deepEqual(cellWidthOf({ advance: 8.4, width: 1000, cols: 100 }), { cell: 10, scale: null });
	assert.deepEqual(cellWidthOf({ advance: 8.4 }), { cell: 8.4, scale: null });
	assert.deepEqual(cellWidthOf({}), { cell: null, scale: null });
	assert.equal(columnsOf(1684, 8.5), 198);
	assert.equal(columnsOf(841.5, 8.5), 99);
	assert.equal(columnsOf(3, 8.5), 1);
});

test("the plan places every cell on the grid; the plate, barcode and bay end on W − 3 at every width", () => {
	const kinds = [pane(PI), pane(), pane({ app: "claude-code", status: "working", program: { key: "claude", name: "Claude Code", agent: true } })];
	for (const p of kinds) {
		for (const lighting of ["lit", "dark"]) {
			for (let W = MIN_WIDTH; W <= 200; W += 11) {
				const m = model(p, { signals: p.app === "pi" ? signals() : null });
				const h = composeHeader(m, { width: W, lighting });
				const plan = cellPlan(h.lines, { cell: 8.5, scale: 2, width: W * 8.5 + 1, keys: h.keys });
				const on = (x) => Math.abs(x / 8.5 - Math.round(x / 8.5)) < 1e-9;
				assert.equal(plan.cols, W);
				for (const piece of [...plan.bgs, ...plan.texts, ...plan.rects.filter((r) => r.kind !== "band")]) assert.ok(on(piece.x) || piece.kind === "block" || piece.kind === "line", `${W}: on the grid`);
				for (const t of plan.texts) assert.equal(t.w, 8.5);
				// Every row's backgrounds tile the header exactly, the remainder in the row's last color.
				for (let row = 0; row < ROWS; row++) {
					const bgs = plan.bgs.filter((b) => b.y === ROW_TOPS[row]);
					assert.equal(bgs.reduce((n, b) => n + b.w, 0), W * 8.5 + 1, `${W} row ${row}`);
					assert.ok(bgs.every((b) => b.h === ROW_HEIGHTS[row]));
				}
				// No piece reaches past the header; the bay's last key ends on W − 3 (its right edge is column W − 2's left).
				for (const piece of [...plan.bgs, ...plan.rects, ...plan.texts]) assert.ok(piece.x + piece.w <= W * 8.5 + 1 + 1e-9);
				if (plan.hits.length) assert.equal(plan.hits.at(-1).x + plan.hits.at(-1).w, (W - 2) * 8.5, `${W}: bay`);
				if (h.regions.barcode) {
					const bars = plan.rects.filter((r) => r.kind === "block" && r.y === ROW_TOPS[2]);
					assert.ok(Math.max(...bars.map((r) => r.x + r.w)) <= (W - 2) * 8.5 && Math.max(...bars.map((r) => r.x + r.w)) > (W - 3) * 8.5, `${W}: the guard bar in column W − 3`);
				}
			}
		}
	}
});

test("shapes, not glyphs: block elements, lines and the peak are rectangles; every text cell is a glyph the terminal font has", () => {
	// JetBrains Mono, which Herdr ships, draws these; ⟁ is the mod's mark.svg.
	const TEXT = /^[\x21-\x7e®⟁■●○▶▲…]$/u;
	for (const p of [pane(PI), pane(), pane({ app: "claude-code", status: "blocked", program: { key: "claude", name: "Claude Code", agent: true } })]) {
		for (const W of [40, 64, 99, 198]) {
			const h = composeHeader(model(p, { signals: p.app === "pi" ? signals({ question: { text: "Which?", more: 0, since: NOW } }) : null }), { width: W });
			const plan = cellPlan(h.lines, { cell: 8.5, scale: 2, width: W * 8.5, keys: h.keys });
			for (const t of plan.texts) {
				assert.equal(glyphShape(t.ch), null, `${t.ch} is text`);
				assert.match(t.ch, TEXT, `${W}: ${JSON.stringify(t.ch)} is a font glyph`);
			}
			const peak = h.paint.length ? plan.rects.filter((r) => r.kind === "band") : [];
			if (W === 198 && p.app === "pi") assert.ok(peak.length > 24, "the peak's triangles are bands");
		}
	}
	// A lower-right triangle at 2x: one device px bands, each as wide as the triangle at its middle, joined when equal.
	const bands = scanPolygon([[1, 0], [1, 1], [0, 1]], { x: 0, y: 0, w: 8.5, h: 18.5 }, (v) => Math.round(v * 2) / 2, 2);
	// Bands tile the cell from its first device row the triangle covers (narrower than half a device px above) to its foot.
	assert.ok(bands[0].y <= 0.5 && bands.at(-1).y + bands.at(-1).h === 18.5);
	bands.slice(1).forEach((b, i) => assert.equal(b.y, bands[i].y + bands[i].h));
	assert.ok(bands.every((b) => b.x + b.w === 8.5 && b.w > 0));
	assert.ok(bands.at(-1).w > bands[0].w);
	assert.deepEqual(KEY_ACTIONS, ["split-right", "split-down", "zoom", "close"]);
});

test("Pi's strip: idle hints, working with its phase, target and elapsed, needs you, done with its settle time", () => {
	const strip = (p, s) => model(pane({ ...PI, ...p }), { signals: s }).strip;
	assert.deepEqual(strip({}, signals()).map((s) => s.key), PI_HINTS.map(([k]) => k));
	const tool = strip({ status: "working" }, signals({ root: { working: true }, phase: { kind: "tool", tool: "bash", target: "npm test\n-- --watch=false", since: NOW - 42_500 } }));
	assert.deepEqual(tool.map((s) => s.kind), ["status", "text", "clock", "hint"]);
	assert.deepEqual([tool[0].word, tool[1].text, tool[2].text, tool[3].key], ["BASH", "npm test -- --watch=false", "00:42", "esc"]);
	assert.equal(strip({ status: "working" }, signals({ root: { working: true }, phase: { kind: "thinking", since: NOW - 12_000 } }))[0].word, "THINKING");
	assert.equal(strip({ status: "working" }, signals({ root: { working: true }, phase: { kind: "tool", tool: "web-search", since: NOW } }))[0].word, "WEB_SEARCH");
	// Working with no phase yet: the word, no clock.
	assert.deepEqual(strip({ status: "working" }, signals({ root: { working: true } })).map((s) => s.kind), ["status", "hint"]);
	const blocked = strip({ status: "blocked" }, signals({ question: { text: "Which trade-off?", more: 1, since: NOW } }));
	assert.deepEqual(blocked, [{ kind: "chip", glyph: "▲", word: "NEEDS YOU" }, { kind: "text", text: "Which trade-off?", clip: true }]);
	// Free text reaches the strip through the mod's one cleaner: no bidi control or line break in a question, a target or a branch.
	assert.equal(strip({ status: "blocked" }, signals({ question: { text: "Ship\u202e it\nnow?", more: 0, since: NOW } }))[1].text, "Ship it now?");
	assert.equal(strip({ status: "working" }, signals({ root: { working: true }, phase: { kind: "tool", tool: "bash", target: "ls\u2066 -la", since: NOW } }))[1].text, "ls -la");
	assert.equal(model(pane({ branch: "feat/\u202ex\ty" })).plate.division[1], "FEAT/X Y");
	const settled = new Date(2026, 10, 17, 15, 2).getTime();
	const done = strip({ status: "done" }, signals({ root: { working: false, lastSettledAt: settled } }));
	assert.deepEqual(done.slice(0, 2), [{ kind: "status", glyph: "●", word: "DONE", tone: "primary" }, { kind: "field", label: "SETTLED", value: "15:02", drop: 5 }]);
	assert.deepEqual(done.slice(2).map((s) => s.key), ["ctrl+c", "/", "!"]);
	// An unknown settle time is left out, never shown as 00:00.
	assert.deepEqual(strip({ status: "done" }, signals()).map((s) => s.kind), ["status", "hint", "hint", "hint"]);
	// A clock asks for the next second.
	assert.equal(model(pane({ ...PI, status: "working" }), { signals: signals({ root: { working: true }, phase: { kind: "writing", since: NOW - 3_400 } }) }).nextAt, NOW + 600);
});

test("Pi starting: STARTING on the terminal plate for 3 s, then the pre-session plate; the label ends it at once", () => {
	let memory = observe(emptyMemory(), pane(), NOW - 5000);
	memory = observe(memory, pane(PI), NOW);
	assert.equal(memory.piSince, NOW);
	const starting = paneModel({ pane: pane(PI), terminal: term(), signals: null, memory, now: NOW + 1000 });
	assert.deepEqual([starting.kind, starting.pi, starting.state, starting.nextAt], ["terminal", true, "pi:starting", NOW + STARTING_GRACE_MS]);
	assert.deepEqual(starting.strip.map((s) => s.word ?? s.text), ["STARTING", "pi"]);
	assert.equal(paneModel({ pane: pane(PI), terminal: term(), signals: null, memory, now: NOW + STARTING_GRACE_MS }).kind, "droid");
	assert.equal(paneModel({ pane: pane(PI), terminal: term(), signals: signals(), memory, now: NOW + 10 }).plate.unit, "DRD-FA03");
});

test("terminal strip: READY, RUNNING the full command with its clock, PI EXITED until the next command", () => {
	let memory = observe(emptyMemory(), pane(), NOW - 9000);
	assert.deepEqual(model(pane(), { memory }).strip, [{ kind: "status", glyph: "○", word: "READY", tone: "ready" }]);
	const npm = pane({ program: { key: "npm", name: "npm", shell: false, agent: false } });
	memory = observe(memory, npm, NOW - 761_000);
	const running = paneModel({ pane: npm, terminal: term(), signals: null, foreground: ["/usr/local/bin/npm", "run", "dev"], memory, now: NOW });
	assert.deepEqual(running.strip.map((s) => s.word ?? s.text), ["RUNNING", "npm run dev", "00:12:41"]);
	assert.equal(running.state, "terminal:running");
	// Without the looked-up command, the program's name.
	assert.equal(paneModel({ pane: npm, terminal: term(), signals: null, memory, now: NOW }).strip[1].text, "npm");
	// The mod's one cleaner: a line break or tab is a space, any other control or bidi mark goes.
	assert.equal(commandText(["a\u0007b"]), "ab");
	assert.equal(commandText(["python3", "-", "<<EOF\nimport\tsys\u202e"]), "python3 - <<EOF import sys");
	assert.equal(commandText([]), null);
	// Pi exits back to the shell.
	memory = observe(observe(memory, pane(PI), NOW), pane(), NOW + 1000);
	const exited = paneModel({ pane: pane(), terminal: term(), signals: null, memory, now: NOW + 2000, home: "/Users/u" });
	assert.equal(exited.state, "terminal:exited");
	assert.deepEqual(exited.strip[1], { kind: "field", label: "PI EXITED", value: timeOfDay(NOW + 1000), drop: 1 });
	memory = observe(memory, npm, NOW + 3000);
	memory = observe(memory, pane(), NOW + 4000);
	assert.equal(paneModel({ pane: pane(), terminal: term(), signals: null, memory, now: NOW + 5000 }).state, "terminal:ready");
});

test("what was under way at the first look has no clock: a running command, a working agent; a running Pi is not starting", () => {
	const npm = pane({ program: { key: "npm", name: "npm", shell: false, agent: false } });
	const running = paneModel({ pane: npm, terminal: term(), signals: null, memory: observe(emptyMemory(), npm, NOW), now: NOW + 5000 });
	assert.deepEqual(running.strip.map((s) => s.kind), ["status", "text"]);
	const claude = pane({ app: "claude-code", status: "working", program: { key: "claude", name: "Claude Code", agent: true } });
	const memory = observe(emptyMemory(), claude, NOW);
	assert.deepEqual(paneModel({ pane: claude, terminal: term(), signals: null, memory, now: NOW + 5000 }).strip.map((s) => s.kind), ["status"]);
	// herdr-core's status time, when the terminal record carries it, is the agent's start.
	const withStatus = paneModel({ pane: claude, terminal: { ...term(), status_ms: NOW - 192_000 }, signals: null, memory, now: NOW });
	assert.equal(withStatus.strip[1].text, "03:12");
	assert.equal(paneModel({ pane: pane(PI), terminal: term(), signals: null, memory: observe(emptyMemory(), pane(PI), NOW), now: NOW }).kind, "droid");
});

test("agent strip: READY, WORKING with the time since it started, NEEDS YOU, DONE", () => {
	const claude = (status) => pane({ app: "claude-code", status, program: { key: "claude", name: "Claude Code", agent: true, shell: false } });
	let memory = observe(emptyMemory(), claude("idle"), NOW - 200_000);
	memory = observe(memory, claude("working"), NOW - 192_000);
	assert.deepEqual(paneModel({ pane: claude("working"), terminal: term(), signals: null, memory, now: NOW }).strip.map((s) => s.word ?? s.text), ["WORKING", "03:12"]);
	assert.deepEqual(model(claude("blocked")).strip, [{ kind: "chip", glyph: "▲", word: "NEEDS YOU" }]);
	assert.deepEqual(model(claude("done")).strip.map((s) => s.word), ["DONE"]);
	assert.deepEqual(model(claude(null)).strip.map((s) => s.word), ["READY"]);
});

test("formats, lighting and the signals label", () => {
	assert.equal(clockText(761_999, true), "00:12:41");
	assert.equal(clockText(3_599_000), "59:59");
	assert.equal(clockText(-1), null);
	assert.equal(timeOfDay(Date.UTC(2026, 10, 17, 7, 4), -480), "15:04");
	assert.equal(timeOfDay(null), null);
	assert.equal(lightingOf({ focused: true, hovered: false, active: true }), "lit");
	assert.equal(lightingOf({ focused: false, hovered: true, active: true }), "standby");
	assert.equal(lightingOf({ focused: false, hovered: false, active: true }), "dark");
	assert.equal(lightingOf({ focused: true, hovered: true, active: false }), "dark");
	assert.equal(LABEL, "io.signals.v1");
	assert.equal(PLATE_LABEL, "io.droid-plate.v1");
	for (const raw of [undefined, "", "{", "[]", JSON.stringify({ version: 2 })]) assert.equal(parseSignals(raw), null);
	const s = parseSignals(JSON.stringify({ version: 1, sessionId: 7, root: { working: true, lastSettledAt: "x" }, phase: { kind: "tool", tool: "read", target: "a".repeat(300), since: 1 }, question: { text: 3 } }));
	assert.deepEqual([s.sessionId, s.lastSettledAt, s.phase.target.length, s.question], [null, null, 200, null]);
	const live = { address: "t1", state: "live", labels: { [LABEL]: JSON.stringify({ version: 1, sessionId: SESSION }) } };
	assert.equal(terminalSignals(live, "pi").sessionId, SESSION);
	assert.equal(terminalSignals(live, "claude-code"), null);
	assert.equal(terminalSignals({ ...live, state: "dead" }, "pi"), null);
});

// A header getter for the timeline tests.
function headers(m, width = 80) {
	const cache = new Map();
	const get = (lighting) => cache.get(lighting) ?? cache.set(lighting, composeHeader(m, { width, lighting })).get(lighting);
	const pre = m.kind === "droid" ? presession(m) : m;
	const getUnknown = (lighting) => composeHeader(pre, { width, lighting });
	return { get, getUnknown, durations: m.kind === "droid" ? headerDurations(getUnknown("lit"), get("lit")) : {} };
}
const view = (m, lighting = "lit", over = {}) => ({ kind: m.kind, state: m.state, known: m.known === true, seed: m.plate.seed ?? 0, pi: m.pi, lighting, idle: m.idle, lit: lighting === "lit", ...over });

test("T2 and H1 are native: a lighting change stacks a layer whose banks fade in 30 ms apart; nothing is drawn per frame", () => {
	const m = model(pane()), h = headers(m);
	let t = advance(emptyTimeline(), view(m, "dark"), NOW);
	assert.deepEqual(t.layers.map((l) => [l.level, l.enter]), [["dark", null]]); // the first view starts nothing
	assert.equal(playingUntil(t), -Infinity);
	t = advance(t, view(m, "lit"), NOW + 10);
	assert.deepEqual(t.layers.map((l) => [l.level, l.enter, l.primedAt]), [["dark", null, NOW], ["lit", BANKS, null]]);
	assert.ok(needsPrime(t));
	// The layer is drawn at opacity 0, then primed: its banks' transitions run natively from then.
	t = prime(t, NOW + 10 + PRIME_MS);
	assert.equal(playingUntil(t), NOW + 10 + PRIME_MS + 130);
	assert.deepEqual(layerBanks(80, BANKS).map((b) => [b.left, b.cols, b.delay, b.duration]), [[0, 20, 0, 40], [20, 20, 30, 40], [40, 20, 60, 40], [60, 20, 90, 40]]);
	assert.deepEqual(layerBanks(80, STANDBY_IN).map((b) => [b.delay, b.duration]), [[0, 90], [0, 90], [0, 90], [0, 90]]);
	// No frame timer for a lighting change: each layer's lines are its own lighting's header, unchanged.
	assert.equal(frameStep(t, NOW + 60), null);
	assert.deepEqual(frame(t, NOW + 60, "lit", h.get, h.getUnknown), h.get("lit").lines);
	assert.deepEqual(frame(t, NOW + 60, "dark", h.get, h.getUnknown), h.get("dark").lines);
	assert.equal(nextWake(t, null, NOW + 60), NOW + 10 + PRIME_MS + 130); // one wake to drop the covered layer
	assert.deepEqual(settle(t, NOW + 59).layers.length, 2);
	assert.deepEqual(settle(t, NOW + 10 + PRIME_MS + 130).layers.map((l) => l.level), ["lit"]);
	// A second change mid-switch stacks another layer over both; the base, which has entered, is never dropped.
	let back = advance(t, view(m, "dark"), NOW + 50);
	assert.deepEqual(back.layers.map((l) => l.level), ["dark", "lit", "dark"]);
	back = advance(back, view(m, "lit"), NOW + 55);
	assert.deepEqual(back.layers.map((l) => l.level), ["dark", "dark", "lit"]);
	assert.equal(back.layers.length, LAYER_LIMIT);
	assert.equal(advance(advance(emptyTimeline(), view(m, "dark"), NOW), view(m, "standby"), NOW).layers[1].enter, STANDBY_IN);
	assert.equal(advance(advance(emptyTimeline(), view(m, "standby"), NOW), view(m, "dark"), NOW).layers[1].enter, STANDBY_OUT);
	assert.equal(STANDBY_IN.fade + STANDBY_OUT.fade, 210);
	// The plan splits every piece into its bank, and the banks tile the header.
	const plan = cellPlan(h.get("lit").lines, { cell: 8.5, scale: 2, width: 80 * 8.5 + 3, keys: h.get("lit").keys, banks: layerBanks(80, BANKS) });
	assert.deepEqual(plan.banks.map((b) => [b.x, b.w]), [[0, 170], [170, 170], [340, 170], [510, 173]]);
	for (const piece of [...plan.bgs, ...plan.rects, ...plan.texts]) {
		const box = plan.banks[piece.bank];
		assert.ok(piece.x >= box.x - 1e-9 && piece.x + piece.w <= box.x + box.w + 1e-9, `piece ${JSON.stringify(piece)} outside bank ${piece.bank}`);
	}
});

test("Pi starts: the boot draws the pre-session plate, then K5 rolls the identity in; a late label rolls it then", () => {
	const shell = model(pane()), droid = model(pane(PI), { signals: signals() }), h = headers(droid);
	assert.ok(h.durations.boot > 1000 && h.durations.roll === 120 + 7 * 50);
	let t = advance(emptyTimeline(), view(shell), NOW);
	t = advance(t, view(droid), NOW + 100, { durations: h.durations });
	assert.equal(t.boot.start, NOW + 100);
	assert.equal(t.roll.start, NOW + 100 + h.durations.boot);
	const bootEnd = NOW + 100 + h.durations.boot;
	// Character-level motions run the frame timer at their own step: 50 ms for the boot, 40 ms for the roll.
	assert.equal(frameStep(t, NOW + 400, h.durations), 50);
	assert.equal(frameStep(t, bootEnd + 10, h.durations), ROLL.tick);
	assert.equal(frameStep(t, bootEnd + h.durations.roll, h.durations), null);
	assert.notDeepEqual(frame(t, NOW + 400, "lit", h.get, h.getUnknown, h.durations), h.get("lit").lines);
	// Between the boot and the roll's end the plate is still DRD-????'s; then the real one, exactly.
	assert.match(text(frame(t, bootEnd + 10, "lit", h.get, h.getUnknown, h.durations)[5]), /S\/N [0-9A-F]{4}-[0-9A-F]{4}/);
	assert.deepEqual(frame(t, bootEnd + h.durations.roll, "lit", h.get, h.getUnknown, h.durations), h.get("lit").lines);
	// Each lighting layer plays the same motion in its own lighting.
	assert.notDeepEqual(frame(t, NOW + 400, "dark", h.get, h.getUnknown, h.durations), frame(t, NOW + 400, "lit", h.get, h.getUnknown, h.durations));
	// Unknown at the boot, known later: the roll starts when the label lands.
	const unknown = model(pane(PI), { memory: { ...emptyMemory(), pi: true, piSince: NOW - STARTING_GRACE_MS } });
	let u = advance(advance(emptyTimeline(), view(shell), NOW), view(unknown), NOW, { durations: h.durations });
	assert.equal(u.roll, null);
	u = advance(u, view(droid), NOW + 9000, { durations: h.durations });
	assert.equal(u.roll.start, NOW + 9000);
	const glyphs = wordmarkGlyphs();
	const plate = unitPlate({ unit: "DRD-F0A3", serial: "0000-0000" }, { width: 104 });
	const col = plate.regions.wordmark.glyphs[4];
	assert.deepEqual(glyphs.F, [2, 3, 4].map((y) => [...text(plate.lines[y])].slice(col, col + 3).join("")));
});

test("hand-back: a native wipe of the droid's rows over the terminal plate; a state change latches; K4 ghosts only the lit idle plate", () => {
	const droid = model(pane(PI), { signals: signals() }), shell = model(pane()), hd = headers(droid), hs = headers(shell);
	let t = advance(emptyTimeline(), view(droid), NOW);
	const outgoing = hd.get("lit").lines;
	t = advance(t, view(shell), NOW + 10, { outgoing });
	assert.deepEqual([t.reveal.start, t.reveal.outgoing, t.reveal.primedAt], [NOW + 10, outgoing, null]);
	assert.ok(needsPrime(t));
	t = prime(t, NOW + 30);
	assert.equal(playingUntil(t), NOW + 30 + 900);
	assert.equal(REVEAL.duration + 6 * REVEAL.stagger, 900);
	assert.equal(frameStep(t, NOW + 100), null); // the wipe is native
	assert.deepEqual(frame(t, NOW + 100, "lit", hs.get, hs.getUnknown), hs.get("lit").lines); // the plate under it
	assert.equal(settle(t, NOW + 929).reveal !== null, true);
	assert.equal(settle(t, NOW + 930).reveal, null);
	// Each piece of a plan knows its row, so the wipe clips row by row.
	const plan = cellPlan(outgoing, { cell: 8.5, scale: 2, width: 680 });
	for (const piece of [...plan.bgs, ...plan.rects, ...plan.texts]) assert.ok(piece.y >= ROW_TOPS[piece.row] - 1e-9 && piece.y + piece.h <= ROW_TOPS[piece.row] + ROW_HEIGHTS[piece.row] + 1e-9);

	const working = model(pane({ ...PI, status: "working" }), { signals: signals({ root: { working: true }, phase: { kind: "thinking", since: NOW } }) });
	t = advance(advance(emptyTimeline(), view(droid), NOW), view(working), NOW + 5);
	assert.equal(t.latch.start, NOW + 5);
	assert.equal(frameStep(t, NOW + 10), 50);
	const hw = headers(working);
	assert.notDeepEqual(frame(t, NOW + 10, "lit", hw.get, hw.getUnknown, hw.durations)[6], hw.get("lit").lines[6]);

	// K4: scheduled 20–60 s out, seeded per plate, only while lit and idle.
	for (let n = 0; n < 50; n++) { const d = ghostDelay(droid.plate.seed, n); assert.ok(d >= GHOST_EVERY[0] && d <= GHOST_EVERY[1]); }
	let g = advance(emptyTimeline(), view(droid), NOW);
	assert.equal(g.ghostAt, NOW + ghostDelay(droid.plate.seed, 0));
	g = advance(g, view(droid), g.ghostAt);
	assert.equal(g.ghost.start, NOW + ghostDelay(droid.plate.seed, 0));
	assert.equal(g.ghostAt, g.ghost.start + ghostDelay(droid.plate.seed, 1));
	assert.notDeepEqual(frame(g, g.ghost.start + 10, "lit", hd.get, hd.getUnknown, hd.durations), hd.get("lit").lines);
	assert.equal(advance(emptyTimeline(), view(droid, "dark"), NOW).ghostAt, null);
	assert.equal(advance(emptyTimeline(), view(working), NOW).ghostAt, null);
});

test("a ghost that falls due during another motion waits for its end: on the real scheduler with a fake clock, no zero-delay loop", () => {
	const clock = fakeClock(NOW);
	const scheduler = new Scheduler(clock);
	const droid = model(pane(PI), { signals: signals() }), h = headers(droid);
	let t = advance(emptyTimeline(), view(droid), NOW);
	const due = t.ghostAt;
	// A state change just before the ghost is due starts a latch (150 ms) that is still playing at `due`.
	t = advance(t, view(droid, "lit", { state: "pi:other" }), due - 50, { durations: h.durations });
	assert.ok(t.latch);
	// The view's loop, as main.js runs it: every wake re-advances the timeline and asks for the next wake.
	let wakes = 0, ghostStarts = [];
	const pass = (now) => {
		t = advance(t, view(droid, "lit", { state: "pi:other" }), now, { durations: h.durations });
		if (t.ghost && !ghostStarts.includes(t.ghost.start)) ghostStarts.push(t.ghost.start);
		const at = nextWake(t, null, now, h.durations);
		if (at !== null) scheduler.wake(at, () => { wakes++; pass(clock.now()); });
	};
	clock.set(due);
	pass(due);
	assert.equal(t.ghost, null);
	assert.equal(t.ghostAt, due + 100); // moved to the latch's end, not left in the past
	clock.run(due + 1000);
	assert.deepEqual(ghostStarts, [due + 100]);
	assert.ok(wakes <= 3, `${wakes} wakes in one second`);
	// A deadline that already fired is never armed again, so an expired time asked for again cannot loop.
	let fired = 0;
	const s2 = new Scheduler(clock);
	s2.wake(clock.now() - 5, () => fired++);
	clock.run(clock.now() + 10);
	s2.wake(clock.now() - 5 - 10, () => fired++);
	clock.run(clock.now() + 10);
	assert.equal(fired, 1);
	assert.ok(s2.idle);
	// The frame timer runs at its step only while asked, and stop() leaves nothing running.
	let frames = 0;
	s2.frame(50, () => frames++);
	clock.run(clock.now() + 200);
	assert.equal(frames, 4);
	s2.frame(null);
	clock.run(clock.now() + 200);
	assert.equal(frames, 4);
	s2.frame(40, () => frames++);
	s2.wake(clock.now() + 500, () => fired++);
	s2.stop();
	scheduler.stop();
	assert.ok(s2.idle && scheduler.idle);
	assert.equal(clock.pending(), 0);
});

test("missing or malformed signals keep what Herdr knows: WORKING and NEEDS YOU from its status, with no phase, question or clock", () => {
	const malformed = [
		null,
		parseSignals(JSON.stringify({ version: 1, sessionId: SESSION, root: {} })),
		parseSignals(JSON.stringify({ version: 1, sessionId: SESSION, root: { working: "yes" } })),
		parseSignals(JSON.stringify({ version: 1, sessionId: SESSION })),
	];
	assert.equal(malformed[1].working, null);
	assert.equal(malformed[2].working, null);
	const expect = { working: ["WORKING", "pi:working:WORKING"], blocked: ["NEEDS YOU", "pi:blocked"], done: [null, null], idle: [null, null], null: [null, null] };
	for (const status of ["working", "blocked", "done", "idle", null]) {
		for (const sig of malformed) {
			const p = pane({ ...PI, status });
			const m = model(p, { signals: sig, memory: observe(emptyMemory(), p, NOW - 10_000) });
			const strip = m.strip.map((x) => x.word ?? x.text ?? "").join(" ");
			const [word, state] = expect[String(status)];
			if (word) {
				assert.ok(strip.includes(word), `${status} ${JSON.stringify(sig)}: ${strip}`);
				assert.equal(m.state, state);
				assert.equal(m.nextAt, null, "no clock is made up");
				assert.ok(!/\d+:\d\d|\d+s\b/.test(strip), `no time: ${strip}`);
				if (status === "blocked") assert.equal(m.strip.length, 1, "no question is made up");
				if (status === "working") assert.ok(!/THINKING|TOOL|READ/.test(strip), `no phase: ${strip}`);
			} else {
				assert.ok(!/WORKING|NEEDS YOU/.test(strip), `${status} ${JSON.stringify(sig)}: ${strip}`);
			}
			assert.notEqual(m.state, "pi:starting", "a busy Pi is not starting");
		}
	}
	// A label that knows wins: working false with Herdr still saying working is the label's idle.
	const settled = model(pane({ ...PI, status: "working" }), { signals: signals() });
	assert.ok(!settled.strip.some((x) => x.word === "WORKING"));
	// Herdr's blocked shows even when the label says idle: a question is actionable.
	assert.equal(model(pane({ ...PI, status: "blocked" }), { signals: signals() }).state, "pi:blocked");
});

test("label publication: one serialized writer, desired kept apart from acknowledged, bounded retries, close supersedes", async () => {
	const calls = [];
	const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
	const queue = []; // the hc results to hand out, in order; each a deferred or a value
	const hcFake = (args) => { calls.push(args.join(" ")); const r = queue.shift() ?? { code: 0 }; return r.promise ?? (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)); };
	const sleeps = [];
	const sleep = (ms) => new Promise((resolve) => sleeps.push({ ms, resolve }));
	const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
	const wake = async () => { while (sleeps.length) sleeps.shift().resolve(); await flush(); };

	// A deferred set to t1; the terminal is replaced by t2 before it lands. Only one write is ever in flight.
	let pub = new LabelPublisher();
	const first = deferred();
	queue.push(first);
	assert.equal(pub.want("t1"), true);
	const worker = pub.run({ hc: hcFake, sleep });
	await flush();
	assert.deepEqual(calls, ["label t1 io.droid-plate.v1=1"]);
	assert.equal(pub.want("t2"), false, "the running worker picks the change up");
	assert.equal(pub.run({ hc: hcFake, sleep }) instanceof Promise, true); // a second run returns at once
	await flush();
	assert.equal(calls.length, 1, "no second write while one is in flight");
	first.resolve({ code: 0 });
	await worker;
	assert.deepEqual(calls, ["label t1 io.droid-plate.v1=1", "label t1 io.droid-plate.v1=", "label t2 io.droid-plate.v1=1"]);
	assert.deepEqual([pub.confirmed, [...pub.maybe]], ["t2", ["t2"]]);

	// Failures retry after 250, 500, 1000 ms, then stop until what is wanted changes; a rejection is a failure.
	calls.length = 0;
	pub = new LabelPublisher();
	queue.push({ code: 1 }, new Error("hc gone"), { code: 1 }, { code: 1 });
	pub.want("t3");
	const failing = pub.run({ hc: hcFake, sleep });
	for (let i = 0; i < 6; i++) await wake();
	await failing;
	assert.equal(calls.length, 1 + RETRY_LIMIT);
	assert.equal(pub.confirmed, null);
	assert.ok(pub.maybe.has("t3"), "a failed set may still have landed");
	assert.equal(pub.want("t3"), false, "spent: no new worker for the same write");
	assert.equal(pub.want("t4"), true, "a change resets the count");

	// close() supersedes a pending retry and a deferred write: the worker stops; close clears every terminal that may
	// carry the label, after the write in flight has landed, and nothing is written after the clear.
	calls.length = 0;
	pub = new LabelPublisher();
	const slow = deferred();
	queue.push(slow);
	pub.want("t5");
	const w5 = pub.run({ hc: hcFake, sleep });
	await flush();
	const closing = pub.close({ hc: hcFake, sleep });
	await flush();
	assert.deepEqual(calls, ["label t5 io.droid-plate.v1=1"], "the clear waits for the set in flight");
	slow.resolve({ code: 0 });
	await closing;
	await w5;
	assert.deepEqual(calls, ["label t5 io.droid-plate.v1=1", "label t5 io.droid-plate.v1="]);
	assert.equal(pub.want("t6"), false);
	await flush();
	assert.equal(calls.length, 2, "nothing after close");
	assert.deepEqual([...pub.maybe], []);

	// A write that never answers times out (bounded), and close does not wait for it past its bound.
	calls.length = 0;
	pub = new LabelPublisher();
	queue.push(deferred(), { code: 0 });
	pub.want("t7");
	const hung = pub.run({ hc: hcFake, sleep });
	await flush();
	const closeHung = pub.close({ hc: hcFake, sleep });
	await wake(); // the close wait and the write timeout pass
	await closeHung;
	await wake();
	await hung;
	assert.deepEqual(calls, ["label t7 io.droid-plate.v1=1", "label t7 io.droid-plate.v1="]);
	assert.equal(WRITE_TIMEOUT_MS, 2000);
});

test("wide panes: at most DRAW_LIMIT columns are composed, the middle widens, and the block, barcode and bay still end on W − 3", () => {
	assert.equal(DRAW_LIMIT, 256);
	const droid = model(pane(PI), { signals: signals() });
	for (const m of [droid, model(pane())]) {
		for (const cols of [198, 256, 257, 400, 999, 1000, 1001, 1500, 4000]) {
			const h = composeHeader(m, { width: cols, peakFrom: peakFromOf(cols * 8.5, 8.5) });
			const drawn = Math.min(cols, DRAW_LIMIT);
			assert.deepEqual([h.width, h.drawn], [cols, drawn]);
			for (const line of h.lines) assert.equal(text(line).length, drawn);
			assert.equal(h.spread === null, cols <= DRAW_LIMIT);
			const width = cols * 8.5 + 3;
			const plan = cellPlan(h.lines, { cell: 8.5, scale: 2, width, keys: h.keys, banks: layerBanks(cols, BANKS), spread: h.spread });
			assert.equal(plan.cols, cols);
			for (let row = 0; row < ROWS; row++) {
				const right = Math.max(...plan.bgs.filter((b) => b.row === row).map((b) => b.x + b.w));
				assert.ok(Math.abs(right - width) < 1e-6, `row ${row} at ${cols}: filled to ${right} of ${width}`);
			}
			// The bay's last key and, for the droid, the barcode's last bar end on W − 3.
			const bay = plan.hits.at(-1);
			assert.ok(Math.abs((bay.x + bay.w) / 8.5 - (cols - 2)) < 1e-6, `${cols}: bay ends at ${(bay.x + bay.w) / 8.5}`);
			if (m === droid) {
				const bars = plan.rects.filter((r) => r.row === 2 && r.kind === "block");
				assert.ok(Math.abs(Math.max(...bars.map((r) => r.x + r.w)) / 8.5 - (cols - 2)) < 1e-6, `${cols}: barcode end`);
			}
			// The widened gap is plain: no text inside it.
			if (h.spread) for (const t of plan.texts) assert.ok(t.x / 8.5 < h.spread.at || t.x / 8.5 >= h.spread.at + h.spread.by, `${cols}: text ${t.ch} in the gap`);
			// A peak is drawn only wholly before the gap, still clear of the grip.
			if (h.paint.length) {
				assert.ok(Math.min(...h.paint.map((p) => p.start)) >= peakFromOf(cols * 8.5, 8.5));
				if (h.spread) assert.ok(Math.max(...h.paint.map((p) => p.end)) <= h.spread.at);
			}
		}
	}
	assert.ok(composeHeader(droid, { width: 400, peakFrom: peakFromOf(400 * 8.5, 8.5) }).paint.length > 0, "a peak at 400 columns");
	assert.equal(composeHeader(droid, { width: 1000, peakFrom: peakFromOf(1000 * 8.5, 8.5) }).paint.length, 0, "none past the drawn plate");
	// Render draws at most PIECE_BUDGET pieces: a wide plate's brushed ground and hairlines are joined across nearly equal
	// cells; inks, shapes and the rows' extent are kept, and a plate within budget is unchanged.
	for (const m of [model(pane(PI), { signals: signals() }), model(pane())]) {
		for (const cols of [198, 256, 400, 1000, 1500]) {
			for (const lighting of ["lit", "standby", "dark"]) {
				const h = composeHeader(m, { width: cols, lighting, peakFrom: peakFromOf(cols * 8.5, 8.5) });
				const full = cellPlan(h.lines, { cell: 8.5, scale: 2, width: cols * 8.5 + 3, keys: h.keys, banks: layerBanks(cols, BANKS), spread: h.spread });
				const plan = coarsen(full);
				const count = plan.bgs.length + plan.rects.length + plan.texts.length;
				assert.ok(count <= PIECE_BUDGET, `${cols} ${lighting}: ${count} pieces`);
				if (full.bgs.length + full.rects.length + full.texts.length <= PIECE_BUDGET) assert.equal(plan, full);
				assert.deepEqual(plan.texts, full.texts);
				assert.deepEqual(plan.rects.filter((r) => r.kind !== "line"), full.rects.filter((r) => r.kind !== "line"));
				const colors = new Set(full.bgs.map((b) => b.color));
				for (const b of plan.bgs) assert.ok(colors.has(b.color));
				for (let row = 0; row < ROWS; row++) {
					const area = (list) => list.filter((b) => b.row === row).reduce((sum, b) => sum + b.w, 0);
					assert.ok(Math.abs(area(plan.bgs) - area(full.bgs)) < 1e-6, `row ${row} keeps its extent`);
				}
				assert.ok(!plan.coarse || plan.coarse <= 8, `${cols} ${lighting}: tolerance ${plan.coarse}`);
				// The drawn plate and its widened middle stay small enough that nothing is coarsened at any width.
				assert.equal(plan, full, `${cols} ${lighting}: ${full.bgs.length + full.rects.length + full.texts.length} pieces`);
			}
		}
	}
	// A lighting switch shares the budget among up to three layers: each plate fits its third at every lighting.
	for (const lighting of ["lit", "standby", "dark"]) {
		const h = composeHeader(model(pane(PI), { signals: signals() }), { width: 300, lighting, peakFrom: peakFromOf(300 * 8.5, 8.5) });
		const third = coarsen(cellPlan(h.lines, { cell: 8.5, scale: 2, width: 300 * 8.5, keys: h.keys, banks: layerBanks(300, BANKS), spread: h.spread }), Math.floor(PIECE_BUDGET / 3));
		assert.ok(third.bgs.length + third.rects.length + third.texts.length <= PIECE_BUDGET / 3, `${lighting}: a third of the budget`);
		assert.ok(third.coarse <= 8);
	}
	// Over a budget (a smaller one here), the ground and hairlines join across nearly equal cells, inks kept.
	const shell = composeHeader(model(pane()), { width: 256 });
	const full = cellPlan(shell.lines, { cell: 8.5, scale: 2, width: 256 * 8.5, keys: shell.keys });
	const tight = coarsen(full, 600);
	assert.ok(tight.bgs.length + tight.rects.length + tight.texts.length <= 600 && tight.coarse >= 2);
	assert.deepEqual(tight.texts, full.texts);
	for (let row = 0; row < ROWS; row++) {
		const extent = (list) => list.filter((b) => b.row === row).reduce((sum, b) => sum + b.w, 0);
		assert.ok(Math.abs(extent(tight.bgs) - extent(full.bgs)) < 1e-6);
	}
	assert.equal(composeHeader(model(pane()), { width: Infinity }).width, MIN_WIDTH);
	assert.equal(composeHeader(model(pane()), { width: NaN }).width, MIN_WIDTH);
});

test("the peak clears Herdr's drag grip: its first cell is the pane centre plus half the grip plus 2 cells, left of the block", () => {
	assert.equal(GRIP_PX, 28);
	const droid = model(pane(PI), { signals: signals() });
	let first = null;
	for (let cols = 40; cols <= 240; cols++) {
		const cell = 8.5, widthPx = cols * cell + 3;
		const from = peakFromOf(widthPx, cell);
		assert.ok(from * cell >= widthPx / 2 + GRIP_PX / 2 + PEAK_CLEAR * cell - 1e-6);
		const h = composeHeader(droid, { width: cols, peakFrom: from });
		const cells = h.paint.filter((p) => p.row === 5);
		if (!h.paint.length) { assert.ok(cols < 80, `no peak at ${cols}`); continue; }
		first ??= cols;
		const left = Math.min(...h.paint.map((p) => p.start)), right = Math.max(...h.paint.map((p) => p.end));
		assert.ok(left >= from, `${cols}: peak at ${left}, grip clear from ${from}`);
		assert.ok(right <= cols - BLOCK_WIDTH - 2 - 2, `${cols}: peak to ${right}, block from ${cols - BLOCK_WIDTH - 2}`);
		assert.ok(cells.length > 0);
	}
	assert.equal(first, 80);
	// Agents and terminals have no peak; the option changes nothing for them.
	const shell = model(pane());
	assert.deepEqual(composeHeader(shell, { width: 99, peakFrom: 54 }).lines, composeHeader(shell, { width: 99 }).lines);
});

test("the plate's folder: one view and five pure modules, which import only each other, ../ds/ and the mod's text formats", async () => {
	// What each file may import from the app is checked for the whole mod in industrial-os-layout.test.mjs.
	const files = (await readdir(MOD)).filter((f) => f.endsWith(".js"));
	assert.deepEqual(files.sort(), ["clock.js", "labels.js", "model.js", "motion.js", "plate.js", "view.js"]);
	for (const file of files.filter((f) => f !== "view.js")) {
		const source = await readFile(new URL(file, MOD), "utf8");
		const specifiers = [...source.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
		for (const specifier of specifiers) assert.match(specifier, /^\.\/[\w-]+\.js$|^\.\.\/ds\/[\w/-]+\.mjs$|^\.\.\/format\.js$/, `${file} imports ${specifier}`);
	}
});

test("ds/ is a byte-for-byte copy of exactly the design-system files the mod imports", async () => {
	assert.deepEqual(await check(), []);
	const entries = await modEntries(MOD_ROOT.pathname);
	assert.ok(entries.includes("elements/unit-plate/unit-plate.mjs") && entries.includes("motions/bank-switch.mjs"));
	const files = await closure(entries);
	assert.ok(files.includes("foundation/cells.mjs") && !files.some((f) => f.endsWith(".test.mjs") || f.endsWith(".d.mts")));
	assert.deepEqual(relativeImports("import { a } from './a.mjs';\nexport { b } from \"../b.mjs\";\nimport './c.mjs';\nimport x from 'pkg';"), ["./a.mjs", "../b.mjs", "./c.mjs"]);
});
