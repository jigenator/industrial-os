import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { observeSignals } from "../src/signals.ts";
const root = process.env.PI_HOST_ROOT;
const host = await import(root ? pathToFileURL(resolve(root, "dist/index.js")).href : "@earendil-works/pi-coding-agent");
const require = createRequire(root ? resolve(root, "package.json") : import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, alias: { "@earendil-works/pi-tui": require.resolve("@earendil-works/pi-tui") } });
const { styleText } = await import(pathToFileURL(require.resolve("@earendil-works/pi-tui")).href);
const theme = { style: (text: string, options: object) => styleText(text, options, "truecolor"), getColorMode: () => "truecolor" };
const { renderFooter } = await jiti.import(resolve("src/footer.ts"));
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const dto = (sessionId = "live", seq = 1) => ({ version: 1, sessionId, seq, launch: "/launch", active: "/active", workspace: null, pr: null, compactions: 0, units: 0, context: { reserve: 16384 }, usage: { installed: false, providers: [] } });
test("observeSignals handshakes both orders; absence/asynchronous reply means unknown; version/session/seq validation; disposal", () => {
	const events = host.createEventBus(), pi = { events } as any, seen: any[] = [];
	const consumer = observeSignals(pi, () => "live", (s) => seen.push(s)); assert.equal(seen.at(-1), undefined);
	let current = dto(); const off = events.on("signals-collector:v1:request", (r: any) => r.reply(current));
	events.emit("signals-collector:v1:ready", { version: 1, sessionId: "live" }); assert.equal(seen.at(-1).seq, 1);
	for (const raw of [dto("other", 10), { ...dto(), version: 2 }, dto("live", 0)]) { const count = seen.length; events.emit("signals-collector:v1:snapshot", raw); assert.equal(seen.length, count); }
	current = { ...dto("live", 2), additive: true } as any; events.emit("signals-collector:v1:snapshot", current); assert.equal(seen.at(-1).active, "/active");
	seen.at(-1).active = "mutated"; assert.equal(current.active, "/active");
	const other: any[] = [], early = observeSignals(pi, () => "live", (s) => other.push(s)); assert.equal(other.at(-1).seq, 2); early.dispose();
	consumer.dispose(); const count = seen.length; events.emit("signals-collector:v1:snapshot", dto("live", 3)); assert.equal(seen.length, count);
	off(); let deferred: any; events.on("signals-collector:v1:request", (r: any) => { deferred = r.reply; });
	const absent: any[] = [], late = observeSignals(pi, () => "live", (s) => absent.push(s)); assert.equal(absent.at(-1), undefined); deferred(dto()); assert.deepEqual(absent, [undefined]); late.dispose();
});

