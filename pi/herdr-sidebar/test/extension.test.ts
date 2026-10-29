// Integration tests: the extension loaded by the installed Pi's real loader and driven through its real
// ExtensionRunner and event bus, against the fake Herdr server. A small fake collector extension, loaded before or
// after this one, publishes snapshots on the signals-collector v1 channels.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { host, load } from "./host.ts";
import { startFakeHerdr, until, type FakeHerdr } from "./fake-herdr.ts";

const packageRoot = resolve(".");
const B = "⠀";
const UNKNOWN_ROWS = { g2_au0: "??AU", g2_bg0: "??BG", bar_unk: "─────────── --%", cmpx: "CMP×??" };

// Replies to requests and announces itself on session start; `collector:set` replaces its snapshot and pushes it,
// `collector:reload` restarts its sequence and fields and announces itself again, as a reloaded collector would.
const fakeCollector = `
export default function (pi) {
	let sessionId, seq = 0, fields = {};
	const current = () => ({ version: 1, sessionId, seq, launch: "/work/tatsu-cli", active: "/work/tatsu-cli", workspace: null, pr: null,
		root: { working: false, lastSettledAt: null }, phase: null, question: null, model: null, thinking: null, context: null,
		compactions: 0, units: 0, goal: null, usage: {}, ...fields });
	pi.events.on("signals-collector:v1:request", (request) => { if (sessionId) request.reply(current()); });
	pi.events.on("collector:set", (next) => { fields = next; seq++; pi.events.emit("signals-collector:v1:snapshot", current()); });
	pi.events.on("collector:reload", () => { seq = 0; fields = {}; pi.events.emit("signals-collector:v1:ready", { version: 1, sessionId }); });
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		sessionId = ctx.sessionManager.getSessionId();
		pi.events.emit("signals-collector:v1:ready", { version: 1, sessionId });
	});
	pi.on("session_shutdown", () => { sessionId = undefined; });
}
`;

const scratch = await mkdtemp(join(tmpdir(), "herdr-sidebar-test-"));
const collectorPath = join(scratch, "fake-collector.ts");
await writeFile(collectorPath, fakeCollector);
test.after(() => rm(scratch, { recursive: true, force: true }));

function herdrEnv(t: any, env: Record<string, string | undefined>) {
	const keys = ["HERDR_ENV", "HERDR_PANE_ID", "HERDR_SOCKET_PATH"];
	const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
	for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
	t.after(() => { for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
}
const inside = (t: any, herdr: FakeHerdr) => herdrEnv(t, { HERDR_ENV: "1", HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: herdr.socketPath });

async function harness(t: any, options: { mode?: string; collector?: "before" | "after" | "none"; events?: any; manager?: any } = {}) {
	const events = options.events ?? host.createEventBus();
	const collector = options.collector ?? "before";
	const paths = collector === "before" ? [collectorPath, packageRoot] : collector === "after" ? [packageRoot, collectorPath] : [packageRoot];
	const loader = new host.DefaultResourceLoader({ eventBus: events, cwd: scratch, agentDir: join(scratch, "agent"), settingsManager: host.SettingsManager.inMemory(), additionalExtensionPaths: paths, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await loader.reload();
	const loaded = loader.getExtensions();
	assert.deepEqual(loaded.errors, [], "the real Pi loader resolves the package entry and its imports");
	assert.deepEqual(loaded.warnings, [], "the manifest uses host peers without loader warnings");
	assert.ok(loaded.extensions.some((extension: any) => extension.path === resolve("src/extension.ts")));
	const manager = options.manager ?? host.SessionManager.inMemory(scratch);
	const runner = new host.ExtensionRunner(loaded.extensions, loaded.runtime, scratch, manager, undefined);
	const errors: any[] = [];
	runner.onError((error: any) => errors.push(error));
	runner.bindCore({
		sendMessage() {}, sendUserMessage() {}, appendEntry() {}, setSessionName() {}, getSessionName: () => undefined, setLabel() {},
		getActiveTools: () => [], getAllTools: () => [], getSettings: () => ({}), setActiveTools() {}, refreshTools() {}, getCommands: () => [], setModel: async () => true,
		getThinkingLevel: () => "off", setThinkingLevel() {},
	}, { getModel: () => undefined, getScopedModels: () => [], isIdle: () => true, isProjectTrusted: () => false, getSignal: () => undefined, abort() {}, hasPendingMessages: () => false, shutdown() {}, getContextUsage: () => undefined, compact() {}, getSystemPrompt: () => "" });
	runner.setUIContext({ notify() {}, setStatus() {}, setFooter() {}, setWidget() {}, theme: { fg: (_c: string, s: string) => s } }, options.mode ?? "tui");
	const blocked: boolean[] = [];
	events.on("herdr:blocked", (data: any) => blocked.push(data.active));
	let stopped = false;
	const stop = async (reason = "quit") => { if (!stopped) { stopped = true; await runner.emit({ type: "session_shutdown", reason }); } };
	t.after(() => stop());
	return {
		events, runner, manager, blocked, errors, stop,
		start: (reason = "startup") => runner.emit({ type: "session_start", reason }),
		set: (fields: object) => events.emit("collector:set", fields),
		sessionId: () => manager.getSessionId(),
	};
}
const tokens = (herdr: FakeHerdr) => Object.fromEntries([...herdr.tokens].sort());
const sorted = (map: object) => Object.fromEntries(Object.entries(map).sort());

test("outside TUI mode nothing reports, subscribes or emits, even inside Herdr: subagent children stay silent", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	for (const mode of ["print", "json", "rpc"]) {
		const events = host.createEventBus(); let backgroundRequests = 0;
		events.on("pi-background-tasks:request:v1", () => { backgroundRequests++; });
		const h = await harness(t, { mode, events });
		await h.start();
		h.events.emit("signals-collector:v1:snapshot", { version: 1, sessionId: h.sessionId(), seq: 1, active: "/w", question: { text: "q", more: 0, since: 0 } });
		h.events.emit("signals-collector:v1:ready", { version: 1, sessionId: h.sessionId() });
		await new Promise((done) => setTimeout(done, 60));
		await h.stop();
		assert.deepEqual(h.blocked, [], mode);
		assert.deepEqual(h.errors, [], mode);
		assert.equal(backgroundRequests, 0, "no background requests outside TUI");
	}
	assert.equal(herdr.log.length, 0);
});

test("in TUI mode outside Herdr the extension is a no-op", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	const cases = [
		{ HERDR_ENV: undefined, HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: herdr.socketPath },
		{ HERDR_ENV: "0", HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: herdr.socketPath },
		{ HERDR_ENV: "1", HERDR_PANE_ID: " ", HERDR_SOCKET_PATH: herdr.socketPath },
		{ HERDR_ENV: "1", HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: undefined },
		{ HERDR_ENV: "1", HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: "relative/h.sock" },
	];
	for (const env of cases) {
		herdrEnv(t, env);
		const h = await harness(t);
		await h.start();
		h.set({ question: { text: "q", more: 0, since: 0 } });
		await new Promise((done) => setTimeout(done, 40));
		await h.stop();
		assert.deepEqual(h.blocked, []);
	}
	assert.equal(herdr.log.length, 0);
});

test("without a collector: the state row and truthful unknowns, never zeros", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	herdr.setStatus("working", false);
	const h = await harness(t, { collector: "none" });
	await h.start();
	await until(() => herdr.tokens.get("g1") === `◐ WRK${B}`, "state row");
	assert.deepEqual(tokens(herdr), sorted({ g1: `◐ WRK${B}`, ...UNKNOWN_ROWS }));
	assert.equal(herdr.subscriberCount, 1);
	assert.deepEqual(h.errors, []);
});

for (const order of ["before", "after"] as const) {
	test(`collector loaded ${order} the sidebar: the snapshot is reported either way`, async (t) => {
		const herdr = await startFakeHerdr();
		t.after(() => herdr.close());
		inside(t, herdr);
		herdr.setStatus("idle", false);
		const h = await harness(t, { collector: order });
		await h.start();
		await until(() => herdr.tokens.get("proj_idle") === "tatsu-cli" && herdr.tokens.get("g1") === `○ IDL${B}`, "first snapshot");
		assert.deepEqual(tokens(herdr), sorted({ g1: `○ IDL${B}`, proj_idle: "tatsu-cli", g2_au0: "00AU", g2_bg0: "??BG", bar_unk: "─────────── --%", cmpx: "CMP×00", g3: `ACT${B}`, dir: "/work/tatsu-cli" }));
		h.set({ units: 3, compactions: 4, context: { tokens: 1, window: 1, reserve: null, usedPercent: 67 }, model: { provider: "anthropic", id: "claude-opus-5-5" }, thinking: "high" });
		await until(() => herdr.tokens.get("mthink") === "opus-5.5/hi", "pushed snapshot");
		assert.equal(herdr.tokens.get("g2_au"), "03AU");
		assert.equal(herdr.tokens.get("g2_au0"), undefined, "a key that stopped applying is cleared");
		// Running units while Herdr reports the main agent idle: SUB, a working state with the title and zone bar.
		assert.equal(herdr.tokens.get("g1"), `◐ SUB${B}`);
		assert.equal(herdr.tokens.get("proj"), "tatsu-cli");
		assert.equal(herdr.tokens.get("bar"), "━━━━━━━━─── 67%");
		assert.equal(herdr.tokens.has("bar_idle"), false);
		assert.equal(herdr.tokens.get("cmpx"), "CMP×04");
		assert.deepEqual(h.errors, []);
	});
}

test("stale, foreign-session and other-version snapshots are ignored; ready re-requests after a collector reload", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	const h = await harness(t);
	await h.start();
	h.set({ units: 5 });
	await until(() => herdr.tokens.get("g2_au") === "05AU", "seq 1");
	const id = h.sessionId(), base = { version: 1, sessionId: id, active: "/work/x", units: 9 };
	h.events.emit("signals-collector:v1:snapshot", { ...base, seq: 1 });
	h.events.emit("signals-collector:v1:snapshot", { ...base, sessionId: "another-session", seq: 50 });
	h.events.emit("signals-collector:v1:snapshot", { ...base, version: 2, seq: 51 });
	h.events.emit("signals-collector:v1:ready", { version: 1, sessionId: "another-session" });
	await new Promise((done) => setTimeout(done, 80));
	assert.equal(herdr.tokens.get("g2_au"), "05AU");
	// A reloaded collector restarts its sequence; ready makes the sidebar request and accept its current snapshot.
	h.events.emit("collector:reload");
	await until(() => herdr.tokens.get("g2_au0") === "00AU", "re-requested after ready");
	h.set({ units: 7 });
	await until(() => herdr.tokens.get("g2_au") === "07AU", "pushes after the reload");
});

