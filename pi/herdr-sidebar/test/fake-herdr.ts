// A fake Herdr server on a temporary Unix socket, never the live Herdr. It models the parts of Herdr 0.9.3 this
// extension depends on, as read in its source (src/metadata_tokens.rs, src/app/api/panes.rs,
// src/terminal/metadata.rs, src/api/subscriptions.rs, src/api/schema/events.rs, src/api/schema/workspaces.rs): one token map per pane that any source can patch, per-source
// sequence freshness, at most 32 sequenced token sources per pane, 16 keys per report and 32 keys per pane. Focus follows
// src/app/creation.rs (`workspace_info`: `focused`, `active_tab_id`) and src/app/api.rs (`emit_focus_api_events`).
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Logged = { method: string; params: any; at: number };
type Mode = "ok" | "error" | "silent";

export async function startFakeHerdr(paneId = "w1:p1") {
	// macOS limits socket paths to 104 bytes; mkdtemp under the OS temp directory stays well inside that.
	const dir = await mkdtemp(join(tmpdir(), "hs-"));
	const socketPath = join(dir, "h.sock");
	const tokens = new Map<string, string>();
	const sequences = new Map<string, number>();
	const tokenSources = new Set<string>();
	const log: Logged[] = [];
	const subscribers = new Set<{ socket: Socket; id: string; subscriptions: any[] }>();
	const sockets = new Set<Socket>();
	let status = "idle", currentPaneId = paneId, workspaceId = "w1", tabId = "w1:t1";
	// The pane starts in the focused workspace's active tab, so it is seen unless a test moves the focus.
	let focusedWorkspaceId: string | null = "w1";
	const activeTabs = new Map([["w1", "w1:t1"]]);
	const paneAliases = new Set([paneId]);
	// Unknown label by default keeps existing fallback fixtures explicit.
	let workspaceLabel: string | null = null;
	let workspaceGetMode: Mode = "ok";
	let workspaceGetDelayMs = 0;
	let reportMode: Mode = "ok";
	let paneGetMode: Mode = "ok";
	let subscribeMode: Mode = "ok";
	let reportDelayMs = 0;

	const reply = (socket: Socket, id: string, body: object) => { if (!socket.destroyed) socket.write(`${JSON.stringify({ id, ...body })}\n`); };
	const error = (socket: Socket, id: string, code: string) => reply(socket, id, { error: { code, message: code } });

	function report(params: any): string | undefined {
		if (!paneAliases.has(params.pane_id)) return "pane_not_found";
		const patch: Record<string, string | null> = params.tokens ?? {};
		if (Object.keys(patch).length > 16) return "invalid_metadata_token";
		if (params.ttl_ms !== undefined && !(params.ttl_ms >= 1 && params.ttl_ms <= 86_400_000)) return "invalid_metadata_ttl";
		const source = params.source, seq = params.seq;
		if (typeof seq === "number") {
			const last = sequences.get(source);
			if (last !== undefined && seq <= last) return undefined; // accepted but ignored, exactly like success
			if (!tokenSources.has(source) && tokenSources.size >= 32) return "metadata_sequence_source_limit";
		}
		const after = new Set(tokens.keys());
		for (const [key, value] of Object.entries(patch)) value === null ? after.delete(key) : after.add(key);
		if (after.size > 32) return "metadata_token_limit";
		if (typeof seq === "number") { sequences.set(source, seq); tokenSources.add(source); }
		for (const [key, value] of Object.entries(patch)) {
			const normalized = value === null ? "" : value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, 80);
			if (normalized) tokens.set(key, normalized); else tokens.delete(key);
		}
		return undefined;
	}

	function handle(socket: Socket, request: any) {
		const { id, method, params } = request;
		log.push({ method, params, at: Date.now() });
		if (method === "pane.report_metadata") {
			if (reportMode === "silent") return;
			if (reportMode === "error") return error(socket, id, "internal_error");
			const respond = () => { const code = report(params); code ? error(socket, id, code) : reply(socket, id, { result: { type: "ok" } }); };
			if (reportDelayMs) setTimeout(respond, reportDelayMs); else respond();
		} else if (method === "pane.get") {
			if (paneGetMode === "silent") return;
			if (paneGetMode === "error" || !paneAliases.has(params?.pane_id)) return error(socket, id, "pane_not_found");
			reply(socket, id, { result: { type: "pane_info", pane: { pane_id: currentPaneId, workspace_id: workspaceId, tab_id: tabId, agent_status: status } } });
		} else if (method === "workspace.get") {
			if (workspaceGetMode === "silent") return;
			if (workspaceGetMode === "error" || params?.workspace_id !== workspaceId) return error(socket, id, "workspace_not_found");
			const result = { type: "workspace_info", workspace: { workspace_id: workspaceId, label: workspaceLabel, focused: focusedWorkspaceId === workspaceId, active_tab_id: activeTabs.get(workspaceId) ?? `${workspaceId}:t1` } };
			const respond = () => reply(socket, id, { result });
			if (workspaceGetDelayMs) setTimeout(respond, workspaceGetDelayMs); else respond();
		} else if (method === "events.subscribe") {
			const entry = params?.subscriptions?.[0];
			if (subscribeMode === "silent") return;
			if (subscribeMode === "error" || entry?.type !== "pane.agent_status_changed" || !paneAliases.has(entry.pane_id)) { error(socket, id, "pane_not_found"); socket.end(); return; }
			reply(socket, id, { result: { type: "subscription_started" } });
			assertSubscriptions(params.subscriptions);
			subscribers.add({ socket, id, subscriptions: params.subscriptions.map((s: any) => s.type === "pane.agent_status_changed" ? { ...s, pane_id: currentPaneId } : s) });
		} else error(socket, id, "unknown_method");
	}

	function assertSubscriptions(subscriptions: any[]) {
		for (const s of subscriptions) if (!["pane.agent_status_changed", "workspace.renamed", "workspace.updated", "pane.moved", "workspace.focused", "tab.focused", "pane.focused"].includes(s.type)) throw new Error("Unknown subscription");
	}
	function emit(event: string, data: any) {
		for (const { socket, subscriptions } of subscribers) if (subscriptions.some((s) => s.type === event && (event !== "pane.agent_status_changed" || s.pane_id === data.pane_id))) socket.write(`${JSON.stringify({ event, data })}\n`);
	}

	const server = createServer((socket) => {
		sockets.add(socket);
		socket.on("close", () => { sockets.delete(socket); for (const s of subscribers) if (s.socket === socket) subscribers.delete(s); });
		socket.on("error", () => {});
		let buffer = "";
		socket.setEncoding("utf8");
		socket.on("data", (chunk: string) => {
			buffer += chunk;
			let newline: number;
			while ((newline = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, newline);
				buffer = buffer.slice(newline + 1);
				try { handle(socket, JSON.parse(line)); } catch { error(socket, "", "invalid_request"); }
			}
		});
	});
	await new Promise<void>((resolve) => server.listen(socketPath, resolve));

	return {
		socketPath, paneId, log, tokens,
		reports: () => log.filter((entry) => entry.method === "pane.report_metadata"),
		get subscriberCount() { return subscribers.size; },
		get sources() { return new Set(log.filter((entry) => entry.method === "pane.report_metadata").map((entry) => entry.params.source)); },
		setStatus(next: string, push = true) {
			status = next;
			if (push) emit("pane.agent_status_changed", { pane_id: currentPaneId, workspace_id: workspaceId, agent_status: next });
		},
		setWorkspaceLabel(label: string | null, push: "renamed" | "updated" | false = "renamed") {
			workspaceLabel = label;
			if (push === "renamed") emit("workspace.renamed", { workspace_id: workspaceId, label });
			if (push === "updated") emit("workspace.updated", { workspace: { workspace_id: workspaceId, label } });
		},
		movePane(nextWorkspaceId: string, nextPaneId: string, label: string) {
			const previous_pane_id = currentPaneId, previous_workspace_id = workspaceId;
			currentPaneId = nextPaneId; workspaceId = nextWorkspaceId; tabId = `${nextWorkspaceId}:t1`; workspaceLabel = label; paneAliases.add(nextPaneId);
			emit("pane.moved", { previous_pane_id, previous_workspace_id, previous_tab_id: "w1:t1", pane: { pane_id: currentPaneId, workspace_id: workspaceId, agent_status: status } });
		},
		/** Moves the pane to another tab of its workspace; Herdr keeps its id, as a same-workspace move does. */
		movePaneToTab(nextTabId: string) {
			const previous_tab_id = tabId;
			tabId = nextTabId;
			emit("pane.moved", { previous_pane_id: currentPaneId, previous_workspace_id: workspaceId, previous_tab_id, pane: { pane_id: currentPaneId, workspace_id: workspaceId, tab_id: tabId, agent_status: status } });
		},
		emit,
		/**
		 * Focuses a pane in a workspace's tab. Herdr emits workspace.focused, tab.focused and pane.focused together when
		 * the focused pane changes; `push` limits the events sent, or sends none, as while disconnected.
		 */
		focus(nextWorkspaceId: string | null, nextTabId: string, focusedPaneId: string, push: string[] | false = ["workspace.focused", "tab.focused", "pane.focused"]) {
			focusedWorkspaceId = nextWorkspaceId;
			if (nextWorkspaceId) activeTabs.set(nextWorkspaceId, nextTabId);
			if (!push || !nextWorkspaceId) return;
			const events: [string, object][] = [["workspace.focused", { workspace_id: nextWorkspaceId }], ["tab.focused", { tab_id: nextTabId, workspace_id: nextWorkspaceId }], ["pane.focused", { pane_id: focusedPaneId, workspace_id: nextWorkspaceId }]];
			for (const [event, data] of events) if (push.includes(event)) emit(event, data);
		},
		setWorkspaceGetMode(mode: Mode) { workspaceGetMode = mode; },
		setWorkspaceGetDelay(ms: number) { workspaceGetDelayMs = ms; },
		/** Herdr drops every subscription, as on events_lost or a server restart. */
		dropSubscribers(lost = false) {
			for (const { socket, id } of subscribers) { if (lost) error(socket, id, "events_lost"); socket.destroy(); }
			subscribers.clear();
		},
		setReportMode(mode: Mode) { reportMode = mode; },
		setPaneGetMode(mode: Mode) { paneGetMode = mode; },
		setSubscribeMode(mode: Mode) { subscribeMode = mode; },
		setReportDelay(ms: number) { reportDelayMs = ms; },
		/** Applies a report directly, as another runtime's late request would arrive. */
		apply(params: any) { log.push({ method: "pane.report_metadata", params, at: Date.now() }); return report(params); },
		async close() {
			for (const socket of sockets) socket.destroy();
			await new Promise<void>((resolve) => server.close(() => resolve()));
			await rm(dir, { recursive: true, force: true });
		},
	};
}
export type FakeHerdr = Awaited<ReturnType<typeof startFakeHerdr>>;

export async function until(check: () => boolean, label = "condition", timeoutMs = 4000) {
	const end = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > end) throw new Error(`Timed out waiting for ${label}`);
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}
