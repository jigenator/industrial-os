// Runs the real guard against a stub Pi and a fake `hc`, over its real loopback socket.
// No Pi host, Herdr or live terminal is used.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { COMMAND, LABEL, reloaderGuard } from "../src/extension.ts";

type Request = Record<string, unknown>;
const SESSION = join(mkdtempSync(join(tmpdir(), "reloader-guard-")), "a b.jsonl");
writeFileSync(SESSION, "{}\n");

function harness(options: { editor?: string; idle?: boolean; queued?: boolean; hcOk?: boolean } = {}) {
	const handlers: Record<string, (event: any, ctx: any) => any> = {};
	const commands: Record<string, (args: string, ctx: any) => Promise<void>> = {};
	const hcCalls: string[][] = [];
	const sent: string[] = [];
	const calls: string[] = [];
	let onDispatch = () => {};
	const ctx = {
		mode: "tui",
		editor: options.editor ?? "",
		idle: options.idle ?? true,
		session: SESSION as string | undefined,
		isIdle: () => ctx.idle,
		hasPendingMessages: () => options.queued ?? false,
		ui: { getEditorText: () => ctx.editor, notify: (text: string) => calls.push(`notify ${text}`) },
		sessionManager: { getSessionFile: () => ctx.session },
		reload: async () => { calls.push("reload"); },
		shutdown: () => { calls.push("shutdown"); },
	};
	const pi = {
		on: (name: string, handler: any) => { handlers[name] = handler; },
		registerCommand: (name: string, command: any) => { commands[name] = command.handler; },
		getCommands: () => Object.keys(commands).map((name) => ({ name, source: "extension" })),
		sendUserMessage: (text: string, opts: any) => {
			sent.push(text);
			assert.deepEqual(opts, { expandPromptTemplates: true });
			const [slash, dispatch] = text.split(" ");
			onDispatch();
			setImmediate(() => void commands[slash.slice(1)](dispatch, ctx));
		},
	};
	reloaderGuard(pi as any, async (args) => { hcCalls.push(args); return options.hcOk ?? true; }, "t9");
	const label = () => JSON.parse(hcCalls[0][2].slice(LABEL.length + 1));
	const request = (fields: Request = {}) => ({ v: 1, token: label().token, pid: process.pid, terminal: "t9", action: "probe", session: ctx.session, ...fields });
	async function send(body: Request | string) {
		return new Promise<any>((resolve, reject) => {
			const socket = connect(label().port, "127.0.0.1", () => socket.write((typeof body === "string" ? body : JSON.stringify(body)) + "\n"));
			let text = "";
			socket.setEncoding("utf8");
			socket.on("data", (d) => { text += d; });
			socket.on("error", reject);
			socket.on("close", () => resolve(text ? JSON.parse(text) : null));
		});
	}
	return { handlers, hcCalls, sent, calls, ctx, label, request, send, start: () => handlers.session_start({}, ctx), dispatching: (f: () => void) => { onDispatch = f; } };
}

test("publishes the loopback port, a fresh token, its pid and parent pid as the io.pi-reloader.v1 label on its own terminal", async (t) => {
	const h = harness();
	await h.start();
	t.after(() => h.handlers.session_shutdown({ reason: "quit" }, h.ctx));
	assert.equal(h.hcCalls[0][0], "label");
	assert.equal(h.hcCalls[0][1], "t9");
	const label = h.label();
	assert.deepEqual(Object.keys(label).sort(), ["pid", "port", "ppid", "token", "v"]);
	assert.equal(label.v, 1);
	assert.equal(label.pid, process.pid);
	assert.equal(label.ppid, process.ppid);
	assert.match(label.token, /^[0-9a-f]{32}$/);
});

test("probe reports ready, draft or busy and never exposes the draft text", async (t) => {
	for (const [options, status] of [[{}, "ready"], [{ editor: "secret draft" }, "draft"], [{ editor: " " }, "draft"], [{ idle: false }, "busy"], [{ queued: true }, "busy"]] as const) {
		const h = harness(options);
		await h.start();
		const reply = await h.send(h.request());
		assert.deepEqual(reply, { v: 1, pid: process.pid, terminal: "t9", session: SESSION, status });
		assert.doesNotMatch(JSON.stringify(reply), /secret/);
		assert.deepEqual(h.sent, []);
		await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
	}
	t.diagnostic("five editor/queue states checked");
});

