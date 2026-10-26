import assert from "node:assert/strict";
import test from "node:test";
import { assignment, clock, contextPath, coreValue, extensionNames, herdrCodes, modelLabel, packageName, parseHead, type ResourceRef, sessionCodes } from "../src/facts.ts";

test("droid codes come from the session ID: the same session keeps its ID, none is unknown", () => {
	const id = "0000beef-0000-4000-8000-00000000c0de";
	assert.deepEqual(sessionCodes(id), { unit: "C0DE", session: "0000BEEF", seed: 0x0000beef });
	assert.deepEqual(sessionCodes(id), sessionCodes(id));
	assert.equal(sessionCodes("0000beef-0000-4000-8000-00000000ffff").unit, "FFFF");
	assert.equal(sessionCodes("ffffffff-0000").seed, -1);
	for (const missing of [undefined, "", "not-a-session", "abc"]) assert.deepEqual(sessionCodes(missing), { unit: "????", session: "????????", seed: 0 });
});

test("Herdr pane and sector codes, and -- outside Herdr", () => {
	assert.deepEqual(herdrCodes({ HERDR_PANE_ID: "wA1:p1", HERDR_WORKSPACE_ID: "wA1", HERDR_TAB_ID: "wA1:t1" }), { pane: "WA1:P1", sector: "WA1.T1" });
	assert.deepEqual(herdrCodes({}), { pane: "--", sector: "--" });
	assert.deepEqual(herdrCodes({ HERDR_PANE_ID: "wA1:p1" }), { pane: "WA1:P1", sector: "--" });
	assert.equal(herdrCodes({ HERDR_WORKSPACE_ID: "w1", HERDR_TAB_ID: "t9" }).sector, "W1.T9");
	assert.deepEqual(herdrCodes({ HERDR_PANE_ID: "\u001b[31m", HERDR_WORKSPACE_ID: "a b", HERDR_TAB_ID: "x" }), { pane: "--", sector: "--" });
});

test("the CORE value is a short model label and the thinking level at boot", () => {
	assert.equal(modelLabel("claude-opus-5-5"), "OPUS-5.5");
	assert.equal(modelLabel("anthropic/claude-sonnet-4-5-20250929"), "SONNET-4.5");
	assert.equal(modelLabel("gpt-5.5"), "GPT-5.5");
	assert.equal(modelLabel("claude-haiku-5-5-latest"), "HAIKU-5.5");
	assert.equal(modelLabel(undefined), "--");
	assert.equal(coreValue({ id: "claude-opus-5-5", provider: "anthropic" }, "high"), "OPUS-5.5 / HIGH");
	assert.equal(coreValue(undefined, undefined), "-- / --");
	assert.equal(coreValue({ id: "unknown", provider: "unknown" }, "off"), "-- / OFF");
});

test("ASSIGNMENT reads the branch from HEAD content: branch, detached commit, unknown, or no repository", () => {
	assert.deepEqual(parseHead("ref: refs/heads/feature/droid-header\n"), { kind: "branch", name: "feature/droid-header" });
	assert.deepEqual(parseHead("e1cc5cf0c8b4a1d2e3f405162738495a6b7c8d9e\n"), { kind: "detached", sha: "e1cc5cf" });
	assert.deepEqual(parseHead("ref: refs/remotes/origin/main"), { kind: "branch", name: "remotes/origin/main" });
	assert.deepEqual(parseHead("garbage"), { kind: "unknown" });
	assert.equal(assignment("/home/user/projects/industrial-os", { kind: "branch", name: "main" }), "INDUSTRIAL-OS · MAIN");
	assert.equal(assignment("/srv/app", { kind: "detached", sha: "e1cc5cf" }), "APP · E1CC5CF");
	assert.equal(assignment("/srv/app", { kind: "unknown" }), "APP · --");
	assert.equal(assignment("/tmp/scratch", { kind: "none" }), "SCRATCH");
	assert.equal(clock(new Date(2026, 9, 27, 4, 9, 5)), "04:09:05");
});

// The shape DefaultPackageManager.resolve() returns on a real machine, with public-safe package names.
const home = "/home/user", agent = `${home}/.pi/agent`;
const top = (path: string): ResourceRef => ({ path: `${agent}/extensions/${path}`, metadata: { source: "auto", scope: "user", origin: "top-level", baseDir: agent } });
const pkg = (source: string, root: string, path: string, scope = "user"): ResourceRef => ({ path: `${root}/${path}`, metadata: { source, scope, origin: "package", baseDir: root, packageRoot: root } });
const io = `${agent}/git/github.com/jigenator/industrial-os`, tasks = `${agent}/git/github.com/example/pi-tasks`, mono = `${agent}/git/github.com/example/agent-mono`;
const PROBE: ResourceRef[] = [
	top("notes-sync.ts"), top("release-kit/index.ts"),
	pkg("npm:pi-web-access", `${agent}/npm/node_modules/pi-web-access`, "dist/index.js"),
	pkg("npm:@scope/pi-goal", `${agent}/npm/node_modules/@scope/pi-goal`, "dist/index.ts"),
	pkg("git:github.com/jigenator/industrial-os", io, "pi/claude-interrupt/src/index.ts"),
	pkg("git:github.com/jigenator/industrial-os", io, "pi/status-bar/src/extension.ts"),
	pkg("git:github.com/jigenator/industrial-os", io, "pi/herdr-pane-naming/index.ts"),
	pkg("git:github.com/example/pi-tasks@main", tasks, "dist/extensions/attribution.js"),
	pkg("git:github.com/example/pi-tasks@main", tasks, "dist/extensions/tasks.js"),
	pkg("git:github.com/example/agent-mono@main", mono, "packages/quick-ask/index.ts"),
	pkg("git:github.com/example/sketch-tools@main", `${agent}/git/github.com/example/sketch-tools`, "sketch.ts"),
];

test("extension names follow the approved rules and are alphabetical", () => {
	assert.deepEqual(extensionNames(PROBE), [
		"industrial-os/claude-interrupt", "industrial-os/herdr-pane-naming", "industrial-os/status-bar",
		"notes-sync", "pi-goal", "pi-tasks", "pi-tasks/attribution", "pi-web-access", "quick-ask", "release-kit", "sketch-tools",
	]);
	assert.equal(packageName("npm:@scope/name@1.2.3", undefined), "name");
	assert.equal(packageName("npm:name@^2", undefined), "name");
	assert.equal(packageName("git:https://github.com/owner/repo.git", undefined), "repo");
	assert.equal(packageName("https://github.com/owner/repo", undefined), "repo");
	assert.equal(packageName("../local/pack", "/abs/local/pack"), "pack");
});

test("context files are shown as Pi lists them", () => {
	const cwd = `${home}/projects/industrial-os`;
	assert.equal(contextPath(`${agent}/AGENTS.md`, cwd, home), "~/.pi/agent/AGENTS.md");
	assert.equal(contextPath(`${cwd}/AGENTS.md`, cwd, home), "AGENTS.md");
	assert.equal(contextPath(`${home}/projects/AGENTS.md`, cwd, home), "~/projects/AGENTS.md");
	assert.equal(contextPath("/etc/AGENTS.md", cwd, home), "/etc/AGENTS.md");
});
