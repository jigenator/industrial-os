import assert from "node:assert/strict";
import { ChildProcess, execFileSync } from "node:child_process";
import { chmod, cp, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";

// This gate loads the actual display through the installed Pi loader; collection
// arrives only through event snapshots. Status providers are offline fixtures.
// PI_HOST_ROOT supports a globally installed Pi without relying on CommonJS
// resolution for Pi's import-only package export.
const hostSpecifier = process.env.PI_HOST_ROOT
	? pathToFileURL(resolve(process.env.PI_HOST_ROOT, "dist/index.js")).href
	: "@earendil-works/pi-coding-agent";
const host = await import(hostSpecifier);
const hostRequire = createRequire(process.env.PI_HOST_ROOT ? resolve(process.env.PI_HOST_ROOT, "package.json") : import.meta.url);
const { stripTerminalSequences, styleText } = await import(pathToFileURL(hostRequire.resolve("@earendil-works/pi-tui")).href);
const git = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8" }).trim();
const packageRoot = resolve(".");
const source = resolve("src/extension.ts");
// Footer colors are fixed concrete values; the host theme only converts them.
const theme = { style: (text: string, options: object) => styleText(text, options, "truecolor"), getColorMode: () => "truecolor" };
// Lit and lost USG squares are both `■` and differ only by style. Text shows a ghost-grey `■` (#333333) as `□` so the lit
// count stays readable; motion checks that only compare glyphs use the raw characters.
const GHOST_INK = "\x1b[38;2;51;51;51m\x1b[48;2;0;0;0m";
const shownText = (line: string) => stripTerminalSequences(line.replaceAll(`${GHOST_INK}■`, `${GHOST_INK}□`));
// Display shows the immediate parent/current directory; stored paths stay absolute.
const shown = (path: string) => `${basename(dirname(path))}/${basename(path)}`;
const row = (text: string, label: string) => text.split("\n").find((line) => line.includes(label)) ?? "";
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

const gitIsolation = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0" };
const runGit = (cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env) => execFileSync(git, ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd, env, encoding: "utf8" });
const shared = await realpath(await mkdtemp(join(tmpdir(), "pi-footer-shared-")));
after(() => rm(shared, { recursive: true, force: true }));
const fakes = join(shared, "fakes"), seed = join(shared, "seed");
await Promise.all([fakes, seed].map((path) => mkdir(path)));
for (const [name, script] of [["git", fakeGit], ["gh", fakeGh]]) {
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
	Object.assign(process.env, { PATH: bin, PI_FOOTER_FIXTURE: root, ...gitIsolation });
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

async function harness(f: any, manager: any, mode = "tui", extra: { before?: string[]; after?: string[]; emptyStatuses?: boolean } = {}) {
	// Real public bus, with transparent subscription accounting for disposal assertions.
	const nativeBus = host.createEventBus(), subscriptions = new Map<string, number>();
	const events = { emit: nativeBus.emit, on(channel: string, handler: (data: any) => void) {
		subscriptions.set(channel, (subscriptions.get(channel) ?? 0) + 1);
		const off = nativeBus.on(channel, handler); let live = true;
		return () => { if (live) { live = false; subscriptions.set(channel, subscriptions.get(channel)! - 1); off(); } };
	} };
	const requests: any[] = [];
	let rpc: ((request: any) => void | Promise<void>) | undefined;
	events.on("subagents:rpc:v1:request", (request) => { requests.push(request); return rpc?.(request); });
	const loader = new host.DefaultResourceLoader({ eventBus: events, cwd: f.launch, agentDir: join(f.root, "agent"), settingsManager: host.SettingsManager.inMemory(), additionalExtensionPaths: [...(extra.before ?? []), packageRoot, ...(extra.after ?? [])], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
	await loader.reload();
	const loaded = loader.getExtensions();
	assert.deepEqual(loaded.errors, [], "real Pi loader must resolve the package entry and local snapshot types");
	assert.deepEqual(loaded.warnings, [], "package manifest must use host peers without loader warnings");
	assert.equal(loaded.extensions.length, 1 + (extra.before?.length ?? 0) + (extra.after?.length ?? 0));
	assert.equal(loaded.extensions[extra.before?.length ?? 0].path, source);
	const runner = new host.ExtensionRunner(loaded.extensions, loaded.runtime, f.launch, manager, undefined);
	const tool = { name: "fixture" };
	assert.equal(runner.getToolDefinition("set_active_project"), undefined, "the display registers no selection tool");
	let component: any, footerFactory: any;
	let idle = true;
	let model = { id: "first-model", provider: "fixture", contextWindow: 128_000 };
	let thinking = "high";
	let usage: any = { tokens: 1000, contextWindow: 128_000, percent: 0.8 };
	let settings: any = {};
	const notices: [string, string][] = [];
	const statuses = new Map(extra.emptyStatuses ? [] : [["ponytail", "\x1b[32mPonytail ready\x1b[0m"]]);
	const statusCalls: any[] = [];
	let renders = 0;
	const errors: any[] = []; runner.onError((error: any) => errors.push(error));
	runner.bindCore({
		sendMessage() {}, sendUserMessage() {}, appendEntry: (type: string, data: any) => manager.appendCustomEntry(type, data), setSessionName() {}, getSessionName: () => undefined, setLabel() {},
		getActiveTools: () => [tool.name], getAllTools: () => [tool], getSettings: () => structuredClone(settings), setActiveTools() {}, refreshTools() {}, getCommands: () => [], setModel: async () => true,
		getThinkingLevel: () => thinking, setThinkingLevel: (value: string) => { thinking = value; },
	}, { getModel: () => model, getScopedModels: () => [], isIdle: () => idle, isProjectTrusted: () => false, getSignal: () => undefined, abort() {}, hasPendingMessages: () => false, shutdown() {}, getContextUsage: () => usage, compact() {}, getSystemPrompt: () => "" });
	const makeUI = () => ({ theme: { ...theme, fg: (_color: string, text: string) => text },
		setStatus(key: string, text: string | undefined) {
			statusCalls.push({ key, text, receiver: this });
			if (key === "throw-fixture") throw new Error("status failure");
			if (text === undefined) statuses.delete(key); else statuses.set(key, text);
			return "forwarded";
		}, setFooter(factory: any) {
		component?.dispose(); component = undefined; footerFactory = factory;
		if (factory) component = factory({ requestRender: () => { renders++; } }, theme, { getExtensionStatuses: () => statuses });
	}, notify(message: string, level: string) { notices.push([level, message]); } });
	runner.setUIContext(makeUI(), mode);
	const emitStart = async (reason = "startup") => runner.emit({ type: "session_start", reason });
	const stop = async (reason = "quit") => runner.emit({ type: "session_shutdown", reason });
	const text = () => component?.render(300).map(shownText).join("\n") ?? "";
	const motion = async (args: string) => runner.getCommand("footer-motion").handler(args, runner.createCommandContext());
	let snapshot = { version: 1, sessionId: manager.getSessionId(), seq: 1, launch: f.launch, active: f.launch,
		workspace: { path: f.launch, git: { kind: "none" }, github: { kind: "none", reason: "not a repository" } }, pr: { kind: "none" },
		root: { working: false, lastSettledAt: null }, phase: null, question: null,
		model: { provider: "fixture", id: "first-model" }, thinking: "high", context: { tokens: 1000, window: 128000, reserve: 16384, usedPercent: 1 },
		compactions: 0, units: null, goal: null, usage: { installed: false, providers: [] } };
	events.on("signals-collector:v1:request", (r) => { snapshot.sessionId = manager.getSessionId(); r.reply(snapshot); });
	const select = async (path: string) => {
		snapshot = { ...snapshot, seq: snapshot.seq + 1, active: path,
			workspace: { path, git: { kind: "repository", active: { path, branch: "feat/footer-ponytail", revision: "abc", dirty: false }, isWorktree: true, main: null }, github: { kind: "none", reason: "No GitHub remote" } } } as any;
		events.emit("signals-collector:v1:snapshot", snapshot);
		return { details: { version: 1, path } };
	};
	return { events, requests, subscriptions, statusCalls,
		get ui() { return runner.createContext().ui; },
		setStatus(key: string, text?: string) { return runner.createContext().ui.setStatus(key, text); },
		replaceUI() { runner.setUIContext(makeUI(), mode); },
		setRpc(handler?: (request: any) => void | Promise<void>) { rpc = handler; },
		setIdle(value: boolean) { idle = value; },
		reply(request: any, data: any, envelope = {}) { events.emit(`subagents:rpc:v1:reply:${request.requestId}`, { version: 1, requestId: request.requestId, method: request.method, success: true, data, ...envelope }); },
		replaceFooter() { const previous = component; previous?.dispose(); component = footerFactory({ requestRender: () => { renders++; } }, theme, { getExtensionStatuses: () => statuses }); return previous; },
		runner, tool, emitStart, stop, text, select, statuses, errors, motion, notices, get component() { return component; }, get renders() { return renders; }, setUsage(value: any) { usage = value; }, setSettings(value: any) { settings = value; }, changeModel() { model = { ...model, id: "second-model" }; thinking = "off"; usage = { tokens: null, percent: null, contextWindow: 128_000 }; } };
}

test("decorative motion: footer-owned unref'd timer, session /footer-motion, live values and disposal without extra I/O", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch);
	const refTimers = () => process.getActiveResourcesInfo().filter((name) => name === "Timeout").length;
	const h = await harness(f, manager); t.after(() => h.stop());
	const baseline = refTimers();
	await h.emitStart(); await until(() => !/Git pending/.test(h.text())); await until(f.idle);
	const local = await f.count(f.gitLog), remote = await f.count(f.ghLog);
	// Real time first: wait for the next decoration wake (a boot tick, or an ambient event at most ~4.2 s after the
	// last); Git or gh started by a wake would be logged meanwhile.
	let renders = h.renders; await untilReal(() => h.renders > renders);
	assert.ok(h.renders > renders, "decoration repaints itself while motion is on");
	assert.equal(refTimers(), baseline, "animation and refresh timers are unref'd");
	assert.equal(await f.count(f.gitLog), local, "animation never inspects Git");
	assert.equal(await f.count(f.ghLog), remote, "animation never queries GitHub");
	h.setUsage({ tokens: 120_000, contextWindow: 128_000, percent: 93.75 });
	assert.match(h.text(), /120k\/112k[^\n]*▲ HIGH/, "a tone change shows the current value immediately, mid-wipe");

	const cleared = t.mock.method(globalThis, "clearTimeout");
	await h.motion("off");
	assert.ok(cleared.mock.callCount() >= 1, "pausing clears the pending animation timeout"); cleared.mock.restore();
	// The real animation timeout is cleared; every later decoration wake is on the mocked clock and runs only when
	// advanced, so each 600 ms window below is exact. Subprocess waits stay on real time.
	const advance = mockClock(t);
	assert.deepEqual(h.notices.at(-1), ["info", "Footer motion off for this session"]);
	const settled = h.text(); renders = h.renders;
	assert.match(settled.split("\n")[0], /┓$/, "settled frame is fully drawn");
	await advance(600);
	assert.equal(h.renders, renders, "motion off leaves no repaint timer"); assert.equal(h.text(), settled);
	h.setUsage({ tokens: null, contextWindow: 128_000, percent: null });
	assert.match(h.text(), /\?\/112k[^\n]*\? UNKNOWN/, "live values still update with motion off");
	await h.motion("sideways");
	assert.deepEqual(h.notices.at(-1), ["warning", "Usage: /footer-motion [on|off]"]);
	await advance(300); assert.equal(h.renders, renders, "invalid arguments leave motion unchanged");
	await h.runner.emit({ type: "session_tree", newLeafId: null, oldLeafId: null });
	// The restore's own local refresh and status check may repaint once.
	await untilReal(() => !/Git pending/.test(h.text())); await untilReal(f.idle); await advance(300); renders = h.renders;
	await advance(600); assert.equal(h.renders, renders, "same-session tree restore keeps the motion choice");

	await h.motion(""); renders = h.renders; await advance(600);
	assert.ok(h.renders > renders, "empty argument toggles motion back on");
	assert.equal(h.runner.getCommand("footer-motion").getArgumentCompletions("o").map((item: any) => item.value).join(), "on,off");
	await h.stop(); h.runner.invalidate(); renders = h.renders; await advance(600);
	assert.equal(h.renders, renders, "shutdown disposes the animation timer");
	const fresh = await harness(f, host.SessionManager.inMemory(f.launch)); t.after(() => fresh.stop());
	await fresh.emitStart(); renders = fresh.renders; await advance(600);
	assert.ok(fresh.renders > renders, "a new session starts with motion on");
	assert.deepEqual([...h.errors, ...fresh.errors], []);
});

const pingData = (manager: any) => ({ version: 1, session: { sessionId: manager.getSessionId() }, capabilities: { fleetStatus: { version: 1 } } });
const fleetData = (units: number) => ({ fleet: { version: 1, entries: [], totalActive: units, omitted: units } });
const replyListeners = (h: any) => [...h.subscriptions].filter(([name]: [string, number]) => name.startsWith("subagents:rpc:v1:reply:")).reduce((sum: number, [, n]: [string, number]) => sum + n, 0);
// Mocks setTimeout and the decoration clock from now on; timers armed earlier stay real.
function mockClock(t: any) {
	let now = Math.ceil(performance.now());
	t.mock.method(performance, "now", () => now);
	t.mock.timers.enable({ apis: ["setTimeout"] });
	return async (ms: number) => { now += ms; t.mock.timers.tick(ms); for (let n = 0; n < 16; n++) await Promise.resolve(); };
}
// Only this adapter's activity/decoration timers are accelerated, from before `start` installs the footer, so the
// first fleet poll (250 ms after installation) runs when advanced; the bus itself remains Pi's bus. Subprocesses,
// including execFile's own timeouts, stay on real time.
async function activityClock(t: any, h: any, start: () => Promise<unknown>) {
	const advance = mockClock(t);
	await start();
	await untilReal(() => !/Git pending/.test(h.text()));
	await advance(250);
	await h.motion("off");
	return advance;
}

const ponytailCode = (h: any) => /PNYTL \/\/ (\w{3})/.exec(h.text())?.[1];
const ponytailText = (mode: string, working = false) => `${working ? "●" : "○"} 🐴 ponytail: ${{ lite: "🌿 LITE", full: "⚡ FULL", ultra: "🔥 ULTRA", review: " REVIEW" }[mode]}`;
// Synthetic portable producer: actual optional producer compatibility is checked
// separately against installed Ponytail, never silently required by npm test.
async function statusProducer(f: any, initial: string) {
	const path = join(f.root, `producer-${initial}.ts`);
	await writeFile(path, `export default function(pi) { const emit = (_e,ctx) => {${initial === "hidden" ? "" : `ctx.ui.setStatus('ponytail', ${initial === "off" ? "undefined" : JSON.stringify(ponytailText(initial))});`}}; pi.on('session_start',emit); pi.on('session_tree',emit); }`);
	return path;
}

test("PNYTL status startup: observer-first captures OFF; producer-first recovers labels but missing never guesses OFF", async (t) => {
	const f = await fixtures(t);
	for (const first of [true, false]) for (const mode of ["off", "lite", "full", "ultra", "review", "hidden"]) {
		const producer = await statusProducer(f, mode), manager = host.SessionManager.inMemory(f.launch);
		const h = await harness(f, manager, "tui", { [first ? "after" : "before"]: [producer], emptyStatuses: true });
		t.after(() => h.stop()); await h.emitStart();
		const expected = mode === "hidden" || (mode === "off" && !first) ? "UNK" : { off: "OFF", lite: "LTE", full: "FUL", ultra: "ULT", review: "REV" }[mode];
		if (expected === "UNK") { assert.equal(ponytailCode(h), "CHK"); await sleep(5); }
		assert.equal(ponytailCode(h), expected, `${first}/${mode}`);
		if (expected !== "UNK") {
			assert.doesNotMatch(h.text(), /🐴 ponytail:/, "recognized status is represented once");
			if (mode !== "off") assert.equal(h.statuses.get("ponytail"), ponytailText(mode), "host map is NOT suppressed");
		}
		h.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "OFF", "later explicit clear works in either order");
		await h.stop(); assert.deepEqual(h.errors, []);
	}
});