test("herdr:blocked is balanced: one true per pending question, one false when it clears or the runtime ends", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	herdr.setStatus("working", false);
	const h = await harness(t);
	await h.start();
	const question = { text: "Which branch should the release be cut from today?", more: 1, since: Date.now() };
	h.set({ question });
	h.set({ question: { ...question, text: "Edited" } });
	assert.deepEqual(h.blocked, [true]);
	await until(() => herdr.tokens.get("g1") === `× QNS${B}` && herdr.tokens.get("ask_l1") === "Edited (+1)", "question rows");
	assert.equal(herdr.tokens.get("g5"), `ASK${B}`);
	h.set({ question: null });
	h.set({ question: null });
	assert.deepEqual(h.blocked, [true, false]);
	await until(() => herdr.tokens.get("g1") === `◐ WRK${B}` && !herdr.tokens.has("ask_l1"), "question cleared");
	h.set({ question });
	assert.deepEqual(h.blocked, [true, false, true]);
	await h.stop();
	assert.deepEqual(h.blocked, [true, false, true, false], "a pending question ends with the runtime");
});

test("shutdown clears every token, closes the subscription and stops reporting", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	const h = await harness(t);
	await h.start();
	h.set({ units: 2, model: { provider: "p", id: "m" } });
	await until(() => herdr.tokens.get("mthink") === "m" && herdr.subscriberCount === 1, "reported");
	herdr.tokens.set("summary", "another reporter");
	await h.stop();
	assert.deepEqual(tokens(herdr), { summary: "another reporter" });
	await until(() => herdr.subscriberCount === 0, "subscription closed");
	const count = herdr.log.length;
	h.set({ units: 3 });
	herdr.setStatus("done");
	await new Promise((done) => setTimeout(done, 100));
	assert.equal(herdr.log.length, count, "nothing after shutdown");
	assert.deepEqual(h.errors, []);
});

test("session replacement: the old runtime clears and balances, the new one reports with the same source", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	const events = host.createEventBus();
	const first = await harness(t, { events });
	await first.start();
	first.set({ question: { text: "Old?", more: 0, since: Date.now() }, units: 1 });
	await until(() => herdr.tokens.get("ask_l1") === "Old?", "old runtime");
	await first.stop("new");
	assert.deepEqual(first.blocked.slice(-2), [true, false]);
	assert.equal(herdr.tokens.size, 0);
	const second = await harness(t, { events, manager: host.SessionManager.inMemory(scratch) });
	assert.notEqual(second.sessionId(), first.sessionId());
	await second.start("new");
	second.set({ units: 4 });
	await until(() => herdr.tokens.get("g2_au") === "04AU", "new runtime");
	assert.equal(herdr.tokens.get("ask_l1"), undefined);
	assert.deepEqual([...herdr.sources], ["industrial-os:herdr-sidebar"]);
	// Every report from the second runtime carries a higher seq than the first runtime's clear.
	const reports = herdr.reports(), clearAt = reports.findLastIndex((r) => Object.values(r.params.tokens).every((v) => v === null));
	assert.ok(reports.slice(clearAt + 1).every((r) => r.params.seq > reports[clearAt].params.seq));
});

