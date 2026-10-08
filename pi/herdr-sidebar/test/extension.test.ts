// Integration tests: the extension loaded by the installed Pi's real loader and driven through its real
// ExtensionRunner and event bus, against the fake Herdr server. A small fake collector extension, loaded before or
// after this one, publishes snapshots on the signals-collector v1 channels.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { host } from "./host.ts";
import { startFakeHerdr, until, type FakeHerdr } from "./fake-herdr.ts";

const packageRoot = resolve(".");
const B = "⠀";
const UNKNOWN_ROWS = { g2_au0: "??AU", bar_unk: "─────────── --%", cmpx: "CMP×??" };

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
		const h = await harness(t, { mode });
		await h.start();
		h.events.emit("signals-collector:v1:snapshot", { version: 1, sessionId: h.sessionId(), seq: 1, active: "/w", question: { text: "q", more: 0, since: 0 } });
		h.events.emit("signals-collector:v1:ready", { version: 1, sessionId: h.sessionId() });
		await new Promise((done) => setTimeout(done, 60));
		await h.stop();
		assert.deepEqual(h.blocked, [], mode);
		assert.deepEqual(h.errors, [], mode);
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
		assert.deepEqual(tokens(herdr), sorted({ g1: `○ IDL${B}`, proj_idle: "tatsu-cli", g2_au0: "00AU", bar_unk: "─────────── --%", cmpx: "CMP×00", g3: `ACT${B}`, dir: "/work/tatsu-cli" }));
		h.set({ units: 3, compactions: 4, context: { tokens: 1, window: 1, reserve: null, usedPercent: 67 }, model: { provider: "anthropic", id: "claude-opus-5-5" }, thinking: "high" });
		await until(() => herdr.tokens.get("mthink") === "opus-5.5/hi", "pushed snapshot");
		assert.equal(herdr.tokens.get("g2_au"), "03AU");
		assert.equal(herdr.tokens.get("g2_au0"), undefined, "a key that stopped applying is cleared");
		assert.equal(herdr.tokens.get("bar_idle"), "━━━━━━━━─── 67%");
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
	assert.equal(herdr.tokens.get("ev_act"), `npm test${B.repeat(7)}`);
	assert.equal(herdr.tokens.get("g5"), `SH${B}${B}`);
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
