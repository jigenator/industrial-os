import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, beforeEach } from "node:test";
import { load, measure, tui } from "./host.ts";

// The extension through the installed host's own Pi packages, with a fake Pi API, context, TUI and clock.
const { default: droidHeader, DroidHeader, FRAME_MS, INTRO_LIMIT_MS } = await load("src/extension.ts");
const { introEnd, settledFrame } = await load("src/header.ts");

const root = await realpath(await mkdtemp(join(tmpdir(), "droid-header-ext-")));
after(() => rm(root, { recursive: true, force: true }));
const agentDir = join(root, "agent"), cwd = join(root, "project");
await mkdir(join(agentDir, "extensions"), { recursive: true });
await writeFile(join(agentDir, "extensions/notes.ts"), "export default function () {}\n");
await mkdir(join(cwd, ".git"), { recursive: true });
await writeFile(join(cwd, ".git/HEAD"), "ref: refs/heads/main\n");
process.env.PI_CODING_AGENT_DIR = agentDir;
for (const key of ["NO_MOTION", "HERDR_PANE_ID", "HERDR_WORKSPACE_ID", "HERDR_TAB_ID"]) delete process.env[key];

/** A manual clock: intervals run only when the test advances time. */
function manualClock() {
	let now = 0, next = 0;
	const timers = new Map<number, { at: number; every: number; run: () => void }>();
	return {
		timers,
		/** Running intervals: the intro's frame timer is the only one. */
		intervals: () => timers.size,
		now: () => now,
		every(ms: number, run: () => void) { const id = next++; timers.set(id, { at: now + ms, every: ms, run }); return () => timers.delete(id); },
		advance(ms: number) {
			const end = now + ms;
			for (;;) {
				const due = [...timers.values()].filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
				if (!due) break;
				now = due.at;
				due.at += due.every;
				due.run();
			}
			now = end;
		},
	};
}

function harness(options: { mode?: string; reason?: string; entries?: string[]; sessionId?: string; manifest?: (request: unknown) => unknown } = {}) {
	const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
	const clock = manualClock();
	const pi = {
		on: (event: string, run: any) => { handlers.set(event, [...(handlers.get(event) ?? []), run]); },
		getThinkingLevel: () => "high",
		getCommands: () => [{ name: "flag", source: "extension" }, { name: "plan", source: "prompt" }, { name: "skill:review", source: "skill" }],
	};
	// Like Pi, the fake TUI draws the header (at 104 columns) whenever a render is requested.
	const state = { header: undefined as any, inputListeners: new Set<(data: string) => unknown>(), setHeaderCalls: 0 };
	const screen = { renders: 0, requestRender() { this.renders++; state.header?.render(104); } };
	const ctx = {
		mode: options.mode ?? "tui", cwd, model: { id: "claude-opus-5-5", provider: "anthropic" }, isProjectTrusted: () => true,
		sessionManager: { getSessionId: () => options.sessionId ?? "0000beef-0000-4000-8000-00000000c0de", getEntries: () => (options.entries ?? ["thinking_level_change"]).map((type) => ({ type })) },
		ui: {
			setHeader(factory: any) {
				state.setHeaderCalls++;
				state.header?.dispose?.();
				state.header = factory ? factory(screen, { getColorMode: () => "truecolor" }) : undefined;
			},
			onTerminalInput(listener: (data: string) => unknown) { state.inputListeners.add(listener); return () => state.inputListeners.delete(listener); },
		},
	};
	if (options.manifest) droidHeader(pi, clock, options.manifest);
	else droidHeader(pi, clock);
	const emit = async (event: string, payload: any = {}) => { for (const run of handlers.get(event) ?? []) await run({ type: event, ...payload }, ctx); };
	const start = () => emit("session_start", { reason: options.reason ?? "startup" });
	const text = (width = 104) => state.header.render(width).map((line: string) => tui.stripTerminalSequences(line));
	return { clock, screen, state, emit, start, text };
}
/** Waits for the real manifest to be built (the header stops showing a pending total). */
const pending = (rows: string[]) => /MANIFEST +--/.test(rows.join("\n"));
async function settleManifest(h: { text: () => string[] }) {
	for (let i = 0; i < 200 && pending(h.text()); i++) await new Promise((done) => setTimeout(done, 25));
}
/** A settled header: the plate's serial and the whole ledger are drawn, with no cursor in the strip or below. */
const settledText = (rows: string[]) => rows.some((row) => /S\/N 0000-BEEF/.test(row)) && rows.some((row) => /SPECIFICATIONS/.test(row)) && !rows.slice(6).join("").includes("█");