test("PNYTL parses only bounded exact styled format; preserves malformed/warning raw status and every other key", async (t) => {
	const f = await fixtures(t), h = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { emptyStatuses: true });
	t.after(() => h.stop()); await h.emitStart(); await h.motion("off");
	const other = "\x1b[38;2;4;5;6mother FULL status\x1b[0m";
	h.setStatus("ponytail-warning", other); h.setStatus("other", "Other status");
	for (const [mode, code] of [["lite", "LTE"], ["full", "FUL"], ["ultra", "ULT"], ["review", "REV"]]) {
		h.setStatus("ponytail", `\x1b[38:2::1:2:3m${ponytailText(mode)}\x1b[0m`);
		assert.equal(ponytailCode(h), code); assert.doesNotMatch(h.text(), /🐴 ponytail:/);
		assert.match(h.text(), /other FULL status/); assert.match(h.text(), /Other status/);
		assert.equal(h.statuses.get("ponytail-warning"), other);
		assert.match(h.component.render(300).join(""), /\x1b\[38;2;4;5;6mother FULL status/);
	}
	for (const raw of ["FULL", "Warning FULL unavailable", "○ 🐴 ponytail: ⚡ FULL extra", "○ 🐴 ponytail: 🌿 FULL", "○ 🐴 ponytail: FULL", "○ 🐴 ponytail:  review", "○ 🐴 ponytail: ⚡ FULL\n", "\x1b[2J" + ponytailText("full"), ponytailText("full") + "\x1b]0;attack\x07", "\u202e" + ponytailText("full"), "x".repeat(600)]) {
		h.setStatus("ponytail", raw);
		assert.equal(ponytailCode(h), "UNK", JSON.stringify(raw));
		assert.equal(h.statuses.get("ponytail"), raw, "host data untouched");
		assert.match(h.text(), /05 EXT/);
		assert.doesNotMatch(h.component.render(300).join(""), /\x1b\[2J|\x1b\]|\u202e/);
	}
	// Ponytail's ● activity dot lights the plate (held lit with motion off); ○ restores the icon.
	h.setStatus("ponytail", ponytailText("full", true)); assert.match(h.text(), /• PNYTL \/\/ FUL/); assert.doesNotMatch(h.text(), /⌑/);
	h.setStatus("ponytail", ponytailText("full", false)); assert.match(h.text(), /⌑ PNYTL \/\/ FUL/); assert.doesNotMatch(h.text(), /•/);
	h.setStatus("ponytail", ponytailText("full", true)); h.setStatus("ponytail", undefined);
	assert.equal(ponytailCode(h), "OFF"); assert.match(h.text(), /⌑ PNYTL \/\/ OFF/, "a clear never leaves the light on");
	h.setStatus("ponytail", "warning: FULL unavailable"); assert.match(h.text(), /warning: FULL unavailable/);
	h.setStatus("ponytail", ponytailText("lite")); h.statuses.delete("ponytail");
	assert.equal(ponytailCode(h), "UNK", "map absence without observed clear is not OFF");
	for (let n = 0; n < 30; n++) h.text();
	assert.deepEqual(h.errors, []);
});

