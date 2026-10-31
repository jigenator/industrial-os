import { createServer, type Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Offline source-collector `feed.sock`: newline-delimited JSON-RPC 2.0 as its contract documents.
 * Replies `result` to each request, `line` verbatim when set, nothing while `hold`. Never the live engine.
 */
export async function fakeSourceCollector(t: any) {
	const home = await mkdtemp(join(tmpdir(), "signals-sc-")), path = join(home, "feed.sock");
	const sockets = new Set<Socket>();
	const fixture = {
		home, path, connections: 0, requests: [] as any[], result: snapshot([]) as unknown, line: undefined as string | undefined, hold: false,
		disconnect() { for (const socket of sockets) socket.destroy(); },
	};
	const server = createServer((socket) => {
		fixture.connections++; sockets.add(socket);
		socket.on("error", () => socket.destroy()); socket.on("close", () => sockets.delete(socket));
		let buffer = ""; socket.setEncoding("utf8");
		socket.on("data", (chunk: string) => {
			buffer += chunk;
			let newline: number;
			while ((newline = buffer.indexOf("\n")) >= 0) {
				const request = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
				fixture.requests.push(request);
				if (!fixture.hold) socket.write((fixture.line ?? JSON.stringify({ jsonrpc: "2.0", id: request.id, result: fixture.result })) + "\n");
			}
		});
	});
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(path, resolve); });
	t.after(async () => {
		fixture.disconnect(); await new Promise<void>((resolve) => server.close(() => resolve()));
		await rm(home, { recursive: true, force: true });
	});
	return fixture;
}

export const OK_AT = "2026-10-31T08:00:00.000Z";
export const status = (id: string, extra: Record<string, unknown> = {}) => ({ id, label: `${id} label`, tag: id.slice(-3).toUpperCase(), order: 0, state: "ok", okAt: OK_AT, checkedAt: OK_AT, writable: [], ...extra });
export const usageItem = (source: string, facts?: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
	key: "usage", title: "Usage", since: OK_AT, source, kind: "item", seenAt: "2026-10-30T08:00:00.000Z", ...(facts ? { facts } : {}),
	overlay: { plan: "inbox", pinned: false }, derived: { ageMs: 0, remaining: 1, stale: false, fresh: false, waiting: false, done: false }, ...extra,
});
export const snapshot = (sources: unknown[], items: unknown[] = []) => ({
	v: 1, rev: 1, at: OK_AT, staleLimitMs: 259200000, sources, items,
	counts: { plan: { today: 0, inbox: 0, later: 0 }, bySource: {} },
	week: { from: OK_AT, to: OK_AT, blocks: [], total: { you: 0, agents: 0 }, lastWeekSoFar: { you: 0, agents: 0 } }, alerts: [],
});
