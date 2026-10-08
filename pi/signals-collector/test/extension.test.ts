import assert from "node:assert/strict";
import { ChildProcess, execFileSync } from "node:child_process";
import { chmod, cp, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";

// This gate loads the actual collector through the installed Pi loader. External
// commands and optional public fleet replies are deterministic offline fixtures.
// PI_HOST_ROOT supports a globally installed Pi without relying on CommonJS
// resolution for Pi's import-only package export.
const hostSpecifier = process.env.PI_HOST_ROOT
	? pathToFileURL(resolve(process.env.PI_HOST_ROOT, "dist/index.js")).href
	: "@earendil-works/pi-coding-agent";
const host = await import(hostSpecifier);
const hostRequire = createRequire(process.env.PI_HOST_ROOT ? resolve(process.env.PI_HOST_ROOT, "package.json") : import.meta.url);

const git = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8" }).trim();
const packageRoot = resolve(".");
const source = resolve("src/extension.ts");
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
const lines = async (path: string) => { try { return (await readFile(path, "utf8")).split("\n").filter(Boolean); } catch { return []; } };
// Signal 0 only probes: a reaped child is gone, and the extension has seen its exit.
const running = (pid: number) => { try { process.kill(pid, 0); return true; } catch (error: any) { return error.code !== "ESRCH"; } };
// Captured before any test mocks timers: waits on real subprocesses while adapter timers are mocked.
const nativeSetTimeout = setTimeout;
const realSleep = (ms: number) => new Promise((done) => nativeSetTimeout(done, ms));
async function untilReal(check: () => boolean | Promise<boolean>) {
	for (let n = 0; n < 400; n++) { if (await check()) return; await realSleep(20); }
	throw new Error("Timed out waiting for integrated extension");
}
async function until(check: () => boolean | Promise<boolean>) {
	for (let n = 0; n < 200; n++) { if (await check()) return; await sleep(20); }
	throw new Error("Timed out waiting for integrated extension");
}

// Fakes on PATH (POSIX sh: far faster to start than Node wrappers). PATH is only the fixture's `bin`, so utilities
// are absolute; fixture paths come from PI_FOOTER_FIXTURE. Contents never vary because the OS checks a new
// executable's content on its first run (~0.25 s on macOS); each fixture links these once-per-run files.
// Every call logs its pid first. A `.hold-git` file in the cwd parks every Git call except
// `rev-parse --show-toplevel` (selection and the first inspection step) until the file is removed.
const fakeGit = `#!/bin/sh
printf '%s %s %s\\n' "$$" "$PWD" "$*" >> "$PI_FOOTER_FIXTURE/git.log"
if [ "$1" = symbolic-ref ] && [ -e .broken-head ]; then printf 'branch failure' >&2; exit 128; fi
if [ "$1 $2" != "rev-parse --show-toplevel" ]; then while [ -e .hold-git ]; do /bin/sleep 0.02 </dev/null >/dev/null 2>&1; done; fi
exec ${quote(git)} "$@"
`;
// Deterministic gh boundary, never a live account or network. [] either means
// no PR or a truthful unavailable result if the domain rejects that protocol.
const fakeGh = `#!/bin/sh
printf '%s %s\\n' "$$" "$*" >> "$PI_FOOTER_FIXTURE/gh.log"
printf '[]'
`;
// Deterministic `codexbar`: the n-th call for a provider prints `<provider>.<n>.json` (else `<provider>.json`) from
// the fixture's `codexbar` directory, exits 1 for an error payload, and records SIGTERM. A `hold-<provider>.<n>` file
// keeps that call pending until the test releases it, independent of real-time scheduling. The trap is armed
// before the call is logged, so a logged call always records its SIGTERM.
const fakeCodexbarScript = `#!/bin/sh
p=$3 dir="$PI_FOOTER_FIXTURE/codexbar" log="$PI_FOOTER_FIXTURE/codexbar.log"
trap 'printf "%s\\n" "$p" >> "$PI_FOOTER_FIXTURE/codexbar.kills"; exit 143' TERM
prior=0; [ -e "$log" ] && prior=$(/usr/bin/grep -c -e " --provider $p " "$log")
printf '%s %s\\n' "$$" "$*" >> "$log"
while [ -e "$dir/hold-$p.$prior" ]; do /bin/sleep 0.02 </dev/null >/dev/null 2>&1; done
if [ -e "$dir/$p.$prior.json" ]; then out=$(/bin/cat "$dir/$p.$prior.json"); else out=$(/bin/cat "$dir/$p.json" 2>/dev/null); fi
printf '%s' "$out"
case $out in *'"error"'*) exit 1 ;; esac
`;
const gitIsolation = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0" };
const runGit = (cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env) => execFileSync(git, ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd, env, encoding: "utf8" });
const shared = await realpath(await mkdtemp(join(tmpdir(), "pi-footer-shared-")));
after(() => rm(shared, { recursive: true, force: true }));
const fakes = join(shared, "fakes"), seed = join(shared, "seed");
await Promise.all([fakes, seed].map((path) => mkdir(path)));
for (const [name, script] of [["git", fakeGit], ["gh", fakeGh], ["codexbar", fakeCodexbarScript]]) {
	await writeFile(join(fakes, name), script); await chmod(join(fakes, name), 0o755);
}
// One isolated seed repository (branch `release`, one empty commit); each fixture copies it.
runGit(seed, ["init", "-b", "release"], { ...process.env, ...gitIsolation });
runGit(seed, ["commit", "--allow-empty", "-m", "fixture"], { ...process.env, ...gitIsolation });