test("PNYTL observer preserves original receiver/return/errors, does not stack and never overwrites later foreign wrappers", async (t) => {
	const f = await fixtures(t), h = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { emptyStatuses: true });
	t.after(() => h.stop()); const original = h.ui.setStatus;
	await h.emitStart(); const wrapped = h.ui.setStatus;
	assert.notEqual(wrapped, original);
	assert.equal(h.setStatus("other", "data"), "forwarded"); assert.equal(h.statusCalls.at(-1).receiver, h.ui);
	assert.throws(() => h.setStatus("throw-fixture", "failure"), /status failure/);
	h.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "OFF");
	for (let n = 0; n < 10; n++) { const old = h.replaceFooter(); old.dispose(); assert.equal(h.ui.setStatus, wrapped); assert.equal(ponytailCode(h), "OFF"); }
	let calls = 0;
	const foreign = function (this: any, ...args: any[]) { calls++; return wrapped.apply(this, args); };
	h.ui.setStatus = foreign;
	for (let n = 0; n < 10; n++) h.replaceFooter();
	assert.equal(h.ui.setStatus, foreign); const before = h.statusCalls.length;
	h.setStatus("ponytail", ponytailText("ultra")); assert.equal(calls, 1); assert.equal(h.statusCalls.length, before + 1); assert.equal(ponytailCode(h), "ULT");
	h.component.dispose(); assert.equal(h.ui.setStatus, foreign);
	const renders = h.renders;
	h.setStatus("ponytail", undefined); assert.equal(h.renders, renders, "inert under foreign chain after disposal");
	assert.equal(h.statuses.has("ponytail"), false, "fallback footer still gets the original behavior");
	await h.stop(); assert.equal(h.ui.setStatus, foreign); assert.deepEqual(h.errors, []);
});

