import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// The draft guard for the Herdr desktop Pi Reloader mod. Its wire protocol is docs/contract.md.
// No editor writes or terminal input: drafts stay in place, including the cursor position.
export const LABEL = "io.pi-reloader.v2";
export const COMMAND = "pi-reloader-guard-control";
const ACTIONS = ["probe", "reload", "quit"];
const HC_TIMEOUT_MS = 2_000;

/** Runs `hc <args>`; resolves true only on exit 0 within the timeout. Never rejects. */
export type RunHc = (args: string[]) => Promise<boolean>;

export const runHc: RunHc = (args) => new Promise((resolve) => {
	let child: ReturnType<typeof spawn>;
	try { child = spawn("hc", args, { stdio: "ignore" }); } catch { resolve(false); return; }
	const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(false); }, HC_TIMEOUT_MS);
	timer.unref();
	child.on("error", () => { clearTimeout(timer); resolve(false); });
	child.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
});

export function reloaderGuard(pi: ExtensionAPI, hc: RunHc = runHc, terminal = process.env.HC_TERMINAL_ID) {
	let server: Server | undefined;
	let token = "";
	let closing = false;
	let published = false;
	let pending: { socket: Socket; request: any; dispatch: string } | undefined;

	// Pi writes a new session's file only with its first entry; until then there is nothing to resume.
	const sessionOf = (ctx: ExtensionContext) => {
		const file = ctx.sessionManager.getSessionFile();
		return file && existsSync(file) ? file : null;
	};

	function state(ctx: ExtensionContext) {
		if (closing || !ctx.isIdle() || ctx.hasPendingMessages()) return "busy";
		return ctx.ui.getEditorText() === "" ? "ready" : "draft";
	}

	function reply(socket: Socket, ctx: ExtensionContext, status: string, error?: string) {
		socket.end(JSON.stringify({ v: 2, session: sessionOf(ctx), status, error }) + "\n");
	}

	function sameToken(value: unknown) {
		if (typeof value !== "string" || value.length !== token.length) return false;
		return timingSafeEqual(Buffer.from(value), Buffer.from(token));
	}

	function validate(request: any, ctx: ExtensionContext) {
		if (!request || request.v !== 2 || !sameToken(request.token) || !ACTIONS.includes(request.action) ||
			(request.action !== "probe" && request.session !== sessionOf(ctx))) {
			throw new Error("Guard token/session mismatch; no action taken");
		}
	}

	// Fail closed if a host version ever routes the internal command as ordinary input.
	pi.on("input", (event) => {
		if (event.text === `/${COMMAND}` || event.text.startsWith(`/${COMMAND} `)) return { action: "handled" };
	});

	// Dispatching a registered command is the only way to obtain ExtensionCommandContext.reload().
	// The command text never enters the editor.
	pi.registerCommand(COMMAND, {
		description: "Internal draft-safe control for the Herdr desktop Pi Reloader",
		handler: async (dispatch, ctx) => {
			if (!pending || dispatch !== pending.dispatch) return;
			const { socket, request } = pending;
			pending = undefined;
			if (socket.destroyed || socket.writableEnded) return;
			try {
				validate(request, ctx);
				const status = state(ctx); // Recheck immediately before the native action.
				if (status !== "ready") { reply(socket, ctx, status); return; }
				closing = true;
				reply(socket, ctx, "accepted");
				// No await between the final draft check and Pi's native API.
				if (request.action === "quit") { ctx.shutdown(); return; }
				await ctx.reload();
				return; // The old runtime must not be used after reload.
			} catch {
				// The caller verifies an accepted action (a new label, or Pi gone); never type a fallback.
				socket.destroy();
			}
		},
	});

	function serve(socket: Socket, ctx: ExtensionContext) {
		socket.setEncoding("utf8");
		socket.setTimeout(3_000, () => socket.destroy());
		socket.on("error", () => socket.destroy());
		let input = "";
		let handled = false;
		socket.on("data", (data) => {
			if (handled) return;
			input += data;
			if (Buffer.byteLength(input) > 4_096) { socket.destroy(); return; }
			if (!input.includes("\n")) return;
			handled = true;
			try {
				const request = JSON.parse(input);
				validate(request, ctx);
				const status = pending ? "busy" : state(ctx);
				if (request.action === "probe" || status !== "ready") { reply(socket, ctx, status); return; }
				if (!pi.getCommands().some((item) => item.name === COMMAND && item.source === "extension")) {
					throw new Error("Guard command unavailable; no action taken");
				}
				const dispatch = randomBytes(16).toString("hex");
				pending = { socket, request, dispatch };
				pi.sendUserMessage(`/${COMMAND} ${dispatch}`, { expandPromptTemplates: true });
			} catch (error) {
				if (pending?.socket === socket) pending = undefined;
				try { reply(socket, ctx, "error", String(error)); } catch { socket.destroy(); }
			}
		});
		socket.on("close", () => { if (pending?.socket === socket) pending = undefined; });
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui" || !terminal || server) return;
		token = randomBytes(16).toString("hex");
		closing = false;
		try {
			const listening = createServer((socket) => serve(socket, ctx));
			server = listening;
			await new Promise<void>((resolve, reject) => {
				listening.once("error", reject);
				listening.listen(0, "127.0.0.1", () => resolve());
			});
			const { port } = listening.address() as AddressInfo;
			published = await hc(["label", terminal, `${LABEL}=${JSON.stringify({ v: 2, port, token })}`]);
			if (!published) throw new Error("hc label failed");
		} catch (error) {
			ctx.ui.notify(`Pi Reloader guard unavailable: ${error}`, "warning");
		}
	});

	pi.on("session_shutdown", async (event) => {
		closing = true;
		pending?.socket.destroy();
		pending = undefined;
		const listening = server;
		server = undefined;
		if (listening?.listening) await new Promise<void>((resolve) => listening.close(() => resolve()));
		// A reload or session switch publishes a new label from the next runtime; only a quit removes it.
		if (event.reason === "quit" && published && terminal) await hc(["label", terminal, `${LABEL}=`]);
		published = false;
	});
}

export default function (pi: ExtensionAPI) {
	reloaderGuard(pi);
}