async function fixtures(t: any) {
	const root = await realpath(await mkdtemp(join(tmpdir(), "pi-footer-integration-")));
	const bin = join(root, "bin"), launch = join(root, "launch"), plain = join(root, "plain ü"), repo = join(root, "repo"), second = join(root, "other repo");
	await Promise.all([bin, launch, plain].map((path) => mkdir(path)));
	await Promise.all([repo, second].map((path) => cp(seed, path, { recursive: true })));
	await Promise.all(["git", "gh"].map((name) => symlink(join(fakes, name), join(bin, name))));
	const saved = { ...process.env };
	Object.assign(process.env, { PATH: bin, PI_FOOTER_FIXTURE: root, XDG_CACHE_HOME: join(root, "cache"), ...gitIsolation });
	const gitLog = join(root, "git.log"), ghLog = join(root, "gh.log");
	t.after(async () => {
		// Preserve Node's native environment object so os.homedir sees later HOME changes.
		for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
		Object.assign(process.env, saved);
		await rm(root, { recursive: true, force: true });
	});
	const count = async (path: string) => (await lines(path)).length;
	// Every Git and gh process has ended, so its result has reached the extension.
	const idle = async () => [...await lines(gitLog), ...await lines(ghLog)].every((line) => !running(Number.parseInt(line)));
	// Pids of `.hold-git` calls made in `cwd`.
	const parked = async (cwd: string) => (await lines(gitLog)).filter((line) => line.includes(` ${cwd} `) && !line.endsWith(" rev-parse --show-toplevel")).map((line) => Number.parseInt(line));
	return { root, launch, plain, repo, second, runGit, gitLog, ghLog, count, idle, parked };
}

