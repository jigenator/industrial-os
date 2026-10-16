// pi-background-tasks 2.6.9 public EventBus API; no package imports or task-file reads.
export const BACKGROUND_REQUEST_CHANNEL = "pi-background-tasks:request:v1";
export const BACKGROUND_RESPONSE_CHANNEL = "pi-background-tasks:response:v1";
export const BACKGROUND_TERMINAL_CHANNEL = "pi-background-tasks:terminal:v1";
export const BACKGROUND_REQUEST_SCHEMA = "pi-background-tasks.extension-request.v1";
export const BACKGROUND_START_TOOLS = ["bg_run", "bg_run_pi_attested", "bg_delegate", "fusion_reason", "fusion_investigate", "fusion_research", "fusion_validate"];
export const BACKGROUND_TIMEOUT_MS = 1_500;

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