async function composed(t: any, order: string[]) {
	const directory = await mkdtemp(join(tmpdir(), "pi-signals-consumer-")), bin = join(directory, "bin"); await mkdir(bin);
	await writeFile(join(bin, "git"), "#!/bin/sh\nprintf 'fatal: not a git repository' >&2\nexit 128\n"); await chmod(join(bin, "git"), 0o755);
	const oldEnv = { ...process.env }; Object.assign(process.env, { PATH: bin, XDG_CACHE_HOME: join(directory, "cache") });
	const events = host.createEventBus(), manager = host.SessionManager.inMemory(directory);
	const loader = new host.DefaultResourceLoader({ eventBus: events, cwd: directory, agentDir: join(directory, "agent"), settingsManager: host.SettingsManager.inMemory(), additionalExtensionPaths: order, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await loader.reload(); const loaded = loader.getExtensions(); assert.deepEqual(loaded.errors, []); assert.deepEqual(loaded.warnings, []);
	const runner = new host.ExtensionRunner(loaded.extensions, loaded.runtime, directory, manager, undefined); let component: any, builder: any;
	const statuses = new Map(), model = { provider: "fixture", id: "model", name: "Fixture", contextWindow: 128000, reasoning: true }, usage = { tokens: 48000, contextWindow: 128000, percent: 37.5 };
	const errors: unknown[] = []; runner.onError((e: unknown) => errors.push(e));
	runner.bindCore({ sendMessage() {}, sendUserMessage() {}, appendEntry() {}, setSessionName() {}, getSessionName: () => undefined, setLabel() {}, getActiveTools: () => [], getAllTools: () => [], getSettings: () => ({}), setActiveTools() {}, refreshTools() {}, getCommands: () => [], setModel: async () => true, getThinkingLevel: () => "high", setThinkingLevel() {} }, { getModel: () => model, getScopedModels: () => [], isIdle: () => true, isProjectTrusted: () => false, getSignal: () => undefined, abort() {}, hasPendingMessages: () => false, shutdown() {}, getContextUsage: () => usage, compact() {}, getSystemPrompt: () => "" });
	runner.setUIContext({ notify() {}, setStatus() {}, setFooter(b: any) { component?.dispose(); builder = b; component = b?.({ requestRender() {} }, theme, { getExtensionStatuses: () => statuses }); } }, "tui");
	let cleaned = false;
	const cleanup = async () => { if (cleaned) return; cleaned = true; await runner.emit({ type: "session_shutdown", reason: "quit" }); component?.dispose(); for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv); await rm(directory, { recursive: true, force: true }); };
	t.after(cleanup);
	await runner.emit({ type: "session_start", reason: "startup" });
	const initialText = component.render(180).join("\n").replace(/\x1b\[[0-9;]*m/g, "");
	await runner.getCommand("footer-motion")!.handler("off", runner.createContext());
	await sleep(900); let snapshot: any; events.emit("signals-collector:v1:request", { reply: (s: any) => { snapshot = s; } });
	return { cleanup, runner, events, component: () => component, replace() { component.dispose(); component = builder({ requestRender() {} }, theme, { getExtensionStatuses: () => statuses }); }, snapshot, directory, statuses, model, usage, errors, initialText };
}
test("actual Pi loader composes display/collector in both orders: equal renderer bytes and replacement handshake", async (t) => {
	for (const order of [[resolve("."), resolve("../signals-collector")], [resolve("../signals-collector"), resolve(".")]]) {
		const h = await composed(t, order); assert.match(h.initialText, /Git pending/); assert.doesNotMatch(h.initialText, /no collector/); assert.ok(h.snapshot); assert.equal(h.snapshot.compactions, 0); assert.equal(h.snapshot.usage.installed, false);
		const expected = { homePath: homedir(), launchPath: h.snapshot.launch, activePath: h.snapshot.active, workspace: h.snapshot.workspace ?? undefined, pullRequest: h.snapshot.pr,
			activity: { working: false, units: h.snapshot.units }, compactions: h.snapshot.compactions, tatsu: undefined, ponytail: "unknown", statuses: h.statuses, model: h.model, thinking: "high", contextUsage: h.usage, compactionReserve: h.snapshot.context.reserve };
		for (const width of [1, 20, 60, 120, 280]) assert.deepEqual(h.component().render(width), renderFooter(expected, width, theme));
		const before = h.component().render(120); h.replace(); await sleep(20); assert.deepEqual(h.component().render(120), before); assert.deepEqual(h.errors, []);
		await h.cleanup();
	}
});
test("missing collector: no data subprocesses, unknown AU/CMP/Active/Git, live CTX/MDL still displayed", async (t) => {
	const spawn = t.mock.method(ChildProcess.prototype, "spawn"); const h = await composed(t, [resolve(".")]);
	assert.equal(h.snapshot, undefined); assert.equal(h.runner.getToolDefinition("set_active_project"), undefined); assert.equal(spawn.mock.callCount(), 0);
	const text = h.component().render(180).join("\n").replace(/\x1b\[[0-9;]*m/g, ""); assert.match(text, /CMP×\?\?/); assert.match(text, /\? AU/); assert.match(text, /unknown/); assert.match(text, /Git unavailable \(no collector\)/); assert.doesNotMatch(text, /pending|lookup pending/); assert.match(text, /fixture\/model/); assert.doesNotMatch(text, /CMP×00|00 AU|clean/);
});