async function harness(f: any, manager: any, mode = "tui") {
	const events = host.createEventBus();
	const loader = new host.DefaultResourceLoader({ eventBus: events, cwd: f.launch, agentDir: join(f.root, "agent"), settingsManager: host.SettingsManager.inMemory(), additionalExtensionPaths: [packageRoot], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await loader.reload();
	const loaded = loader.getExtensions();
	assert.deepEqual(loaded.errors, []); assert.deepEqual(loaded.warnings, []); assert.equal(loaded.extensions[0].path, source);
	const runner = new host.ExtensionRunner(loaded.extensions, loaded.runtime, f.launch, manager, undefined);
	const tool = runner.getToolDefinition("set_active_project"); assert.ok(tool);
	let idle = true, thinking = "high", settings: any = {};
	let model: any = { id: "model", provider: "fixture", contextWindow: 128000 };
	let usage: any = { tokens: 48000, contextWindow: 128000, percent: 37.5 };
	const errors: unknown[] = []; runner.onError((e: unknown) => errors.push(e));
	runner.bindCore({ sendMessage() {}, sendUserMessage() {}, appendEntry: (type: string, data: any) => manager.appendCustomEntry(type, data), setSessionName() {}, getSessionName: () => undefined, setLabel() {},
		getActiveTools: () => [tool.name], getAllTools: () => [tool], getSettings: () => structuredClone(settings), setActiveTools() {}, refreshTools() {}, getCommands: () => [], setModel: async () => true,
		getThinkingLevel: () => thinking, setThinkingLevel: (v: string) => { thinking = v; },
	}, { getModel: () => model, getScopedModels: () => [], isIdle: () => idle, isProjectTrusted: () => false, getSignal: () => undefined, abort() {}, hasPendingMessages: () => false, shutdown() {}, getContextUsage: () => usage, compact() {}, getSystemPrompt: () => "" });
	runner.setUIContext({ setFooter() { throw new Error("collector must not install a display"); } }, mode);
	const pushed: any[] = [], ready: any[] = [], requests: any[] = [];
	events.on("signals-collector:v1:snapshot", (s: unknown) => pushed.push(s));
	events.on("signals-collector:v1:ready", (s: unknown) => ready.push(s));
	let rpc: ((r: any) => void) | undefined;
	events.on("subagents:rpc:v1:request", (r: any) => { requests.push(r); rpc?.(r); });
	const read = () => { let result: any; events.emit("signals-collector:v1:request", { reply: (s: any) => { result = s; } }); return result; };
	const select = async (path: string, signal?: AbortSignal) => {
		const id = `selection-${manager.getEntries().length}`;
		const result = await tool.execute(id, { path }, signal, undefined, runner.createToolContext(id, signal));
		manager.appendMessage({ role: "toolResult", toolName: tool.name, toolCallId: id, content: result.content, details: result.details, timestamp: Date.now(), isError: false });
		return result;
	};
	return { events, runner, tool, pushed, ready, requests, errors, read, select,
		start: (reason = "startup") => runner.emit({ type: "session_start", reason }), stop: () => runner.emit({ type: "session_shutdown", reason: "quit" }),
		idle: (v: boolean) => { idle = v; }, model: (v: any) => { model = v; }, thinking: (v: string) => { thinking = v; }, settings: (v: any) => { settings = v; }, usage: (v: any) => { usage = v; },
		rpc: (handler: (r: any) => void) => { rpc = handler; },
		reply: (r: any, data: any, envelope = {}) => events.emit(`subagents:rpc:v1:reply:${r.requestId}`, { version: 1, requestId: r.requestId, method: r.method, success: true, data, ...envelope }),
	};
}
const toolEnd = (id = "tool", toolName = "write") => ({ type: "tool_execution_end", toolCallId: id, toolName, result: {}, isError: false });

test("TUI-only collection; synchronous request/ready; strict seq, immutable replies and bounded coalescing", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager); t.after(() => h.stop());
	assert.equal(h.read(), undefined); await h.start();
	assert.deepEqual(h.ready, [{ version: 1, sessionId: manager.getSessionId() }]);
	const initial = h.read(); assert.equal(initial.version, 1); assert.equal(initial.sessionId, manager.getSessionId()); assert.equal(initial.launch, f.launch);
	initial.active = "mutated"; assert.equal(h.read().active, f.launch);
	await until(() => h.pushed.length > 0); await until(() => h.read().workspace !== null && h.read().usage.installed === false); await sleep(150);
	const times: number[] = []; h.events.on("signals-collector:v1:snapshot", () => times.push(Date.now()));
	h.idle(false); const before = h.pushed.length, at = Date.now();
	for (let n = 0; n < 30; n++) await h.runner.emit({ type: "agent_start" });
	await sleep(115); assert.equal(h.pushed.length, before + 1); assert.ok(times[0] - at <= 110);
	assert.ok(h.pushed.every((s: any, i: number) => i === 0 || s.seq > h.pushed[i - 1].seq));
	assert.ok(times.every((time, i) => i === 0 || time - times[i - 1] >= 95));
	const old = h.read().seq; await h.runner.emit({ type: "session_tree", newLeafId: null, oldLeafId: null });
	assert.equal(h.ready.length, 2); assert.ok(h.read().seq > old);
	const saved = h.read(); manager.newSession(); assert.equal(h.read(), undefined, "live session ID ownership rejects stale requests");
	await h.start("new"); assert.notEqual(h.read().sessionId, saved.sessionId);
	await h.stop(); assert.equal(h.read(), undefined); const stopped = h.pushed.length; await sleep(150); assert.equal(h.pushed.length, stopped);
	for (const mode of ["print", "json", "rpc"]) {
		const non = await harness(f, host.SessionManager.inMemory(f.launch), mode); t.after(() => non.stop());
		const spawns = t.mock.method(ChildProcess.prototype, "spawn"); await non.start(); await sleep(300);
		assert.equal(spawns.mock.callCount(), 0); spawns.mock.restore();
		assert.equal(non.read(), undefined); assert.deepEqual(non.pushed, []); assert.deepEqual(non.ready, []); assert.deepEqual(non.requests, []);
	}
	assert.deepEqual(h.errors, []);
});