beforeEach(() => { delete process.env.NO_MOTION; });

test("a fresh session animates at most every 50 ms, settles after the intro and stops its timer", async () => {
	const h = harness();
	await h.start();
	assert.equal(FRAME_MS, 50);
	assert.equal(h.state.inputListeners.size, 1);
	assert.deepEqual([...h.clock.timers.values()].map((t) => t.every), [FRAME_MS]);
	h.clock.advance(1000);
	const mid = h.screen.renders;
	assert.ok(mid >= 1000 / FRAME_MS, `${mid} renders requested in the first second`);
	h.clock.advance(4000);
	assert.equal(h.clock.intervals(), 0, "no frame timer after the intro");
	assert.equal(h.state.inputListeners.size, 0, "the input listener is released when settled");
	const settled = h.screen.renders;
	h.clock.advance(10_000);
	assert.equal(h.screen.renders, settled, "no renders after settling");
	// The real manifest, built in-process after the first draw, is drawn settled once it is ready.
	await settleManifest(h);
	const rows = h.text();
	assert.match(rows.join("\n"), /EXTENSIONS {2}01 {2}notes/);
	assert.match(rows.join("\n"), /ASSIGNMENT +PROJECT · MAIN/);
	assert.match(rows.join("\n"), /MODEL +OPUS-5\.5 \/ HIGH/);
	// Outside interactive mode Pi has not installed its app keybindings, so keyText cannot name the interrupt and clear
	// keys; those hints are left out rather than guessed. No ctrl+o hint is ever shown.
	assert.match(rows[6], /^ {18}\/ commands {11}! bash *$/);
});

test("a fresh session with only setting entries animates, as Pi records the thinking level before session_start", async () => {
	for (const entries of [[], ["thinking_level_change"], ["thinking_level_change", "model_change", "session_info"]]) {
		const h = harness({ entries });
		await h.start();
		assert.equal(h.clock.intervals(), 1, entries.join());
		await h.emit("session_shutdown", { reason: "quit" });
	}
});

test("resumed sessions, sessions with content, reloads and NO_MOTION render settled with no timer", async () => {
	for (const [name, options, env] of [
		["resume", { reason: "resume" }, undefined], ["fork", { reason: "fork" }, undefined], ["reload", { reason: "reload" }, undefined],
		["messages", { entries: ["thinking_level_change", "message"] }, undefined], ["a new entry type", { entries: ["future_entry"] }, undefined],
		["NO_MOTION", {}, "1"],
	] as const) {
		if (env) process.env.NO_MOTION = env; else delete process.env.NO_MOTION;
		const h = harness(options);
		await h.start();
		assert.equal(h.clock.intervals(), 0, name);
		assert.equal(h.state.inputListeners.size, 0, name);
		assert.match(h.text()[0], /^\+[─◢◤◥◣]+\+$/u, name);
		assert.ok(settledText(h.text()), `${name}: settled at once`);
	}
});

