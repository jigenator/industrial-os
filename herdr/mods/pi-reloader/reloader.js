// Every Pi Reloader rule, with no gpui-kit or herdr import: which agents are candidates, the guard label and wire
// protocol (pi/reloader-guard/docs/contract.md), and the reload and reset sequences over an injected `io`.
// main.js supplies `io`: hc get/send, the guard socket, focus commands, sleep, the clock and progress.

export const LABEL = "io.pi-reloader.v1";
export const POLL_MS = 250;
export const VISIT_MS = 250;
export const EXIT_MS = 15_000;
export const READY_MS = 30_000;
export const RELOAD_MS = 30_000;
const SETTLED = ["idle", "done"];
// Shells whose quoting resumeCommand uses; another root program is never quit.
const POSIX_SHELLS = ["sh", "bash", "zsh", "dash", "ksh"];
// Lunalee's chat terminal; also protected when no layout names it.
const LUNALEE_CHAT = "lunalee-chat";

/** The guard's label on a terminal: `{ port, token, pid, ppid }`, or null when absent or malformed. */
export function parseGuard(labels) {
	const value = labels?.[LABEL];
	if (typeof value !== "string") return null;
	let guard;
	try { guard = JSON.parse(value); } catch { return null; }
	if (guard?.v !== 1 || !Number.isInteger(guard.port) || guard.port < 1 || guard.port > 65_535) return null;
	if (typeof guard.token !== "string" || !/^[0-9a-f]{32}$/.test(guard.token)) return null;
	if (![guard.pid, guard.ppid].every((pid) => Number.isInteger(pid) && pid > 0)) return null;
	return { port: guard.port, token: guard.token, pid: guard.pid, ppid: guard.ppid };
}

/** Every terminal a layout block shows (`content.terminal`, an address or a name), floating blocks included. */
export function layoutTerminals(node, found = new Set()) {
	if (!node || typeof node !== "object") return found;
	if (typeof node.content?.terminal === "string") found.add(node.content.terminal);
	for (const child of [...(node.children ?? []), ...(node.floating ?? [])]) layoutTerminals(child, found);
	return found;
}

export function emptySummary() {
	return { completed: 0, visited: 0, drafts: 0, busy: 0, notPi: 0, notRestartable: 0, protected: 0, remote: 0, failed: 0, errors: [], outcomes: [] };
}

/**
 * Splits Herdr's agents into candidates (idle or done Pi in a pane on this computer, in agents() order) and counted
 * skips. Protected: no pane of its own, shown by a layout block, or Lunalee's chat.
 * `only`, when an array, limits everything to those addresses (the test scope in scope.js); others are not counted.
 */
export function selectCandidates(agents, terminals, layout, only = null) {
	const shown = layoutTerminals(layout);
	const names = new Map(terminals.map((t) => [t.address, t.name]));
	const skipped = emptySummary();
	const candidates = [];
	for (const agent of agents) {
		if (Array.isArray(only) && !only.includes(agent.address)) continue;
		const name = names.get(agent.address);
		if (agent.app !== "pi") skipped.notPi++;
		else if (agent.address.includes("/")) skipped.remote++;
		else if (!agent.pane || shown.has(agent.address) || (name && shown.has(name)) || name === LUNALEE_CHAT) skipped.protected++;
		else if (!SETTLED.includes(agent.status)) skipped.busy++;
		else candidates.push({ address: agent.address, wasIdle: agent.status === "idle", where: `${agent.space_name} / ${agent.tab_name}`, title: agent.title });
	}
	return { candidates, skipped };
}

/** One `hc get --json` record judged at action time: `{ guard }`, or `{ skip }` / `{ error }` with nothing done. */
export function checkTerminal(t, address) {
	if (t?.address !== address || t.state !== "live") return { skip: "notPi", note: "no longer live" };
	if (t.name === LUNALEE_CHAT) return { skip: "protected", note: "Lunalee's terminal" };
	if (t.status?.app !== "pi") return { skip: "notPi", note: "no longer Pi" };
	if (!SETTLED.includes(t.status.state)) return { skip: "busy", note: "Pi became busy" };
	const guard = parseGuard(t.labels);
	if (!guard) return { error: "guard unavailable; reload that Pi once by hand from an empty editor" };
	if (!inForeground(guard, t)) return { error: "the foreground process is not the guarded Pi; no action taken" };
	return { guard };
}

/** The guarded Pi is the terminal's foreground process, or the direct child of a launcher (volta's shim) that is. */
export function inForeground(guard, t) {
	const pid = t.foreground?.pid;
	return Number.isInteger(pid) && (guard.pid === pid || (guard.ppid === pid && pid !== t.pid));
}

