// The signals-collector snapshot contract v1, as this extension consumes it. The collector is another project, so
// its types are not imported: this module validates the event-bus payload at the trust boundary and keeps only the
// fields the sidebar shows. A field that is missing or malformed becomes unknown (null), never zero or clean.

export const SNAPSHOT_CHANNEL = "signals-collector:v1:snapshot";
export const REQUEST_CHANNEL = "signals-collector:v1:request";
export const READY_CHANNEL = "signals-collector:v1:ready";

// The contract bounds free text to 200 UTF-16 code units; a longer value is cut here rather than trusted.
const FREE_TEXT_LIMIT = 200;

export type Phase =
	| { kind: "waiting"; since: number }
	| { kind: "thinking"; since: number }
	| { kind: "writing"; since: number }
	| { kind: "tool"; tool: string; target: string | null; since: number };

// The parts of status-bar's WorkspaceInfo union the sidebar reads. `branch` null is a detached HEAD; `dirty` null
// is unavailable, never clean.
export type WorkspaceView = {
	git: { kind: "repository"; branch: string | null; dirty: boolean | null } | { kind: "other" };
	githubRepository: boolean;
};

export type PullRequestView = { kind: "open"; number: number } | { kind: "unavailable" } | { kind: "none" } | { kind: "not-applicable" };

export interface SidebarSnapshot {
	sessionId: string;
	seq: number;
	active: string | null;
	workspace: WorkspaceView | null;
	pr: PullRequestView | null;
	lastSettledAt: number | null;
	phase: Phase | null;
	question: { text: string; more: number } | null;
	model: { provider: string; id: string } | null;
	thinking: string | null;
	usedPercent: number | null;
	compactions: number | null;
	units: number | null;
	goal: { status: string; usedSeconds: number; activeSince: number | null } | null;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const count = (value: unknown): number | null => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null);
const text = (value: unknown): string | null => (typeof value === "string" ? value.slice(0, FREE_TEXT_LIMIT) : null);
const time = (value: unknown): number | null => (finite(value) ? value : null);

function workspaceView(value: unknown): WorkspaceView | null {
	if (!record(value) || !record(value.git) || !record(value.github)) return null;
	const git = value.git, active = git.active;
	const view: WorkspaceView["git"] = git.kind === "repository" && record(active)
		? { kind: "repository", branch: typeof active.branch === "string" && active.branch ? active.branch : null, dirty: typeof active.dirty === "boolean" ? active.dirty : null }
		: { kind: "other" };
	return { git: view, githubRepository: value.github.kind === "repository" };
}

function pullRequestView(value: unknown): PullRequestView | null {
	if (!record(value)) return null;
	if (value.kind === "open") return typeof value.number === "number" && Number.isSafeInteger(value.number) && value.number > 0 ? { kind: "open", number: value.number } : { kind: "unavailable" };
	if (value.kind === "unavailable" || value.kind === "none" || value.kind === "not-applicable") return { kind: value.kind };
	return null;
}

function phase(value: unknown): Phase | null {
	if (!record(value) || !finite(value.since)) return null;
	const since = value.since;
	if (value.kind === "waiting" || value.kind === "thinking" || value.kind === "writing") return { kind: value.kind, since };
	if (value.kind === "tool" && typeof value.tool === "string" && value.tool) return { kind: "tool", tool: value.tool.slice(0, FREE_TEXT_LIMIT), target: text(value.target), since };
	return null;
}

/**
 * Validates a snapshot for this session. Returns undefined when the payload is not a v1 snapshot for `sessionId`;
 * the caller then keeps what it had. Unknown fields are ignored.
 */
export function readSnapshot(data: unknown, sessionId: string): SidebarSnapshot | undefined {
	if (!record(data) || data.version !== 1 || data.sessionId !== sessionId || !finite(data.seq)) return undefined;
	const root = record(data.root) ? data.root : {};
	const question = record(data.question) && typeof data.question.text === "string" ? { text: text(data.question.text)!, more: count(data.question.more) ?? 0 } : null;
	const model = record(data.model) && typeof data.model.id === "string" && typeof data.model.provider === "string" ? { provider: data.model.provider, id: data.model.id } : null;
	const context = record(data.context) ? data.context : null;
	const goal = record(data.goal) && typeof data.goal.status === "string" && finite(data.goal.usedSeconds)
		? { status: data.goal.status, usedSeconds: Math.max(0, data.goal.usedSeconds), activeSince: data.goal.status === "active" ? time(data.goal.activeSince) : null }
		: null;
	return {
		sessionId,
		seq: data.seq,
		active: typeof data.active === "string" && data.active ? data.active : null,
		workspace: workspaceView(data.workspace),
		pr: pullRequestView(data.pr),
		lastSettledAt: time(root.lastSettledAt),
		phase: root.working === true ? phase(data.phase) : null,
		question,
		model,
		thinking: typeof data.thinking === "string" && data.thinking ? data.thinking : null,
		usedPercent: context && finite(context.usedPercent) ? context.usedPercent : null,
		compactions: count(data.compactions),
		units: count(data.units),
		goal,
	};
}