test("the first keystroke, a submitted input or an agent start settles the intro at once", async () => {
	for (const trigger of ["keystroke", "input", "agent_start"]) {
		const h = harness();
		await h.start();
		h.clock.advance(300);
		if (trigger === "keystroke") {
			const [listener] = h.state.inputListeners;
			assert.equal(listener("x"), undefined, "the listener never consumes input");
		} else await h.emit(trigger);
		assert.equal(h.clock.intervals(), 0, trigger);
		assert.equal(h.state.inputListeners.size, 0, trigger);
		assert.ok(settledText(h.text()), trigger);
	}
});

test("shutdown, a replaced header and a new session dispose every timer and listener", async () => {
	const shutdown = harness();
	await shutdown.start();
	await shutdown.emit("session_shutdown", { reason: "quit" });
	assert.equal(shutdown.clock.timers.size, 0);
	assert.equal(shutdown.state.inputListeners.size, 0);

	const replaced = harness();
	await replaced.start();
	replaced.state.header.dispose();
	assert.equal(replaced.clock.timers.size, 0);
	assert.equal(replaced.state.inputListeners.size, 0);

	const again = harness();
	await again.start();
	await again.emit("session_shutdown", { reason: "new" });
	await again.emit("session_start", { reason: "new" });
	assert.equal(again.clock.intervals(), 1, "only the new header's timer");
	assert.equal(again.state.inputListeners.size, 1);
	assert.equal(again.state.setHeaderCalls, 2);
});

test("outside TUI mode nothing is set, read or scheduled", async () => {
	for (const mode of ["rpc", "json", "print"]) {
		const h = harness({ mode });
		await h.start();
		assert.equal(h.state.setHeaderCalls, 0);
		assert.equal(h.clock.timers.size, 0);
	}
});

const turn = () => new Promise((done) => setImmediate(done));

test("the manifest is built after the header is first drawn, with the prompts Pi loaded, and not for a header gone first", async () => {
	const requests: unknown[] = [];
	let answer!: (manifest: unknown) => void;
	const h = harness({ reason: "resume", manifest: (request) => { requests.push(request); return new Promise((done) => { answer = done; }); } });
	await h.start();
	await turn();
	assert.equal(requests.length, 0, "nothing before the header is drawn");
	assert.ok(pending(h.text()));
	assert.equal(requests.length, 0, "nothing during the draw");
	await turn();
	assert.deepEqual(requests, [{ cwd, trusted: true, prompts: ["plan"] }]);
	answer({ status: "unavailable", reason: "SETTINGS UNREADABLE: global ~/.pi/agent/settings.json" });
	await turn();
	assert.match(h.text().join("\n"), /MANIFEST UNAVAILABLE · SETTINGS UNREADABLE: global ~\/\.pi\/agent\/settings\.json/);
	// Replaced before it was drawn, then drawn but shut down before the next turn: neither header builds.
	await h.emit("session_start", { reason: "new" });
	await h.emit("session_start", { reason: "new" });
	h.text();
	await h.emit("session_shutdown", { reason: "quit" });
	await turn();
	assert.equal(requests.length, 1);
	assert.equal(h.clock.timers.size, 0);
});

test("a manifest source or Pi call that throws shows the manifest as unavailable, never throwing into Pi", async () => {
	const h = harness({ reason: "resume", manifest: () => { throw new Error("stale context\n    at somewhere"); } });
	await h.start();
	h.text();
	await turn();
	await turn();
	assert.match(h.text().join("\n"), /MANIFEST UNAVAILABLE · stale context/);
});

