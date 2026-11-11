// Reads the `io.signals.v1` terminal label: a signals-collector SignalsSnapshot v1 (without `usage`) plus
// `backgroundTasks` and `flag`, as the frozen publication contract defines. The label is untrusted input: anything
// missing or malformed becomes unknown (null), never zero or clean; unknown fields are ignored.

export const LABEL = "io.signals.v1";

// The snapshot contract bounds free text to 200 UTF-16 code units; a longer value is cut here rather than trusted.
const FREE_TEXT_LIMIT = 200;

const record = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const count = (value) => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null);
const time = (value) => (finite(value) ? value : null);
const text = (value) => (typeof value === "string" ? value.slice(0, FREE_TEXT_LIMIT) : null);

// status-bar's WorkspaceInfo, reduced to what ACT shows. `branch` null is a detached HEAD; `dirty` null is unknown.
function workspace(value) {
	if (!record(value) || !record(value.git) || !record(value.github)) return null;
	const git = value.git, active = git.active;
	return {
		repository: git.kind === "repository" && record(active),
		branch: git.kind === "repository" && record(active) && typeof active.branch === "string" && active.branch ? active.branch : null,
		dirty: git.kind === "repository" && record(active) && typeof active.dirty === "boolean" ? active.dirty : null,
		github: value.github.kind === "repository",
	};
}

function pullRequest(value) {
	if (!record(value)) return null;
	if (value.kind === "open") {
		return Number.isSafeInteger(value.number) && value.number > 0 ? { kind: "open", number: value.number } : { kind: "unavailable" };
	}
	return ["unavailable", "none", "not-applicable"].includes(value.kind) ? { kind: value.kind } : null;
}

function phase(value) {
	if (!record(value) || !finite(value.since)) return null;
	if (["waiting", "thinking", "writing"].includes(value.kind)) return { kind: value.kind, since: value.since };
	if (value.kind === "tool" && typeof value.tool === "string" && value.tool) return { kind: "tool", since: value.since };
	return null;
}

function goal(value) {
	if (!record(value) || typeof value.status !== "string" || !finite(value.usedSeconds)) return null;
	const active = value.status === "active";
	return { active, usedSeconds: Math.max(0, value.usedSeconds), activeSince: active ? time(value.activeSince) : null };
}

/**
 * Parses a label value. Returns null when it is absent, not JSON, or not a version 1 snapshot ("no signals").
 * Field by field, a malformed value becomes unknown.
 */
export function parseSignals(raw) {
	if (typeof raw !== "string" || !raw) return null;
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!record(data) || data.version !== 1) return null;
	const root = record(data.root) ? data.root : {};
	const question = record(data.question) && typeof data.question.text === "string"
		? { text: text(data.question.text), more: count(data.question.more) ?? 0 }
		: null;
	const model = record(data.model) && typeof data.model.id === "string" && typeof data.model.provider === "string"
		? { provider: data.model.provider, id: data.model.id }
		: null;
	const context = record(data.context) ? data.context : null;
	return {
		active: typeof data.active === "string" && data.active ? data.active : null,
		workspace: workspace(data.workspace),
		pr: pullRequest(data.pr),
		working: root.working === true,
		lastSettledAt: time(root.lastSettledAt),
		phase: root.working === true ? phase(data.phase) : null,
		question,
		model,
		thinking: typeof data.thinking === "string" && data.thinking ? data.thinking : null,
		usedPercent: context && finite(context.usedPercent) ? context.usedPercent : null,
		compactions: count(data.compactions),
		units: count(data.units),
		goal: goal(data.goal),
		backgroundTasks: count(data.backgroundTasks),
		flag: data.flag === true,
	};
}

/**
 * The signals for one terminal, or null. A label counts only on a live terminal whose agent status `app` is `pi`;
 * on any other terminal it is stale and ignored.
 */
export function terminalSignals(terminal, app) {
	if (!record(terminal) || terminal.state !== "live" || app !== "pi") return null;
	const labels = record(terminal.labels) ? terminal.labels : {};
	return parseSignals(labels[LABEL]);
}
