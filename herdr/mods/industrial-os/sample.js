// An invented window for the storybook and the checks, in the shapes Herdr gives the mod: five spaces and nine
// panes in every state. Nothing here is read from Herdr; a story shows a part with this data and says so.
import { LABEL } from "./signals.js";

const HOME = "/Users/operator";

/**
 * The spaces, plainly: [{ name, branch, git: [ahead, behind], tabs: [{ name?, panes: [{ key, kind?, title, status?, sig }] }] }].
 * A pane is a Pi with its label unless `kind` is "shell", or "unlabelled": a Pi whose label has not come yet.
 * In `sig`, a `units` or `context` of null is a reading Pi does not know.
 */
export const sampleSpaces = () => [
	{ name: "foundry", branch: "feat/ingest-queue", git: [0, 20], tabs: [
		{ name: "ingest pipeline", panes: [
			{ key: "a1", title: "Rebuild the ingest queue", sig: { working: true, since: 6000, units: 3, context: 42, model: "claude-fable-5-1", compactions: 2, dirty: true, pr: 482 } },
			{ key: "a2", title: "Trace the flaky deploy check", sig: { context: 67, settled: 180_000, compactions: 9 } },
		] },
		{ panes: [{ key: "a3", kind: "shell", title: "zsh" }] },
	] },
	{ name: "relay", branch: "main", tabs: [
		{ name: "rollout", panes: [
			{ key: "b1", title: "Staging rollout: eu-west", sig: { question: "Approve the rollback plan for eu-west before the canary widens?", since: 42_000, context: 81, compactions: 4 } },
			{ key: "b2", title: "Watch the canary metrics", sig: { background: 1, context: 24, settled: 95_000 } },
		] },
	] },
	{ name: "archive", branch: "main", tabs: [
		{ panes: [{ key: "c1", title: "Index the archive snapshots", sig: { working: true, since: 31_000, context: 91, compactions: 12 } }] },
	] },
	{ name: "harbor", branch: "docs/release-notes", tabs: [
		{ name: "release", panes: [
			{ key: "d1", title: "Draft the release notes", status: "done", sig: { context: 35, settled: 15_000 } },
			{ key: "d2", title: "Review the migration plan", sig: { context: 12, settled: 3_600_000 } },
		] },
	] },
	{ name: "signal", branch: "main", tabs: [
		{ panes: [{ key: "e1", title: "Profile the cold start", sig: { context: 58, settled: 420_000 } }] },
	] },
];

const program = (key, name, agent) => ({ key, name, icon: null, tint: false, tile: null, color: null, shell: !agent, agent });
// The signals-collector's snapshot for one Pi, as its `io.signals.v1` label carries it.
function snapshot(folder, branch, sig, now, seq) {
	const ago = (ms) => (ms === null || ms === undefined ? null : now - ms);
	return {
		version: 1, sessionId: "s", seq, launch: folder, active: folder, visible: true,
		workspace: { path: folder, git: { kind: "repository", active: { path: folder, branch, revision: "abc1234", dirty: sig.dirty === true }, main: null, isWorktree: false }, github: { kind: "repository", name: "io/x", url: "https://github.com/io/x" } },
		pr: sig.pr ? { kind: "open", number: sig.pr, url: "https://github.com/io/x/pull/1" } : { kind: "none" },
		root: { working: sig.working === true, lastSettledAt: sig.working ? null : ago(sig.settled ?? 240_000) },
		phase: sig.working ? { kind: "tool", tool: "bash", target: "x", since: ago(sig.since ?? 20_000) } : null,
		question: sig.question ? { text: sig.question, more: 0, since: ago(sig.since ?? 30_000) } : null,
		model: { provider: "anthropic", id: sig.model ?? "claude-opus-5-5" }, thinking: sig.thinking ?? "high",
		context: { tokens: 1, window: 200_000, reserve: 16_384, usedPercent: "context" in sig ? sig.context : 30 },
		compactions: sig.compactions ?? 0, units: "units" in sig ? sig.units : 0, goal: sig.goal ? { status: "active", usedSeconds: sig.goal, activeSince: now - 1000 } : null,
		backgroundTasks: sig.background ?? 0, flag: sig.flag === true,
	};
}

/**
 * The window as Herdr reports it at `now`: { spaces, agents, terminals, panes, focused, git, home }, where `git`
 * maps each space's folder to its [ahead, behind]. `focus` is the key of the pane with the keyboard.
 */
export function sampleWindow(now, { spaces: list = sampleSpaces(), focus = "a1", seq = 1 } = {}) {
	const out = { spaces: [], agents: [], terminals: [], panes: [], focused: null, git: {}, home: HOME };
	const focusSpace = list.find((s) => s.tabs.some((t) => t.panes.some((p) => p.key === focus))) ?? list[0];
	list.forEach((s, si) => {
		const sid = `s${si + 1}`, folder = `${HOME}/${s.name.toLowerCase()}`;
		out.git[folder] = s.git ?? null;
		const focusTab = s.tabs.find((t) => t.panes.some((p) => p.key === focus)) ?? s.tabs[0];
		const tabs = s.tabs.map((t, ti) => {
			const tid = `${sid}t${ti + 1}`;
			for (const p of t.panes) {
				const pi = p.kind !== "shell", focused = p.key === focus, sig = p.sig ?? {};
				const status = pi ? (sig.question ? "blocked" : p.status ?? (sig.working ? "working" : "idle")) : "idle";
				out.terminals.push({ address: p.key, state: "live", status, labels: { "herdr.space": sid, "herdr.tab": tid, ...(pi && p.kind !== "unlabelled" ? { [LABEL]: JSON.stringify(snapshot(folder, s.branch ?? "main", sig, now, seq)) } : {}) } });
				const prog = pi ? program("pi", "Pi", true) : program("shell", "zsh", false);
				if (pi) out.agents.push({ address: p.key, pane: `p-${p.key}`, space: sid, space_name: s.name, tab: tid, tab_index: ti + 1, tab_name: t.name ?? String(ti + 1), status, app: "pi", program: prog, title: p.title, seq, pinned: false, focused });
				out.panes.push({ pane: `p-${p.key}`, terminal: p.key, tab: tid, title: p.title, cwd: folder, branch: null, status: pi ? status : null, app: pi ? "pi" : null, program: prog, focused, zoomed: false, movable: false });
				if (focused) out.focused = { pane: `p-${p.key}`, tab: tid };
			}
			return { id: tid, index: ti + 1, name: t.name ?? String(ti + 1), named: !!t.name, active: t === focusTab, status: null, panes: t.panes.length, zoomed: false, settled: false, settled_at: null, changed_at: now - 300_000, working_since: now - 40_000 };
		});
		out.spaces.push({ id: sid, index: si + 1, name: s.name, named: true, folder, machine: null, branch: null, active: s === focusSpace, status: null, tabs });
	});
	return out;
}
