// Herdr's local socket API: newline-delimited JSON over a Unix socket (a named pipe on Windows). One short-lived
// connection per request, and one long-lived subscription for this pane's status, workspace label and visibility. Every wait is bounded and
// every failure is returned or reported as unknown; nothing here throws into Pi.
import { createConnection, type Socket } from "node:net";
import type { HerdrStatus } from "./tokens.ts";

export type HerdrTarget = { socketPath: string; paneId: string };
export type HerdrReply = { ok: true; result: unknown } | { ok: false; error: string };

const STATUSES: readonly string[] = ["idle", "working", "blocked", "done", "unknown"];
const MAX_LINE = 1024 * 1024;
let requestCount = 0;
const requestId = (kind: string) => `industrial-os:herdr-sidebar:${process.pid}:${kind}:${++requestCount}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const endpoint = (socketPath: string) => (process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath);
export const herdrStatus = (value: unknown): HerdrStatus | null => (typeof value === "string" && STATUSES.includes(value) ? (value as HerdrStatus) : null);

/** Reads newline-delimited JSON lines from a socket; a line over the limit closes the connection. */
function readLines(socket: Socket, onLine: (line: unknown) => void): void {
	let buffer = "";
	socket.setEncoding("utf8");
	socket.on("data", (chunk: string) => {
		buffer += chunk;
		let newline: number;
		while ((newline = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			if (!line.trim()) continue;
			let parsed: unknown;
			try { parsed = JSON.parse(line); } catch { parsed = undefined; }
			onLine(parsed);
			if (socket.destroyed) return;
		}
		if (buffer.length > MAX_LINE) socket.destroy();
	});
}

/** Sends one request on its own connection and waits at most `timeoutMs` for the reply with its id. */
export function herdrRequest(socketPath: string, method: string, params: Record<string, unknown>, timeoutMs: number): Promise<HerdrReply> {
	return new Promise((resolve) => {
		const id = requestId(method);
		let settled = false;
		const socket = createConnection(endpoint(socketPath));
		const finish = (reply: HerdrReply) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			resolve(reply);
		};
		const timer = setTimeout(() => finish({ ok: false, error: `${method} timed out` }), timeoutMs);
		timer.unref();
		socket.on("error", (error: NodeJS.ErrnoException) => finish({ ok: false, error: `${method} failed: ${error.code ?? "socket error"}` }));
		socket.on("close", () => finish({ ok: false, error: `${method} connection closed` }));
		socket.on("connect", () => socket.write(`${JSON.stringify({ id, method, params })}\n`));
		readLines(socket, (line) => {
			if (!record(line) || line.id !== id) return;
			if (record(line.error)) finish({ ok: false, error: `${method}: ${typeof line.error.code === "string" ? line.error.code : "error"}` });
			else finish({ ok: true, result: line.result });
		});
	});
}

export type PaneWatchOptions = { requestTimeoutMs?: number; minBackoffMs?: number; maxBackoffMs?: number };
// `visible`: the pane's tab is the active tab of Herdr's focused workspace, which Herdr 0.9.3 treats as seen; null is unknown.
export type PaneState = { status: HerdrStatus | null; workspaceLabel: string | null; visible: boolean | null };
const UNKNOWN: PaneState = { status: null, workspaceLabel: null, visible: null };
const FOCUS_EVENTS = ["workspace.focused", "tab.focused", "pane.focused"];
const LIFECYCLE_EVENTS = ["workspace.renamed", "workspace.updated", "pane.moved", ...FOCUS_EVENTS];
// Herdr 0.9.3 schema/events.rs: Subscription request types are dotted, but EventKind envelopes serialize
// as snake_case. SubscriptionEventKind keeps pane.agent_status_changed dotted. Normalize only known kinds.
const WIRE_EVENTS = new Map([
	...LIFECYCLE_EVENTS.map((type): [string, string] => [type.replace(".", "_"), type]),
	["pane.agent_status_changed", "pane.agent_status_changed"],
]);

/**
 * Subscribes before reading pane.get and workspace.get. Workspace, focus and pane-move events invalidate reads;
 * every reconnect re-resolves them. Herdr 0.9.3 schema/events.rs, schema/panes.rs and schema/workspaces.rs define
 * these shapes; app/api.rs emits the three focus events together whenever the focused pane changes.
 */
export function watchPaneState(target: HerdrTarget, onState: (state: PaneState) => void, options: PaneWatchOptions = {}) {
	const requestTimeoutMs = options.requestTimeoutMs ?? 1500;
	const minBackoffMs = options.minBackoffMs ?? 250;
	const maxBackoffMs = options.maxBackoffMs ?? 30_000;
	let closed = false;
	let socket: Socket | undefined;
	let retry: NodeJS.Timeout | undefined;
	let backoff = minBackoffMs;
	let state: PaneState = { ...UNKNOWN };
	let paneId = target.paneId, workspaceId: string | undefined, connection = 0;
	// The connection whose subscription Herdr acknowledged, while it lasts.
	let live: number | undefined;
	let reading: { owner: number; stale: boolean } | undefined;
	// A failed read is retried with the reconnect's bounded backoff, so a transient timeout does not leave the
	// state unknown until the next event. A failed read reports nothing new: on a fresh connection the state is
	// already unknown, and on a live subscription the events keep it current, so a slow periodic refresh cannot
	// blank row 1.
	let readRetry: NodeJS.Timeout | undefined;
	let readBackoff = minBackoffMs;
	// Set by a focus change until a complete read: visibility is then genuinely unknown, not merely unrefreshed.
	let focusChanged = false;

	function cancelReadRetry() {
		if (readRetry) clearTimeout(readRetry);
		readRetry = undefined;
	}

	function scheduleReadRetry(owner: number) {
		if (closed || readRetry || owner !== connection) return;
		readRetry = setTimeout(() => { readRetry = undefined; if (owner === connection) void reconcile(owner); }, readBackoff);
		readRetry.unref();
		readBackoff = Math.min(maxBackoffMs, readBackoff * 2);
	}

	const report = (next: PaneState) => {
		if (closed || (next.status === state.status && next.workspaceLabel === state.workspaceLabel && next.visible === state.visible)) return;
		state = next;
		onState({ ...next });
	};

	async function reconcile(owner: number) {
		if (reading?.owner === owner) { reading.stale = true; return; }
		const task = { owner, stale: false }; reading = task;
		try {
			do {
				task.stale = false;
				const reply = await herdrRequest(target.socketPath, "pane.get", { pane_id: paneId }, requestTimeoutMs);
				if (closed || owner !== connection) return;
				if (task.stale) continue;
				if (!reply.ok || !record(reply.result) || !record(reply.result.pane)) { scheduleReadRetry(owner); return; }
				const pane = reply.result.pane;
				if (typeof pane.pane_id === "string" && pane.pane_id) paneId = pane.pane_id;
				const previousWorkspaceId = workspaceId;
				workspaceId = typeof pane.workspace_id === "string" && pane.workspace_id ? pane.workspace_id : undefined;
				const tabId = typeof pane.tab_id === "string" && pane.tab_id ? pane.tab_id : undefined;
				let workspaceLabel: string | null = null, visible: boolean | null = null, complete = true;
				if (workspaceId) {
					const read = await herdrRequest(target.socketPath, "workspace.get", { workspace_id: workspaceId }, requestTimeoutMs);
					if (closed || owner !== connection) return;
					if (task.stale) continue;
					const workspace = read.ok && record(read.result) && record(read.result.workspace) && read.result.workspace.workspace_id === workspaceId ? read.result.workspace : undefined;
					complete = workspace !== undefined;
					// A failed read keeps what is known about the same workspace; a different workspace stays unknown.
					if (!complete && workspaceId === previousWorkspaceId) { workspaceLabel = state.workspaceLabel; if (!focusChanged) visible = state.visible; }
					if (typeof workspace?.label === "string") workspaceLabel = workspace.label.slice(0, 200);
					if (tabId && typeof workspace?.focused === "boolean" && typeof workspace.active_tab_id === "string") visible = workspace.focused && workspace.active_tab_id === tabId;
				}
				report({ status: herdrStatus(pane.agent_status), workspaceLabel, visible });
				if (!complete) { scheduleReadRetry(owner); return; }
				cancelReadRetry();
				readBackoff = minBackoffMs;
				focusChanged = false;
			} while (task.stale);
		} finally { if (reading === task) reading = undefined; }
	}

	function scheduleReconnect() {
		if (closed || retry) return;
		retry = setTimeout(() => { retry = undefined; connect(); }, backoff);
		retry.unref();
		backoff = Math.min(maxBackoffMs, backoff * 2);
	}

	function connect() {
		if (closed) return;
		const owner = ++connection;
		const id = requestId("subscribe");
		const current = createConnection(endpoint(target.socketPath));
		socket = current;
		current.unref();
		let started = false;
		const drop = () => {
			if (socket !== current) return;
			socket = undefined;
			live = undefined;
			++connection; // Fence reads still pending on this connection.
			cancelReadRetry();
			readBackoff = minBackoffMs;
			current.destroy();
			report({ ...UNKNOWN });
			scheduleReconnect();
		};
		current.on("error", drop);
		current.on("close", drop);
		current.on("connect", () => current.write(`${JSON.stringify({ id, method: "events.subscribe", params: { subscriptions: [
			{ type: "pane.agent_status_changed", pane_id: paneId },
			...LIFECYCLE_EVENTS.map((type) => ({ type })),
		] } })}\n`));
		readLines(current, (line) => {
			if (socket !== current || !record(line)) return;
			if (!started) {
				if (line.id !== id) return;
				if (!record(line.result) || line.result.type !== "subscription_started") return drop();
				started = true;
				live = owner;
				backoff = minBackoffMs;
				void reconcile(owner);
				return;
			}
			if (line.id === id && record(line.error)) return drop();
			const event = typeof line.event === "string" ? WIRE_EVENTS.get(line.event) : undefined;
			if (!event || !record(line.data)) return;
			const data = line.data;
			if (event === "pane.moved" && data.previous_pane_id === paneId && record(data.pane) && typeof data.pane.pane_id === "string") {
				if (data.pane.pane_id === paneId) { focusChanged = true; void reconcile(owner); return; } // Same id, possibly another tab: the subscription stays valid.
				paneId = data.pane.pane_id;
				workspaceId = undefined;
				// Status subscriptions bind the canonical pane id; resubscribe after a move that changes it.
				drop();
			} else if (event === "pane.agent_status_changed" && data.pane_id === paneId) {
				if (reading?.owner === owner) reading.stale = true;
				report({ ...state, status: herdrStatus(data.agent_status) });
			} else if ((event === "workspace.renamed" && (workspaceId === undefined || data.workspace_id === workspaceId)) ||
				(event === "workspace.updated" && record(data.workspace) && (workspaceId === undefined || data.workspace.workspace_id === workspaceId)) ||
				FOCUS_EVENTS.includes(event)) {
				// Any focus change can make this pane seen or unseen; the reads are authoritative, the payloads only invalidate.
				if (FOCUS_EVENTS.includes(event)) focusChanged = true;
				void reconcile(owner);
			}
		});
	}

	connect();
	return {
		get status() { return state.status; },
		get workspaceLabel() { return state.workspaceLabel; },
		get visible() { return state.visible; },
		get paneId() { return paneId; },
		/**
		 * Re-reads the pane and workspace on the live subscription. Herdr recomputes an automatic SPACE label from the
		 * workspace's Git state without any workspace event; the caller refreshes on its report-renewal cycle.
		 */
		refresh() {
			if (!closed && live === connection) void reconcile(live);
		},
		close() {
			closed = true;
			cancelReadRetry();
			if (retry) clearTimeout(retry);
			retry = undefined;
			socket?.destroy();
			socket = undefined;
		},
	};
}
