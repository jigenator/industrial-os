import { isAbsolute } from "node:path";
import { performance } from "node:perf_hooks";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { collectActivity } from "./activity.ts";
import { compactionReserve, contextSnapshot } from "./context.ts";
import { goalSnapshot, pendingQuestion, phaseTarget, READY, REQUEST, SNAPSHOT } from "./snapshot.ts";
import type { Phase, SignalsSnapshot } from "./snapshot.ts";
import { collectUsage } from "./usage-cache.ts";
import { emptyUsage } from "./usage.ts";
import type { UsageSnapshot } from "./usage.ts";
import { inspectPullRequest, inspectWorkspace, resolveActivePath } from "./workspace.ts";
import type { PullRequestInfo, WorkspaceInfo } from "./workspace.ts";

const LOCAL_REFRESH_MS = 15_000, PR_TTL_MS = 60_000;
type Selection = { version: 1; path: string };
type SessionState = {
	ctx: ExtensionContext; id: string; disposed: boolean; launch: string; active: string; selection: number;
	workspace?: WorkspaceInfo; pr: PullRequestInfo | null; prKey?: string;
	prCache: Map<string, { at: number; value: PullRequestInfo }>;
	localAbort?: AbortController; prAbort?: AbortController; refreshPending: boolean;
	timer?: ReturnType<typeof setInterval>; pushTimer?: ReturnType<typeof setTimeout>;
	activity?: ReturnType<typeof collectActivity>; usageCollector?: ReturnType<typeof collectUsage>; offRequest?: () => void;
	units: number | null; usage: UsageSnapshot; phase: Phase | null; lastSettledAt: number | null;
	tools: Map<string, Extract<Phase, { kind: "tool" }>>;
	questions: Map<string, NonNullable<SignalsSnapshot["question"]>>;
	snapshot: SignalsSnapshot; publishedSeq?: number;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
// Tool result text is a sink: raw snapshot paths remain unmodified.
const toolPath = (value: string) => value.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, " ");

