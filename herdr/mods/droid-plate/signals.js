// Reads what the plate needs from the `io.signals.v1` terminal label, the frozen publication of the signals-collector
// snapshot (pi/signals-collector/docs/contract.md, section 4). The label is untrusted: anything missing or malformed
// is unknown (null), never zero; unknown fields are ignored. The sidebar mod reads the same label for its own fields.

export const LABEL = "io.signals.v1";
/** The label this mod sets on its pane's terminal while it draws a plate there, for the droid header to read. */
export const PLATE_LABEL = "io.droid-plate.v1";

const FREE_TEXT_LIMIT = 200;
const record = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const text = (value) => (typeof value === "string" ? value.slice(0, FREE_TEXT_LIMIT) : null);

function phase(value) {
	if (!record(value) || !finite(value.since)) return null;
	if (["waiting", "thinking", "writing"].includes(value.kind)) return { kind: value.kind, since: value.since };
	if (value.kind === "tool" && typeof value.tool === "string" && value.tool) {
		return { kind: "tool", tool: value.tool.slice(0, FREE_TEXT_LIMIT), target: text(value.target), since: value.since };
	}
	return null;
}

/** A label value's session, working state, phase, question and settle time; null when absent or not version 1. */
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
	return {
		sessionId: typeof data.sessionId === "string" && data.sessionId ? data.sessionId : null,
		// Unknown (null) unless the label says true or false: a malformed value is not "not working".
		working: typeof root.working === "boolean" ? root.working : null,
		lastSettledAt: finite(root.lastSettledAt) ? root.lastSettledAt : null,
		phase: root.working === true ? phase(data.phase) : null,
		question: record(data.question) && typeof data.question.text === "string" ? { text: text(data.question.text) } : null,
	};
}

/** The signals of a live terminal whose agent app is `pi`; on any other terminal the label is stale (null). */
export function terminalSignals(terminal, app) {
	if (!record(terminal) || terminal.state !== "live" || app !== "pi") return null;
	return parseSignals(record(terminal.labels) ? terminal.labels[LABEL] : undefined);
}
