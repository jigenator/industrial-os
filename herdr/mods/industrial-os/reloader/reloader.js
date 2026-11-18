// Every Pi Reloader rule, with no gpui-kit or herdr import: which agents are candidates, the guard label and wire
// protocol (pi/reloader-guard/docs/contract.md), and the reload and reset sequences over an injected `io`.
// main.js supplies `io`: hc get and send, the guard socket, sleep, the clock and progress.

export const RELOADER_LABEL = "io.pi-reloader.v2";
export const POLL_MS = 250;
export const EXIT_MS = 15_000;
export const READY_MS = 30_000;
export const RELOAD_MS = 30_000;
const SETTLED = ["idle", "done"];
// Shells whose quoting resumeCommand uses; another root program is never quit.
const POSIX_SHELLS = ["sh", "bash", "zsh", "dash", "ksh"];
// Lunalee's chat terminal; also protected when no layout names it.
const LUNALEE_CHAT = "lunalee-chat";

/** The guard's label on a terminal: `{ port, token }`, or null when absent or malformed. */
export function parseGuard(labels) {
	const value = labels?.[RELOADER_LABEL];
	if (typeof value !== "string") return null;
	let guard;
	try { guard = JSON.parse(value); } catch { return null; }
	if (guard?.v !== 2 || !Number.isInteger(guard.port) || guard.port < 1 || guard.port > 65_535) return null;
	if (typeof guard.token !== "string" || !/^[0-9a-f]{32}$/.test(guard.token)) return null;
	return { port: guard.port, token: guard.token };
}

/** Every terminal a layout block shows (`content.terminal`, an address or a name), floating blocks included. */
export function layoutTerminals(node, found = new Set()) {
	if (!node || typeof node !== "object") return found;
	if (typeof node.content?.terminal === "string") found.add(node.content.terminal);
	for (const child of [...(node.children ?? []), ...(node.floating ?? [])]) layoutTerminals(child, found);
	return found;
}

/**
 * Splits Herdr's Pi agents into candidates (idle or done, in a pane on this computer, in agents() order) and counts
 * of the rest. Protected: no pane of its own, shown by a layout block, Lunalee's chat, or another machine.
 * `only`, when an array, limits everything to those addresses (an isolated live check); others are not counted.
 */
export function selectCandidates(agents, terminals, layout, only = null) {
	const shown = layoutTerminals(layout);
	const names = new Map(terminals.map((t) => [t.address, t.name]));
	const result = { candidates: [], busy: 0, protected: 0 };
	for (const agent of agents) {
		if (agent.app !== "pi" || (Array.isArray(only) && !only.includes(agent.address))) continue;
		const name = names.get(agent.address);
		if (agent.address.includes("/") || !agent.pane || shown.has(agent.address) || (name && shown.has(name)) || name === LUNALEE_CHAT) result.protected++;
		else if (!SETTLED.includes(agent.status)) result.busy++;
		else result.candidates.push({ address: agent.address, status: agent.status, where: `${agent.space_name} / ${agent.tab_name}`, title: agent.title });
	}
	return result;
}