/** Quitting Pi leaves the terminal open only when an interactive POSIX shell is its root program and Pi a child. */
export function restartable(t) {
	const shell = String(t.argv?.[0] ?? "").split("/").pop().replace(/^-/, "");
	return POSIX_SHELLS.includes(shell) && Number.isInteger(t.pid) && t.foreground?.pid !== t.pid;
}

export function validSession(session) {
	return typeof session === "string" && session.startsWith("/") && !/[\u0000-\u001f\u007f]/.test(session);
}

/** The shell line typed into the root shell after Pi has quit: never a Pi slash command. */
export function resumeCommand(session) {
	return `pi --session '${session.replaceAll("'", "'\\''")}'`;
}

export function requestLine(address, guard, action, session = null) {
	return JSON.stringify({ v: 1, token: guard.token, pid: guard.pid, terminal: address, action, session }) + "\n";
}

/** Validates the guard's reply line; throws on a wrong identity, an unknown status or a refusal. */
export function checkReply(text, address, guard) {
	let reply;
	try { reply = JSON.parse(text); } catch { throw new Error("guard sent no reply; no terminal-input fallback"); }
	if (reply?.v !== 1 || reply.pid !== guard.pid || reply.terminal !== address) throw new Error("guard identity mismatch");
	if (reply.status === "error") throw new Error(reply.error || "guard refused the action");
	if (!["ready", "draft", "busy", "accepted"].includes(reply.status)) throw new Error("unexpected guard reply");
	return reply;
}

/** UTF-8 bytes to text without a text decoder, which the mod runtime lacks; throws on invalid UTF-8. */
export function decodeUtf8(bytes) {
	return decodeURIComponent(Array.from(bytes, (b) => `%${b.toString(16).padStart(2, "0")}`).join(""));
}

async function ask(io, address, guard, action, session) {
	return checkReply(await io.call(guard, requestLine(address, guard, action, session)), address, guard);
}

/** Polls `test` until it returns a value; null after `ms`. Errors from `test` end the wait. */
async function waitFor(io, ms, test) {
	const deadline = io.now() + ms;
	for (;;) {
		const value = await test();
		if (value) return value;
		if (io.now() >= deadline) return null;
		await io.sleep(POLL_MS);
	}
}

async function probeQuietly(io, address, guard) {
	try { return await ask(io, address, guard, "probe"); } catch { return null; }
}

/** Reloads one Pi: `{ outcome: "completed" | "drafts" | "busy" | skip }` or throws. */
export async function reloadOne(io, address) {
	const checked = checkTerminal(await io.get(address), address);
	if (checked.skip) return { outcome: checked.skip, note: checked.note };
	if (checked.error) throw new Error(checked.error);
	const { guard } = checked;
	const probe = await ask(io, address, guard, "probe");
	if (probe.status !== "ready") return { outcome: probe.status === "draft" ? "drafts" : "busy" };
	const reply = await ask(io, address, guard, "reload", probe.session);
	if (reply.status !== "accepted") return { outcome: reply.status === "draft" ? "drafts" : "busy" };
	// Accepted is not done: the replacement runtime must publish a new label and answer on it.
	const done = await waitFor(io, RELOAD_MS, async () => {
		const next = parseGuard((await io.get(address)).labels);
		return next && next.token !== guard.token && next.pid === guard.pid && (await probeQuietly(io, address, next));
	});
	if (!done) throw new Error("reload did not confirm a new guard runtime");
	return { outcome: "completed" };
}

/** Restarts one Pi in its root shell: `{ outcome, guard?, session? }` or throws. */
export async function resetOne(io, address) {
	const t = await io.get(address);
	const checked = checkTerminal(t, address);
	if (checked.skip) return { outcome: checked.skip, note: checked.note };
	if (checked.error) throw new Error(checked.error);
	if (!restartable(t)) return { outcome: "notRestartable", note: "Pi is not a job of a POSIX shell; quitting would end the terminal" };
	const { guard } = checked;
	const probe = await ask(io, address, guard, "probe");
	if (probe.status !== "ready") return { outcome: probe.status === "draft" ? "drafts" : "busy" };
	if (!validSession(probe.session)) throw new Error("no resumable session file; not reset");
	const reply = await ask(io, address, guard, "quit", probe.session);
	if (reply.status !== "accepted") return { outcome: reply.status === "draft" ? "drafts" : "busy" };
	// Type the resume line only once the root shell is back in front, never into another program.
	const back = await waitFor(io, EXIT_MS, async () => {
		const now = await io.get(address);
		if (now.state !== "live") throw new Error("terminal ended after quit");
		return now.foreground?.pid === now.pid && !now.status;
	});
	if (!back) throw new Error("shell not back after quit; no start command sent");
	await io.send(address, resumeCommand(probe.session));
	const ready = await waitFor(io, READY_MS, async () => {
		const now = await io.get(address);
		const next = parseGuard(now.labels);
		if (now.status?.app !== "pi" || !SETTLED.includes(now.status.state) || !next || next.token === guard.token || !inForeground(next, now)) return null;
		const answer = await probeQuietly(io, address, next);
		return answer?.session === probe.session && next;
	});
	if (!ready) throw new Error("resumed Pi or its session not confirmed after 30s; not visited");
	return { outcome: "completed", guard: ready, session: probe.session };
}

