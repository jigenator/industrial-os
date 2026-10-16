import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { BACKGROUND_REQUEST_CHANNEL, BACKGROUND_RESPONSE_CHANNEL, BACKGROUND_TERMINAL_CHANNEL, BACKGROUND_REQUEST_SCHEMA, BACKGROUND_START_TOOLS, BACKGROUND_TIMEOUT_MS, readBackgroundRunning, isBackgroundUnavailable, isBackgroundTerminal } from "./background-tasks.ts";
import { herdrRequest, watchPaneState, type HerdrTarget } from "./herdr-client.ts";
import { createTokenSender } from "./sender.ts";
import { READY_CHANNEL, REQUEST_CHANNEL, SNAPSHOT_CHANNEL, readSnapshot, type SidebarSnapshot } from "./snapshot.ts";
import { buildTokens, nextLastAccessAt, nextFinishedAt, nextTokenChange, type HerdrStatus, type SidebarInput, type TokenMap } from "./tokens.ts";

// The blocked-state signal Herdr's Pi integration (herdr-agent-state.ts) counts: one true per question wait, one false.
export const BLOCKED_CHANNEL = "herdr:blocked";
// Time-based values re-render when their text changes, but never more than once a second.
const MIN_RENDER_INTERVAL_MS = 1_000;
// The custom session entry type `/flag` appends, with data `{ flagged: boolean }`.
export const FLAG_ENTRY = "industrial-os:herdr-sidebar:flag";

/** The session's manual flag: the latest valid saved entry on the active branch, otherwise false. */
export function savedFlag(branch: readonly SessionEntry[]): boolean {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		const flagged = entry.type === "custom" && entry.customType === FLAG_ENTRY ? (entry.data as { flagged?: unknown } | undefined)?.flagged : undefined;
		if (typeof flagged === "boolean") return flagged;
	}
	return false;
}

/** The pane this process runs in, when it runs inside Herdr; otherwise undefined and the extension stays inert. */
export function herdrTarget(env: NodeJS.ProcessEnv): HerdrTarget | undefined {
	const paneId = env.HERDR_PANE_ID?.trim(), socketPath = env.HERDR_SOCKET_PATH?.trim();
	if (env.HERDR_ENV !== "1" || !paneId || !socketPath) return undefined;
	if (process.platform !== "win32" && !isAbsolute(socketPath)) return undefined;
	return { paneId, socketPath };
}

type Runtime = {
	sessionId: string;
	snapshot: SidebarSnapshot | null;
	herdr: HerdrStatus | null;
	workspaceLabel: string | null;
	paneLabel: string | null;
	visible: boolean | null;
	finishedAt: number | null;
	backgroundRunning: number | null;
	refreshBackground(): void;
	flagged: boolean;
	question: boolean;
	lastRender: number;
	lastAccessAt: number;
	timer?: NodeJS.Timeout;
	send(tokens: TokenMap): void;
	dispose(): Promise<void>;
};