/** One `hc get --json` record judged at action time: `{ guard }`, or `{ skip }` with nothing done; throws without a guard. */
export function checkTerminal(t, address) {
	if (t?.address !== address || t.state !== "live") return { skip: "no longer live" };
	if (t.name === LUNALEE_CHAT) return { skip: "Lunalee's terminal" };
	if (t.status?.app !== "pi") return { skip: "no longer Pi" };
	if (!SETTLED.includes(t.status.state)) return { skip: "busy" };
	const guard = parseGuard(t.labels);
	if (!guard) throw new Error("guard unavailable; reload that Pi once by hand from an empty editor");
	return { guard };
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

export function requestLine(guard, action, session = null) {
	return JSON.stringify({ v: 2, token: guard.token, action, session }) + "\n";
}

/** Validates the guard's reply line; throws on an unknown status or a refusal. */
export function checkReply(text) {
	let reply;
	try { reply = JSON.parse(text); } catch { throw new Error("guard sent no reply; no terminal-input fallback"); }
	if (reply?.v !== 2) throw new Error("unexpected guard reply");
	if (reply.status === "error") throw new Error(reply.error || "guard refused the action");
	if (!["ready", "draft", "busy", "accepted"].includes(reply.status)) throw new Error("unexpected guard reply");
	return reply;
}

/** UTF-8 bytes to text without a text decoder, which the mod runtime lacks; throws on invalid UTF-8. */
export function decodeUtf8(bytes) {
	return decodeURIComponent(Array.from(bytes, (b) => `%${b.toString(16).padStart(2, "0")}`).join(""));
}

async function ask(io, guard, action, session) {
	return checkReply(await io.call(guard, requestLine(guard, action, session)));
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

async function probeQuietly(io, guard) {
	try { return await ask(io, guard, "probe"); } catch { return null; }
}

/** Probes, then asks for `action` once the guard is ready: `{ session }`, or `{ skip }` for a draft or a busy Pi. */
async function request(io, guard, action, check = () => {}) {
	const skip = (status) => ({ skip: status === "draft" ? "unsent draft left untouched" : "busy" });
	const probe = await ask(io, guard, "probe");
	if (probe.status !== "ready") return skip(probe.status);
	check(probe.session);
	const reply = await ask(io, guard, action, probe.session);
	return reply.status === "accepted" ? { session: probe.session } : skip(reply.status);
}

/** Reloads one Pi through Pi's own reload, confirmed by a replacement guard runtime: `{}` or `{ skip }`; throws. */
export async function reloadOne(io, { address }) {
	const checked = checkTerminal(await io.get(address), address);
	if (checked.skip) return checked;
	const { guard } = checked;
	const asked = await request(io, guard, "reload");
	if (asked.skip) return asked;
	const done = await waitFor(io, RELOAD_MS, async () => {
		const next = parseGuard((await io.get(address)).labels);
		return next && next.token !== guard.token && (await probeQuietly(io, next));
	});
	if (!done) throw new Error("reload did not confirm a new guard runtime");
	return {};
}

/** Quits one Pi and resumes its session in the same root shell: `{}` or `{ skip }`; throws. */
export async function resetOne(io, { address }) {
	const t = await io.get(address);
	const checked = checkTerminal(t, address);
	if (checked.skip) return checked;
	if (!restartable(t)) return { skip: "not a job of a POSIX shell; quitting would end the terminal" };
	const { guard } = checked;
	const asked = await request(io, guard, "quit", (session) => {
		if (!validSession(session)) throw new Error("no resumable session file; not reset");
	});
	if (asked.skip) return asked;
	const { session } = asked;
	// Type the resume line only once the root shell is back in front, never into another program.
	const back = await waitFor(io, EXIT_MS, async () => {
		const now = await io.get(address);
		if (now.state !== "live") throw new Error("terminal ended after quit");
		return now.foreground?.pid === now.pid && !now.status;
	});
	if (!back) throw new Error("shell not back after quit; no start command sent");
	await io.send(address, resumeCommand(session));
	const ready = await waitFor(io, READY_MS, async () => {
		const now = await io.get(address);
		const next = parseGuard(now.labels);
		if (now.status?.app !== "pi" || !SETTLED.includes(now.status.state) || !next || next.token === guard.token) return null;
		return (await probeQuietly(io, next))?.session === session;
	});
	if (!ready) throw new Error("resumed Pi or its session not confirmed after 30s");
	return {};
}

/** Runs `one` on every candidate at once and waits for every attempt: `{ completed, skipped, failed, outcomes }`. */
export async function runAll(io, candidates, one, verb) {
	let settled = 0;
	io.progress(0, candidates.length);
	const results = await Promise.all(candidates.map(async (candidate) => {
		let result;
		try { result = await one(io, candidate); } catch (error) { result = { error: error?.message ?? String(error) }; }
		io.progress(++settled, candidates.length);
		return result;
	}));
	const summary = { completed: 0, skipped: 0, failed: 0, outcomes: [] };
	candidates.forEach(({ address }, index) => {
		const { skip, error } = results[index];
		if (error) { summary.failed++; summary.outcomes.push(`${address} failed: ${error}`); }
		else if (skip) { summary.skipped++; summary.outcomes.push(`${address} skipped (${skip})`); }
		else { summary.completed++; summary.outcomes.push(`${address} ${verb.toLowerCase()}`); }
	});
	return summary;
}

export function heading(summary) {
	if (summary.failed > 0) return "Completed with errors";
	return summary.completed > 0 ? "Success" : "Nothing to do";
}
