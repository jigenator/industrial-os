// Checks the pi-reloader mod's pure rules (reloader.js): candidate selection and protection, the guard label and
// wire checks, and the reload and reset sequences against a simulated herdr-core and guard. No Herdr, Pi or socket.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
	LABEL, checkReply, checkTerminal, decodeUtf8, heading, layoutTerminals, parseGuard, reloadAll, requestLine,
	resetAll, restartable, resumeCommand, selectCandidates, summaryLines, validSession,
} from "../mods/pi-reloader/reloader.js";

const MOD = new URL("../mods/pi-reloader/", import.meta.url);
const TOKEN = (n) => n.toString(16).padStart(32, "0");
const label = (port, token, pid, ppid = 1) => ({ [LABEL]: JSON.stringify({ v: 1, port, token, pid, ppid }) });

// A simulated machine: herdr-core terminals with a shell root and a guarded Pi job under a launcher shim (as volta
// runs it; `noShim`: Pi itself in front; `rootPi`: Pi as the root program), answering like the guard
// (pi/reloader-guard/docs/contract.md). Effects of reload and quit land after `delay` ms of simulated time.
function world(specs, { delay = 500 } = {}) {
	let clock = 0, next = 1;
	const events = [], log = [];
	const terms = new Map();
	const later = (ms, run) => events.push({ at: clock + ms, run });
	function startPi(t, session) {
		const port = 40_000 + next, token = TOKEN(next), shim = 1_000 + next++;
		const pid = t.spec.rootPi ? t.pid : t.spec.noShim ? shim : shim + 500;
		const front = t.spec.rootPi ? t.pid : shim;
		t.pi = { port, token, pid, ppid: t.spec.noShim ? t.pid : front, session, editor: "", busy: false, ...t.spec.pi, ...(t.restarts++ ? t.spec.after : {}) };
		t.foreground = { pid: front, argv: ["node", "/bin/pi"] };
		t.status = { app: "pi", state: t.spec.status ?? "idle" };
		t.labels = t.spec.noGuard ? {} : label(port, token, t.pi.pid, t.pi.ppid);
	}
	for (const [address, spec] of Object.entries(specs)) {
		const t = { address, spec, state: "live", name: spec.name ?? null, argv: spec.argv ?? ["/bin/zsh", "-l"], pid: 100 + next, restarts: 0 };
		startPi(t, spec.session ?? `/sessions/${address}.jsonl`);
		terms.set(address, t);
	}
	const snapshot = (t) => structuredClone({ address: t.address, state: t.state, name: t.name, argv: t.argv, pid: t.pid, foreground: t.foreground, status: t.status, labels: t.labels });
	const io = {
		now: () => clock,
		async sleep(ms) {
			clock += ms;
			for (const e of events.splice(0).sort((a, b) => a.at - b.at)) e.at <= clock ? e.run() : events.push(e);
		},
		progress: (done, total, note) => log.push(`progress ${done}/${total} ${note}`),
		async get(address) { return snapshot(terms.get(address)); },
		async call(guard, line) {
			const t = [...terms.values()].find((x) => x.pi?.port === guard.port && x.labels[LABEL]);
			if (!t || t.spec.unresponsive) throw new Error("connect refused");
			const req = JSON.parse(line);
			log.push(`${req.action} ${t.address}`);
			const reply = (status, error) => JSON.stringify({ v: 1, pid: t.pi.pid, terminal: t.address, session: t.pi.session, status, error }) + "\n";
			if (req.token !== t.pi.token || req.pid !== t.pi.pid || req.terminal !== t.address) return reply("error", "Guard identity/session mismatch");
			if (req.action !== "probe" && req.session !== t.pi.session) return reply("error", "Guard identity/session mismatch");
			const status = t.pi.busy ? "busy" : t.pi.editor ? "draft" : "ready";
			if (req.action === "probe" || status !== "ready") return reply(status);
			const pi = t.pi;
			if (req.action === "reload" && !t.spec.reloadHangs) later(delay, () => { if (t.pi === pi) { t.pi.token = TOKEN(next++); t.labels = label(pi.port, t.pi.token, pi.pid, pi.ppid); } });
			if (req.action === "quit") later(delay, () => {
				t.pi = null; t.labels = {};
				if (t.spec.rootPi) { t.state = "finished"; return; }
				if (!t.spec.shellStuck) { t.foreground = { pid: t.pid, argv: t.argv }; t.status = null; }
			});
			return reply("accepted");
		},
		async send(address, text) {
			const t = terms.get(address);
			log.push(`send ${address} ${text}`);
			assert.equal(t.foreground.pid, t.pid, "typed only into the root shell");
			const session = t.spec.resumeSession ?? text.match(/^pi --session '(.*)'$/s)[1].replaceAll("'\\''", "'");
			later(delay, () => startPi(t, session));
		},
		async focus(address) { log.push(`focus ${address}`); },
		async restore() { log.push("restore"); },
	};
	return { io, log, terms, set: (address, fields) => Object.assign(terms.get(address).pi, fields) };
}