test("PNYTL lifecycle: no OFF evidence crosses session/UI; tree/new/reload/resume/fork rebind and shutdown/non-TUI detach", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager, "tui", { emptyStatuses: true });
	t.after(() => h.stop()); const original = h.ui.setStatus;
	await h.emitStart(); h.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "OFF");
	for (const reason of ["tree", "new", "reload", "resume", "fork"]) {
		const oldComponent = h.component;
		if (reason === "tree") await h.runner.emit({ type: "session_tree", newLeafId: null, oldLeafId: null });
		else { if (reason === "new" || reason === "fork") manager.newSession(); await h.emitStart(reason); }
		assert.deepEqual(oldComponent.render(120), []); oldComponent.dispose();
		assert.equal(ponytailCode(h), "CHK"); await sleep(5); assert.equal(ponytailCode(h), "UNK", reason);
		h.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "OFF");
	}
	const oldUI = h.ui; h.replaceUI(); assert.notEqual(h.ui, oldUI);
	await h.emitStart("reload"); assert.equal(oldUI.setStatus, original);
	oldUI.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "CHK", "old UI cannot create new OFF evidence");
	h.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "OFF");
	// A render can rebind a replaced UI even before its next lifecycle event.
	h.replaceUI(); h.text(); await sleep(5); assert.notEqual(ponytailCode(h), "OFF");
	h.setStatus("ponytail", ponytailText("review")); assert.equal(ponytailCode(h), "REV");
	const nextOriginal = h.ui.setStatus; await h.stop(); assert.notEqual(h.ui.setStatus, nextOriginal);
	const renders = h.renders; h.setStatus("ponytail", undefined); assert.equal(h.renders, renders);
	const nonTui = await harness(f, host.SessionManager.inMemory(f.launch), "print"); t.after(() => nonTui.stop());
	const untouched = nonTui.ui.setStatus; await nonTui.emitStart(); assert.equal(nonTui.ui.setStatus, untouched);
	assert.equal(nonTui.component, undefined); assert.deepEqual(h.errors, []);
});