export default function herdrSidebar(pi: ExtensionAPI) {
	let runtime: Runtime | undefined;

	const inputAt = (r: Runtime, now: number): SidebarInput => ({
		snapshot: r.snapshot, herdr: r.herdr, workspaceLabel: r.workspaceLabel, paneLabel: r.paneLabel, visible: r.visible,
		lastAccessAt: r.lastAccessAt, backgroundRunning: r.backgroundRunning, finishedAt: r.finishedAt, flagged: r.flagged, now, home: homedir(),
	});
	// Capture the end of a seen/working/unknown interval before changing its inputs.
	const updateAccess = (r: Runtime) => { r.lastAccessAt = nextLastAccessAt(inputAt(r, Date.now())); };

	function render(r: Runtime) {
		if (runtime !== r) return;
		if (r.timer) clearTimeout(r.timer);
		r.timer = undefined;
		const now = Date.now();
		r.lastRender = now;
		r.lastAccessAt = nextLastAccessAt(inputAt(r, now));
		const input = inputAt(r, now);
		r.send(buildTokens(input));
		const due = nextTokenChange(input);
		if (due === null) return;
		r.timer = setTimeout(() => render(r), Math.max(due - now, r.lastRender + MIN_RENDER_INTERVAL_MS - now));
		r.timer.unref();
	}

	// Advance unseen completion from the two independently observed work counts.
	function updateFinished(r: Runtime, previousUnits = r.snapshot?.units ?? null, previousBackgroundRunning = r.backgroundRunning) {
		r.finishedAt = nextFinishedAt({ previousUnits, previousBackgroundRunning, backgroundRunning: r.backgroundRunning, units: r.snapshot?.units ?? null, herdr: r.herdr, visible: r.visible, finishedAt: r.finishedAt, now: Date.now() });
	}

	// Balanced: one true when a question becomes pending, one false when it clears or the runtime ends.
	function setQuestion(r: Runtime, pending: boolean) {
		if (r.question === pending) return;
		r.question = pending;
		pi.events.emit(BLOCKED_CHANNEL, { active: pending });
	}

	async function start(ctx: ExtensionContext) {
		await stop();
		// TUI only: subagent children run in print, JSON or RPC mode with the parent's Herdr environment.
		const target = herdrTarget(process.env);
		if (ctx.mode !== "tui" || !target) return;
		let watch: ReturnType<typeof watchPaneState> | undefined;
		const sender = createTokenSender({
			paneId: target.paneId,
			request: (params, timeoutMs) => herdrRequest(target.socketPath, "pane.report_metadata", { ...params, pane_id: watch?.paneId ?? target.paneId }, timeoutMs),
			// Automatic SPACE labels and pane.rename can change labels without events; re-read with each renewal.
			onRenew: () => {
				// Also refresh access even when watch inputs have not changed; no extra interval.
				if (runtime === r) { render(r); r.refreshBackground(); }
				watch?.refresh();
			},
		});
		const unsubscribe: (() => void)[] = [];
		let backgroundRequest: { id: string; stale: boolean; timer: NodeJS.Timeout } | undefined;
		let backgroundRetry: NodeJS.Timeout | undefined;
		let backgroundRetryUsed = false;
		const r: Runtime = {
			sessionId: ctx.sessionManager.getSessionId(), snapshot: null, herdr: null, workspaceLabel: null, paneLabel: null, visible: null, finishedAt: null, backgroundRunning: null,
			refreshBackground,
			flagged: savedFlag(ctx.sessionManager.getBranch()), question: false, lastRender: 0, lastAccessAt: Date.now(),
			send: (tokens) => sender.update(tokens),
			async dispose() {
				if (backgroundRetry) clearTimeout(backgroundRetry);
				backgroundRetry = undefined;
				if (backgroundRequest) clearTimeout(backgroundRequest.timer);
				backgroundRequest = undefined;
				if (r.timer) clearTimeout(r.timer);
				r.timer = undefined;
				for (const off of unsubscribe) off();
				watch?.close();
				setQuestion(r, false);
				await sender.shutdown();
			},
		};
		runtime = r;
		function finishBackground(count: number | null, unavailable = false) {
			if (runtime !== r || !backgroundRequest) return;
			const stale = backgroundRequest.stale;
			clearTimeout(backgroundRequest.timer);
			backgroundRequest = undefined;
			if (!stale || count === null) {
				const previous = r.backgroundRunning;
				updateAccess(r);
				r.backgroundRunning = count;
				updateFinished(r, r.snapshot?.units ?? null, previous);
				render(r);
			}
			if (unavailable && !backgroundRetryUsed) {
				// One delayed retry lets a later-loaded producer finish session_start without adding a polling loop.
				backgroundRetryUsed = true;
				backgroundRetry = setTimeout(() => { backgroundRetry = undefined; refreshBackground(); }, 1_000);
				backgroundRetry.unref();
			} else if (stale) refreshBackground();
		}
		function refreshBackground() {
			if (runtime !== r || backgroundRetry) return;
			// Coalesce invalidations, but never accept an answer older than a trigger.
			if (backgroundRequest) { backgroundRequest.stale = true; return; }
			const id = randomUUID();
			const timer = setTimeout(() => finishBackground(null), BACKGROUND_TIMEOUT_MS);
			timer.unref();
			backgroundRequest = { id, stale: false, timer };
			pi.events.emit(BACKGROUND_REQUEST_CHANNEL, { schema_version: BACKGROUND_REQUEST_SCHEMA, request_id: id, operation: "status", payload: {} });
		}
		unsubscribe.push(pi.events.on(BACKGROUND_RESPONSE_CHANNEL, (data) => {
			if (runtime !== r || !backgroundRequest || (data as { request_id?: unknown } | null)?.request_id !== backgroundRequest.id) return;
			finishBackground(readBackgroundRunning(data), isBackgroundUnavailable(data));
		}));
		unsubscribe.push(pi.events.on(BACKGROUND_TERMINAL_CHANNEL, (data) => {
			if (isBackgroundTerminal(data)) refreshBackground();
		}));
		const apply = (data: unknown, requested: boolean) => {
			if (runtime !== r) return;
			const snapshot = readSnapshot(data, r.sessionId);
			// Pushes arrive in order; a reply to a request is the collector's current snapshot whatever its seq.
			if (!snapshot || (!requested && r.snapshot && snapshot.seq <= r.snapshot.seq)) return;
			const previousUnits = r.snapshot?.units ?? null;
			updateAccess(r);
			r.snapshot = snapshot;
			updateFinished(r, previousUnits);
			setQuestion(r, snapshot.question !== null);
			render(r);
		};
		const request = () => pi.events.emit(REQUEST_CHANNEL, { reply: (snapshot: unknown) => apply(snapshot, true) });
		unsubscribe.push(pi.events.on(SNAPSHOT_CHANNEL, (data) => apply(data, false)));
		unsubscribe.push(pi.events.on(READY_CHANNEL, (data) => {
			const ready = data as { version?: unknown; sessionId?: unknown } | undefined;
			if (runtime === r && ready?.version === 1 && ready.sessionId === r.sessionId) request();
		}));
		watch = watchPaneState(target, (state) => {
			if (runtime !== r) return;
			const reconnected = r.herdr === null && state.status !== null;
			updateAccess(r);
			r.herdr = state.status;
			r.workspaceLabel = state.workspaceLabel;
			r.paneLabel = state.paneLabel;
			r.visible = state.visible;
			updateFinished(r);
			render(r);
			if (reconnected) refreshBackground();
		});
		// The collector may load before or after this extension; one that loads later announces itself with ready.
		request();
		refreshBackground();
		if (runtime === r && !r.snapshot) render(r);
	}

	async function stop() {
		const r = runtime;
		runtime = undefined;
		await r?.dispose();
	}

	pi.on("session_start", (_event, ctx) => start(ctx));
	pi.on("session_shutdown", () => stop());
	pi.on("tool_execution_end", (event) => {
		if (BACKGROUND_START_TOOLS.includes(event.toolName)) runtime?.refreshBackground();
	});
	// Tree navigation moves the active branch, and with it the latest saved flag.
	pi.on("session_tree", (_event, ctx) => {
		const r = runtime;
		if (!r) return;
		r.flagged = savedFlag(ctx.sessionManager.getBranch());
		render(r);
	});

	pi.registerCommand("flag", {
		description: "Toggle this session's red reminder dot beside its SPACE name in Herdr's sidebar",
		async handler(args, ctx) {
			if (args.trim()) {
				if (ctx.hasUI) ctx.ui.notify("Usage: /flag", "warning");
				return;
			}
			const r = runtime;
			// Only a reporting runtime saves the flag, so nothing is saved where it cannot show.
			if (!r) {
				if (ctx.hasUI) ctx.ui.notify("/flag needs Pi's terminal UI inside Herdr; nothing was flagged", "warning");
				return;
			}
			r.flagged = !r.flagged;
			pi.appendEntry(FLAG_ENTRY, { flagged: r.flagged });
			render(r);
			ctx.ui.notify(r.flagged ? "Flagged" : "Flag cleared", "info");
		},
	});
}
