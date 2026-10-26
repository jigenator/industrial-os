import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { buildManifest, readBranch } from "../src/sources.ts";
import { hostEntry } from "./host.ts";

const root = await realpath(await mkdtemp(join(tmpdir(), "droid-header-")));
after(() => rm(root, { recursive: true, force: true }));
const write = async (path: string, content: string) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), content); };

test("the branch is read from .git/HEAD, following a worktree's .git file, without running Git", async () => {
	await write("repo/.git/HEAD", "ref: refs/heads/main\n");
	await mkdir(join(root, "repo/src/deep"), { recursive: true });
	assert.deepEqual(await readBranch(join(root, "repo/src/deep")), { kind: "branch", name: "main" });
	await write("repo/.git/worktrees/feature/HEAD", "ref: refs/heads/feature/droid-header\n");
	await write("feature/.git", "gitdir: ../repo/.git/worktrees/feature\n");
	assert.deepEqual(await readBranch(join(root, "feature")), { kind: "branch", name: "feature/droid-header" });
	await write("absolute/.git", `gitdir: ${join(root, "repo/.git/worktrees/feature")}\n`);
	assert.deepEqual(await readBranch(join(root, "absolute")), { kind: "branch", name: "feature/droid-header" });
	await write("detached/.git/HEAD", `${"ab".repeat(20)}\n`);
	assert.deepEqual(await readBranch(join(root, "detached")), { kind: "detached", sha: "abababa" });
	await write("broken/.git", "not a gitdir line\n");
	assert.deepEqual(await readBranch(join(root, "broken")), { kind: "unknown" });
	await mkdir(join(root, "headless/.git"), { recursive: true });
	assert.deepEqual(await readBranch(join(root, "headless")), { kind: "unknown" });
	await write("missing/.git", "gitdir: ./nowhere\n");
	assert.deepEqual(await readBranch(join(root, "missing")), { kind: "unknown" });
	// Only the first KiB is read.
	await write("huge/.git/HEAD", `ref: refs/heads/${"x".repeat(5000)}`);
	assert.equal((await readBranch(join(root, "huge"))).kind, "branch");
});

test("a folder outside any repository has no branch", async (t) => {
	// The temporary folder is the only one this test controls; skip if some ancestor of it is a repository.
	for (let dir = root; dir !== dirname(dir); dir = dirname(dir)) if (existsSync(join(dir, ".git"))) return t.skip(`${dir} is a repository`);
	await mkdir(join(root, "plain/deep"), { recursive: true });
	assert.deepEqual(await readBranch(join(root, "plain/deep")), { kind: "none" });
});

// Against the installed Pi: its real settings, package resolution and loaders.
const pi = await import(pathToFileURL(hostEntry).href);
const skill = (frontmatter: string) => `---\n${frontmatter}\n---\nBody\n`;
async function fixtureTree(name: string) {
	await write(`${name}/agent/extensions/notes.ts`, "export default function () {}\n");
	// Loading this extension would leave a marker file: the manifest must never run extension code.
	await write(`${name}/agent/extensions/kit/index.ts`, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(join(root, name, "ran"))}, "");\nexport default function () {}\n`);
	await write(`${name}/agent/skills/review/SKILL.md`, skill("name: review\ndescription: Review code."));
	await write(`${name}/agent/skills/folder-name/SKILL.md`, skill("name: renamed-skill\ndescription: Named in frontmatter."));
	await write(`${name}/agent/skills/no-description/SKILL.md`, skill("name: no-description"));
	await write(`${name}/agent/skills/broken/SKILL.md`, "---\nname: [unclosed\ndescription: x\n---\n");
	await write(`${name}/agent/skills/review-copy/SKILL.md`, skill("name: review\ndescription: A second review."));
	await write(`${name}/agent/AGENTS.md`, "Global rules.\n");
	await write(`${name}/agent/settings.json`, JSON.stringify({ packages: ["npm:pi-not-installed-fixture", "git:github.com/example/never-cloned"] }));
	await write(`${name}/work/AGENTS.md`, "Project rules.\n");
	await write(`${name}/work/.pi/skills/local-skill/SKILL.md`, skill("name: local-skill\ndescription: A project skill."));
	return { cwd: join(root, name, "work"), agentDir: join(root, name, "agent"), home: root, prompts: ["plan", "explain"] };
}

test("against the installed Pi: skills as Pi loads them, Pi's prompts, extensions as configured candidates, nothing run", async () => {
	const tree = await fixtureTree("host");
	assert.deepEqual(await buildManifest(pi, { ...tree, trusted: false }), {
		status: "ready", context: ["~/host/agent/AGENTS.md", "AGENTS.md"],
		// Frontmatter names win over folders; no description and malformed frontmatter are rejected; one "review".
		skills: ["renamed-skill", "review"], prompts: ["/explain", "/plan"], extensions: ["kit", "notes"],
	});
	const trusted = await buildManifest(pi, { ...tree, trusted: true });
	assert.deepEqual(trusted.status === "ready" && trusted.skills, ["local-skill", "renamed-skill", "review"], "a trusted project's skills load");
	assert.equal(existsSync(join(root, "host", "ran")), false, "no extension code ran");
});

test("against the installed Pi: unreadable global or trusted project settings make the manifest unavailable", async () => {
	const tree = await fixtureTree("bad-settings");
	await write("bad-settings/work/.pi/settings.json", "{ not json");
	assert.deepEqual(await buildManifest(pi, { ...tree, trusted: true }), { status: "unavailable", reason: "SETTINGS UNREADABLE: project .pi/settings.json" });
	// An untrusted project's settings are never read, so they cannot fail.
	assert.equal((await buildManifest(pi, { ...tree, trusted: false })).status, "ready");
	await write("bad-settings/agent/settings.json", "{ \"packages\": [ }");
	assert.deepEqual(await buildManifest(pi, { ...tree, trusted: false }), { status: "unavailable", reason: "SETTINGS UNREADABLE: global ~/bad-settings/agent/settings.json" });
});

test("against the installed Pi: no process starts and nothing installs, with npm and git packages missing", { timeout: 20_000 }, async () => {
	const tree = await fixtureTree("no-spawn");
	// In a process of its own whose every child_process function throws, killed after 10 s.
	const out = execFileSync(process.execPath, [fileURLToPath(new URL("./fixtures/spawn-guarded-build.ts", import.meta.url)), JSON.stringify({ ...tree, trusted: true })], {
		encoding: "utf8", timeout: 10_000, killSignal: "SIGKILL",
	});
	const { spawns, manifest } = JSON.parse(out);
	assert.deepEqual(spawns, [], "no process was started");
	assert.equal(existsSync(join(tree.agentDir, "npm")), false, "the missing npm package was not installed");
	assert.equal(existsSync(join(tree.agentDir, "git")), false, "the missing git package was not cloned");
	assert.equal(manifest.status, "ready");
	assert.deepEqual(manifest.extensions, ["kit", "notes"], "missing packages are left out");
	assert.deepEqual(manifest.skills, ["local-skill", "renamed-skill", "review"]);
	assert.deepEqual(manifest.prompts, ["/explain", "/plan"]);
});

test("a Pi loader that throws makes the manifest unavailable with the first line of its message", async () => {
	const broken = { ...pi, SettingsManager: { create() { throw new Error("cannot read\n    at somewhere"); } } };
	assert.deepEqual(await buildManifest(broken, { ...(await fixtureTree("broken")), trusted: true }), { status: "unavailable", reason: "cannot read" });
});