test("PNYTL live status/motion: immediate idle changes, no activity-only flashes, off-time replay or extra bus I/O", async (t) => {
	const f = await fixtures(t), h = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { emptyStatuses: true });
	t.after(() => h.stop());
	const advance = await activityClock(t, h, async () => { await h.emitStart(); h.setStatus("ponytail", ponytailText("lite")); h.text(); });
	const modeInk = () => {
		const line = h.component.render(120).find((line: string) => stripTerminalSequences(line).includes("PNYTL"));
		const start = stripTerminalSequences(line).indexOf("PNYTL") + 9;
		let col = 0, fg = "", inks: string[] = [];
		for (const token of line.match(/\x1b\[[0-9;]*m|[^\x1b]/gu) ?? []) {
			if (token.startsWith("\x1b")) { const color = /^\x1b\[38;2;(\d+;\d+;\d+)m$/.exec(token); if (color) fg = color[1]; }
			else { if (col >= start && col < start + 3) inks.push(fg); col++; }
		}
		return inks.join("|");
	};
	const black = /(?:^|\|)0;0;0(?:\||$)/;
	h.setStatus("ponytail", ponytailText("full")); assert.equal(ponytailCode(h), "FUL"); assert.doesNotMatch(modeInk(), black);
	await h.motion("on"); await advance(100); assert.doesNotMatch(modeInk(), black);
	h.setStatus("ponytail", ponytailText("full", true)); await advance(100); assert.doesNotMatch(modeInk(), black, "activity glyph is not a mode change");
	h.setStatus("ponytail", ponytailText("ultra")); h.text(); await advance(100); assert.match(modeInk(), black);
	await h.motion("off"); assert.doesNotMatch(modeInk(), black);
	await h.motion("on"); h.setStatus("ponytail", ponytailText("review")); h.text(); await advance(100); assert.doesNotMatch(modeInk(), black);
	h.replaceFooter(); h.setStatus("ponytail", ponytailText("lite")); h.text(); await advance(100); assert.doesNotMatch(modeInk(), black);
	h.setStatus("ponytail", undefined); assert.equal(ponytailCode(h), "OFF"); assert.doesNotMatch(modeInk(), black);
	const count = h.requests.length; for (let n = 0; n < 30; n++) h.text(); assert.equal(h.requests.length, count);
	assert.deepEqual(h.errors, []);
});


test("PNYTL observer and directory-first linked-worktree selection preserve both footer features", async (t) => {
	const f = await fixtures(t), checkout = join(f.root, "linked-footer-worktree");
	f.runGit(f.repo, ["worktree", "add", "-b", "feat/footer-ponytail", checkout]);
	const manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager, "tui", { emptyStatuses: true });
	t.after(() => h.stop()); await h.emitStart(); await h.motion("off");
	await h.select(checkout); await until(() => /feat\/footer-ponytail clean/.test(h.text()));
	h.setStatus("other", "Other extension retained");
	for (const [raw, expected] of [[ponytailText("full"), "FUL"], [undefined, "OFF"], ["warning: Ponytail unavailable", "UNK"]] as const) {
		h.setStatus("ponytail", raw);
		assert.equal(ponytailCode(h), expected);
		const lines = h.text().split("\n"), act = lines.findIndex((line) => line.includes("01 ACT"));
		assert.ok(lines[act].includes(shown(checkout)));
		assert.doesNotMatch(lines[act], /feat\/footer-ponytail|clean|⑂/);
		assert.match(lines[act + 1], /⑂ feat\/footer-ponytail clean/);
		assert.doesNotMatch(lines[act + 1], /01 ACT/); assert.ok(lines[act - 1].includes(`cwd ${shown(f.launch)}`));
		assert.doesNotMatch(h.text(), /2\.1 MN|release|https:\/\/github\.com/);
		assert.match(h.text(), /Other extension retained/);
		if (expected === "UNK") assert.match(h.text(), /warning: Ponytail unavailable/);
		else assert.doesNotMatch(h.text(), /🐴 ponytail:/);
	}
	assert.equal(manager.getCwd(), f.launch, "selection remains display-only");
	assert.deepEqual(h.errors, []);
});

