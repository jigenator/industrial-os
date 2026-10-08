import type { ContextSnapshot } from "./context.ts";
import type { UsageSnapshot } from "./usage.ts";
import type { PullRequestInfo, WorkspaceInfo } from "./workspace.ts";

export const SNAPSHOT = "signals-collector:v1:snapshot";
export const REQUEST = "signals-collector:v1:request";
export const READY = "signals-collector:v1:ready";
export type Phase =
	| { kind: "waiting" | "thinking" | "writing"; since: number }
	| { kind: "tool"; tool: string; target: string | null; since: number };
export type SignalsSnapshot = {
	version: 1; sessionId: string; seq: number; launch: string; active: string;
	workspace: WorkspaceInfo | null; pr: PullRequestInfo | null;
	root: { working: boolean; lastSettledAt: number | null };
	phase: Phase | null;
	question: { text: string; more: number; since: number } | null;
	model: { provider: string; id: string } | null;
	thinking: string | null;
	context: ContextSnapshot | null;
	compactions: number | null; units: number | null;
	goal: { status: string; usedSeconds: number; activeSince: number | null } | null;
	usage: UsageSnapshot;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const first = (value: unknown) => Array.isArray(value) ? value[0] : value;
const bounded = (value: unknown) => typeof value === "string" ? value.slice(0, 200) : null;

export function phaseTarget(tool: string, args: unknown): string | null {
	if (!record(args)) return null;
	switch (tool) {
		case "read": case "edit": case "write": return bounded(args.path);
		case "bash": return bounded(typeof args.command === "string" ? args.command.split(/\r?\n/, 1)[0] : null);
		case "web_search": return bounded(first(args.query ?? args.queries));
		case "fetch_content": return bounded(first(args.url ?? args.urls));
		case "subagent": return bounded(args.agent);
		default: return null;
	}
}
export function pendingQuestion(args: unknown, since: number): SignalsSnapshot["question"] {
	if (!record(args) || !Array.isArray(args.questions) || !args.questions.length || !args.questions.every((q) => record(q) && typeof q.question === "string")) return null;
	return { text: args.questions[0].question.slice(0, 200), more: args.questions.length - 1, since };
}

// Private pi-goal 0.54.10 persistence coupling, not its run-protocol DTO.
// Reject incompatible/legacy shapes; only the latest selected-branch record matters.
export function goalSnapshot(entries: readonly { type: string; customType?: string; data?: unknown }[]): SignalsSnapshot["goal"] {
	const entry = entries.filter((e) => e.type === "custom" && e.customType === "goal-state").at(-1);
	if (!record(entry?.data) || Object.hasOwn(entry.data, "queue") || Object.hasOwn(entry.data, "pendingAction")) return null;
	const goal = entry.data.goal;
	if (!record(goal) || !["active", "paused", "blocked", "usage_limited", "budget_limited"].includes(goal.status as string)
		|| typeof goal.id !== "string" || !goal.id.trim() || goal.id.trim() !== goal.id
		|| typeof goal.text !== "string" || !goal.text.trim() || goal.text.length > 4000
		|| ![goal.startedAt, goal.updatedAt, goal.iteration, goal.tokensUsed, goal.timeUsedSeconds, goal.baselineTokens].every(nonnegative)
		|| (goal.activeStartedAt !== undefined && !nonnegative(goal.activeStartedAt))
		|| (goal.safetyResetPending !== undefined && typeof goal.safetyResetPending !== "boolean")) return null;
	return { status: goal.status as string, usedSeconds: goal.timeUsedSeconds as number, activeSince: goal.status === "active" ? goal.activeStartedAt as number ?? null : null };
}