const agent = (address, status = "idle", app = "pi") => ({ address, pane: `p-${address}`, status, app, space_name: "reloader-test", tab_name: "1", title: `π - ${address}` });
const candidates = (...pairs) => pairs.map(([address, status = "idle"]) => ({ address, wasIdle: status === "idle" }));

test("selection: idle or done Pi in a pane on this computer, in agents() order; every other agent is a counted skip", () => {
	const layout = { id: "root", children: [{ id: "chat", content: { terminal: "lunalee-chat" } }, { id: "side", children: [{ content: { terminal: "t9" } }] }], floating: [{ content: { terminal: "named-pi" } }] };
	const agents = [agent("t1"), agent("t2", "done"), agent("t3", "working"), agent("t4", "blocked"), agent("t5", "idle", "claude-code"), agent("vps/t6"), agent("t9"), agent("t7"), agent("t8"), { ...agent("t10"), pane: "" }];
	const terminals = [{ address: "t7", name: "named-pi" }, { address: "t8", name: "lunalee-chat" }];
	const { candidates: picked, skipped } = selectCandidates(agents, terminals, layout);
	assert.deepEqual(picked.map((c) => [c.address, c.wasIdle]), [["t1", true], ["t2", false]]);
	assert.deepEqual(picked[0].where, "reloader-test / 1");
	assert.deepEqual([skipped.busy, skipped.notPi, skipped.remote, skipped.protected], [2, 1, 1, 4]);
});

test("selection: a test scope acts only on its addresses and counts nothing else", () => {
	const { candidates: picked, skipped } = selectCandidates([agent("t1"), agent("t2"), agent("t3", "working"), agent("t4", "idle", "codex")], [], null, ["t2", "t3"]);
	assert.deepEqual(picked.map((c) => c.address), ["t2"]);
	assert.deepEqual([skipped.busy, skipped.notPi], [1, 0]);
	assert.deepEqual(selectCandidates([agent("t1")], [], null, []).candidates, []);
});

test("layoutTerminals finds terminal blocks at any depth, floating ones too", () => {
	assert.deepEqual([...layoutTerminals({ children: [{ children: [{ content: { terminal: "a" } }] }, { content: { mod: "x" } }], floating: [{ content: { terminal: "b" } }] })], ["a", "b"]);
	assert.deepEqual([...layoutTerminals(null)], []);
});

test("the guard label: version 1 with a port, a 32-hex token and a pid; anything else is no guard", () => {
	assert.deepEqual(parseGuard(label(4000, TOKEN(1), 12, 11)), { port: 4000, token: TOKEN(1), pid: 12, ppid: 11 });
	for (const bad of [undefined, {}, { [LABEL]: "{" }, { [LABEL]: "null" }, label(0, TOKEN(1), 1), label(70_000, TOKEN(1), 1), label(4000, "short", 1), label(4000, TOKEN(1), 0), label(4000, TOKEN(1), 12, 0), { [LABEL]: JSON.stringify({ v: 2, port: 1, token: TOKEN(1), pid: 1, ppid: 1 }) }]) {
		assert.equal(parseGuard(bad), null, JSON.stringify(bad));
	}
});