// Tiny fake of the documented Tatsu public event API: no live CLI/config/formatter.
async function tatsuProducer(f: any) {
	const path = join(f.root, "tatsu-producer.ts");
	await writeFile(path, `export default function(pi) {
		let snapshot = { version: 1, phase: "inactive", components: ["tatsu-cli", "agent-workspace"].map(component => ({ component, state: "inactive" })) }, ctx, requests = 0;
		let live = true;
		const api = { version: 1, getSnapshot() { return live ? snapshot : { ...snapshot, phase: "inactive" }; }, registerFormatter() { throw new Error("consumer must not register a formatter"); } };
		pi.events.on("tatsu-status:request", r => { requests++; if (live && r.version === 1) r.reply(api); });
		pi.events.on("test:tatsu", r => {
			if (r.kind === "count") { r.reply(requests); return; }
			if (r.kind === "restart") { live = true; pi.events.emit("tatsu-status:ready", api); return; }
			if (r.kind === "stop") { live = false; return; }
			if (r.kind === "ready") { pi.events.emit("tatsu-status:ready", api); return; }
			snapshot = r.snapshot;
			ctx?.ui.setStatus("tatsu-status", r.text);
			pi.events.emit("tatsu-status:changed", snapshot);
		});
		pi.events.emit("tatsu-status:ready", api);
		pi.on("session_start", (_, next) => {
			ctx = next;
			snapshot = { version: 1, phase: "completed", components: ["tatsu-cli", "agent-workspace"].map(component => ({ component, state: "current", text: "private prose", detail: "private detail", reason: "private reason", installedSha: "private sha" })) };
			ctx.ui.setStatus("tatsu-status", "tatsu-cli: current | agent-workspace: current");
			pi.events.emit("tatsu-status:changed", snapshot);
		});
	}`);
	return path;
}
const tatsuDTO = (state = "current", options = {}, phase = "completed") => ({ version: 1, phase, components: ["tatsu-cli", "agent-workspace"].map((component) => ({ component, state, ...options })) });
function pushTatsu(h: any, snapshot: any, ...text: [string | undefined] | []) { h.events.emit("test:tatsu", { snapshot, text: text.length ? text[0] : "raw Tatsu fallback" }); }
const tatsuRequests = (h: any) => { let n = -1; h.events.emit("test:tatsu", { kind: "count", reply: (value: number) => { n = value; } }); return n; };

