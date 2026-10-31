import { createConnection } from "node:net";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const MAX_REPLY = 1024 * 1024;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `feed.sock` in the runtime directory exactly as source-collector's own `paths()` resolves it. */
export function socketPath(env: NodeJS.ProcessEnv = process.env): string {
	const home = env.HOME ?? homedir(), root = env.SOURCE_COLLECTOR_HOME ?? "~/Library/Application Support/source-collector";
	return join(root.startsWith("~/") ? resolve(home, root.slice(2)) : isAbsolute(root) ? root : resolve(home, root), "feed.sock");
}

/**
 * One scoped `get { sources }` on its own connection, newline-delimited JSON-RPC 2.0. Resolves the
 * result, or undefined for any failure: no socket, error reply, malformed or oversized reply,
 * timeout or abort. Never retries; the next poll is the retry.
 */
export function getSources(path: string, sources: readonly string[], options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<unknown> {
	const { signal } = options;
	if (signal?.aborted) return Promise.resolve(undefined);
	return new Promise((done) => {
		const socket = createConnection({ path });
		let received = Buffer.alloc(0), settled = false;
		const finish = (result?: unknown) => {
			if (settled) return;
			settled = true;
			clearTimeout(deadline);
			signal?.removeEventListener("abort", fail);
			socket.destroy();
			done(result);
		};
		function fail() { finish(); }
		const deadline = setTimeout(fail, options.timeoutMs ?? 5_000);
		deadline.unref();
		signal?.addEventListener("abort", fail, { once: true });
		socket.once("connect", () => socket.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "get", params: { sources } }) + "\n"));
		socket.on("data", (chunk: Buffer) => {
			received = Buffer.concat([received, chunk]);
			const end = received.indexOf(10);
			if (end < 0 ? received.length > MAX_REPLY : end > MAX_REPLY) return fail();
			if (end < 0) return;
			try {
				const reply = JSON.parse(received.subarray(0, end).toString("utf8"));
				finish(record(reply) && reply.jsonrpc === "2.0" && reply.id === 1 && !("error" in reply) ? reply.result : undefined);
			} catch { fail(); }
		});
		socket.once("error", fail);
		socket.once("close", fail);
	});
}