function tally(summary, address, result, verb) {
	if (result.error) {
		summary.failed++;
		summary.errors.push(`${address}: ${result.error}`);
		summary.outcomes.push(`${address} failed`);
		return;
	}
	summary[result.outcome]++;
	const text = { completed: verb, drafts: "skipped (unsent draft left untouched)", busy: "skipped (busy)", notRestartable: "skipped (not restartable)" }[result.outcome];
	summary.outcomes.push(`${address} ${text ?? `skipped (${result.note})`}`);
}

async function settle(run) {
	try { return await run(); } catch (error) { return { error: error?.message ?? String(error) }; }
}

/** Reloads each candidate in turn. */
export async function reloadAll(io, candidates, summary = emptySummary()) {
	for (const [index, { address }] of candidates.entries()) {
		io.progress(index, candidates.length, `reloading ${address}`);
		tally(summary, address, await settle(() => reloadOne(io, address)), "reloaded");
	}
	return summary;
}

/**
 * Restarts every candidate at once and waits for every attempt; then visits, in candidate order, each restarted
 * Pi that was idle and is still safe, and restores the original focus if anything was visited.
 */
export async function resetAll(io, candidates, summary = emptySummary()) {
	let settled = 0;
	io.progress(0, candidates.length, "waiting for restart batch");
	const results = await Promise.all(candidates.map(async ({ address }) => {
		const result = await settle(() => resetOne(io, address));
		io.progress(++settled, candidates.length, "waiting for restart batch");
		return result;
	}));
	candidates.forEach(({ address }, index) => tally(summary, address, results[index], "restarted"));
	let visiting = false;
	for (const [index, { address, wasIdle }] of candidates.entries()) {
		const result = results[index];
		if (result.outcome !== "completed" || !wasIdle) continue;
		// The batch may have taken a while: never visit a Pi whose runtime, session, status or draft changed.
		const safe = await settle(async () => {
			const checked = checkTerminal(await io.get(address), address);
			if (!checked.guard || checked.guard.token !== result.guard.token) return false;
			const probe = await ask(io, address, checked.guard, "probe");
			return probe.status === "ready" && probe.session === result.session;
		});
		if (safe !== true) { summary.outcomes.push(`${address} not visited (no longer safe)`); continue; }
		io.progress(candidates.length, candidates.length, `viewing ${address}`);
		visiting = true;
		const focused = await settle(async () => { await io.focus(address); await io.sleep(VISIT_MS); return true; });
		if (focused === true) summary.visited++;
		else { summary.failed++; summary.errors.push(`${address}: could not visit (${focused.error})`); }
	}
	if (visiting) {
		io.progress(candidates.length, candidates.length, "returning to the original pane");
		const restored = await settle(async () => { await io.restore(); return true; });
		if (restored !== true) { summary.failed++; summary.errors.push(`could not restore the original focus (${restored.error})`); }
	}
	return summary;
}

/** The counts as shown after a run: completed, every skip kind and failed. */
export function summaryLines(summary, verb) {
	const lines = [`${verb}: ${summary.completed}`];
	if (verb === "Restarted") lines.push(`Visited: ${summary.visited}`);
	lines.push(`Skipped (drafts): ${summary.drafts}`, `Skipped (busy): ${summary.busy}`, `Skipped (not Pi): ${summary.notPi}`);
	if (summary.notRestartable) lines.push(`Skipped (not restartable): ${summary.notRestartable}`);
	if (summary.protected) lines.push(`Skipped (protected terminal): ${summary.protected}`);
	if (summary.remote) lines.push(`Skipped (another machine): ${summary.remote}`);
	lines.push(`Failed: ${summary.failed}`);
	return lines;
}

export function heading(summary) {
	if (summary.failed > 0) return "Completed with errors";
	return summary.completed > 0 ? "Success" : "Nothing to do";
}