test("Tatsu public events: real loader in both orders, replacement/fallback, hidden text, repaint and restart discovery", async (t) => {
	const f = await fixtures(t), path = await tatsuProducer(f);
	for (const order of ["before", "after"] as const) {
		const h = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { [order]: [path], emptyStatuses: true });
		t.after(() => h.stop()); await h.emitStart(); await h.motion("off");
		assert.equal(h.subscriptions.get("tatsu-status:changed"), 1); assert.equal(h.subscriptions.get("tatsu-status:ready"), 1);
		assert.match(h.text(), /05 EXT\s+TCLI • OK   AWKS • OK\b/);
		h.setStatus("a-status", "first"); h.setStatus("z-status", "last");
		assert.match(h.text(), /05 EXT\s+first[\s\S]*TCLI • OK   AWKS • OK [\s\S]*last/, "sorted among other statuses");
		h.setStatus("a-status", undefined); h.setStatus("z-status", undefined);
		assert.doesNotMatch(h.text(), /tatsu-cli:|private prose|private detail|private reason|private sha/);
		assert.ok(h.statuses.has("tatsu-status"), "host raw status map is untouched");
		const renders = h.renders;
		pushTatsu(h, tatsuDTO("behind", { commitsBehind: 1, localChanges: true }));
		assert.ok(h.renders > renders); assert.match(h.text(), /TCLI ▲ UP×1 ◆ EDIT\b/); assert.doesNotMatch(h.text(), /raw Tatsu fallback/);
		pushTatsu(h, tatsuDTO("checking", {}, "checking"), undefined);
		assert.match(h.text(), /TCLI ▲ UP×1 ◆ EDIT\b/, "a refresh keeps the last completed result"); assert.doesNotMatch(h.text(), /· CHK/);
		assert.equal(h.statuses.has("tatsu-status"), false, "hidden default text still has structured display");
		pushTatsu(h, tatsuDTO("current"), undefined); assert.match(h.text(), /TCLI • OK   AWKS • OK\b/, "only a changed result changes the text");
		pushTatsu(h, tatsuDTO("inactive", {}, "inactive")); assert.match(h.text(), /raw Tatsu fallback/); assert.doesNotMatch(h.text(), /TCLI/);
		pushTatsu(h, tatsuDTO("inactive", {}, "inactive"), undefined); assert.doesNotMatch(h.text(), /05 EXT|TCLI/);
		pushTatsu(h, tatsuDTO("checking", {}, "checking"), undefined);
		assert.match(h.text(), /TCLI · CHK   AWKS · CHK\b/, "checking shows only when no completed result is held");
		pushTatsu(h, tatsuDTO("repair", { localChanges: true }));
		const requests = tatsuRequests(h); h.events.emit("test:tatsu", { kind: "restart" }); assert.equal(tatsuRequests(h), requests + 1);
		assert.match(h.text(), /TCLI ▲ FIX ◆ EDIT\b/);
		h.events.emit("test:tatsu", { kind: "stop" }); h.events.emit("test:tatsu", { kind: "ready" });
		assert.match(h.text(), /raw Tatsu fallback/); assert.doesNotMatch(h.text(), /TCLI/);
		await h.stop(); assert.deepEqual(h.errors, []);
	}
});

test("Tatsu public events: strict snapshot whitelist, unknown/invalid fallback, optional field dropping and absent provider", async (t) => {
	const f = await fixtures(t), path = await tatsuProducer(f), h = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { before: [path], emptyStatuses: true });
	t.after(() => h.stop()); await h.emitStart(); await h.motion("off");
	const good = tatsuDTO();
	for (const invalid of [undefined, null, [], {}, { ...good, version: 2 }, { ...good, phase: "future" }, { ...good, components: [] },
		{ ...good, components: [...good.components, good.components[0]] }, { ...good, components: [good.components[0], good.components[0]] },
		tatsuDTO("future-state"), { ...good, components: [good.components[0], { component: "future-component", state: "current" }] },
		{ ...good, components: [good.components[0], null] }]) {
		pushTatsu(h, invalid); assert.match(h.text(), /raw Tatsu fallback/); assert.doesNotMatch(h.text(), /TCLI/);
	}
	for (const commitsBehind of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
		pushTatsu(h, tatsuDTO("behind", { commitsBehind, localChanges: "true", text: "private prose", detail: "secret" }));
		assert.match(h.text(), /TCLI ▲ UP   AWKS ▲ UP\b/); assert.doesNotMatch(h.text(), /UP×|EDIT|private prose|secret|raw Tatsu fallback/);
	}
	pushTatsu(h, tatsuDTO("behind", { commitsBehind: 0, localChanges: false })); assert.match(h.text(), /UP×0 /);
	pushTatsu(h, { ...good, components: [...good.components].reverse() }); assert.match(h.text(), /TCLI • OK   AWKS • OK\b/, "known components normalized into contract order");
	await h.stop(); assert.equal(h.subscriptions.get("tatsu-status:changed"), 0); assert.equal(h.subscriptions.get("tatsu-status:ready"), 0);
	const absent = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { emptyStatuses: true }); t.after(() => absent.stop());
	await absent.emitStart(); await absent.motion("off"); absent.setStatus("tatsu-status", "unrecognized producer status");
	assert.match(absent.text(), /unrecognized producer status/); assert.doesNotMatch(absent.text(), /TCLI/);
	assert.deepEqual(h.errors, []); assert.deepEqual(absent.errors, []);
});

