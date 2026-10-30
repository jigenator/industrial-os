import { createHash, randomUUID } from "node:crypto";
import { constants, lstatSync, statSync } from "node:fs";
import { chmod, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { inspectPullRequest } from "./workspace.ts";
import type { GithubRepository, PullRequestInfo } from "./workspace.ts";

export const PR_TTL_MS = 60_000;
const LOCK_STALE_MS = 30_000, WAIT_MS = 12_000, MAX_ENTRIES = 128, MAX_BYTES = 1024 * 1024;
export type PrSample = { at: number; value: PullRequestInfo };
type Entry = PrSample & { key: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const unavailable = (reason: string): PullRequestInfo => ({ kind: "unavailable", reason });
const fresh = (at: number) => at <= Date.now() && Date.now() - at < PR_TTL_MS;

// Never fingerprint tokens or read credential contents. Explicit overrides keep the existing session-local path.
// Default credential/config metadata invalidates sharing after login/logout/account switches at the same HOME.
export function prAuthContext(): string | null {
	if (["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA"].some((key) => process.env[key] !== undefined)) return null;
	try {
		return hash([homedir(), ...["hosts.yml", "config.yml"].map((name) => {
			try { const s = statSync(join(homedir(), ".config", "gh", name)); return [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs]; }
			catch (error: any) { if (error.code === "ENOENT") return null; throw error; }
		})]);
	} catch { return null; }
}

const reasons = new Set([
	"GitHub authentication unavailable", "GitHub rate limit reached", "GitHub request validation failed",
	"GitHub repository access unavailable", "GitHub network unavailable", "Invalid GitHub response",
	"Invalid or truncated GitHub response", "Invalid GitHub pull request data", "Ambiguous open pull requests",
	"gh is not installed or executable", "gh output exceeded the safety limit", "gh lookup timed out", "gh command failed",
]);
function value(raw: unknown): PullRequestInfo | null {
	if (!record(raw)) return null;
	if (raw.kind === "none") return { kind: "none" };
	if (raw.kind === "unavailable" && typeof raw.reason === "string" && (reasons.has(raw.reason) || /^gh command failed \(exit \d{1,3}\)$/.test(raw.reason))) return unavailable(raw.reason);
	if (raw.kind === "open" && Number.isSafeInteger(raw.number) && (raw.number as number) > 0 && typeof raw.url === "string" && raw.url.length <= 400
		&& /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]+\/pull\/[1-9]\d*$/i.test(raw.url)
		&& raw.url.toLowerCase().endsWith(`/pull/${raw.number}`)) return { kind: "open", number: raw.number as number, url: raw.url };
	return null;
}
// Read and write through the same whitelist; cache input never reaches a snapshot by object spread.
export function parsePrCache(raw: unknown): Entry[] | null {
	if (!record(raw) || raw.version !== 1 || !Array.isArray(raw.entries) || raw.entries.length > MAX_ENTRIES) return null;
	const entries: Entry[] = [], keys = new Set<string>();
	for (const e of raw.entries) {
		if (!record(e) || typeof e.key !== "string" || !/^[a-f0-9]{64}$/.test(e.key) || keys.has(e.key)
			|| typeof e.at !== "number" || !Number.isFinite(e.at) || e.at < 0) return null;
		const parsed = value(e.value); if (!parsed) return null;
		keys.add(e.key); entries.push({ key: e.key, at: e.at, value: parsed });
	}
	return entries;
}
async function read(file: string): Promise<Entry[]> {
	const input = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const s = await input.stat();
		if (!s.isFile() || s.size > MAX_BYTES || (s.mode & 0o777) !== 0o600 || s.uid !== process.getuid?.()) return [];
		const buffer = Buffer.alloc(MAX_BYTES + 1), { bytesRead } = await input.read(buffer, 0, buffer.length, 0);
		if (bytesRead > MAX_BYTES) return [];
		return parsePrCache(JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"))) ?? [];
	} finally { await input.close(); }
}
async function privateDirectory(directory: string) {
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const s = await lstat(directory);
	if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid?.()) throw new Error("Unsafe cache directory");
	await chmod(directory, 0o700);
}
function pause(signal?: AbortSignal): Promise<void> {
	return new Promise((done) => {
		const finish = () => { clearTimeout(timer); signal?.removeEventListener("abort", finish); done(); };
		const timer = setTimeout(finish, 50 + Math.floor(Math.random() * 50)); timer.unref();
		signal?.addEventListener("abort", finish, { once: true });
		if (signal?.aborted) finish();
	});
}

