import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// pi-background-tasks 2.6.9 public EventBus API; no package imports or task-file reads.
export const BACKGROUND_REQUEST_CHANNEL = "pi-background-tasks:request:v1";
export const BACKGROUND_RESPONSE_CHANNEL = "pi-background-tasks:response:v1";
export const BACKGROUND_TERMINAL_CHANNEL = "pi-background-tasks:terminal:v1";
export const BACKGROUND_REQUEST_SCHEMA = "pi-background-tasks.extension-request.v1";
export const BACKGROUND_START_TOOLS = ["bg_run", "bg_run_pi_attested", "bg_delegate", "fusion_reason", "fusion_investigate", "fusion_research", "fusion_validate"];
export const BACKGROUND_TIMEOUT_MS = 1_500;
// The producer has no start event: /bg, /fusion, UI and EventBus `run` starts are seen at the next re-query.
export const BACKGROUND_REQUERY_MS = 20_000;

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const TERMINAL_STATUSES = ["completed", "failed", "killed"];
const task = (value: unknown): value is { id: string; status: string } => record(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.status === "string" && (value.status === "running" || TERMINAL_STATUSES.includes(value.status));

/** Only the consumed id/status fields are retained. A malformed list is unknown, never an empty list. */
export function readBackgroundRunning(data: unknown): number | null {
	if (!record(data) || data.schema_version !== "pi-background-tasks.extension-response.v1" || data.operation !== "status" || data.ok !== true || !record(data.result) || !Array.isArray(data.result.tasks)) return null;
	let running = 0;
	const ids = new Set<string>();
	for (const entry of data.result.tasks) {
		if (!task(entry) || ids.has(entry.id)) return null;
		ids.add(entry.id);
		if (entry.status === "running") running++;
	}
	return running;
}

/** The producer's exact startup refusal, not a timeout, shutdown or arbitrary error. */
export function isBackgroundUnavailable(data: unknown): boolean {
	return record(data) && data.schema_version === "pi-background-tasks.extension-response.v1" && data.operation === "status" && data.ok === false && data.error === "pi-background-tasks EventBus service is unavailable before session_start";
}

/** A terminal event only invalidates status; never decrement a count from a possibly duplicated event. */
export function isBackgroundTerminal(data: unknown): boolean {
	return record(data) && data.schema_version === "pi-background-tasks.extension-terminal.v1" && task(data.task) && TERMINAL_STATUSES.includes(data.task.status);
}

/** One status request in flight; a trigger during it marks the answer stale and coalesces one follow-up. */
export function collectBackgroundTasks(pi: ExtensionAPI, ownedSession: () => boolean, publish: (running: number | null) => void): { refresh(): void; dispose(): void } {
	let live = true, retryUsed = false;
	let request: { id: string; stale: boolean; timer: ReturnType<typeof setTimeout> } | undefined;
	let retry: ReturnType<typeof setTimeout> | undefined;
	const owned = () => live && ownedSession();
	function finish(count: number | null, unavailable = false) {
		if (!owned() || !request) return;
		const stale = request.stale;
		clearTimeout(request.timer);
		request = undefined;
		if (!stale || count === null) publish(count);
		if (unavailable && !retryUsed) {
			// One delayed retry lets a later-loaded producer finish session_start without adding a polling loop.
			retryUsed = true;
			retry = setTimeout(() => { retry = undefined; refresh(); }, 1_000);
			retry.unref();
		} else if (stale) refresh();
	}
	function refresh() {
		if (!owned() || retry) return;
		// Coalesce invalidations, but never accept an answer older than a trigger.
		if (request) { request.stale = true; return; }
		const id = randomUUID();
		const timer = setTimeout(() => finish(null), BACKGROUND_TIMEOUT_MS);
		timer.unref();
		request = { id, stale: false, timer };
		pi.events.emit(BACKGROUND_REQUEST_CHANNEL, { schema_version: BACKGROUND_REQUEST_SCHEMA, request_id: id, operation: "status", payload: {} });
	}
	const offResponse = pi.events.on(BACKGROUND_RESPONSE_CHANNEL, (data) => {
		if (!owned() || !request || (data as { request_id?: unknown } | null)?.request_id !== request.id) return;
		finish(readBackgroundRunning(data), isBackgroundUnavailable(data));
	});
	const offTerminal = pi.events.on(BACKGROUND_TERMINAL_CHANNEL, (data) => { if (isBackgroundTerminal(data)) refresh(); });
	const interval = setInterval(refresh, BACKGROUND_REQUERY_MS);
	interval.unref();
	refresh();
	return { refresh, dispose() {
		live = false;
		clearInterval(interval);
		if (retry) clearTimeout(retry);
		if (request) clearTimeout(request.timer);
		retry = request = undefined;
		offResponse(); offTerminal();
	} };
}