test("Herdr status follows the subscription, is unknown while disconnected, and reconciles after reconnecting", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	inside(t, herdr);
	herdr.setStatus("working", false);
	const h = await harness(t);
	await h.start();
	await until(() => herdr.tokens.get("g1") === `◐ WRK${B}`, "working");
	herdr.setStatus("done");
	await until(() => herdr.tokens.get("g1") === `✓ DNE${B}` && herdr.tokens.get("ev_rdy_text") === "finished", "done");
	herdr.dropSubscribers();
	await until(() => herdr.tokens.get("g1") === `· UNK${B}` || herdr.tokens.get("g1") === `○ IDL${B}`, "unknown or reconciled");
	herdr.setStatus("idle", false);
	await until(() => herdr.tokens.get("g1") === `○ IDL${B}` && herdr.tokens.get("proj_idle") === "tatsu-cli", "reconciled after reconnect");
	assert.equal(herdr.tokens.get("ev_rdy_text"), undefined);
});

test("time values re-render when their text changes, at most once a second", async (t) => {
	const herdr = await startFakeHerdr();
	herdr.setPaneLabel("Running tests");
	t.after(() => herdr.close());
	inside(t, herdr);
	herdr.setStatus("working", false);
	const h = await harness(t);
	await h.start();
	h.set({ root: { working: true, lastSettledAt: null }, phase: { kind: "tool", tool: "bash", target: "npm test", since: Date.now() - 58_300 } });
	await until(() => herdr.tokens.get("ph_age") === `${B.repeat(3)}58s`, "58s");
	await until(() => herdr.tokens.get("ph_age") === `${B.repeat(3)}59s`, "59s", 2500);
	await until(() => herdr.tokens.get("ph_age") === `${B.repeat(4)}1m`, "1m", 2500);
	const ages = herdr.reports().filter((r) => "ph_age" in r.params.tokens && Object.keys(r.params.tokens).length === 1);
	for (let i = 1; i < ages.length; i++) assert.ok(ages[i].at - ages[i - 1].at >= 950, `${ages[i].at - ages[i - 1].at} ms apart`);
	assert.equal(herdr.tokens.get("pane"), `Running tests${B.repeat(2)}`);
	assert.equal(herdr.tokens.get("g5"), `PNE${B}`);
	// Once minutes show, nothing changes for the rest of the minute.
	const count = herdr.reports().length;
	await new Promise((done) => setTimeout(done, 1200));
	assert.equal(herdr.reports().length, count);
});

test("row-1 SPACE label updates on rename, reconnect and cross-workspace pane move", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	herdr.setWorkspaceLabel("SPACE", false);
	const h = await harness(t); await h.start(); await until(() => herdr.tokens.get("proj_idle") === "SPACE");
	h.set({ active: "/work/other-project" }); await new Promise((done) => setTimeout(done, 30)); assert.equal(herdr.tokens.get("proj_idle"), "SPACE");
	herdr.setWorkspaceLabel("Renamed SPACE"); await until(() => herdr.tokens.get("proj_idle") === "Renamed SPACE");
	herdr.dropSubscribers(); herdr.setWorkspaceLabel("Reconnect SPACE", false); await until(() => herdr.tokens.get("proj_idle") === "Reconnect SPACE");
	herdr.movePane("w2", "w2:p2", "Moved SPACE"); await until(() => herdr.tokens.get("proj_idle") === "Moved SPACE");
	assert.equal(herdr.reports().at(-1)!.params.pane_id, "w2:p2");
	await h.stop(); assert.equal(herdr.tokens.size, 0); assert.deepEqual(h.errors, []);
});

test("WRK to IDL swaps the zone bar for bar_idle and clears it on the next attention state", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr); herdr.setStatus("working", false);
	const h = await harness(t); await h.start(); h.set({ context: { usedPercent: 67 } });
	await until(() => herdr.tokens.get("bar") === "━━━━━━━━─── 67%");
	herdr.setStatus("idle"); await until(() => herdr.tokens.get("bar_idle") === "━━━━━━━━─── 67%"); assert.equal(herdr.tokens.has("bar"), false);
	h.set({ context: { usedPercent: 95 } }); await until(() => herdr.tokens.get("bar_idle") === "━━━━━━━━━━━ 95%");
	assert.equal(herdr.tokens.has("bar_crit"), false); assert.equal(herdr.tokens.has("bar_warn"), false);
	herdr.setStatus("done"); await until(() => herdr.tokens.get("bar_crit") === "━━━━━━━━━━━ 95%"); assert.equal(herdr.tokens.has("bar_idle"), false);
	herdr.setStatus("unknown"); await until(() => herdr.tokens.get("bar_idle") === "━━━━━━━━━━━ 95%"); assert.equal(herdr.tokens.has("bar_crit"), false);
	h.set({ context: null }); await until(() => herdr.tokens.get("bar_unk") === "─────────── --%"); assert.equal(herdr.tokens.has("bar_idle"), false);
});

test("SUB: the main agent working supersedes it; it shows while Herdr is idle, done or unknown and beats DNE", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr); herdr.setStatus("working", false);
	const h = await harness(t); await h.start();
	h.set({ units: 2, context: { usedPercent: 67 } });
	await until(() => herdr.tokens.get("g2_au") === "02AU" && herdr.tokens.get("g1") === `◐ WRK${B}`, "WRK beats SUB");
	herdr.setStatus("idle"); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "SUB while idle");
	assert.equal(herdr.tokens.get("proj"), "tatsu-cli"); assert.equal(herdr.tokens.get("bar"), "━━━━━━━━─── 67%");
	herdr.setStatus("done"); await new Promise((done) => setTimeout(done, 60));
	assert.equal(herdr.tokens.get("g1"), `◐ SUB${B}`, "SUB beats Herdr's done"); assert.equal(herdr.tokens.has("ev_rdy_text"), false);
	herdr.setStatus("unknown"); await new Promise((done) => setTimeout(done, 60)); assert.equal(herdr.tokens.get("g1"), `◐ SUB${B}`);
	herdr.dropSubscribers(); herdr.setStatus("idle", false);
	await until(() => herdr.tokens.get("g1") === `◐ SUB${B}` && herdr.subscriberCount === 1, "SUB while unknown and after reconnect");
	herdr.setStatus("blocked"); await until(() => herdr.tokens.get("g1") === `× BLK${B}`, "blocked wins");
	h.set({ units: 2, question: { text: "Go?", more: 0, since: Date.now() } }); await until(() => herdr.tokens.get("g1") === `× QNS${B}`, "question wins");
	assert.deepEqual(h.errors, []);
});

const workspaceReads = (herdr: FakeHerdr) => herdr.log.filter((r) => r.method === "workspace.get").length;
// Waits until the watch has read the workspace again after `reads`, so the visibility it holds is current.
async function visibilityRead(herdr: FakeHerdr, reads: number) {
	await until(() => workspaceReads(herdr) > reads, "visibility read");
	await new Promise((done) => setTimeout(done, 40));
}