test("set_active_project is display-only, restores selected branch/reload/resume/fork and resets new sessions", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.create(f.launch, join(f.root, "sessions")), h = await harness(f, manager); t.after(() => h.stop());
	manager.appendMessage({ role: "assistant", content: [], api: "openai-completions", provider: "fixture", model: "fixture", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "stop", timestamp: Date.now() }); const root = manager.getLeafId();
	const cwd = process.cwd(); await h.start();
	assert.equal(h.tool.executionMode, "sequential"); assert.match(h.tool.promptGuidelines.join(" "), /incidental reads/);
	await h.select(f.repo); const repoId = manager.getLeafId(); await h.select("../plain ü"); assert.equal(h.read().active, f.plain);
	const before = manager.getEntries().length; await assert.rejects(h.select(join(f.root, "missing"))); await assert.rejects(h.select(f.repo, AbortSignal.abort()));
	assert.equal(manager.getEntries().length, before); assert.equal(h.read().active, f.plain); assert.equal(process.cwd(), cwd); assert.equal(manager.getCwd(), f.launch);
	manager.branch(repoId); await h.runner.emit({ type: "session_tree", newLeafId: repoId, oldLeafId: null }); assert.equal(h.read().active, f.repo);
	manager.appendCustomEntry("persist-leaf", {}); await h.stop(); h.runner.invalidate();
	for (const restoredManager of [manager, host.SessionManager.open(manager.getSessionFile()), host.SessionManager.forkFrom(manager.getSessionFile(), f.launch, join(f.root, "forks"))]) {
		const restored = await harness(f, restoredManager); await restored.start("resume"); assert.equal(restored.read().active, f.repo); await restored.stop(); assert.deepEqual(restored.errors, []);
	}
	const next = await harness(f, manager); t.after(() => next.stop()); manager.branch(root); await next.start(); assert.equal(next.read().active, f.launch);
	manager.newSession(); await next.start("new"); assert.equal(next.read().active, f.launch); assert.deepEqual(h.errors, []);
});

test("Git refresh after tools, selection aborts stale work, PR unavailable/TTL, 15s timer and shutdown", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager); t.after(() => h.stop());
	f.runGit(f.repo, ["remote", "add", "origin", "https://github.com/fixture/repo.git"]);
	await h.start(); await h.select(f.repo); await until(() => h.read().pr?.kind === "none");
	assert.equal(h.read().workspace.git.active.dirty, false); const calls = await f.count(f.ghLog);
	await writeFile(join(f.repo, "untracked"), "modified"); await h.runner.emit(toolEnd()); await until(() => h.read().workspace.git.active.dirty === true);
	assert.equal(await f.count(f.ghLog), calls); await h.runner.emit({ type: "session_tree", newLeafId: null, oldLeafId: null }); await until(() => h.read().pr?.kind === "none"); assert.equal(await f.count(f.ghLog), calls);
	await writeFile(join(f.second, ".hold-git"), "hold"); await h.select(f.second); await until(async () => (await f.parked(f.second)).length > 0); await h.select(f.plain);
	await until(() => h.read().workspace?.git.kind === "none"); await until(async () => (await f.parked(f.second)).every((pid: number) => !running(pid)));
	assert.equal(h.read().active, f.plain); assert.equal(h.read().pr.kind, "not-applicable");
	t.mock.timers.enable({ apis: ["setInterval", "Date"], now: Date.now() });
	await h.start("reload"); await h.select(f.repo); await until(() => h.read().pr?.kind === "none");
	await rm(join(f.repo, "untracked")); t.mock.timers.tick(15000); await until(() => h.read().workspace.git.active.dirty === false);
	const count = await f.count(f.ghLog); t.mock.timers.tick(60000); await until(async () => await f.count(f.ghLog) > count);
	await h.stop(); await until(f.idle); const gitCount = await f.count(f.gitLog); t.mock.timers.tick(120000); await sleep(100); assert.equal(await f.count(f.gitLog), gitCount);
	assert.deepEqual(h.errors, []);
});

