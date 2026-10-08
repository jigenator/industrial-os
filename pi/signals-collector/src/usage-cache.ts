import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, statSync, watch } from "node:fs";
import { chmod, open, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { emptyUsage, fetchUsage, USAGE_PROVIDERS } from "./usage.ts";
import type { UsageProviderState, UsageSnapshot, UsageWindows } from "./usage.ts";

const REFRESH_MS = 5 * 60_000, LOCK_STALE_MS = 3 * 60_000;
type Cache = UsageSnapshot & { fetchedAt: number };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const timestamp = (v: unknown): v is number => finite(v) && v >= 0;
const nullable = (v: unknown) => v === null || finite(v);

// Read through the same whitelist as writes: never spread cached external objects into state.
export function parseUsageCache(raw: unknown): Cache | null {
	if (!record(raw) || !timestamp(raw.fetchedAt) || (raw.installed !== true && raw.installed !== false) || !Array.isArray(raw.providers)) return null;
	const providers: UsageProviderState[] = [];
	for (const provider of USAGE_PROVIDERS) {
		const matches = raw.providers.filter((p) => record(p) && p.provider === provider);
		if (matches.length !== 1) return null;
		const p = matches[0], result: UsageProviderState = { provider };
		if (p.failure !== undefined) {
			if (p.failure !== "timeout" && p.failure !== "failed") return null;
			result.failure = p.failure;
		}
		if (p.data !== undefined) {
			const d = p.data;
			if (!record(d) || !record(d.windows) || !nullable(d.updatedAt) || !timestamp(d.fetchedAt)) return null;
			const windows: UsageWindows = {};
			for (const key of ["5h", "wk"] as const) {
				const w = d.windows[key];
				if (w === undefined) continue;
				if (!record(w) || !nullable(w.usedPercent) || !nullable(w.resetsAt)) return null;
				windows[key] = { usedPercent: w.usedPercent as number | null, resetsAt: w.resetsAt as number | null };
			}
			result.data = { windows, updatedAt: d.updatedAt as number | null, fetchedAt: d.fetchedAt };
		}
		providers.push(result);
	}
	return { installed: raw.installed, providers: raw.installed ? providers : USAGE_PROVIDERS.map((provider) => ({ provider })), fetchedAt: raw.fetchedAt };
}

export function collectUsage(publish: (usage: UsageSnapshot) => void): { dispose(): void } {
	const directory = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "industrial-os", "signals-collector");
	const file = join(directory, "usage.json"), lock = join(directory, "usage.lock");
	// `contending`: the last refresh found another collector's lock. Only a contender wakes on lock removal, so this
	// collector's own release, whenever its event arrives, never cuts short the retry after a failed write.
	let live = true, busy = false, contending = false, lockRemoved = false, cache: Cache | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const controller = new AbortController();
	const fresh = () => cache !== null && Date.now() - cache.fetchedAt < REFRESH_MS;
	const arm = (delay = cache ? Math.max(0, cache.fetchedAt + REFRESH_MS - Date.now()) : 0) => {
		if (!live || busy) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => { timer = undefined; void refresh(); }, delay + Math.floor(Math.random() * 250));
		timer.unref();
	};
	const reload = () => {
		if (!live) return;
		try {
			// Bounded input. Atomic rename means a reader never sees our partial write.
			const next = statSync(file).size <= 1024 * 1024 ? parseUsageCache(JSON.parse(readFileSync(file, "utf8"))) : null;
			if (next && JSON.stringify(next) !== JSON.stringify(cache)) {
				cache = next; publish({ installed: next.installed, providers: next.providers });
			}
		} catch { /* Missing/malformed cache is unknown, not a successful sample. */ }
		arm();
	};
	let watcher: ReturnType<typeof watch> | undefined;
	try {
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		watcher = watch(directory, (_event, name) => {
			if (name === null || name.toString() === "usage.json") reload();
			if (name === null || name.toString() === "usage.lock") {
				// A disposed winner may release without writing. Wake contenders on removal,
				// but not on creation/writes (which would reset stale-lock backoff).
				try { statSync(lock); } catch (error: any) { if (error.code === "ENOENT" && contending) { lockRemoved = true; reload(); } }
			}
		});
		watcher.unref();
		watcher.on("error", () => { watcher?.close(); watcher = undefined; });
	} catch { /* Cache failure does not fall back to uncoordinated CodexBar calls. */ }
	publish(emptyUsage());
	reload();

	async function refresh() {
		if (!live || busy) return;
		busy = true; contending = false; lockRemoved = false;
		let handle: Awaited<ReturnType<typeof open>> | undefined;
		let temporary: string | undefined;
		let retry = REFRESH_MS;
		try {
			reload();
			if (fresh() || !live) return;
			try { handle = await open(lock, "wx", 0o600); }
			catch (error: any) {
				if (error.code !== "EEXIST") return;
				const old = await stat(lock);
				let time = old.mtimeMs;
				try { const data = JSON.parse(readFileSync(lock, "utf8")); if (record(data) && timestamp(data.time)) time = data.time; } catch { /* use mtime for malformed locks */ }
				if (Date.now() - time <= LOCK_STALE_MS) { contending = true; retry = Math.max(1, time + LOCK_STALE_MS - Date.now() + 1); return; }
				// Recheck identity before unlink. Cross-process stat/unlink is not atomic;
				// two stale takers can still cause one extra fetch (documented, atomic cache writes).
				const checked = await stat(lock);
				if (old.ino !== checked.ino || old.mtimeMs !== checked.mtimeMs) { contending = true; retry = LOCK_STALE_MS; return; }
				await unlink(lock);
				try { handle = await open(lock, "wx", 0o600); } catch { contending = true; retry = LOCK_STALE_MS; return; }
			}
			await handle.writeFile(JSON.stringify({ pid: process.pid, time: Date.now() }));
			reload(); // A preceding winner may have written between the first read and lock acquisition.
			if (fresh() || !live) return;
			const results = await Promise.all(USAGE_PROVIDERS.map((provider) => fetchUsage(provider, { signal: controller.signal })));
			if (!live || controller.signal.aborted) return;
			const fetchedAt = Date.now(), installed = !results.some((r) => r.kind === "not-installed");
			const providers = USAGE_PROVIDERS.map((provider, i): UsageProviderState => {
				const r = results[i];
				if (!installed) return { provider };
				if (r.kind === "usage") return { provider, data: { windows: r.windows, updatedAt: r.updatedAt, fetchedAt } };
				return { provider, ...(cache?.providers.find((p) => p.provider === provider)?.data ? { data: cache.providers.find((p) => p.provider === provider)!.data } : {}), failure: r.kind === "unavailable" && r.reason === "timeout" ? "timeout" : "failed" };
			});
			const next = parseUsageCache({ installed, providers, fetchedAt })!;
			temporary = join(directory, `.usage-${process.pid}-${randomUUID()}.json`);
			const output = await open(temporary, "wx", 0o600);
			try { await output.chmod(0o600); await output.writeFile(JSON.stringify(next) + "\n"); } finally { await output.close(); }
			if (!live) return;
			await rename(temporary, file); temporary = undefined;
			await chmod(file, 0o600);
			reload();
		} catch { /* No success-shaped fallback or immediate retry on a cache/lock write failure. */ }
		finally {
			if (temporary) await unlink(temporary).catch(() => {});
			if (handle) {
				try { const [own, current] = await Promise.all([handle.stat(), stat(lock)]); if (own.ino === current.ino) await unlink(lock); } catch { /* another stale taker may own it */ }
				await handle.close();
			}
			busy = false;
			arm(fresh() ? undefined : lockRemoved ? 0 : retry);
		}
	}
	return { dispose() { live = false; if (timer) clearTimeout(timer); watcher?.close(); controller.abort(); } };
}
