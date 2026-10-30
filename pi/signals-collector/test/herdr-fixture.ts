import { createServer, type Socket } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Offline Herdr 0.9.5 wire fixture shared by transport and collector tests. */
export async function fakeHerdr(t: any) {
	const directory = await mkdtemp(join(tmpdir(), "signals-herdr-")), path = join(directory, "s");
	const saved = { ...process.env };
	Object.assign(process.env, { HERDR_ENV: "1", HERDR_PANE_ID: "w1:p1", HERDR_SOCKET_PATH: path });
	const sockets = new Set<Socket>(), subscribers = new Set<Socket>();
	const fixture = {
		pane: { pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1" },
		workspace: { workspace_id: "w1", focused: true, active_tab_id: "w1:t1" },
		layout: { workspace_id: "w1", tab_id: "w1:t1", zoomed: false, focused_pane_id: "w1:p2" },
		fail: false, hold: false, subscriptions: [] as string[][], requests: [] as string[], params: [] as unknown[],
		wire(line: string) { for (const socket of subscribers) socket.write(line); },
		event(event: string, data: unknown = {}) { fixture.wire(JSON.stringify({ event, data }) + "\n"); },
		disconnect() { for (const socket of sockets) socket.destroy(); },
	};
	const server = createServer((socket) => {
		sockets.add(socket); socket.on("error", () => socket.destroy()); socket.on("close", () => { sockets.delete(socket); subscribers.delete(socket); });
		let buffer = ""; socket.setEncoding("utf8");
		socket.on("data", (chunk: string) => {
			buffer += chunk;
			let newline: number;
			while ((newline = buffer.indexOf("\n")) >= 0) {
				const { id, method, params } = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
				fixture.requests.push(method); fixture.params.push(params);
				if (method === "events.subscribe") {
					fixture.subscriptions.push(params.subscriptions.map((s: any) => s.type)); subscribers.add(socket);
					socket.write(JSON.stringify({ id, result: { type: "subscription_started" } }) + "\n");
				} else if (!fixture.hold) {
					const result = method === "pane.get" ? { pane: fixture.pane } : method === "workspace.get" ? { workspace: fixture.workspace } : { layout: fixture.layout };
					socket.write(JSON.stringify(fixture.fail ? { id, error: { code: "fixture_failure" } } : { id, result }) + "\n");
				}
			}
		});
	});
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(path, resolve); });
	t.after(async () => {
		fixture.disconnect(); await new Promise<void>((resolve) => server.close(() => resolve()));
		for (const key of ["HERDR_ENV", "HERDR_PANE_ID", "HERDR_SOCKET_PATH"]) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
		await rm(directory, { recursive: true, force: true });
	});
	return fixture;
}
