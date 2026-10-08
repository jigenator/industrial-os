import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
const ACTIVITY_REFRESH_MS = 5_000, ACTIVITY_MIN_MS = 1_000, RPC_TIMEOUT_MS = 2_000;
const RPC_REQUEST = "subagents:rpc:v1:request", RPC_READY = "subagents:rpc:v1:ready";
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
// Public pi-subagents v1 RPC. Subscribe and arm timeout before emit (Pi does not await replies).
export function collectActivity(pi: ExtensionAPI, sessionId: string, ownedSession: () => boolean, publish: (units: number | null) => void): { refresh(): void; dispose(): void } {
	let live = true, busy = false, pending = false, lastStart = -Infinity;
	let timer: ReturnType<typeof setTimeout> | undefined, due = Infinity;
	let cancelReply: (() => void) | undefined;
	const owned = () => live && ownedSession();
	const schedule = (delay: number) => {
		if (!owned()) return;
		const now = performance.now(), next = Math.max(now + delay, lastStart + ACTIVITY_MIN_MS);
		if (timer && due <= next) return;
		if (timer) clearTimeout(timer);
		due = next;
		timer = setTimeout(() => { timer = undefined; due = Infinity; poll(); }, next - now);
		timer.unref();
	};
	const request = (method: "ping" | "status", receive: (data: Record<string, unknown> | null) => void) => {
		const requestId = randomUUID();
		let done = false;
		const finish = (data: Record<string, unknown> | null) => {
			if (done) return;
			done = true; unsubscribe(); clearTimeout(timeout); cancelReply = undefined;
			if (owned()) receive(data);
		};
		const unsubscribe = pi.events.on(`subagents:rpc:v1:reply:${requestId}`, (reply) => {
			finish(record(reply) && reply.version === 1 && reply.requestId === requestId
				&& (reply.method === undefined || reply.method === method) && reply.success === true
				&& record(reply.data) && reply.data.isError !== true ? reply.data : null);
		});
		const timeout = setTimeout(() => finish(null), RPC_TIMEOUT_MS); timeout.unref();
		cancelReply = () => { done = true; unsubscribe(); clearTimeout(timeout); };
		try { pi.events.emit(RPC_REQUEST, { version: 1, requestId, method, source: { extension: "pi-signals-collector" } }); }
		catch { finish(null); }
	};
	const finishPoll = (units: number | null) => {
		busy = false; publish(units);
		const delay = pending ? 250 : ACTIVITY_REFRESH_MS;
		pending = false; schedule(delay);
	};
	function poll() {
		if (!owned() || busy) return;
		busy = true; lastStart = performance.now();
		request("ping", (data) => {
			if (!data || data.version !== 1 || !record(data.session) || data.session.sessionId !== sessionId
				|| !record(data.capabilities) || !record(data.capabilities.fleetStatus) || data.capabilities.fleetStatus.version !== 1) {
				finishPoll(null); return;
			}
			request("status", (status) => {
				const fleet = status?.fleet;
				finishPoll(record(fleet) && fleet.version === 1 && count(fleet.totalActive)
					&& Array.isArray(fleet.entries) && count(fleet.omitted)
					&& fleet.omitted === fleet.totalActive - fleet.entries.length ? fleet.totalActive : null);
			});
		});
	}
	const refresh = () => { if (busy) pending = true; else schedule(250); };
	const unsubscribeReady = pi.events.on(RPC_READY, (data) => {
		if (!owned() || !record(data) || data.version !== 1 || !record(data.session) || data.session.sessionId !== sessionId) return;
		// A replacement owner invalidates its predecessor's in-flight response.
		cancelReply?.(); cancelReply = undefined; busy = pending = false;
		publish(null); refresh();
	});
	schedule(250); // let all session_start handlers finish restoring their owner
	return { refresh, dispose() {
		live = false;
		if (timer) clearTimeout(timer);
		cancelReply?.(); unsubscribeReady();
	} };
}