async function finishedUnseen(t: any) {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr); herdr.setStatus("idle", false);
	const h = await harness(t); await h.start();
	await visibilityRead(herdr, 0);
	// The user looks at another tab of the pane's workspace while the subagents run.
	const reads = workspaceReads(herdr);
	herdr.focus("w1", "w1:t2", "w1:p2"); await visibilityRead(herdr, reads);
	h.set({ units: 1 }); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "SUB");
	h.set({ units: 0 });
	await until(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "DNE after an unseen finish");
	return { herdr, h };
}

test("subagents finishing unseen show DNE with RDY · finished and its age, cleared when tab focus makes the pane seen", async (t) => {
	const { herdr, h } = await finishedUnseen(t);
	assert.equal(herdr.tokens.get("g5"), `RDY${B}`); assert.equal(herdr.tokens.get("ev_rdy_text"), `finished${B.repeat(7)}`);
	assert.equal(herdr.tokens.get("ph_age"), `${B.repeat(4)}0s`); assert.equal(herdr.tokens.get("proj"), "tatsu-cli");
	await until(() => herdr.tokens.get("ph_age") === `${B.repeat(4)}1s`, "the age ticks", 2500);
	// Focus moves elsewhere without reaching the pane: still unseen.
	herdr.focus("w3", "w3:t1", "w3:p1"); await new Promise((done) => setTimeout(done, 80));
	assert.equal(herdr.tokens.get("g1"), `✓ DNE${B}`);
	herdr.focus("w1", "w1:t1", "w1:p1", ["tab_focused"]);
	await until(() => herdr.tokens.get("g1") === `○ IDL${B}` && !herdr.tokens.has("ev_rdy_text") && !herdr.tokens.has("ph_age"), "seen clears it");
	// Seen is sticky: looking away again does not bring DNE back.
	herdr.focus("w1", "w1:t2", "w1:p2"); await new Promise((done) => setTimeout(done, 80));
	assert.equal(herdr.tokens.get("g1"), `○ IDL${B}`); assert.deepEqual(h.errors, []);
});

for (const event of ["workspace_focused", "pane_focused"]) {
	test(`subagents-finished DNE clears when ${event} makes the pane seen`, async (t) => {
		const { herdr } = await finishedUnseen(t);
		herdr.focus("w1", "w1:t1", "w1:p1", [event]);
		await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "seen");
	});
}

test("subagents finishing while the pane is seen go straight to IDL", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr); herdr.setStatus("idle", false);
	const h = await harness(t); await h.start();
	await visibilityRead(herdr, 0);
	h.set({ units: 2 }); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "SUB");
	const g1: string[] = [];
	h.set({ units: 0 }); await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "IDL");
	for (const r of herdr.reports()) if (r.params.tokens.g1) g1.push(r.params.tokens.g1);
	assert.ok(!g1.includes(`✓ DNE${B}`), "never DNE");
	assert.equal(herdr.tokens.has("ev_rdy_text"), false);
});

