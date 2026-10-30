import { createConnection, type Socket } from "node:net";

const MAX_LINE = 1024 * 1024;
// Subscription names are dotted; EventKind envelopes are snake_case (Herdr 0.9.5, protocol 22).
const EVENTS = ["workspace.created", "workspace.focused", "workspace.updated", "workspace.closed", "tab.created", "tab.focused", "tab.closed", "tab.moved", "pane.created", "pane.focused", "pane.moved", "pane.closed", "layout.updated"];
const WIRE_EVENTS = new Set(EVENTS.map((name) => name.replace(".", "_")));
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const endpoint = (path: string) => process.platform === "win32" ? `\\\\.\\pipe\\${path}` : path;
let sequence = 0;
function readLines(socket: Socket, receive: (line: unknown) => void) {
	let buffer = "";
	socket.setEncoding("utf8");
	socket.on("data", (chunk: string) => {
		buffer += chunk;
		let newline: number;
		while ((newline = buffer.indexOf("\n")) >= 0) {
			if (newline > MAX_LINE) { socket.destroy(); return; }
			const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
			let parsed: unknown;
			try { parsed = JSON.parse(line); } catch { socket.destroy(); return; }
			receive(parsed);
			if (socket.destroyed) return;
		}
		if (buffer.length > MAX_LINE) socket.destroy();
	});
}

/** Event-driven visibility only. Separate request sockets: Herdr stops serving RPC on a subscribed connection. */
export function watchVisibility(publish: (visible: boolean | null) => void, options: { timeoutMs?: number; minBackoffMs?: number; maxBackoffMs?: number } = {}) {
	let paneId = process.env.HERDR_PANE_ID;
	const path = process.env.HERDR_SOCKET_PATH;
	if (process.env.HERDR_ENV !== "1" || !paneId || !path) return { dispose() {} };
	const timeout = options.timeoutMs ?? 1500, minimum = options.minBackoffMs ?? 250, maximum = options.maxBackoffMs ?? 30_000;
	let disposed = false, generation = 0, backoff = minimum, visible: boolean | null = null;
	// Last resolved placement: updates for other workspaces/tabs cannot change our visibility, so they cost no reads.
	let workspaceId: string | undefined, tabId: string | undefined;
	let subscription: Socket | undefined, retry: ReturnType<typeof setTimeout> | undefined, acknowledgement: ReturnType<typeof setTimeout> | undefined;
	const pending = new Set<() => void>();
	const report = (next: boolean | null) => { if (!disposed && visible !== next) { visible = next; publish(next); } };
	function request(method: string, params: Record<string, unknown>): Promise<unknown> {
		return new Promise((resolve) => {
			const id = `signals-collector:${process.pid}:${++sequence}`, socket = createConnection(endpoint(path!));
			socket.unref();
			let settled = false;
			const finish = (result?: unknown) => {
				if (settled) return;
				settled = true; clearTimeout(timer); pending.delete(cancel); socket.destroy(); resolve(result);
			};
			const cancel = () => finish(); pending.add(cancel);
			const timer = setTimeout(cancel, timeout); timer.unref();
			socket.on("error", cancel); socket.on("close", cancel);
			socket.on("connect", () => socket.write(JSON.stringify({ id, method, params }) + "\n"));
			readLines(socket, (line) => { if (record(line) && line.id === id) finish(line.error ? undefined : line.result); });
		});
	}
	function connect() {
		if (disposed) return;
		const owner = ++generation, socket = createConnection(endpoint(path!)); subscription = socket; socket.unref();
		const id = `signals-collector:${process.pid}:${++sequence}`;
		let started = false, reading = false, stale = false;
		const owned = () => !disposed && generation === owner;
		const drop = () => {
			if (!owned()) return;
			++generation; clearTimeout(acknowledgement); subscription = undefined; socket.destroy();
			for (const cancel of pending) cancel();
			report(null);
			retry = setTimeout(() => { retry = undefined; connect(); }, backoff); retry.unref();
			backoff = Math.min(maximum, backoff * 2);
		};
		acknowledgement = setTimeout(drop, timeout); acknowledgement.unref();
		async function reconcile() {
			if (reading) { stale = true; return; }
			reading = true;
			try {
				do {
					stale = false;
					const result = await request("pane.get", { pane_id: paneId });
					if (!owned()) return;
					if (stale) continue;
					const pane = record(result) && record(result.pane) ? result.pane : undefined;
					if (!pane || typeof pane.pane_id !== "string" || typeof pane.workspace_id !== "string" || typeof pane.tab_id !== "string") return drop();
					paneId = pane.pane_id;
					const read = await request("workspace.get", { workspace_id: pane.workspace_id });
					if (!owned()) return;
					if (stale) continue;
					const workspace = record(read) && record(read.workspace) ? read.workspace : undefined;
					if (!workspace || workspace.workspace_id !== pane.workspace_id || typeof workspace.focused !== "boolean" || typeof workspace.active_tab_id !== "string") return drop();
					let next = workspace.focused && workspace.active_tab_id === pane.tab_id;
					if (next) {
						const read = await request("pane.layout", { pane_id: paneId });
						if (!owned()) return;
						if (stale) continue;
						const layout = record(read) && record(read.layout) ? read.layout : undefined;
						if (!layout || layout.workspace_id !== pane.workspace_id || layout.tab_id !== pane.tab_id || typeof layout.zoomed !== "boolean" || typeof layout.focused_pane_id !== "string") return drop();
						next = !layout.zoomed || layout.focused_pane_id === paneId;
					}
					workspaceId = pane.workspace_id; tabId = pane.tab_id;
					backoff = minimum; report(next);
				} while (stale && owned());
			} finally { reading = false; }
		}
		socket.on("error", drop); socket.on("close", drop);
		socket.on("connect", () => socket.write(JSON.stringify({ id, method: "events.subscribe", params: { subscriptions: EVENTS.map((type) => ({ type })) } }) + "\n"));
		readLines(socket, (line) => {
			if (!owned() || !record(line)) return;
			if (!started) {
				if (line.id !== id) return;
				if (!record(line.result) || line.result.type !== "subscription_started") return drop();
				started = true; clearTimeout(acknowledgement); void reconcile(); return;
			}
			if (line.id === id && line.error) return drop();
			if (typeof line.event !== "string" || !WIRE_EVENTS.has(line.event)) return;
			const data = record(line.data) ? line.data : {};
			if (line.event === "workspace_updated" && record(data.workspace) && workspaceId && data.workspace.workspace_id !== workspaceId) return;
			if (line.event === "layout_updated" && record(data.layout) && tabId && data.layout.tab_id !== tabId) return;
			if (line.event === "pane_moved" && data.previous_pane_id === paneId && record(data.pane) && typeof data.pane.pane_id === "string") paneId = data.pane.pane_id;
			void reconcile();
		});
	}
	connect();
	return { dispose() {
		disposed = true; ++generation;
		if (retry) clearTimeout(retry);
		clearTimeout(acknowledgement);
		subscription?.destroy();
		for (const cancel of pending) cancel();
		pending.clear();
	} };
}
