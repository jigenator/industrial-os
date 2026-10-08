// Herdr's local socket API: newline-delimited JSON over a Unix socket (a named pipe on Windows). One short-lived
// connection per request, and one long-lived subscription for this pane's status and workspace label. Every wait is bounded and
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
export type PaneState = { status: HerdrStatus | null; workspaceLabel: string | null };

/**
 * Subscribes before reading pane.get and workspace.get. Workspace events and pane moves invalidate reads;
 * every reconnect re-resolves both. Herdr 0.9.3 schema/events.rs and schema/workspaces.rs define these shapes.
 */
export function watchPaneState(target: HerdrTarget, onState: (state: PaneState) => void, options: PaneWatchOptions = {}) {
	const requestTimeoutMs = options.requestTimeoutMs ?? 1500;
	const minBackoffMs = options.minBackoffMs ?? 250;
	const maxBackoffMs = options.maxBackoffMs ?? 30_000;
	let closed = false;
	let socket: Socket | undefined;
	let retry: NodeJS.Timeout | undefined;
	let backoff = minBackoffMs;
	let state: PaneState = { status: null, workspaceLabel: null };
	let paneId = target.paneId, workspaceId: string | undefined, connection = 0;
	let reading: { owner: number; stale: boolean } | undefined;

	const report = (next: PaneState) => {
		if (closed || (next.status === state.status && next.workspaceLabel === state.workspaceLabel)) return;
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
				if (!reply.ok || !record(reply.result) || !record(reply.result.pane)) { report({ status: null, workspaceLabel: null }); return; }
				const pane = reply.result.pane;
				if (typeof pane.pane_id === "string" && pane.pane_id) paneId = pane.pane_id;
				workspaceId = typeof pane.workspace_id === "string" && pane.workspace_id ? pane.workspace_id : undefined;
				let workspaceLabel: string | null = null;
				if (workspaceId) {
					const workspace = await herdrRequest(target.socketPath, "workspace.get", { workspace_id: workspaceId }, requestTimeoutMs);
					if (closed || owner !== connection) return;
					if (task.stale) continue;
					if (workspace.ok && record(workspace.result) && record(workspace.result.workspace) && workspace.result.workspace.workspace_id === workspaceId && typeof workspace.result.workspace.label === "string") workspaceLabel = workspace.result.workspace.label.slice(0, 200);
				}
				report({ status: herdrStatus(pane.agent_status), workspaceLabel });
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
			++connection; // Fence reads still pending on this connection.
			current.destroy();
			report({ status: null, workspaceLabel: null });
			scheduleReconnect();
		};
		current.on("error", drop);
		current.on("close", drop);
		current.on("connect", () => current.write(`${JSON.stringify({ id, method: "events.subscribe", params: { subscriptions: [
			{ type: "pane.agent_status_changed", pane_id: paneId },
			{ type: "workspace.renamed" }, { type: "workspace.updated" }, { type: "pane.moved" },
		] } })}\n`));
		readLines(current, (line) => {
			if (socket !== current || !record(line)) return;
			if (!started) {
				if (line.id !== id) return;
				if (!record(line.result) || line.result.type !== "subscription_started") return drop();
				started = true;
				backoff = minBackoffMs;
				void reconcile(owner);
				return;
			}
			if (line.id === id && record(line.error)) return drop();
			if (!record(line.data)) return;
			const data = line.data;
			if (line.event === "pane.moved" && data.previous_pane_id === paneId && record(data.pane) && typeof data.pane.pane_id === "string") {
				paneId = data.pane.pane_id;
				workspaceId = undefined;
				// Status subscriptions bind the canonical pane id; resubscribe after a move.
				drop();
			} else if (line.event === "pane.agent_status_changed" && data.pane_id === paneId) {
				if (reading?.owner === owner) reading.stale = true;
				report({ ...state, status: herdrStatus(data.agent_status) });
			} else if ((line.event === "workspace.renamed" && (workspaceId === undefined || data.workspace_id === workspaceId)) ||
				(line.event === "workspace.updated" && record(data.workspace) && (workspaceId === undefined || data.workspace.workspace_id === workspaceId))) {
				void reconcile(owner);
			}
		});
	}

	connect();
	return {
		get status() { return state.status; },
		get workspaceLabel() { return state.workspaceLabel; },
		get paneId() { return paneId; },
		close() {
			closed = true;
			if (retry) clearTimeout(retry);
			retry = undefined;
			socket?.destroy();
			socket = undefined;
		},
	};
}