test("checkTerminal: only a live, settled Pi that is, or whose launcher is, the foreground process", () => {
	const base = { address: "t1", state: "live", name: null, pid: 10, foreground: { pid: 20 }, status: { app: "pi", state: "idle" }, labels: label(4000, TOKEN(1), 20, 10) };
	assert.ok(checkTerminal(base, "t1").guard);
	assert.ok(checkTerminal({ ...base, labels: label(4000, TOKEN(1), 21, 20) }, "t1").guard, "under a launcher shim");
	assert.ok(checkTerminal({ ...base, foreground: { pid: 10 }, labels: label(4000, TOKEN(1), 10, 1) }, "t1").guard, "Pi as the root program");
	assert.match(checkTerminal({ ...base, foreground: { pid: 10 }, labels: label(4000, TOKEN(1), 21, 10) }, "t1").error, /not the guarded Pi/, "a Pi job behind the shell");
	assert.equal(checkTerminal({ ...base, state: "finished" }, "t1").skip, "notPi");
	assert.equal(checkTerminal({ ...base, name: "lunalee-chat" }, "t1").skip, "protected");
	assert.equal(checkTerminal({ ...base, status: null }, "t1").skip, "notPi");
	assert.equal(checkTerminal({ ...base, status: { app: "pi", state: "working" } }, "t1").skip, "busy");
	assert.match(checkTerminal({ ...base, labels: {} }, "t1").error, /guard unavailable/);
	assert.match(checkTerminal({ ...base, foreground: { pid: 21 } }, "t1").error, /not the guarded Pi/);
	assert.equal(checkTerminal(base, "t2").skip, "notPi");
});

test("restartable: Pi is a job of a POSIX shell root, never the root program itself", () => {
	const t = { argv: ["/bin/zsh", "-l"], pid: 10, foreground: { pid: 20 } };
	assert.equal(restartable(t), true);
	assert.equal(restartable({ ...t, argv: ["-bash"] }), true);
	assert.equal(restartable({ ...t, foreground: { pid: 10 } }), false);
	assert.equal(restartable({ ...t, argv: ["/opt/homebrew/bin/fish"] }), false);
	assert.equal(restartable({ ...t, argv: ["/usr/local/bin/pi"] }), false);
});

test("the resume line single-quotes the session; sessions with control characters are refused", () => {
	assert.equal(resumeCommand("/s/it's here.jsonl"), "pi --session '/s/it'\\''s here.jsonl'");
	assert.equal(validSession("/s/a b.jsonl"), true);
	for (const bad of [null, "", "relative.jsonl", "/s/a\nb", "/s/\u0007"]) assert.equal(validSession(bad), false);
});

test("requests carry token, pid and terminal; replies must match them", () => {
	const guard = { port: 4000, token: TOKEN(3), pid: 20 };
	assert.deepEqual(JSON.parse(requestLine("t1", guard, "quit", "/s")), { v: 1, token: TOKEN(3), pid: 20, terminal: "t1", action: "quit", session: "/s" });
	const ok = JSON.stringify({ v: 1, pid: 20, terminal: "t1", session: "/s", status: "ready" });
	assert.equal(checkReply(ok, "t1", guard).status, "ready");
	assert.throws(() => checkReply(ok, "t2", guard), /identity/);
	assert.throws(() => checkReply(JSON.stringify({ v: 1, pid: 21, terminal: "t1", status: "ready" }), "t1", guard), /identity/);
	assert.throws(() => checkReply(JSON.stringify({ v: 1, pid: 20, terminal: "t1", status: "error", error: "nope" }), "t1", guard), /nope/);
	assert.throws(() => checkReply(JSON.stringify({ v: 1, pid: 20, terminal: "t1", status: "done" }), "t1", guard), /unexpected/);
	assert.throws(() => checkReply("", "t1", guard), /no reply/);
});