test("Tatsu public events: late provider, synchronous-only replies, UI/session/component ownership, disposal and non-TUI", async (t) => {
	const f = await fixtures(t), manager = host.SessionManager.inMemory(f.launch), h = await harness(f, manager, "tui", { emptyStatuses: true });
	t.after(() => h.stop()); await h.emitStart(); await h.motion("off"); h.setStatus("tatsu-status", "late raw fallback");
	let pendingReply: any, requests = 0;
	const api = { version: 1, getSnapshot: () => tatsuDTO("behind", { commitsBehind: 1 }) };
	const off = h.events.on("tatsu-status:request", (r: any) => { requests++; pendingReply = r.reply; });
	h.events.emit("tatsu-status:ready", api); pendingReply(api);
	assert.match(h.text(), /late raw fallback/); assert.doesNotMatch(h.text(), /TCLI/, "delayed discovery reply is inert");
	off(); const answer = h.events.on("tatsu-status:request", (r: any) => { requests++; r.reply(api); }); t.after(answer);
	h.events.emit("tatsu-status:ready", api); assert.match(h.text(), /TCLI ▲ UP×1\b/);
	const previous = h.replaceFooter(); previous.dispose();
	assert.equal(h.subscriptions.get("tatsu-status:changed"), 1); assert.deepEqual(previous.render(100), []);
	const beforeUI = h.renders; h.replaceUI(); h.events.emit("tatsu-status:changed", tatsuDTO()); h.events.emit("tatsu-status:ready", api);
	assert.equal(h.renders, beforeUI, "old UI events cannot publish"); assert.match(h.text(), /late raw fallback/);
	h.replaceFooter(); await h.motion("off"); assert.match(h.text(), /TCLI ▲ UP×1\b/);
	manager.newSession(); const beforeSession = h.renders, priorRequests = requests;
	h.events.emit("tatsu-status:changed", tatsuDTO()); h.events.emit("tatsu-status:ready", api);
	assert.equal(h.renders, beforeSession); assert.equal(requests, priorRequests); assert.match(h.text(), /late raw fallback/);
	await h.emitStart("new"); await h.motion("off"); assert.match(h.text(), /TCLI ▲ UP×1\b/);
	h.component.dispose(); const disposedRenders = h.renders, disposedRequests = requests;
	assert.equal(h.subscriptions.get("tatsu-status:changed"), 0); assert.equal(h.subscriptions.get("tatsu-status:ready"), 0);
	h.events.emit("tatsu-status:changed", tatsuDTO()); h.events.emit("tatsu-status:ready", api);
	assert.equal(h.renders, disposedRenders); assert.equal(requests, disposedRequests);
	await h.stop(); assert.deepEqual(h.errors, []);
	const print = await harness(f, host.SessionManager.inMemory(f.launch), "print"); t.after(() => print.stop());
	let queried = 0; const unlisten = print.events.on("tatsu-status:request", () => { queried++; }); t.after(unlisten);
	await print.emitStart(); print.events.emit("tatsu-status:ready", api); print.events.emit("tatsu-status:changed", tatsuDTO());
	assert.equal(queried, 0); assert.equal(print.subscriptions.get("tatsu-status:changed") ?? 0, 0); assert.equal(print.subscriptions.get("tatsu-status:ready") ?? 0, 0);
	assert.equal(print.component, undefined);
});

test("background tasks: real loader draws the producer's status natively, keeps raw fallback, and wakes Idle only while tasks run", async (t) => {
	const f = await fixtures(t), h = await harness(f, host.SessionManager.inMemory(f.launch), "tui", { emptyStatuses: true });
	t.after(() => h.stop());
	await h.emitStart(); await until(() => !/Git pending/.test(h.text())); await until(f.idle);
	// pi-background-tasks 2.6.9 wraps its padded label in a light-blue chip.
	const chip = (label: string) => `\x1b[48;2;183;223;255m\x1b[38;2;11;70;110m ${label} \x1b[0m`;
	const running = chip("bg 1 running · Shift↓"), finished = chip("bg 1 done · Shift↓ · /bg-clear");
	h.setStatus("background-tasks", running);
	assert.match(row(h.text(), "05 EXT"), /05 EXT  BG ◆ RUN×1   Shift↓ +━┛$/);
	assert.doesNotMatch(h.text(), /bg 1 running/); assert.doesNotMatch(h.component.render(300).join(""), /183;223;255/);
	assert.equal(h.statuses.get("background-tasks"), running, "host map untouched");
	h.setStatus("background-tasks", chip("bg 1 running · Shift↓ · extra"));
	assert.match(h.text(), /05 EXT +bg 1 running · Shift↓ · extra/, "unrecognized text stays raw");
	assert.match(h.component.render(300).join(""), /\x1b\[48;2;183;223;255m\x1b\[38;2;11;70;110m bg 1 running/);
	// The ◆ ink: white lit, graphic grey on the ROOT lamp's off phase.
	const diamond = () => { const out = h.component.render(300).join("\n"); return [...out.slice(0, out.indexOf("◆")).matchAll(/\x1b\[38;2;(\d+;\d+;\d+)m/g)].at(-1)?.[1]; };
	await h.motion("off");
	const advance = mockClock(t);
	h.setStatus("background-tasks", running);
	assert.equal(diamond(), "255;255;255", "motion off holds it lit");
	// Resumed and Idle with no fleet units, the ┼ nudge settles by 250 ms and the first ghost is due at 800 ms. Between
	// them only a running ◆ wakes the decoration timeout, at the 500 ms lamp edge, and that wake dims it.
	const wakes = async (status: string) => {
		h.setStatus("background-tasks", status); await h.motion("on");
		await advance(300); const renders = h.renders; await advance(450);
		return h.renders - renders;
	};
	assert.equal(await wakes(running), 1, "a running task wakes the Idle footer at the lamp edge");
	assert.equal(diamond(), "113;113;113", "graphic grey on the ROOT lamp's off phase");
	await h.motion("off");
	assert.equal(await wakes(finished), 0, "finished-only status adds no wake");
	await h.stop(); assert.deepEqual(h.errors, []);
});