test("CMP counts only persisted compactions on selected branch, duplicate/boundary/failure events and goal records", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager); t.after(() => h.stop());
	manager.appendCustomEntry("root", {}); manager.appendCompaction("summary", manager.getLeafId(), 1000); const base = manager.getLeafId();
	await h.start(); assert.equal(h.read().compactions, 1);
	const entry = manager.getEntry(manager.appendCompaction("summary", manager.getLeafId(), 1000));
	for (let i = 0; i < 3; i++) await h.runner.emit({ type: "session_compact", compactionEntry: entry, fromExtension: false, reason: "manual", willRetry: false });
	assert.equal(h.read().compactions, 2); await h.runner.emit({ type: "session_compact_failed", reason: "overflow", aborted: true, willRetry: false, fromExtension: false }); assert.equal(h.read().compactions, 2);
	manager.branchWithSummary(base, "summary"); await h.runner.emit({ type: "session_tree", newLeafId: manager.getLeafId(), oldLeafId: entry.id }); assert.equal(h.read().compactions, 1);
	manager.appendCompaction("boundary", manager.getLeafId(), 1000); await h.runner.emit({ type: "turn_start", turnIndex: 1, timestamp: Date.now() }); assert.equal(h.read().compactions, 2);
	const goal = { id: "goal", text: "objective", status: "active", startedAt: 1, updatedAt: 2, iteration: 0, tokensUsed: 0, timeUsedSeconds: 15, baselineTokens: 0, activeStartedAt: 3 };
	manager.appendCustomEntry("goal-state", { goal }); await h.runner.emit({ type: "agent_end", messages: [] }); assert.deepEqual(h.read().goal, { status: "active", usedSeconds: 15, activeSince: 3 });
	manager.appendCustomEntry("goal-state", { goal: null }); await h.runner.emit({ type: "agent_settled" }); assert.equal(h.read().goal, null);
	assert.deepEqual(h.errors, []);
});