export async function inspectSharedPullRequest(repository: GithubRepository, branch: string | null, options: { signal?: AbortSignal } = {}): Promise<PrSample> {
	const { signal } = options, context = prAuthContext();
	const sample = (value: PullRequestInfo): PrSample => ({ at: Date.now(), value });
	// The original boundary owns validation/not-applicable semantics. Only auth overrides bypass valid lookups.
	if (context === null || branch === null || !branch || /[\x00-\x20\x7f]/.test(branch)
		|| !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]+$/.test(repository.name)
		|| [".", ".."].includes(repository.name.split("/")[1]) || repository.url !== `https://github.com/${repository.name}`) {
		try { return sample(await inspectPullRequest(repository, branch, options)); }
		catch { return sample(unavailable("GitHub lookup failed")); }
	}
	const parent = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "industrial-os");
	const directory = join(parent, "signals-collector", "pr"), file = join(directory, "cache.json"), lock = join(directory, "refresh.lock");
	const key = hash([context, repository.name.toLowerCase(), branch]);
	const cached = async () => {
		const e = (await read(file).catch(() => [])).find((e) => e.key === key && fresh(e.at));
		if (!e || (e.value.kind === "open" && e.value.url.toLowerCase() !== `${repository.url}/pull/${e.value.number}`.toLowerCase())) return undefined;
		return { at: e.at, value: e.value };
	};
	let handle: Awaited<ReturnType<typeof open>> | undefined, temporary: string | undefined;
	try {
		// Reject symlinked application directories before creating descendants. Cache root is user-selected.
		await privateDirectory(parent); await privateDirectory(join(parent, "signals-collector")); await privateDirectory(directory);
		const deadline = performance.now() + WAIT_MS;
		while (!signal?.aborted) {
			const hit = await cached(); if (hit) return hit;
			try { handle = await open(lock, "wx", 0o600); break; }
			catch (error: any) {
				if (error.code !== "EEXIST") throw error;
				try {
					const old = await lstat(lock);
					if (!old.isFile() || old.isSymbolicLink()) throw new Error("Unsafe lock");
					if (Date.now() - old.mtimeMs > LOCK_STALE_MS) {
						// Same narrow stat/unlink stale-taker race as quota; never an uncoordinated fetch fallback.
						const checked = lstatSync(lock);
						if (old.ino === checked.ino && old.mtimeMs === checked.mtimeMs) await unlink(lock);
					}
				} catch (probe: any) { if (probe.code !== "ENOENT") throw probe; }
			}
			if (performance.now() >= deadline) return sample(unavailable("GitHub lookup cache busy"));
			await pause(signal);
		}
		if (!handle || signal?.aborted) return sample(unavailable("gh lookup cancelled"));
		await handle.chmod(0o600);
		await handle.writeFile(JSON.stringify({ pid: process.pid, time: Date.now() }));
		const hit = await cached(); if (hit) return hit;
		if (signal?.aborted) return sample(unavailable("gh lookup cancelled"));
		const result = sample(await inspectPullRequest(repository, branch, options));
		if (signal?.aborted || prAuthContext() !== context) return sample(unavailable("gh lookup cancelled"));
		const parsed = value(result.value); if (!parsed) return result;
		const entries = (await read(file).catch(() => [])).filter((e) => e.key !== key && fresh(e.at)).slice(-(MAX_ENTRIES - 1));
		entries.push({ key, at: result.at, value: parsed });
		temporary = join(directory, `.pr-${process.pid}-${randomUUID()}.json`);
		const output = await open(temporary, "wx", 0o600);
		try { await output.chmod(0o600); await output.writeFile(JSON.stringify({ version: 1, entries }) + "\n"); } finally { await output.close(); }
		if (signal?.aborted || prAuthContext() !== context) return sample(unavailable("gh lookup cancelled"));
		await rename(temporary, file); temporary = undefined;
		return result;
	} catch { return sample(unavailable(signal?.aborted ? "gh lookup cancelled" : "GitHub lookup cache unavailable")); }
	finally {
		if (temporary) await unlink(temporary).catch(() => {});
		if (handle) {
			try { const [own, current] = await Promise.all([handle.stat(), lstat(lock)]); if (own.ino === current.ino) await unlink(lock); } catch { /* another stale taker may own it */ }
			await handle.close().catch(() => {});
		}
	}
}