test("decodeUtf8 decodes multibyte text and rejects invalid bytes", () => {
	assert.equal(decodeUtf8([...Buffer.from('{"s":"/会话/π é.jsonl"}')]), '{"s":"/会话/π é.jsonl"}');
	assert.throws(() => decodeUtf8([0xc3]));
});

test("reload: idle reloads and is confirmed by a new guard runtime; drafts and busy are skipped untouched", async () => {
	const w = world({ t1: {}, t2: { pi: { editor: "unsent words" } }, t3: { pi: { busy: true } }, t4: { status: "done" } });
	const summary = await reloadAll(w.io, candidates(["t1"], ["t2"], ["t3"], ["t4", "done"]));
	assert.deepEqual([summary.completed, summary.drafts, summary.busy, summary.failed], [2, 1, 1, 0]);
	assert.equal(w.log.filter((l) => l.startsWith("reload ")).join(), "reload t1,reload t4");
	assert.equal(w.terms.get("t2").pi.editor, "unsent words");
	assert.ok(!w.log.some((l) => l.startsWith("send")), "reload never types");
	assert.deepEqual(summary.outcomes, ["t1 reloaded", "t2 skipped (unsent draft left untouched)", "t3 skipped (busy)", "t4 reloaded"]);
});

test("reload fails closed: no guard, an unresponsive guard, or no replacement runtime", async () => {
	const w = world({ t1: { noGuard: true }, t2: { unresponsive: true }, t3: { reloadHangs: true } });
	const summary = await reloadAll(w.io, candidates(["t1"], ["t2"], ["t3"]));
	assert.deepEqual([summary.completed, summary.failed], [0, 3]);
	assert.match(summary.errors[0], /^t1: guard unavailable/);
	assert.match(summary.errors[1], /^t2: connect refused/);
	assert.match(summary.errors[2], /^t3: reload did not confirm/);
	assert.ok(!w.log.some((l) => l.startsWith("send")));
});

test("reset: quits every candidate at once, resumes each session in its shell, visits idle ones in order, restores focus", async () => {
	const w = world({ t1: { session: "/s/it's.jsonl" }, t2: { status: "done" }, t3: {}, t4: { pi: { editor: "draft" } } });
	const summary = await resetAll(w.io, candidates(["t1"], ["t2", "done"], ["t3"], ["t4"]));
	assert.deepEqual([summary.completed, summary.visited, summary.drafts, summary.failed], [3, 2, 1, 0], summary.errors.join());
	const quits = w.log.map((l, i) => l.startsWith("quit") && i).filter(Number.isInteger);
	assert.ok(quits.length === 3 && quits.every((i) => i < w.log.findIndex((l) => l.startsWith("send"))), "every quit precedes the first resume");
	assert.deepEqual(w.log.filter((l) => l.startsWith("send")).sort(), ["send t1 pi --session '/s/it'\\''s.jsonl'", "send t2 pi --session '/sessions/t2.jsonl'", "send t3 pi --session '/sessions/t3.jsonl'"]);
	assert.deepEqual(w.log.filter((l) => /^(focus|restore)/.test(l)), ["focus t1", "focus t3", "restore"]);
	assert.equal(w.terms.get("t4").pi.editor, "draft");
	assert.equal(w.terms.get("t1").pi.session, "/s/it's.jsonl");
	assert.deepEqual(w.log.slice(-2), ["progress 4/4 returning to the original pane", "restore"]);
});