test("rejects a wrong token, pid, terminal, action or session without acting", async () => {
	const h = harness();
	await h.start();
	for (const bad of [{ token: "0".repeat(32) }, { token: undefined }, { pid: process.pid + 1 }, { terminal: "t1" }, { action: "submit" }, { action: "reload", session: "/sessions/other.jsonl" }, { action: "quit", session: null }, { v: 2 }]) {
		const reply = await h.send(h.request(bad));
		assert.equal(reply.status, "error", JSON.stringify(bad));
	}
	assert.equal((await h.send("not json")).status, "error");
	assert.deepEqual(h.sent, []);
	assert.deepEqual(h.calls, []);
	await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
});

test("reload is accepted only when ready, through the registered command, and calls Pi's reload", async () => {
	const h = harness();
	await h.start();
	const reply = await h.send(h.request({ action: "reload" }));
	assert.equal(reply.status, "accepted");
	assert.equal(h.sent.length, 1);
	assert.match(h.sent[0], new RegExp(`^/${COMMAND} [0-9a-f]{32}$`));
	await new Promise((r) => setImmediate(r));
	assert.deepEqual(h.calls, ["reload"]);
	// A reload keeps the label for the next runtime to overwrite.
	await h.handlers.session_shutdown({ reason: "reload" }, h.ctx);
	assert.equal(h.hcCalls.length, 1);
});

test("a draft typed between the request and the command is skipped, not reloaded", async () => {
	const h = harness();
	await h.start();
	h.dispatching(() => { h.ctx.editor = "typed meanwhile"; }); // after the socket check, before the command runs
	assert.equal((await h.send(h.request({ action: "quit" }))).status, "draft");
	assert.equal(h.sent.length, 1);
	assert.deepEqual(h.calls, []);
	await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
});

test("draft and busy actions are refused before dispatch", async () => {
	for (const [options, status] of [[{ editor: "x" }, "draft"], [{ idle: false }, "busy"]] as const) {
		const h = harness(options);
		await h.start();
		assert.equal((await h.send(h.request({ action: "quit" }))).status, status);
		assert.deepEqual(h.sent, []);
		await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
	}
});

test("quit shuts Pi down, and a quit shutdown clears the label", async () => {
	const h = harness();
	await h.start();
	assert.equal((await h.send(h.request({ action: "quit" }))).status, "accepted");
	await new Promise((r) => setImmediate(r));
	assert.deepEqual(h.calls, ["shutdown"]);
	await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
	assert.deepEqual(h.hcCalls[1], ["label", "t9", `${LABEL}=`]);
});

test("a session whose file Pi has not written yet reports no session", async () => {
	const h = harness();
	h.ctx.session = join(tmpdir(), "reloader-guard-missing", "new.jsonl");
	await h.start();
	assert.equal((await h.send(h.request())).session, null);
	h.ctx.session = undefined;
	assert.equal((await h.send(h.request())).session, null);
	await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
});

test("the internal command typed as input is swallowed", () => {
	const h = harness();
	assert.deepEqual(h.handlers.input({ text: `/${COMMAND} abc` }), { action: "handled" });
	assert.equal(h.handlers.input({ text: "/reload" }), undefined);
});

test("outside a Herdr desktop terminal, or outside the TUI, nothing listens or is published", async () => {
	const h = harness();
	h.ctx.mode = "rpc";
	await h.start();
	assert.deepEqual(h.hcCalls, []);
	const handlers: Record<string, any> = {};
	const calls: string[][] = [];
	reloaderGuard({ on: (n: string, f: any) => { handlers[n] = f; }, registerCommand() {} } as any, async (a) => { calls.push(a); return true; }, "");
	await handlers.session_start({}, { ...h.ctx, mode: "tui" });
	assert.deepEqual(calls, []);
});

test("a failed label publication warns", async () => {
	const h = harness({ hcOk: false });
	await h.start();
	assert.match(h.calls[0], /^notify Pi Reloader guard unavailable/);
	await h.handlers.session_shutdown({ reason: "quit" }, h.ctx);
	assert.equal(h.hcCalls.length, 1); // nothing published, nothing to clear
});