test("a header's manifest updates request a render, and a disposed header ignores them", () => {
	const clock = manualClock();
	const screen = { renders: 0, requestRender() { this.renders++; } };
	const state = { unit: "C0DE", session: "0000BEEF", seed: 0x0000beef, core: "-- / --", version: "1.4.0", sector: "--", pane: "--", deployed: "00:00:00", assignment: "X", manifest: { status: "pending" }, hints: [] };
	const header = new DroidHeader(state, false, clock);
	const component = header.attach(screen, { getColorMode: () => "truecolor" });
	header.setManifest({ status: "unavailable", reason: "SETTINGS UNREADABLE: global" });
	assert.match(component.render(104).map(tui.stripTerminalSequences).join("\n"), /MANIFEST UNAVAILABLE · SETTINGS UNREADABLE: global/);
	header.setManifest({ status: "ready", context: [], skills: ["a"], prompts: [], extensions: [] });
	assert.match(component.render(104).map(tui.stripTerminalSequences).join("\n"), /SKILLS {6}01 {2}a/);
	assert.equal(screen.renders, 2);
	header.dispose();
	header.setManifest({ status: "unavailable", reason: "late" });
	assert.equal(header.manifest.status, "ready", "a disposed header ignores updates");
	assert.equal(screen.renders, 2);
});

test("rendered ANSI lines never exceed the width Pi passes, at every width and frame", async () => {
	const h = harness();
	await h.start();
	await settleManifest(h);
	for (let step = 0; step <= 3600; step += 100) {
		for (const width of [1, 20, 39, 40, 41, 72, 99, 100, 101, 104, 160, 240]) {
			for (const line of h.state.header.render(width)) assert.ok(measure(line) <= width, `${width} cells at ${step} ms`);
		}
		h.clock.advance(100);
	}
});

test("the Escape hint follows the manifest: steer once it shows claude-interrupt", () => {
	const clock = manualClock();
	const screen = { renders: 0, requestRender() { this.renders++; } };
	const state = { unit: "C0DE", session: "0000BEEF", seed: 0x0000beef, core: "-- / --", version: "1.4.0", sector: "--", pane: "--", deployed: "00:00:00", assignment: "X", manifest: { status: "pending" }, hints: [["escape", "interrupt"], ["/", "commands"]] };
	const header = new DroidHeader(state, false, clock);
	const component = header.attach(screen, { getColorMode: () => "truecolor" });
	const strip = () => tui.stripTerminalSequences(component.render(104)[6]);
	assert.match(strip(), /escape interrupt/);
	header.setManifest({ status: "ready", context: [], skills: [], prompts: [], extensions: ["industrial-os/claude-interrupt"] }, [["escape", "steer"], ["/", "commands"]]);
	assert.match(strip(), /escape steer/);
	// Without new hints the old ones stay.
	header.setManifest({ status: "unavailable", reason: "x" });
	assert.match(strip(), /escape steer/);
});

test("the intro ends when the frame drawn says, or at the backstop for a header Pi never draws", () => {
	const state = { unit: "C0DE", session: "0000BEEF", seed: 0x0000beef, core: "-- / --", version: "1.4.0", sector: "--", pane: "--", deployed: "00:00:00", assignment: "X", manifest: { status: "pending" }, hints: [] };
	assert.equal(INTRO_LIMIT_MS, 8000);
	const end = introEnd(settledFrame(state, 104, measure));
	assert.ok(end > 1000 && end < INTRO_LIMIT_MS, `${end} ms`);
	// Drawn at 104 columns on every request: it settles on the first tick after its frame's end.
	const drawn = manualClock();
	const header = new DroidHeader(state, true, drawn);
	const component = header.attach({ requestRender() { component.render(104); } }, { getColorMode: () => "truecolor" });
	component.render(104);
	drawn.advance(Math.ceil(end / FRAME_MS) * FRAME_MS - FRAME_MS);
	assert.equal(header.animating, true);
	drawn.advance(FRAME_MS);
	assert.equal(header.animating, false);
	// Never drawn: the 8 s backstop settles it.
	const clock = manualClock();
	const undrawn = new DroidHeader(state, true, clock);
	undrawn.attach({ requestRender() {} }, { getColorMode: () => "truecolor" });
	clock.advance(INTRO_LIMIT_MS - FRAME_MS);
	assert.equal(undrawn.animating, true);
	clock.advance(FRAME_MS);
	assert.equal(undrawn.animating, false);
	assert.equal(clock.intervals(), 0);
});