test("reset never quits a Pi that would end its terminal, and fails closed without typing when the shell is not back", async () => {
	const w = world({ t1: { rootPi: true }, t2: { argv: ["/usr/bin/fish"] }, t3: { shellStuck: true } });
	const summary = await resetAll(w.io, candidates(["t1"], ["t2"], ["t3"]));
	assert.deepEqual([summary.completed, summary.notRestartable, summary.failed], [0, 2, 1]);
	assert.deepEqual(w.log.filter((l) => l.startsWith("quit")), ["quit t3"]);
	assert.ok(!w.log.some((l) => /^(send|focus|restore)/.test(l)));
	assert.match(summary.errors[0], /^t3: shell not back after quit; no start command sent/);
});

test("reset: a resumed Pi on another session fails and is not visited; nothing is visited when no idle Pi restarted", async () => {
	const w = world({ t1: { resumeSession: "/sessions/other.jsonl" }, t2: { status: "done" } });
	const summary = await resetAll(w.io, candidates(["t1"], ["t2", "done"]));
	assert.deepEqual([summary.completed, summary.visited, summary.failed], [1, 0, 1]);
	assert.match(summary.errors[0], /^t1: resumed Pi or its session not confirmed/);
	assert.ok(!w.log.some((l) => /^(focus|restore)/.test(l)));
});

test("reset: a Pi that gains a draft after its restart is not visited", async () => {
	const w = world({ t1: {}, t2: { after: { editor: "typed after restart" } } });
	const summary = await resetAll(w.io, candidates(["t1"], ["t2"]));
	assert.deepEqual([summary.completed, summary.visited], [2, 1]);
	assert.ok(summary.outcomes.includes("t2 not visited (no longer safe)"));
	assert.deepEqual(w.log.filter((l) => /^(focus|restore)/.test(l)), ["focus t1", "restore"]);
});

test("summary lines report completed, every skip kind present and failed", () => {
	const summary = { completed: 1, visited: 1, drafts: 2, busy: 0, notPi: 3, notRestartable: 1, protected: 0, remote: 1, failed: 0, errors: [], outcomes: [] };
	assert.deepEqual(summaryLines(summary, "Restarted"), ["Restarted: 1", "Visited: 1", "Skipped (drafts): 2", "Skipped (busy): 0", "Skipped (not Pi): 3", "Skipped (not restartable): 1", "Skipped (another machine): 1", "Failed: 0"]);
	assert.ok(summaryLines({ ...summary, protected: 2 }, "Reloaded").includes("Skipped (protected terminal): 2"));
	assert.equal(summaryLines(summary, "Reloaded")[1], "Skipped (drafts): 2");
	assert.equal(heading(summary), "Success");
	assert.equal(heading({ ...summary, completed: 0 }), "Nothing to do");
	assert.equal(heading({ ...summary, failed: 1 }), "Completed with errors");
});

test("the mod folder: imports stay inside it, the pure modules import nothing, no missing runtime globals", async () => {
	const files = (await readdir(MOD)).filter((f) => f.endsWith(".js"));
	assert.deepEqual(files.sort(), ["main.js", "reloader.js", "scope.js"]);
	for (const file of files) {
		const source = await readFile(new URL(file, MOD), "utf8");
		const specifiers = [...source.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
		const allowed = file === "main.js" ? ["gpui-kit", "gpui-base", "herdr", "net"] : [];
		for (const specifier of specifiers) assert.ok(allowed.includes(specifier) || /^\.\/[\w-]+\.js$/.test(specifier), `${file} imports ${specifier}`);
		assert.doesNotMatch(source, /\b(setTimeout|setInterval|Intl\.|TextDecoder|WebSocket|require\()/, file);
		assert.doesNotMatch(source, /#[0-9a-f]{6}\b/i, `${file} holds a color value`);
	}
	assert.equal((await import("../mods/pi-reloader/scope.js")).ONLY, null, "the shipped scope acts on every eligible Pi");
	assert.deepEqual(JSON.parse(await readFile(new URL("mod.json", MOD), "utf8")), { place: "none", title: "Pi Reloader", overlay: { kind: "window", width: 620, height: 460 } });
});
