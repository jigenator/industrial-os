import { getSources, socketPath } from "./source-collector.ts";

/** A window's used share; null when the source reported the window without a used percentage. */
export type UsageWindow = { usedPercent: number | null; resetsAt: number | null };
/** Only 300-minute (5H) and 10080-minute (WK) windows; an absent key is a window the provider does not report. */
export type UsageWindows = { "5h"?: UsageWindow; wk?: UsageWindow };
/** Last good sample; receipt timestamp identifies the sample for display motion. */
export type UsageSample = { windows: UsageWindows; updatedAt: number | null; fetchedAt: number };
/** `provider` is a source-collector source id; `tag` and `color` are its raw status values. */
export type UsageProviderState = { provider: string; tag?: string; color?: string; data?: UsageSample; failure?: "timeout" | "failed" };
export type UsageSnapshot = { installed: boolean | null; providers: UsageProviderState[] };

// Poll just after the engine's next planned run; while one runs, check again shortly.
const AFTER_RUN_MS = 5_000, RUNNING_MS = 10_000, MAX_MS = 5 * 60_000, UNREACHABLE_MS = 60_000;
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDOWS = [["h5", "5h"], ["wk", "wk"]] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

// ISO 8601 instants only; anything else is unknown rather than guessed.
function instant(value: unknown): number | null {
	if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
	const time = Date.parse(value);
	return Number.isFinite(time) ? time : null;
}

/** `industrialOs.usageSources` from Pi settings: ordered unique source ids; absent or invalid is none. */
export function usageSources(settings: unknown): string[] {
	const value = record(settings) && record(settings.industrialOs) ? settings.industrialOs.usageSources : undefined;
	if (!Array.isArray(value) || value.length > 256 || !value.every((id) => typeof id === "string" && ID.test(id))) return [];
	return [...new Set(value as string[])];
}

export const pendingUsage = (sources: readonly string[]): UsageSnapshot => ({ installed: null, providers: sources.map((provider) => ({ provider })) });

// The usage item convention: every known fact must have its type, or the whole item is no data.
function sample(item: Record<string, unknown>, fetchedAt: number | null): UsageSample | undefined {
	const facts = item.facts ?? {};
	if (fetchedAt === null || !record(facts)) return undefined;
	const updatedAt = instant(facts.updatedAt);
	if (facts.updatedAt !== undefined && updatedAt === null) return undefined;
	const windows: UsageWindows = {};
	for (const [fact, key] of WINDOWS) {
		const reported = facts[fact], used = facts[`${fact}Used`], resets = facts[`${fact}ResetsAt`];
		if (reported === undefined || reported === false) continue;
		const resetsAt = instant(resets);
		if (reported !== true || (used !== undefined && !finite(used)) || (resets !== undefined && resetsAt === null)) return undefined;
		windows[key] = { usedPercent: finite(used) ? used : null, resetsAt };
	}
	return { windows, updatedAt, fetchedAt };
}

/**
 * Next usage state from one poll: the scoped `get` result, or undefined when the engine could not be
 * read. The contract's state table is canonical; `fetchedAt` is the source's `okAt`, the end of the
 * successful run that produced its current items.
 *
 * Wire fields read, described locally from source-collector's v1 contract and validated here:
 * `{ v: 1, sources: [{ id, tag, color?, state, okAt?, error?: { code } }], items: [{ source, key, facts? }] }`.
 */
export function nextUsage(sources: readonly string[], previous: UsageSnapshot, reply: unknown): UsageSnapshot {
	if (!record(reply) || reply.v !== 1 || !Array.isArray(reply.sources) || !Array.isArray(reply.items)) {
		if (previous.installed !== true) return pendingUsage(sources);
		return { installed: true, providers: previous.providers.map((p) => p.data ? { ...p, failure: "failed" } : p) };
	}
	const statuses = reply.sources.filter(record), items = reply.items.filter(record);
	return { installed: true, providers: sources.map((provider): UsageProviderState => {
		const status = statuses.find((s) => s.id === provider);
		if (!status) return { provider, failure: "failed" };
		const own = items.filter((i) => i.source === provider), item = own.find((i) => i.key === "usage");
		const data = item && sample(item, instant(status.okAt));
		const pending = status.state === "ok" || (status.state === "loading" && own.length === 0);
		return {
			provider,
			...(text(status.tag) ? { tag: status.tag } : {}),
			...(text(status.color) ? { color: status.color } : {}),
			...(data ? { data } : {}),
			...(pending ? {} : { failure: record(status.error) && status.error.code === "timeout" ? "timeout" as const : "failed" as const }),
		};
	}) };
}

/**
 * Delay before the next poll, from the reply just read. A scheduled source has `nextAt`; a running one
 * has none, so it is checked again in RUNNING_MS. Disabled, planned and misconfigured sources never run.
 * Clamped to [RUNNING_MS, MAX_MS]; an unreadable engine retries in UNREACHABLE_MS.
 */
export function nextPollDelay(sources: readonly string[], reply: unknown, now: number): number {
	if (!record(reply) || reply.v !== 1 || !Array.isArray(reply.sources)) return UNREACHABLE_MS;
	let delay = MAX_MS;
	for (const s of reply.sources.filter(record)) {
		if (!sources.includes(s.id as string) || ["disabled", "planned", "config_error"].includes(s.state as string)) continue;
		const at = instant(s.nextAt);
		delay = Math.min(delay, at === null ? RUNNING_MS : at - now + AFTER_RUN_MS);
	}
	return Math.max(RUNNING_MS, delay);
}

/**
 * Polls the configured usage sources now, then at `nextPollDelay` while visible, and when shown again.
 * One request at a time; disposal aborts it and suppresses its result.
 */
export function collectUsage(
	sources: readonly string[], publish: (usage: UsageSnapshot) => void,
	request: (signal: AbortSignal) => Promise<unknown> = (signal) => getSources(socketPath(), sources, { signal }),
): { setVisible(visible: boolean): void; dispose(): void } {
	let live = sources.length > 0, visible = true, usage = pendingUsage(sources);
	let timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
	async function poll() {
		if (!live || !visible || controller) return;
		clearTimeout(timer); timer = undefined;
		const own = controller = new AbortController();
		const reply = await request(own.signal).catch(() => undefined);
		if (controller === own) controller = undefined;
		if (!live || own.signal.aborted) return;
		usage = nextUsage(sources, usage, reply);
		publish(usage);
		if (visible) { timer = setTimeout(() => void poll(), nextPollDelay(sources, reply, Date.now())); timer.unref(); }
	}
	void poll();
	return {
		setVisible(next) {
			if (!live || visible === next) return;
			visible = next;
			if (!visible) { clearTimeout(timer); timer = undefined; }
			else void poll();
		},
		dispose() { live = false; clearTimeout(timer); controller?.abort(); },
	};
}
