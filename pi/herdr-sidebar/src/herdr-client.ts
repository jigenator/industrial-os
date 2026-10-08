// Herdr's local socket API: newline-delimited JSON over a Unix socket (a named pipe on Windows). One short-lived
// connection per request, and one long-lived subscription for this pane's agent status. Every wait is bounded and
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

export type StatusWatchOptions = { requestTimeoutMs?: number; minBackoffMs?: number; maxBackoffMs?: number };

/**
 * Follows Herdr's agent status for one pane: subscribes to `pane.agent_status_changed`, then reconciles with an
 * authoritative `pane.get`. Reconnects with exponential backoff and reconciles again after every subscription.
 * While disconnected, or until the first read answers, the status is unknown (null).
 */
export function watchAgentStatus(target: HerdrTarget, onStatus: (status: HerdrStatus | null) => void, options: StatusWatchOptions = {}) {
	const requestTimeoutMs = options.requestTimeoutMs ?? 1500;
	const minBackoffMs = options.minBackoffMs ?? 250;
	const maxBackoffMs = options.maxBackoffMs ?? 30_000;
	let closed = false;
	let socket: Socket | undefined;
	let retry: NodeJS.Timeout | undefined;
	let backoff = minBackoffMs;
	let status: HerdrStatus | null = null;
	// A read answers for the moment it was served; an event that arrives meanwhile is newer, so the read is
	// discarded and repeated rather than applied over it.
	let reading = false, readStale = false, connection = 0;

	const report = (next: HerdrStatus | null) => {
		if (closed || next === status) return;
		status = next;
		onStatus(next);
	};

	async function reconcile(owner: number) {
		if (reading) { readStale = true; return; }
		reading = true;
		try {
			do {
				readStale = false;
				const reply = await herdrRequest(target.socketPath, "pane.get", { pane_id: target.paneId }, requestTimeoutMs);
				if (closed || owner !== connection) return;
				if (readStale) continue;
				if (reply.ok && record(reply.result) && record(reply.result.pane)) report(herdrStatus(reply.result.pane.agent_status));
			} while (readStale);
		} finally {
			reading = false;
		}
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
			current.destroy();
			report(null);
			scheduleReconnect();
		};
		current.on("error", drop);
		current.on("close", drop);
		current.on("connect", () => current.write(`${JSON.stringify({ id, method: "events.subscribe", params: { subscriptions: [{ type: "pane.agent_status_changed", pane_id: target.paneId }] } })}\n`));
		readLines(current, (line) => {
			if (!record(line)) return;
			if (!started) {
				if (line.id !== id) return;
				// A rejected subscription (for example an unknown pane) closes the connection; retry later.
				if (!record(line.result) || line.result.type !== "subscription_started") return drop();
				started = true;
				backoff = minBackoffMs;
				void reconcile(owner);
				return;
			}
			// events_lost and other errors end the subscription; resubscribe and reconcile.
			if (line.id === id && record(line.error)) return drop();
			if (line.event === "pane.agent_status_changed" && record(line.data) && line.data.pane_id === target.paneId) {
				if (reading) readStale = true;
				report(herdrStatus(line.data.agent_status));
			}
		});
	}

	connect();
	return {
		get status() { return status; },
		close() {
			closed = true;
			if (retry) clearTimeout(retry);
			retry = undefined;
			socket?.destroy();
			socket = undefined;
		},
	};
}
