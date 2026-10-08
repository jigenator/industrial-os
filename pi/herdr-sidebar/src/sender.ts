// Reports the token map to Herdr with `pane.report_metadata`: only what changed since the last accepted report,
// at most 16 keys per request, with a TTL renewed well before it expires. Every request carries the one stable
// source and a clock-based sequence number, so Herdr ignores a report composed before a newer one, including a
// late clear from a runtime that has already been replaced. See docs/architecture.md#reporting-to-herdr.
import { TOKEN_KEYS, type TokenKey, type TokenMap } from "./tokens.ts";
import type { HerdrReply } from "./herdr-client.ts";

export const SOURCE = "industrial-os:herdr-sidebar";
const KEYS_PER_REQUEST = 16;

export type ReportRequest = (params: Record<string, unknown>, timeoutMs: number) => Promise<HerdrReply>;
export type SenderOptions = {
	paneId: string;
	request: ReportRequest;
	now?: () => number;
	ttlMs?: number;
	renewMs?: number;
	retryMs?: number;
	requestTimeoutMs?: number;
	shutdownTimeoutMs?: number;
};

// Herdr keeps a report only when its seq is above the last one accepted for the source. Microseconds of wall-clock
// time order reports across runtimes in one process and across processes in one pane; within a runtime the counter
// also never repeats. A backwards clock step makes Herdr ignore reports until the clock passes the last seq.
let lastSeq = 0;
export function nextSeq(now = Date.now()): number {
	lastSeq = Math.max(now * 1000, lastSeq + 1);
	return lastSeq;
}

type Report = { patch: Record<string, string | null>; seq: number }[];

export function createTokenSender(options: SenderOptions) {
	const now = options.now ?? Date.now;
	const ttlMs = options.ttlMs ?? 60_000;
	const renewMs = options.renewMs ?? 20_000;
	const retryMs = options.retryMs ?? 5_000;
	const requestTimeoutMs = options.requestTimeoutMs ?? 1_000;
	const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1_500;
	let desired: TokenMap = {};
	// What Herdr holds from us as far as accepted replies show. Unsynced means unknown: the next report sets every
	// applicable key and clears every other key in the list.
	let sent: TokenMap = {};
	let synced = false;
	let dirty = false;
	let draining: Promise<void> | undefined;
	let closed = false;
	let renewTimer: NodeJS.Timeout | undefined;
	let retryTimer: NodeJS.Timeout | undefined;
	let lastError: string | undefined;
	let accepted = 0;

	function compose(all: boolean): Report {
		const clears: [TokenKey, null][] = [], sets: [TokenKey, string][] = [];
		for (const key of TOKEN_KEYS) {
			const value = desired[key];
			if (!all && value === sent[key]) continue;
			if (value === undefined) clears.push([key, null]);
			else sets.push([key, value]);
		}
		// Clears first, so a full pane never rejects the sets for exceeding its key limit.
		const entries = [...clears, ...sets];
		const report: Report = [];
		for (let i = 0; i < entries.length; i += KEYS_PER_REQUEST) report.push({ patch: Object.fromEntries(entries.slice(i, i + KEYS_PER_REQUEST)), seq: nextSeq(now()) });
		return report;
	}

	const params = (patch: Record<string, string | null>, seq: number) => ({ pane_id: options.paneId, source: SOURCE, tokens: patch, ttl_ms: ttlMs, seq });

	async function drain() {
		while (dirty && !closed) {
			dirty = false;
			const full = !synced;
			for (const { patch, seq } of compose(full)) {
				const reply = await options.request(params(patch, seq), requestTimeoutMs);
				if (closed) return;
				if (!reply.ok) {
					// Herdr may hold any mix of old and new values now; resend everything on the next attempt.
					synced = false;
					lastError = reply.error;
					scheduleRetry();
					return;
				}
				accepted++;
				for (const [key, value] of Object.entries(patch)) {
					if (value === null) delete sent[key as TokenKey];
					else sent[key as TokenKey] = value;
				}
			}
			if (full) {
				synced = true;
				lastError = undefined;
				scheduleRenew();
			}
		}
	}

	function flush() {
		if (closed) return;
		dirty = true;
		draining ??= drain().finally(() => { draining = undefined; if (dirty && !closed) flush(); });
	}

	function scheduleRetry() {
		if (retryTimer || closed) return;
		retryTimer = setTimeout(() => { retryTimer = undefined; flush(); }, retryMs);
		retryTimer.unref();
	}

	// A full report resets every set key's TTL; renewing at a third of it survives two failed attempts.
	function scheduleRenew() {
		if (renewTimer) clearTimeout(renewTimer);
		renewTimer = setTimeout(() => { renewTimer = undefined; synced = false; flush(); }, renewMs);
		renewTimer.unref();
	}

	return {
		update(tokens: TokenMap) {
			if (closed) return;
			desired = { ...tokens };
			flush();
		},
		/** The current health: whether Herdr's copy is known to match, and the last failure. */
		get state() { return { synced: synced && !dirty && !draining, lastError, accepted }; },
		/**
		 * Stops reporting and clears every key in the list. The clear is composed now, before any replacement runtime
		 * can report, so its sequence numbers are below the new runtime's. Waits at most `shutdownTimeoutMs`.
		 */
		async shutdown(): Promise<void> {
			if (closed) return;
			closed = true;
			if (renewTimer) clearTimeout(renewTimer);
			if (retryTimer) clearTimeout(retryTimer);
			renewTimer = retryTimer = undefined;
			desired = {};
			const report = compose(true);
			const deadline = now() + shutdownTimeoutMs;
			for (const { patch, seq } of report) {
				const left = deadline - now();
				if (left <= 0) return;
				const reply = await options.request(params(patch, seq), Math.min(requestTimeoutMs, left));
				if (!reply.ok) { lastError = reply.error; return; }
			}
		},
	};
}
