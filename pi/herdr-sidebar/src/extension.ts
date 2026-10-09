import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { herdrRequest, watchPaneState, type HerdrTarget } from "./herdr-client.ts";
import { createTokenSender } from "./sender.ts";
import { READY_CHANNEL, REQUEST_CHANNEL, SNAPSHOT_CHANNEL, readSnapshot, type SidebarSnapshot } from "./snapshot.ts";
import { buildTokens, nextLastAccessAt, nextSubagentsFinishedAt, nextTokenChange, type HerdrStatus, type SidebarInput } from "./tokens.ts";

// The blocked-state signal Herdr's Pi integration (herdr-agent-state.ts) counts: one true per question wait, one false.
export const BLOCKED_CHANNEL = "herdr:blocked";
// Time-based values re-render when their text changes, but never more than once a second.
const MIN_RENDER_INTERVAL_MS = 1_000;

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
	visible: boolean | null;
	subagentsFinishedAt: number | null;
	question: boolean;
	lastRender: number;
	lastAccessAt: number;
	timer?: NodeJS.Timeout;
	dispose(): Promise<void>;
};

export default function herdrSidebar(pi: ExtensionAPI) {
	let runtime: Runtime | undefined;

	const inputAt = (r: Runtime, now: number): SidebarInput => ({
		snapshot: r.snapshot, herdr: r.herdr, workspaceLabel: r.workspaceLabel, visible: r.visible,
		lastAccessAt: r.lastAccessAt, subagentsFinishedAt: r.subagentsFinishedAt, now, home: homedir(),
	});
	// Capture the end of a seen/working/unknown interval before changing its inputs.
	const updateAccess = (r: Runtime) => { r.lastAccessAt = nextLastAccessAt(inputAt(r, Date.now())); };

	function render(r: Runtime, send: (tokens: ReturnType<typeof buildTokens>) => void) {
		if (runtime !== r) return;
		if (r.timer) clearTimeout(r.timer);
		r.timer = undefined;
		const now = Date.now();
		r.lastRender = now;
		r.lastAccessAt = nextLastAccessAt(inputAt(r, now));
		const input = inputAt(r, now);
		send(buildTokens(input));
		const due = nextTokenChange(input);
		if (due === null) return;
		r.timer = setTimeout(() => render(r, send), Math.max(due - now, r.lastRender + MIN_RENDER_INTERVAL_MS - now));
		r.timer.unref();
	}

	// Advances the "subagents finished unseen" flag from the units before this change to the current inputs.
	function updateFinished(r: Runtime, previousUnits: number | null) {
		r.subagentsFinishedAt = nextSubagentsFinishedAt({ previousUnits, units: r.snapshot?.units ?? null, herdr: r.herdr, visible: r.visible, subagentsFinishedAt: r.subagentsFinishedAt, now: Date.now() });
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
			// Herdr changes an automatic SPACE label without an event; re-read it with each renewal.
			onRenew: () => {
				// Also refresh access even when watch inputs have not changed; no extra interval.
				if (runtime === r) render(r, send);
				watch?.refresh();
			},
		});
		const send = (tokens: ReturnType<typeof buildTokens>) => sender.update(tokens);
		const unsubscribe: (() => void)[] = [];
		const r: Runtime = {
			sessionId: ctx.sessionManager.getSessionId(), snapshot: null, herdr: null, workspaceLabel: null, visible: null, subagentsFinishedAt: null, question: false, lastRender: 0, lastAccessAt: Date.now(),
			async dispose() {
				if (r.timer) clearTimeout(r.timer);
				r.timer = undefined;
				for (const off of unsubscribe) off();
				watch?.close();
				setQuestion(r, false);
				await sender.shutdown();
			},
		};
		runtime = r;
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
			render(r, send);
		};
		const request = () => pi.events.emit(REQUEST_CHANNEL, { reply: (snapshot: unknown) => apply(snapshot, true) });
		unsubscribe.push(pi.events.on(SNAPSHOT_CHANNEL, (data) => apply(data, false)));
		unsubscribe.push(pi.events.on(READY_CHANNEL, (data) => {
			const ready = data as { version?: unknown; sessionId?: unknown } | undefined;
			if (runtime === r && ready?.version === 1 && ready.sessionId === r.sessionId) request();
		}));
		watch = watchPaneState(target, (state) => {
			if (runtime !== r) return;
			updateAccess(r);
			r.herdr = state.status;
			r.workspaceLabel = state.workspaceLabel;
			r.visible = state.visible;
			updateFinished(r, r.snapshot?.units ?? null);
			render(r, send);
		});
		// The collector may load before or after this extension; one that loads later announces itself with ready.
		request();
		if (runtime === r && !r.snapshot) render(r, send);
	}

	async function stop() {
		const r = runtime;
		runtime = undefined;
		await r?.dispose();
	}

	pi.on("session_start", (_event, ctx) => start(ctx));
	pi.on("session_shutdown", () => stop());
}
