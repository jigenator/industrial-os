// Cross-package composition follows status-bar/test/signals.test.ts: only tests give Pi's
// real loader sibling package paths; production consumes the public bus, never sibling imports.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { host } from "./host.ts";
import { startFakeHerdr, until } from "./fake-herdr.ts";

const git = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8" }).trim();
const B = "⠀";
for (const order of [[resolve("."), resolve("../signals-collector")], [resolve("../signals-collector"), resolve(".")]]) {
	test(`real collector/sidebar composition: ${order.map((p) => p.split("/").at(-1)).join(" then ")}`, async (t) => {
		const directory = await mkdtemp(join(tmpdir(), "hs-signals-")), bin = join(directory, "bin"), project = join(directory, "project");
		await mkdir(bin); await mkdir(project);
		const saved = { ...process.env }, herdr = await startFakeHerdr();
		Object.assign(process.env, { PATH: bin, XDG_CACHE_HOME: join(directory, "cache"), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", HERDR_ENV: "1", HERDR_PANE_ID: herdr.paneId, HERDR_SOCKET_PATH: herdr.socketPath });
		let runner: any;
		t.after(async () => {
			try { await runner?.emit({ type: "session_shutdown", reason: "quit" }); await herdr.close(); }
			finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); await rm(directory, { recursive: true, force: true }); }
		});
		await symlink(git, join(bin, "git"));
		execFileSync(git, ["-c", "core.hooksPath=/dev/null", "init", "-b", "main"], { cwd: project, stdio: "ignore" });
		execFileSync(git, ["remote", "add", "origin", "https://github.com/fixture/project.git"], { cwd: project });
		await writeFile(join(project, "modified"), "fixture");
		await writeFile(join(bin, "gh"), '#!/bin/sh\nprintf \'[{"number":42,"state":"open","head":{"ref":"main","repo":{"full_name":"fixture/project"}},"base":{"repo":{"full_name":"fixture/project"}},"html_url":"https://github.com/fixture/project/pull/42"}]\'\n'); await chmod(join(bin, "gh"), 0o755);
		await writeFile(join(bin, "codexbar"), `#!/bin/sh\nprintf '[{"provider":"%s","usage":{"primary":{"windowMinutes":300,"usedPercent":25,"resetsAt":null}}}]' "$3"\n`); await chmod(join(bin, "codexbar"), 0o755);
		herdr.setStatus("working", false); herdr.setWorkspaceLabel("Release SPACE", false);
		const events = host.createEventBus(), manager = host.SessionManager.inMemory(project);
		manager.appendCustomEntry("root", {}); manager.appendCompaction("summary", manager.getLeafId(), 1000);
		const loader = new host.DefaultResourceLoader({ eventBus: events, cwd: project, agentDir: join(directory, "agent"), settingsManager: host.SettingsManager.inMemory(), additionalExtensionPaths: order, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
		await loader.reload(); const loaded = loader.getExtensions(); assert.deepEqual(loaded.errors, []); assert.deepEqual(loaded.warnings, []);
		assert.equal(loaded.extensions.length, 2);
		runner = new host.ExtensionRunner(loaded.extensions, loaded.runtime, project, manager, undefined);
		let idle = true, usage = { tokens: 64000, contextWindow: 128000, percent: 50 };
		const model = { provider: "anthropic", id: "claude-opus-5-5", contextWindow: 128000 }, errors: unknown[] = [], blocked: boolean[] = [];
		runner.onError((e: unknown) => errors.push(e)); events.on("herdr:blocked", (data: any) => blocked.push(data.active));
		runner.bindCore({ sendMessage() {}, sendUserMessage() {}, appendEntry() {}, setSessionName() {}, getSessionName: () => undefined, setLabel() {}, getActiveTools: () => [], getAllTools: () => [], getSettings: () => ({ compaction: { reserveTokens: 32000 } }), setActiveTools() {}, refreshTools() {}, getCommands: () => [], setModel: async () => true, getThinkingLevel: () => "high", setThinkingLevel() {} }, { getModel: () => model, getScopedModels: () => [], isIdle: () => idle, isProjectTrusted: () => false, getSignal: () => undefined, abort() {}, hasPendingMessages: () => false, shutdown() {}, getContextUsage: () => usage, compact() {}, getSystemPrompt: () => "" });
		runner.setUIContext({ notify() {}, setStatus() {} }, "tui");
		const read = () => { let snapshot: any; events.emit("signals-collector:v1:request", { reply: (s: any) => { snapshot = s; } }); return snapshot; };
		await runner.emit({ type: "session_start", reason: "startup" });
		await until(() => read()?.usage.installed === true && read()?.pr?.kind === "open", "real quota and PR");
		await until(() => herdr.tokens.get("prn") === `${B.repeat(3)}#42` && herdr.tokens.get("proj") === "Release SPACE", "real snapshot tokens");
		const snapshot = read();
		assert.deepEqual(snapshot.context, { tokens: 64000, window: 128000, reserve: 32000, usedPercent: 64000 / 96000 * 100 });
		assert.deepEqual(snapshot.usage.providers.map((p: any) => p.provider), ["codex", "claude", "kimi"]);
		for (const p of snapshot.usage.providers) { assert.deepEqual(p.data.windows["5h"], { usedPercent: 25, resetsAt: null }); assert.equal(typeof p.data.fetchedAt, "number"); }
		assert.equal(herdr.tokens.get("bar"), "━━━━━━━━─── 66%"); assert.equal(herdr.tokens.get("cmpx"), "CMP×01");
		assert.equal(herdr.tokens.get("g2_au0"), "??AU"); assert.equal(herdr.tokens.get("br_dirty"), `main*${B.repeat(10)}`);
		assert.equal(herdr.tokens.get("mthink"), "opus-5.5/hi");
		idle = false; await runner.emit({ type: "agent_start" });
		await runner.emit({ type: "tool_execution_start", toolCallId: "sh", toolName: "bash", args: { command: "npm test\nsecond line" } });
		await until(() => herdr.tokens.get("ev_act") === `npm test${B.repeat(7)}`); assert.equal(herdr.tokens.get("g5"), `SH${B.repeat(2)}`);
		await runner.emit({ type: "tool_execution_start", toolCallId: "q", toolName: "ask_user_question", args: { questions: [{ question: "Continue?" }] } });
		await until(() => herdr.tokens.get("ask_l1") === "Continue?"); assert.deepEqual(blocked, [true]);
		await runner.emit({ type: "tool_execution_end", toolCallId: "q", toolName: "ask_user_question", result: {}, isError: false });
		await until(() => !herdr.tokens.has("ask_l1")); assert.deepEqual(blocked, [true, false]);
		usage = { tokens: 100000, contextWindow: 128000, percent: 78.125 }; await runner.emit({ type: "message_end", message: {} });
		await until(() => herdr.tokens.get("bar_crit") === "━━━━━━━━━━━ 99%"); assert.equal(read().context.usedPercent, 100);
		idle = true; await runner.emit({ type: "agent_settled" }); herdr.setStatus("done");
		await until(() => herdr.tokens.get("ev_rdy_text") === `finished${B.repeat(7)}`); assert.equal(read().phase, null); assert.equal(read().root.working, false);
		assert.deepEqual(errors, []);
	});
}