export default function (pi: ExtensionAPI) {
	let session: SessionState | undefined, seq = 0, lastPush = -Infinity;
	const current = (s: SessionState) => session === s && !s.disposed && s.ctx.mode === "tui" && s.ctx.sessionManager.getSessionId() === s.id;
	function sample(s: SessionState) {
		const ctx = s.ctx, working = !ctx.isIdle();
		if (!working) s.phase = null;
		const next: SignalsSnapshot = {
			version: 1, sessionId: s.id, seq: s.snapshot?.seq ?? 0, launch: s.launch, active: s.active,
			workspace: s.workspace ?? null, pr: s.pr, root: { working, lastSettledAt: s.lastSettledAt },
			phase: working ? s.phase : null, question: s.questions.values().next().value ?? null,
			model: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : null, thinking: pi.getThinkingLevel() ?? null,
			context: contextSnapshot(ctx.getContextUsage(), ctx.model, compactionReserve(pi.getSettings(), ctx.model)),
			compactions: ctx.sessionManager.getBranch().filter((e) => e.type === "compaction").length,
			units: s.units, goal: goalSnapshot(ctx.sessionManager.getBranch()), usage: s.usage,
		};
		if (JSON.stringify(next) !== JSON.stringify(s.snapshot)) { next.seq = ++seq; s.snapshot = next; return true; }
		return false;
	}
	// The push budget is monotonic; every timestamp in the wire DTO remains epoch time.
	function changed(s: SessionState) {
		if (!current(s)) return;
		sample(s);
		if (s.pushTimer) return;
		const delay = Math.max(0, Math.ceil(lastPush + 100 - performance.now()));
		const flush = () => {
			s.pushTimer = undefined;
			if (!current(s)) return;
			const remaining = lastPush + 100 - performance.now();
			if (remaining > 0) {
				s.pushTimer = setTimeout(flush, Math.ceil(remaining)); s.pushTimer.unref(); return;
			}
			sample(s); // after other lifecycle handlers have persisted branch state
			if (s.publishedSeq === s.snapshot.seq) return;
			const snapshot = structuredClone(s.snapshot);
			s.publishedSeq = snapshot.seq; lastPush = performance.now();
			pi.events.emit(SNAPSHOT, snapshot);
		};
		s.pushTimer = setTimeout(flush, delay);
		s.pushTimer.unref();
	}
	function stopWork(s: SessionState) {
		s.disposed = true;
		if (s.timer) clearInterval(s.timer);
		if (s.pushTimer) clearTimeout(s.pushTimer);
		s.offRequest?.(); s.activity?.dispose(); s.usageCollector?.dispose();
		s.localAbort?.abort(); s.prAbort?.abort();
	}

	async function refreshPR(s: SessionState, workspace: WorkspaceInfo) {
		if (!current(s)) return;
		if (workspace.github.kind !== "repository" || workspace.git.kind !== "repository") {
			s.prAbort?.abort(); s.prAbort = undefined; s.prKey = undefined;
			s.pr = workspace.git.kind === "unknown"
				? { kind: "unavailable", reason: workspace.git.reason }
				: { kind: "not-applicable" };
			return;
		}
		const repository = workspace.github;
		const branch = workspace.git.active.branch;
		const key = JSON.stringify([repository.name, repository.url, branch]);
		if (s.prKey !== key) {
			s.prAbort?.abort(); s.prAbort = undefined;
			s.prKey = key;
			s.pr = { kind: "unavailable", reason: "lookup pending" };
		}
		const cached = s.prCache.get(key);
		if (cached && Date.now() - cached.at < PR_TTL_MS) { s.pr = cached.value; return; }
		if (s.prAbort) return;
		const controller = new AbortController();
		s.prAbort = controller;
		try {
			let value: PullRequestInfo;
			try { value = await inspectPullRequest(repository, branch, { signal: controller.signal }); }
			catch (error) { value = { kind: "unavailable", reason: error instanceof Error ? error.message : "lookup failed" }; }
			if (!current(s) || controller.signal.aborted || s.prAbort !== controller || s.prKey !== key) return;
			s.prCache.set(key, { at: Date.now(), value });
			s.pr = value;
			changed(s);
		} finally {
			if (s.prAbort === controller) s.prAbort = undefined;
		}
	}

	async function refreshLocal(s: SessionState): Promise<void> {
		if (!current(s)) return;
		if (s.localAbort) { s.refreshPending = true; return; }
		const controller = new AbortController();
		s.localAbort = controller;
		const path = s.active;
		try {
			let workspace: WorkspaceInfo;
			try { workspace = await inspectWorkspace(path, { signal: controller.signal }); }
			catch (error) {
				const reason = error instanceof Error ? error.message : "inspection failed";
				workspace = { path, git: { kind: "unknown", reason }, github: { kind: "unknown", reason } };
			}
			if (!current(s) || controller.signal.aborted || s.localAbort !== controller || s.active !== path) return;
			s.workspace = workspace;
			void refreshPR(s, workspace);
			changed(s);
		} finally {
			if (s.localAbort === controller) {
				s.localAbort = undefined;
				if (s.refreshPending && current(s)) { s.refreshPending = false; void refreshLocal(s); }
			}
		}
	}

	function restore(ctx: ExtensionContext) {
		const previous = session, id = ctx.sessionManager.getSessionId();
		if (previous) stopWork(previous);
		session = undefined;
		if (ctx.mode !== "tui") return;
		const launch = ctx.sessionManager.getHeader()?.cwd ?? ctx.sessionManager.getCwd();
		let active = launch;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message" || entry.message.role !== "toolResult" || entry.message.toolName !== "set_active_project" || entry.message.isError) continue;
			const data = entry.message.details as Partial<Selection> | undefined;
			if (data?.version === 1 && typeof data.path === "string" && isAbsolute(data.path)) active = data.path;
		}
		const s: SessionState = { ctx, id, disposed: false, launch, active, selection: 0, pr: null,
			prCache: previous?.id === id ? previous.prCache : new Map(), refreshPending: false,
			units: null, usage: emptyUsage(), phase: ctx.isIdle() ? null : { kind: "waiting", since: Date.now() },
			lastSettledAt: previous?.id === id ? previous.lastSettledAt : null, tools: new Map(), questions: new Map(), snapshot: undefined! };
		session = s; sample(s);
		s.offRequest = pi.events.on(REQUEST, (request) => {
			if (!current(s) || !record(request) || typeof request.reply !== "function") return;
			if (sample(s)) changed(s);
			request.reply(structuredClone(s.snapshot)); // synchronous: absence is detectable before emit returns
		});
		s.activity = collectActivity(pi, id, () => current(s), (units) => { if (current(s) && s.units !== units) { s.units = units; changed(s); } });
		s.usageCollector = collectUsage((usage) => { if (current(s)) { s.usage = usage; changed(s); } });
		s.timer = setInterval(() => { void refreshLocal(s); }, LOCAL_REFRESH_MS); s.timer.unref();
		void refreshLocal(s);
		changed(s);
		pi.events.emit(READY, { version: 1, sessionId: id });
	}
	const live = (ctx: ExtensionContext) => {
		const s = session;
		if (!s || !current(s) || ctx.mode !== "tui" || ctx.sessionManager.getSessionId() !== s.id) return undefined;
		s.ctx = ctx; return s;
	};
	const phase = (s: SessionState, next: Phase) => {
		const before = s.phase;
		if (!before || before.kind !== next.kind || (before.kind === "tool" && next.kind === "tool" && (before.tool !== next.tool || before.target !== next.target))) s.phase = next;
	};
	pi.on("session_start", (_e, ctx) => restore(ctx));
	pi.on("session_tree", (_e, ctx) => restore(ctx));
	pi.on("session_shutdown", () => { if (session) stopWork(session); session = undefined; });
	pi.on("agent_start", (_e, ctx) => { const s = live(ctx); if (s) { phase(s, { kind: "waiting", since: Date.now() }); changed(s); s.activity?.refresh(); } });
	pi.on("turn_start", (_e, ctx) => { const s = live(ctx); if (s) { phase(s, { kind: "waiting", since: Date.now() }); changed(s); } });
	pi.on("message_update", (e, ctx) => {
		const s = live(ctx); if (!s) return;
		const update = e.assistantMessageEvent;
		if (update.type !== "thinking_start" && update.type !== "text_start" && update.type !== "toolcall_start") return;
		const since = Date.now();
		if (update.type === "thinking_start") phase(s, { kind: "thinking", since });
		else if (update.type === "text_start") phase(s, { kind: "writing", since });
		else if (update.type === "toolcall_start") {
			const tool = update.partial.content[update.contentIndex];
			if (tool?.type === "toolCall") phase(s, { kind: "tool", tool: tool.name, target: phaseTarget(tool.name, tool.arguments), since });
		}
		changed(s);
	});
	pi.on("tool_execution_start", (e, ctx) => {
		const s = live(ctx); if (!s) return;
		const since = Date.now(), tool: Extract<Phase, { kind: "tool" }> = { kind: "tool", tool: e.toolName, target: phaseTarget(e.toolName, e.args), since };
		s.tools.set(e.toolCallId, tool); phase(s, tool);
		if (e.toolName === "ask_user_question") { const question = pendingQuestion(e.args, since); if (question) s.questions.set(e.toolCallId, question); }
		changed(s);
	});
	pi.on("tool_execution_end", (e, ctx) => {
		const s = live(ctx); if (!s) return;
		s.tools.delete(e.toolCallId); s.questions.delete(e.toolCallId);
		phase(s, [...s.tools.values()].at(-1) ?? { kind: "waiting", since: Date.now() });
		changed(s); void refreshLocal(s); s.activity?.refresh();
	});
	pi.on("agent_settled", (_e, ctx) => {
		const s = live(ctx); if (!s) return;
		s.lastSettledAt = Date.now(); s.phase = null; s.tools.clear(); s.questions.clear();
		changed(s); s.activity?.refresh();
	});
	for (const event of ["agent_end", "turn_end", "message_end", "session_compact", "model_select", "thinking_level_select", "input"] as const) {
		pi.on(event, (_e, ctx) => { const s = live(ctx); if (s) { changed(s); if (event === "agent_end") s.activity?.refresh(); } });
	}

	pi.registerTool({
		name: "set_active_project", label: "Set active project",
		description: "Declare the project or worktree shown in Industrial OS displays. Display only: does not change cwd, tool behavior, instructions, or loaded resources. Relative paths resolve from Launch. The display is agent-reported, not automatic tracking.",
		promptSnippet: "Declare the workspace displayed in Industrial OS",
		promptGuidelines: ["Before deliberately starting work in a different project or worktree (including an unrelated repository), call set_active_project with its path; call it again when switching back. Do not switch for incidental reads. This signal changes only the display; use explicit tool paths/cwd for actual work."],
		parameters: Type.Object({ path: Type.String({ minLength: 1, description: "Existing project/worktree directory; relative to the original session Launch directory" }) }),
		executionMode: "sequential", annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		async execute(_id, params, signal, _onUpdate, ctx) {
			const result = (path: string) => ({ content: [{ type: "text" as const, text: `Active display: ${toolPath(path)}. Cwd, tools, instructions and resources are unchanged.` }], details: { version: 1, path } satisfies Selection });
			if (ctx.mode !== "tui") {
				const id = ctx.sessionManager.getSessionId();
				const launch = ctx.sessionManager.getHeader()?.cwd ?? ctx.sessionManager.getCwd();
				const path = await resolveActivePath(params.path, launch, { signal });
				if (signal?.aborted || ctx.sessionManager.getSessionId() !== id) throw new Error("Workspace selection cancelled or session changed");
				return result(path);
			}
			const s = session; if (!s || !current(s)) throw new Error("No active TUI session");
			const selection = ++s.selection, path = await resolveActivePath(params.path, s.launch, { signal });
			if (!current(s) || s.selection !== selection || signal?.aborted) throw new Error("Workspace selection cancelled or session changed");
			s.localAbort?.abort(); s.prAbort?.abort(); s.localAbort = s.prAbort = undefined; s.refreshPending = false;
			s.active = path; s.workspace = undefined; s.prKey = undefined; s.pr = null;
			changed(s); void refreshLocal(s);
			return result(path);
		},
	});
}
