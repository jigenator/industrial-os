// The header's only I/O: the branch from `.git/HEAD`, whether Herdr's droid-plate pane header draws this terminal's
// plate (one bounded `hc get`), and the manifest through Pi's public loaders. Each runs once per session start, off
// the render path, and resolves to a value rather than throwing.
import { execFile } from "node:child_process";
import { open, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type * as Pi from "@earendil-works/pi-coding-agent";
import type { Manifest } from "./header.ts";
import { type Branch, contextPath, extensionNames, isClaudeInterrupt, parseHead, sortNames } from "./facts.ts";

const MAX_DEPTH = 64, MAX_BYTES = 1024;

async function readSmall(path: string): Promise<string | undefined> {
	const handle = await open(path, "r").catch(() => undefined);
	if (!handle) return undefined;
	try {
		const buffer = Buffer.alloc(MAX_BYTES);
		const { bytesRead } = await handle.read(buffer, 0, MAX_BYTES, 0);
		return buffer.subarray(0, bytesRead).toString("utf8");
	} catch {
		return undefined;
	} finally {
		await handle.close();
	}
}

async function headAt(gitDir: string): Promise<Branch> {
	const content = await readSmall(join(gitDir, "HEAD"));
	return content === undefined ? { kind: "unknown" } : parseHead(content);
}

/**
 * The branch of the repository containing `cwd`, read from `.git/HEAD` without running Git. A `.git` file (a linked
 * worktree or submodule) is followed to its `gitdir`. At most 64 parent folders and 1 KiB per file are read.
 */
export async function readBranch(cwd: string): Promise<Branch> {
	let dir = resolve(cwd);
	for (let depth = 0; depth < MAX_DEPTH; depth++) {
		const dotGit = join(dir, ".git");
		const found = await stat(dotGit).catch(() => undefined);
		if (found?.isDirectory()) return headAt(dotGit);
		if (found?.isFile()) {
			const gitdir = /^gitdir:\s*(.+)$/m.exec((await readSmall(dotGit)) ?? "")?.[1]?.trim();
			return gitdir ? headAt(isAbsolute(gitdir) ? gitdir : resolve(dir, gitdir)) : { kind: "unknown" };
		}
		const parent = dirname(dir);
		if (parent === dir) return { kind: "none" };
		dir = parent;
	}
	return { kind: "none" };
}

/** The label Herdr's droid-plate pane header mod sets to `1` on its pane's terminal while it draws a plate there. */
export const PLATE_LABEL = "io.droid-plate.v1";
/** The lookup's bound: Pi's header waits for it, so a slow or stuck `hc` costs at most this before the full header. */
export const PLATE_LOOKUP_MS = 300;

/** `execFile`'s shape as the lookup uses it; tests pass their own. */
export type RunFile = (file: string, args: string[], options: { timeout: number; env: NodeJS.ProcessEnv }, done: (error: Error | null, stdout: string) => void) => void;
const runFile: RunFile = (file, args, options, done) => {
	execFile(file, args, { ...options, encoding: "utf8", maxBuffer: 1024 * 1024, killSignal: "SIGKILL" }, (error, stdout) => done(error, String(stdout ?? "")));
};

/**
 * Whether the droid-plate pane header draws this terminal's plate: inside Herdr Desktop (`HC_TERMINAL_ID` set), one
 * `hc get <terminal> --json`, bounded at 300 ms, whose labels hold `io.droid-plate.v1=1`. A missing `hc`, an error,
 * a timeout, unreadable output or an absent label is false, so the header stays whole. Never runs npm or Git.
 */
export function platedTerminal(env: NodeJS.ProcessEnv, run: RunFile = runFile): Promise<boolean> {
	const terminal = env.HC_TERMINAL_ID;
	if (!terminal || !/^[A-Za-z0-9:._/-]{1,64}$/.test(terminal)) return Promise.resolve(false);
	return new Promise((resolve) => {
		let settled = false;
		const finish = (value: boolean) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
		// A backstop beside execFile's own timeout, so a runner that never calls back still cannot hold the header. It
		// is cleared as soon as the lookup answers.
		const timer = setTimeout(() => finish(false), PLATE_LOOKUP_MS + 50);
		try {
			run("hc", ["get", terminal, "--json"], { timeout: PLATE_LOOKUP_MS, env }, (error, stdout) => {
				if (error) return finish(false);
				try {
					const labels = JSON.parse(stdout)?.labels;
					finish(!!labels && typeof labels === "object" && labels[PLATE_LABEL] === "1");
				} catch {
					finish(false);
				}
			});
		} catch {
			finish(false);
		}
	});
}

/** The public Pi exports the manifest uses; extension.ts passes the host's own. */
export type PiLoaders = Pick<typeof Pi, "SettingsManager" | "DefaultPackageManager" | "loadSkills" | "loadProjectContextFiles">;

/**
 * An empty npm command. Pi looks up packages installed the old, global way by running `npm root -g` synchronously and
 * without a timeout; Pi's own guard rejects an empty command before any process starts, and the lookup treats that as
 * not found.
 */
const NO_NPM = [""];

/** A failure as the manifest shows it: the first line of its message. */
export function failure(error: unknown): Manifest {
	const message = error instanceof Error ? error.message : String(error);
	return { status: "unavailable", reason: message.split("\n")[0].slice(0, 200) || "unknown error" };
}

/**
 * The manifest for `cwd`, built in Pi's process through its public loaders, never running npm or Git and never
 * installing. Extensions are the enabled candidates Pi's settings name, not proven loads; skills and context files
 * go through the loaders Pi itself uses; `prompts` are the names Pi already loaded. Pi applies project trust. Never
 * throws: unreadable settings or any failure becomes `unavailable` with its reason.
 */
export async function buildManifest(
	pi: PiLoaders,
	request: { cwd: string; agentDir: string; trusted: boolean; home: string; prompts: readonly string[] },
): Promise<Manifest> {
	const { cwd, agentDir, trusted, home } = request;
	try {
		const settingsManager = pi.SettingsManager.create(cwd, agentDir, { projectTrusted: trusted });
		// Pi records unreadable settings rather than throwing, and carries on with them empty.
		const unreadable = new Map(settingsManager.drainErrors().map(({ scope, path }) => [scope, path ? `${scope} ${contextPath(path, cwd, home)}` : scope]));
		if (unreadable.size) return { status: "unavailable", reason: `SETTINGS UNREADABLE: ${[...unreadable.values()].join(", ")}` };
		// In memory only: this manager is never saved, and nothing reloads it.
		settingsManager.applyOverrides({ npmCommand: NO_NPM });
		const resolved = await new pi.DefaultPackageManager({ cwd, agentDir, settingsManager }).resolve(async () => "skip");
		const skillPaths = resolved.skills.filter((r) => r.enabled).map((r) => r.path);
		const extensions = resolved.extensions.filter((r) => r.enabled);
		return {
			status: "ready",
			context: pi.loadProjectContextFiles({ cwd, agentDir }).map((file) => contextPath(file.path, cwd, home)),
			skills: sortNames(pi.loadSkills({ cwd, agentDir, skillPaths, includeDefaults: false }).skills.map((skill) => skill.name)),
			prompts: sortNames(request.prompts.map((name) => `/${name}`)),
			extensions: extensionNames(extensions),
			steering: extensions.some((r) => isClaudeInterrupt(r.path)),
		};
	} catch (error) {
		return failure(error);
	}
}