test("the subagents-finished flag clears when the main agent starts working or units rise; question and blocked still win", async (t) => {
	const { herdr, h } = await finishedUnseen(t);
	h.set({ units: 0, question: { text: "Next?", more: 0, since: Date.now() } }); await until(() => herdr.tokens.get("g1") === `× QNS${B}`, "question wins");
	h.set({ units: 0 }); await until(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "flag kept under the question");
	herdr.setStatus("blocked"); await until(() => herdr.tokens.get("g1") === `× BLK${B}`, "blocked wins");
	herdr.setStatus("idle"); await until(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "flag kept under blocked");
	herdr.setStatus("working"); await until(() => herdr.tokens.get("g1") === `◐ WRK${B}`, "main agent works");
	herdr.setStatus("idle"); await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "work cleared the flag");
	// Units rising clears a new flag too.
	h.set({ units: 1 }); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`);
	h.set({ units: 0 }); await until(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "second unseen finish");
	h.set({ units: 3 }); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "units rise");
	herdr.focus("w1", "w1:t1", "w1:p1", false); h.set({ units: 0 });
	await new Promise((done) => setTimeout(done, 80));
	// The focus change went unannounced, so the pane still reads as unseen: the new drop flags again.
	assert.equal(herdr.tokens.get("g1"), `✓ DNE${B}`); assert.deepEqual(h.errors, []);
});

test("reconnect re-resolves visibility: a pane seen while disconnected clears the flag; the flag survives the outage", async (t) => {
	const { herdr } = await finishedUnseen(t);
	let reads = workspaceReads(herdr);
	herdr.dropSubscribers();
	await new Promise((done) => setTimeout(done, 100));
	// The reconnect waits at least 250 ms; meanwhile Herdr's state and visibility are unknown.
	assert.equal(herdr.subscriberCount, 0);
	assert.equal(herdr.tokens.get("g1"), `✓ DNE${B}`, "own DNE outranks unknown Herdr state");
	await until(() => herdr.subscriberCount === 1, "reconnected"); await visibilityRead(herdr, reads);
	assert.equal(herdr.tokens.get("g1"), `✓ DNE${B}`, "still unseen after reconnect: the flag survived");
	reads = workspaceReads(herdr);
	herdr.dropSubscribers(); herdr.focus("w1", "w1:t1", "w1:p1", false);
	await until(() => herdr.tokens.get("g1") === `○ IDL${B}` && herdr.subscriberCount === 1, "re-resolved as seen after reconnect");
	assert.ok(workspaceReads(herdr) > reads);
});

test("access decay reports each boundary without a snapshot/focus change and clears its timer on shutdown", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	herdr.focus("w2", "w2:t1", "w2:p1", false);
	// A past virtual clock: the sender's sequence floor is module state, and a future one would make Herdr ignore
	// later tests' reports from a freshly loaded module.
	let now = 1_700_000_000_000;
	t.mock.method(Date, "now", () => now);
	const scheduled: { callback: () => void; due: number; timer: NodeJS.Timeout }[] = [];
	const original = globalThis.setTimeout;
	t.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number, ...args: any[]) => {
		const timer = original(callback, delay, ...args);
		if (delay >= 3_600_000) scheduled.push({ callback, due: now + delay, timer });
		return timer;
	});
	// Socket delivery uses the real event loop; virtual Date advances only when a boundary is invoked.
	const wait = async (check: () => boolean) => {
		for (let n = 0; n < 400; n++) { if (check()) return; await sleep(10); }
		assert.fail("fake Herdr did not receive the expected stage");
	};
	const h = await harness(t); await h.start();
	h.set({ model: { provider: "anthropic", id: "claude-opus-5-5" }, thinking: "high" });
	await wait(() => herdr.tokens.has("mthink") && scheduled.some((item) => item.due === now + 3_600_000));
	const baseline = now;
	for (const [stage, elapsed] of [[1, 3_600_000], [2, 14_400_000], [3, 86_400_000]]) {
		const boundary = scheduled.findLast((item) => item.due === baseline + elapsed)!;
		assert.ok(boundary, "next exact stage boundary is scheduled");
		assert.equal(boundary.timer.hasRef(), false, "boundary timer is unref'd");
		assert.equal(herdr.tokens.has(`dir_d${stage}`), false, "not old before boundary");
		now = boundary.due;
		boundary.callback();
		await wait(() => herdr.tokens.has(`dir_d${stage}`) && herdr.tokens.has(`mthink_d${stage}`));
		for (const key of ["g3", "dir", "g4", "mthink"]) {
			const variants = [key, `${key}_d1`, `${key}_d2`, `${key}_d3`];
			assert.deepEqual(variants.filter((variant) => herdr.tokens.has(variant)), [`${key}_d${stage}`]);
		}
		assert.equal(herdr.tokens.get("g1"), `○ IDL${B}`);
	}
	// WRK refreshes even unseen, and its end captures now after days with no status event.
	herdr.setStatus("working");
	await wait(() => herdr.tokens.has("dir") && herdr.tokens.get("g1") === `◐ WRK${B}`);
	now += 2 * 86_400_000;
	herdr.setStatus("idle");
	await wait(() => scheduled.some((item) => item.due === now + 3_600_000));
	let boundary = scheduled.findLast((item) => item.due === now + 3_600_000)!;
	now = boundary.due; boundary.callback();
	await wait(() => herdr.tokens.has("dir_d1"));
	herdr.setStatus("unknown");
	await wait(() => herdr.tokens.has("dir") && !herdr.tokens.has("dir_d1"));
	now += 2 * 86_400_000;
	herdr.setStatus("idle");
	await wait(() => scheduled.some((item) => item.due === now + 3_600_000));
	boundary = scheduled.findLast((item) => item.due === now + 3_600_000)!;
	now = boundary.due; boundary.callback();
	await wait(() => herdr.tokens.has("dir_d1"));
	// RUN refreshes access over a long unseen interval, then starts a full hour on becoming unknown.
	let backgroundKnown = true;
	h.events.on("pi-background-tasks:request:v1", (request: any) => h.events.emit("pi-background-tasks:response:v1", backgroundKnown ? bgResponse(request, ["running"]) : { ...bgResponse(request), ok: false }));
	await endTool(h); await wait(() => herdr.tokens.get("g1") === `◐ RUN${B}` && herdr.tokens.has("mthink"));
	now += 2 * 86_400_000;
	backgroundKnown = false; await endTool(h);
	await wait(() => herdr.tokens.get("g1") === `○ IDL${B}` && scheduled.some((item) => item.due === now + 3_600_000));
	assert.equal(herdr.tokens.has("mthink_d1"), false, "RUN kept ACT/MDL fresh through the long interval");
	boundary = scheduled.findLast((item) => item.due === now + 3_600_000)!;
	now = boundary.due; boundary.callback(); await wait(() => herdr.tokens.has("mthink_d1"));
	// Session replacement, the same start path as reload, discards memory-only age.
	await h.start("reload");
	await wait(() => herdr.tokens.has("dir") && !herdr.tokens.has("dir_d1"));

	// Access at the end of a long visible interval must restart the full hour, not use load time.
	await wait(() => scheduled.some((item) => item.due === now + 3_600_000 && !(item.timer as any)._destroyed));
	const beforeFocus = scheduled.findLast((item) => !(item.timer as any)._destroyed)!;
	herdr.focus("w1", "w1:t1", herdr.paneId);
	await wait(() => (beforeFocus.timer as any)._destroyed);
	await sleep(30); // Let the focus reconciliation finish even though d0 text did not change.
	now += 2 * 86_400_000;
	herdr.focus("w2", "w2:t1", "w2:p1");
	await wait(() => scheduled.some((item) => item.due === now + 3_600_000));
	const pending = scheduled.findLast((item) => item.due === now + 3_600_000)!;
	await h.stop();
	assert.equal((pending.timer as any)._destroyed, true, "shutdown clears the boundary timeout");
	assert.equal(herdr.tokens.size, 0);
	const count = herdr.reports().length;
	now = pending.due; pending.callback(); await sleep(30);
	assert.equal(herdr.reports().length, count, "late callback cannot report");
	assert.deepEqual(h.errors, []);
});

test("PNE shows while idle without a collector and follows pane_updated", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	herdr.setPaneLabel("Updating sidebar pane name");
	const h = await harness(t, { collector: "none" });
	await h.start();
	await until(() => herdr.tokens.get("pane") === "Updating sidebar pane n…");
	assert.equal(herdr.tokens.get("g5"), `PNE${B}`); assert.equal(herdr.tokens.has("ph_age"), false);
	herdr.setPaneLabel("Renamed", true);
	await until(() => herdr.tokens.get("pane") === "Renamed");
	herdr.setPaneLabel("", true);
	await until(() => !herdr.tokens.has("pane") && !herdr.tokens.has("g5"));
});

// The manual flag through Pi's real session runtime: the command dispatch, appendEntry, session files in a temporary
// directory, reload, new session, resume, fork and tree navigation, with no model call. The fake collector loads first.
let sessionDirs = 0;
async function piSession(t: any, options: { mode?: string; ui?: boolean } = {}) {
	const host_ = host as any, agentDir = join(scratch, "agent"), sessionDir = join(scratch, `sessions-${++sessionDirs}`);
	const settingsManager = host_.SettingsManager.inMemory(), events = host_.createEventBus();
	const resourceLoaderOptions = { eventBus: events, additionalExtensionPaths: [collectorPath, packageRoot], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true };
	const create = async ({ cwd, sessionManager, sessionStartEvent }: any) => {
		const services = await host_.createAgentSessionServices({ cwd, agentDir, settingsManager, resourceLoaderOptions });
		return { ...(await host_.createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })), services, diagnostics: services.diagnostics };
	};
	const runtime = await host_.createAgentSessionRuntime(create, { cwd: scratch, agentDir, sessionManager: host_.SessionManager.create(scratch, sessionDir) });
	const notes: string[] = [], errors: unknown[] = [];
	const ui = options.ui ?? true;
	const bind = () => runtime.session.bindExtensions({ mode: options.mode ?? "tui", onError: (error: unknown) => errors.push(error), ...(ui ? { uiContext: { notify: (message: string, type = "info") => notes.push(`${type}: ${message}`), setStatus() {}, setWidget() {}, setFooter() {}, setTitle() {} } } : {}) });
	runtime.setRebindSession(async () => { await bind(); });
	await bind();
	t.after(() => runtime.dispose());
	const manager = () => runtime.session.sessionManager;
	return {
		runtime, notes, errors,
		command: (text: string) => runtime.session.prompt(text),
		set: (fields: object) => events.emit("collector:set", fields),
		manager,
		flags: () => manager().getBranch().filter((entry: any) => entry.type === "custom" && entry.customType === "industrial-os:herdr-sidebar:flag").map((entry: any) => entry.data.flagged),
		// A user message, as a prompt would add, so Pi writes the session file; no model is called.
		userMessage: (text: string) => manager().appendMessage({ role: "user", content: text, timestamp: Date.now() }),
	};
}

const FLAG_WARNING = "warning: /flag needs Pi's terminal UI inside Herdr; nothing was flagged";
// Waits for a complete report from the current runtime: `dir` is set after every flag key in the sender's order.
const reported = (herdr: FakeHerdr) => until(() => herdr.tokens.get("dir") === "/work/tatsu-cli", "complete report");

test("/flag toggles the current session's flag at once and saves it; state, focus, work and completion never clear it", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	herdr.setWorkspaceLabel("rpiv-mono", false);
	const s = await piSession(t);
	await reported(herdr);
	assert.equal(herdr.tokens.get("proj_idle"), "rpiv-mono"); assert.equal(herdr.tokens.has("flag"), false); assert.deepEqual(s.flags(), []);
	const before = herdr.reports().length;
	await s.command("/flag");
	assert.deepEqual(s.notes, ["info: Flagged"]); assert.deepEqual(s.flags(), [true]);
	await until(() => herdr.tokens.get("flag") === "●", "flag reported");
	assert.deepEqual(herdr.reports().slice(before).map((r) => r.params.tokens), [{ flag: "●" }], "one immediate diff");
	const flagged = async (check: () => boolean, label: string) => { await until(check, label); assert.equal(herdr.tokens.get("flag"), "●", label); };
	herdr.setStatus("working"); await flagged(() => herdr.tokens.get("g1") === `◐ WRK${B}`, "working");
	s.set({ units: 2 }); herdr.setStatus("idle"); await flagged(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "subagents");
	herdr.focus("w2", "w2:t1", "w2:p1"); await new Promise((done) => setTimeout(done, 60));
	s.set({ units: 0 }); await flagged(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "finished unseen");
	herdr.focus("w1", "w1:t1", herdr.paneId); await flagged(() => herdr.tokens.get("g1") === `○ IDL${B}`, "seen");
	s.set({ question: { text: "Go?", more: 0, since: Date.now() } }); await flagged(() => herdr.tokens.get("g1") === `× QNS${B}`, "question");
	s.set({ question: null }); herdr.setStatus("done"); await flagged(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "done");
	herdr.dropSubscribers(); await flagged(() => herdr.tokens.get("g1") === `· UNK${B}` || herdr.subscriberCount === 1, "disconnected");
	// A goal takes the right slot: the project gives up the flag's cells and the goal keeps its column.
	herdr.setStatus("idle", false);
	s.set({ goal: { status: "paused", usedSeconds: 30, activeSince: null } });
	await flagged(() => herdr.tokens.get("proj_idle") === `rpiv-mono${B.repeat(2)}` && herdr.tokens.get("gt_off") === `${B.repeat(3)}30s`, "with goal");
	await s.command("/flag");
	assert.deepEqual(s.notes, ["info: Flagged", "info: Flag cleared"]); assert.deepEqual(s.flags(), [true, false]);
	await until(() => !herdr.tokens.has("flag") && herdr.tokens.get("proj_idle") === `rpiv-mono${B.repeat(6)}`, "flag cleared");
	assert.deepEqual(s.errors, []);
});

test("the flag rehydrates on reload and resume, starts false in a new session and never leaks between sessions", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	const s = await piSession(t);
	await s.command("/flag"); s.userMessage("first");
	const first = s.runtime.session.sessionFile;
	await until(() => herdr.tokens.get("flag") === "●", "flagged");
	await s.runtime.session.reload();
	await reported(herdr); assert.equal(herdr.tokens.get("flag"), "●", "after reload"); assert.deepEqual(s.flags(), [true]);
	await s.runtime.newSession();
	await reported(herdr); assert.equal(herdr.tokens.has("flag"), false, "a new session starts unflagged"); assert.deepEqual(s.flags(), []);
	await s.runtime.switchSession(first);
	await reported(herdr); assert.equal(herdr.tokens.get("flag"), "●", "resumed"); assert.deepEqual(s.flags(), [true]);
	await s.command("/flag");
	await until(() => !herdr.tokens.has("flag"), "cleared");
	await s.runtime.newSession();
	await s.command("/flag"); s.userMessage("other");
	await until(() => herdr.tokens.get("flag") === "●", "the other session flagged");
	await s.runtime.switchSession(first);
	await reported(herdr); assert.equal(herdr.tokens.has("flag"), false, "the other session's flag does not leak"); assert.deepEqual(s.flags(), [true, false]);
	await s.runtime.dispose();
	assert.equal(herdr.tokens.size, 0, "Pi exiting clears the flag with every token");
	assert.deepEqual(s.errors, []);
});

test("the flag follows the active branch: tree navigation rewinds it, and a fork or clone copies the value at its point", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	const s = await piSession(t);
	s.userMessage("one");
	await s.command("/flag");
	const second = s.userMessage("two");
	await s.command("/flag");
	const cleared = s.manager().getLeafId();
	await s.command("/flag");
	const latest = s.manager().getLeafId(), file = s.runtime.session.sessionFile;
	await until(() => herdr.tokens.get("flag") === "●", "flagged");
	await s.runtime.session.navigateTree(cleared, { summarize: false });
	await until(() => !herdr.tokens.has("flag"), "rewound to the cleared entry"); assert.deepEqual(s.flags(), [true, false]);
	await s.runtime.session.navigateTree(latest, { summarize: false });
	await until(() => herdr.tokens.get("flag") === "●", "back to the latest entry");
	// Forking before the second message copies the path up to the first /flag.
	await s.runtime.fork(second);
	await reported(herdr); assert.equal(herdr.tokens.get("flag"), "●", "fork"); assert.deepEqual(s.flags(), [true]);
	await s.runtime.switchSession(file);
	await s.runtime.fork(cleared, { position: "at" });
	await reported(herdr); assert.equal(herdr.tokens.has("flag"), false, "clone at the clear"); assert.deepEqual(s.flags(), [true, false]);
	assert.deepEqual(s.errors, []);
});

test("/flag outside Pi's terminal UI inside Herdr saves nothing and reports nothing; it warns where Pi has a UI", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	for (const [mode, ui] of [["print", false], ["json", false], ["rpc", true]] as const) {
		const s = await piSession(t, { mode, ui });
		await s.command("/flag");
		assert.deepEqual(s.flags(), [], mode);
		assert.deepEqual(s.notes, ui ? [FLAG_WARNING] : [], mode);
	}
	assert.equal(herdr.log.length, 0);
	herdrEnv(t, { HERDR_ENV: undefined, HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: herdr.socketPath });
	const outside = await piSession(t);
	await outside.command("/flag");
	assert.deepEqual(outside.flags(), []); assert.deepEqual(outside.notes, [FLAG_WARNING]);
	assert.equal(herdr.log.length, 0);
	// Arguments are not modes: `/flag off` neither toggles nor saves.
	inside(t, herdr);
	const s = await piSession(t);
	await s.command("/flag off");
	assert.deepEqual(s.flags(), []); assert.deepEqual(s.notes, ["warning: Usage: /flag"]);
});

test("savedFlag: the latest valid boolean on the active branch wins; malformed and other entries are ignored", async () => {
	const { savedFlag, FLAG_ENTRY } = await load("src/extension.ts");
	assert.equal(FLAG_ENTRY, "industrial-os:herdr-sidebar:flag");
	const m = host.SessionManager.inMemory(scratch);
	assert.equal(savedFlag(m.getBranch()), false);
	m.appendCustomEntry(FLAG_ENTRY, { flagged: true });
	const on = m.getLeafId();
	for (const data of [undefined, null, {}, { flagged: "false" }, { flagged: 0 }]) m.appendCustomEntry(FLAG_ENTRY, data);
	m.appendCustomEntry("another-extension", { flagged: false });
	m.appendMessage({ role: "user", content: "x", timestamp: 0 });
	assert.equal(savedFlag(m.getBranch()), true);
	m.appendCustomEntry(FLAG_ENTRY, { flagged: false });
	assert.equal(savedFlag(m.getBranch()), false);
	// The abandoned branch is still in the session but does not decide the active branch's value.
	m.branch(on);
	assert.equal(savedFlag(m.getBranch()), true);
});

const BG_REQUEST = "pi-background-tasks:request:v1", BG_RESPONSE = "pi-background-tasks:response:v1", BG_TERMINAL = "pi-background-tasks:terminal:v1";
const bgTerminal = { schema_version: "pi-background-tasks.extension-terminal.v1", task: { id: "task", status: "completed" } };
const bgResponse = (request: any, statuses: string[] = []) => ({ schema_version: "pi-background-tasks.extension-response.v1", request_id: request.request_id, operation: "status", ok: true, result: { tasks: statuses.map((status, n) => ({ id: `task-${n}`, status })) } });
const endTool = (h: any, toolName = "bg_run") => h.runner.emit({ type: "tool_execution_end", toolName, toolCallId: "call", input: {}, result: { content: [] }, isError: false });

// Fake producer frames follow 2.6.9 core/extension-api.ts; no background-task package code is loaded.
test("background status gives RUN, precedence, token choices, unseen completion and clears on seen/work/rise", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	herdr.focus("w2", "w2:t1", "w2:p1", false);
	const h = await harness(t);
	let statuses = ["running", "completed", "failed", "killed"];
	let valid = true;
	const requests: any[] = [];
	h.events.on(BG_REQUEST, (request: any) => { requests.push(request); h.events.emit(BG_RESPONSE, valid ? bgResponse(request, statuses) : { ...bgResponse(request), ok: false }); });
	await h.start(); h.set({ context: { usedPercent: 67 }, model: { id: "m", provider: "p" } });
	await until(() => herdr.tokens.get("g1") === `◐ RUN${B}` && herdr.tokens.has("bar"), "RUN from status");
	assert.equal(requests[0].schema_version, "pi-background-tasks.extension-request.v1");
	assert.equal(requests[0].operation, "status"); assert.deepEqual(requests[0].payload, {});
	assert.equal(herdr.tokens.get("proj"), "tatsu-cli"); assert.equal(herdr.tokens.has("proj_idle"), false);
	assert.equal(herdr.tokens.has("bar_idle"), false); assert.equal(herdr.tokens.get("g2_au0"), "00AU", "background tasks do not invent subagent units");
	assert.equal(herdr.tokens.get("g2_bg"), "01BG");
	h.set({ units: 2 }); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "SUB beats RUN");
	assert.equal(herdr.tokens.get("g2_bg"), "01BG", "SUB does not hide the running count");
	herdr.setStatus("working"); await until(() => herdr.tokens.get("g1") === `◐ WRK${B}`, "WRK beats both");
	assert.equal(herdr.tokens.get("g2_bg"), "01BG", "WRK does not hide the running count");
	h.set({ units: 0 }); herdr.setStatus("blocked"); await until(() => herdr.tokens.get("g1") === `× BLK${B}`, "BLK beats RUN");
	h.set({ question: { text: "q", more: 0 } }); await until(() => herdr.tokens.get("g1") === `× QNS${B}`, "QNS beats RUN");
	h.set({}); herdr.setStatus("idle"); await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "RUN restored");
	h.set({ units: 1 }); await until(() => herdr.tokens.get("g1") === `◐ SUB${B}`, "subagents alongside tasks");
	h.set({ units: 0 }); await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "subagents finish during RUN");
	assert.equal(herdr.tokens.has("ev_rdy_text"), false, "ongoing tasks suppress the subagent completion");
	statuses = ["completed"]; h.events.emit(BG_TERMINAL, bgTerminal);
	await until(() => herdr.tokens.get("g1") === `✓ DNE${B}` && herdr.tokens.get("g5") === `RDY${B}`, "unseen background finish");
	assert.ok(herdr.tokens.get("ev_rdy_text")?.startsWith("finished")); assert.equal(herdr.tokens.get("ph_age"), `${B.repeat(4)}0s`);
	assert.equal(herdr.tokens.get("g2_bg0"), "00BG"); assert.equal(herdr.tokens.has("g2_bg"), false);
	// Duplicate terminal frames only re-read; they cannot restart the finish age or decrement a count.
	h.events.emit(BG_TERMINAL, bgTerminal);
	herdr.focus("w1", "w1:t1", "w1:p1"); await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "seen clears");
	herdr.focus("w2", "w2:t1", "w2:p1"); await visibilityRead(herdr, workspaceReads(herdr));
	for (const clear of ["rise", "work"]) {
		statuses = ["running"]; await endTool(h); await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "running again");
		statuses = []; h.events.emit(BG_TERMINAL, bgTerminal); await until(() => herdr.tokens.get("g1") === `✓ DNE${B}`, "finished again");
		if (clear === "rise") {
			statuses = ["running"]; await endTool(h); await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "rise clears");
			valid = false; await endTool(h); await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "rise removed the old flag, unknown is not another finish");
			assert.equal(herdr.tokens.get("g2_bg0"), "??BG");
			valid = true;
		} else {
			herdr.setStatus("working"); await until(() => herdr.tokens.get("g1") === `◐ WRK${B}`, "work clears");
			herdr.setStatus("idle"); await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "no old completion");
		}
	}
	assert.deepEqual(h.errors, []);
});

test("background requests coalesce, fence stale/wrong/late/runtime responses, and re-query all start tools and reconnect", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	const h = await harness(t); const requests: any[] = []; let automatic = true;
	h.events.on(BG_REQUEST, (request: any) => { requests.push(request); if (automatic) h.events.emit(BG_RESPONSE, bgResponse(request)); });
	await h.start(); await until(() => herdr.tokens.get("g1") === `○ IDL${B}` && herdr.subscriberCount === 1, "initial read");
	for (const tool of ["bg_run", "bg_run_pi_attested", "bg_delegate", "fusion_reason", "fusion_investigate", "fusion_research", "fusion_validate"]) {
		const before = requests.length; await endTool(h, tool); assert.equal(requests.length, before + 1, tool);
	}
	let before = requests.length; await endTool(h, "read"); assert.equal(requests.length, before);
	h.events.emit(BG_TERMINAL, { ...bgTerminal, schema_version: "unknown" }); assert.equal(requests.length, before);
	automatic = false; await endTool(h); const pending = requests.at(-1);
	await endTool(h); h.events.emit(BG_TERMINAL, bgTerminal); assert.equal(requests.length, before + 1, "one in flight");
	h.events.emit(BG_RESPONSE, { ...bgResponse(pending, ["running"]), request_id: "wrong" }); assert.equal(requests.length, before + 1);
	h.events.emit(BG_RESPONSE, bgResponse(pending, ["running"])); assert.equal(requests.length, before + 2, "one coalesced follow-up");
	await sleep(40); assert.equal(herdr.tokens.get("g1"), `○ IDL${B}`, "stale running count ignored");
	h.events.emit(BG_RESPONSE, bgResponse(requests.at(-1), ["running"])); await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "current response");
	h.events.emit(BG_RESPONSE, bgResponse(pending)); await sleep(40); assert.equal(herdr.tokens.get("g1"), `◐ RUN${B}`);
	automatic = true; before = requests.length; herdr.dropSubscribers();
	await until(() => requests.length > before && herdr.subscriberCount === 1 && herdr.tokens.get("g1") === `○ IDL${B}`, "reconnect re-query");
	automatic = false; await endTool(h); const old = requests.at(-1); await h.stop();
	const replacement = await harness(t, { events: h.events }); await replacement.start();
	await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "replacement runtime");
	h.events.emit(BG_RESPONSE, bgResponse(old, ["running"])); await sleep(40); assert.equal(herdr.tokens.get("g1"), `○ IDL${B}`);
	await replacement.stop(); before = requests.length;
	h.events.emit(BG_TERMINAL, bgTerminal); await endTool(h); assert.equal(requests.length, before, "no requests after shutdown");
});

test("background unknown/absent/malformed/timeout never gives RUN or an inferred finish; renewal re-queries", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	herdr.focus("w2", "w2:t1", "w2:p1", false);
	const scheduled: { callback: () => void; delay: number; timer: NodeJS.Timeout }[] = [];
	const original = globalThis.setTimeout;
	t.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number, ...args: any[]) => {
		const timer = original(callback, delay, ...args); scheduled.push({ callback, delay, timer }); return timer;
	});
	const h = await harness(t); const requests: any[] = []; let respond = true;
	let frame: (request: any) => any = (request) => bgResponse(request);
	let deadline: (typeof scheduled)[number];
	h.events.on(BG_REQUEST, (request: any) => { requests.push(request); deadline = scheduled.at(-1)!; if (respond) h.events.emit(BG_RESPONSE, frame(request)); });
	await h.start(); h.set({ model: { id: "m", provider: "p" } });
	await until(() => herdr.tokens.get("g1") === `○ IDL${B}` && herdr.tokens.has("mthink"), "known idle");
	for (const malformed of [(r: any) => ({ ...bgResponse(r, ["running"]), schema_version: "v2" }), (r: any) => ({ ...bgResponse(r), ok: false }), (r: any) => ({ ...bgResponse(r), result: { tasks: [{ id: "a", status: "queued" }] } }), (r: any) => ({ request_id: r.request_id })]) {
		frame = malformed; await endTool(h); await sleep(20); assert.equal(herdr.tokens.get("g1"), `○ IDL${B}`);
	}
	respond = false; await endTool(h); const timedOut = requests.at(-1);
	assert.equal(deadline!.delay, 1500); assert.equal(deadline!.timer.hasRef(), false); deadline!.callback();
	h.events.emit(BG_RESPONSE, bgResponse(timedOut, ["running"])); await sleep(20); assert.equal(herdr.tokens.get("g1"), `○ IDL${B}`, "late response ignored");
	respond = true; frame = (r) => bgResponse(r, ["running"]); await endTool(h);
	await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "running");
	const before = requests.length;
	const renewal = scheduled.findLast((item) => item.delay === 20_000)!;
	assert.ok(renewal); assert.equal(renewal.timer.hasRef(), false); clearTimeout(renewal.timer); renewal.callback();
	assert.equal(requests.length, before + 1, "renewal re-queries");
	assert.equal(herdr.tokens.has("mthink_d1"), false);
	// Losing the producer after a known running count is unknown, never a fabricated completion.
	respond = false; await endTool(h); deadline!.callback();
	await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "timeout removes RUN without DNE");
	assert.equal(herdr.tokens.has("ev_rdy_text"), false);
	await endTool(h); const onShutdown = deadline!; await h.stop();
	assert.equal((onShutdown.timer as any)._destroyed, true, "request deadline disposed");
	assert.deepEqual(h.errors, []);
});

test("background readiness refusal retries once after a short delay and disposes the retry on replacement/shutdown", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); inside(t, herdr);
	const retries: { callback: () => void; timer: NodeJS.Timeout }[] = [];
	let handlingRefusal = false;
	const original = globalThis.setTimeout;
	t.mock.method(globalThis, "setTimeout", (callback: () => void, delay: number, ...args: any[]) => {
		const timer = original(callback, delay, ...args);
		if (handlingRefusal && delay === 1_000) retries.push({ callback, timer });
		return timer;
	});
	const h = await harness(t); const requests: any[] = []; let ready = false;
	h.events.on(BG_REQUEST, (request: any) => {
		requests.push(request);
		handlingRefusal = !ready;
		h.events.emit(BG_RESPONSE, ready ? bgResponse(request, ["running"]) : {
			schema_version: "pi-background-tasks.extension-response.v1", request_id: request.request_id,
			operation: "status", ok: false, error: "pi-background-tasks EventBus service is unavailable before session_start",
		});
		handlingRefusal = false;
	});
	await h.start(); await until(() => herdr.tokens.get("g1") === `○ IDL${B}`, "initial refusal stays unknown");
	assert.equal(retries.length, 1, "readiness refusal schedules a delayed retry");
	assert.equal(retries[0].timer.hasRef(), false);
	assert.equal(requests.length, 1, "reconnect trigger cannot bypass the pending retry");
	ready = true; clearTimeout(retries[0].timer); retries[0].callback();
	await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "late-starting producer recovered without renewal");
	assert.equal(requests.length, 2);

	ready = false; await h.start("reload");
	assert.equal(retries.length, 2, "replacement runtime gets its own single retry");
	clearTimeout(retries[1].timer); retries[1].callback();
	await sleep(30); assert.equal(retries.length, 2, "a second refusal cannot create a retry loop");
	const beforeReplacement = requests.length;
	await h.start("reload"); const replaced = retries.at(-1)!;
	ready = true; await h.start("reload");
	await until(() => herdr.tokens.get("g1") === `◐ RUN${B}`, "replacement running");
	assert.ok(requests.length > beforeReplacement);
	assert.equal((replaced.timer as any)._destroyed, true, "replacement clears the old retry");
	let count = requests.length; replaced.callback(); assert.equal(requests.length, count, "old callback is fenced");
	ready = false; await h.start("reload"); const stopped = retries.at(-1)!;
	await h.stop(); count = requests.length;
	assert.equal((stopped.timer as any)._destroyed, true, "shutdown clears the retry");
	stopped.callback(); assert.equal(requests.length, count);
	assert.deepEqual(h.errors, []);
});