test("root working/settlement, phase transitions/targets, question correlation, model/thinking/context", async (t) => {
	const f = await fixtures(t), h = await harness(f, host.SessionManager.inMemory(f.launch)); t.after(() => h.stop()); await h.start();
	assert.equal(h.read().phase, null); assert.equal(h.read().root.lastSettledAt, null);
	h.idle(false); await h.runner.emit({ type: "agent_start" }); assert.equal(h.read().phase.kind, "waiting");
	for (const [type, kind] of [["thinking_start", "thinking"], ["text_start", "writing"]]) {
		await h.runner.emit({ type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type, contentIndex: 0, partial: { content: [] } } }); assert.equal(h.read().phase.kind, kind);
		const since = h.read().phase.since; await h.runner.emit({ type: "message_update", message: {}, assistantMessageEvent: { type: "text_delta", delta: "token" } }); assert.equal(h.read().phase.since, since);
	}
	await h.runner.emit({ type: "message_update", message: {}, assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, partial: { content: [{ type: "toolCall", name: "read", arguments: { path: "given/path" } }] } } }); assert.equal(h.read().phase.target, "given/path");
	await h.runner.emit({ type: "tool_execution_start", toolCallId: "q", toolName: "ask_user_question", args: { questions: [{ question: "Question?" }, { question: "More?" }] } });
	assert.equal(h.read().phase.tool, "ask_user_question"); assert.equal(h.read().question.text, "Question?"); assert.equal(h.read().question.more, 1);
	await h.runner.emit(toolEnd("other")); assert.notEqual(h.read().question, null); await h.runner.emit(toolEnd("q", "ask_user_question")); assert.equal(h.read().question, null);
	await h.runner.emit({ type: "agent_end", messages: [] }); assert.equal(h.read().root.working, true, "agent_end is not settlement");
	h.settings({ compaction: { reserveTokens: 64000 } }); h.model({ provider: "fixture", id: "new", contextWindow: 128000 }); h.thinking("max");
	await h.runner.emit({ type: "model_select" }); await h.runner.emit({ type: "thinking_level_select", level: "max", previousLevel: "high" });
	assert.deepEqual(h.read().model, { provider: "fixture", id: "new" }); assert.equal(h.read().thinking, "max"); assert.equal(h.read().context.usedPercent, 75);
	h.idle(true); const at = Date.now(); await h.runner.emit({ type: "agent_settled" }); assert.equal(h.read().phase, null); assert.equal(h.read().root.working, false); assert.ok(h.read().root.lastSettledAt >= at);
	assert.deepEqual(h.errors, []);
});
const pingData = (manager: any) => ({ version: 1, session: { sessionId: manager.getSessionId() }, capabilities: { fleetStatus: { version: 1 } } });
const fleetData = (units: unknown) => ({ fleet: { version: 1, entries: [], totalActive: units, omitted: units } });
test("fleet v1 validates session/capabilities/counts, retains while pending, times out and rejects stale ready/replies", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager); t.after(() => h.stop());
	h.rpc((r) => h.reply(r, r.method === "ping" ? pingData(manager) : fleetData(103))); await h.start(); await until(() => h.read().units === 103);
	assert.deepEqual(h.requests.map((r) => r.method), ["ping", "status"]);
	for (const units of [-1, 1.5, Infinity, "3", null]) {
		h.rpc((r) => h.reply(r, r.method === "ping" ? pingData(manager) : fleetData(units))); h.events.emit("subagents:rpc:v1:ready", pingData(manager)); await sleep(1100); assert.equal(h.read().units, null);
	}
	h.rpc((r) => h.reply(r, r.method === "ping" ? pingData(manager) : fleetData(0))); h.events.emit("subagents:rpc:v1:ready", pingData(manager)); await until(() => h.read().units === 0);
	let delayed: any; h.rpc((r) => { delayed = r; }); h.events.emit("subagents:rpc:v1:ready", pingData(manager)); await until(() => delayed !== undefined); await sleep(2100); assert.equal(h.read().units, null);
	h.reply(delayed, pingData(manager)); assert.equal(h.read().units, null);
	await h.stop(); const requests = h.requests.length; h.events.emit("subagents:rpc:v1:ready", pingData(manager)); await sleep(300); assert.equal(h.requests.length, requests); assert.deepEqual(h.errors, []);
});

test("snapshot rate budget is monotonic while wire timestamps use the wall clock", async (t) => {
	const f = await fixtures(t), h = await harness(f, host.SessionManager.inMemory(f.launch)); t.after(() => h.stop());
	await h.start(); await until(() => h.read().workspace !== null && h.read().usage.installed === false); await sleep(150);
	const pushes: number[] = []; h.events.on("signals-collector:v1:snapshot", () => pushes.push(performance.now()));
	h.model({ provider: "fixture", id: "before", contextWindow: 128000 }); await h.runner.emit({ type: "model_select" }); await until(() => pushes.length === 1);
	const wall = Date.now(); t.mock.method(Date, "now", () => wall + 60000);
	h.model({ provider: "fixture", id: "after", contextWindow: 128000 }); await h.runner.emit({ type: "model_select" }); await sleep(30);
	assert.equal(pushes.length, 1, "a wall-clock jump must not bypass the 100ms push budget"); await until(() => pushes.length === 2);
	assert.ok(pushes[1] - pushes[0] >= 99); assert.deepEqual(h.errors, []);
});
