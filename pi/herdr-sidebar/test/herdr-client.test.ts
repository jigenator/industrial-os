// The Herdr socket client against the fake Herdr server: bounded requests, and the agent-status subscription with
// reconciliation, reconnect and backoff.
import assert from "node:assert/strict";
import { Socket } from "node:net";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { load } from "./host.ts";
import { startFakeHerdr, until } from "./fake-herdr.ts";

const { herdrRequest, watchPaneState } = await load("src/herdr-client.ts");

const MAX_LINE = 1024 * 1024;
// Capture only the first client: readLines installs its decoder synchronously before the fake server accepts.
// Unix sockets normally fragment large writes. Coalescing decoded data here makes the single-chunk bypass
// deterministic while retaining the real fake-server connection, response id, and close/reconnect behavior.
function captureClient(t: TestContext, coalesce = false) {
	let client: Socket | undefined;
	const delivered: string[] = [];
	const setEncoding = Socket.prototype.setEncoding;
	t.mock.method(Socket.prototype, "setEncoding", function (this: Socket, encoding: BufferEncoding) {
		if (!client) {
			client = this;
			if (coalesce) {
				const emit = this.emit;
				let pending = "";
				t.mock.method(this, "emit", function (this: Socket, event: string, ...args: any[]) {
					if (event !== "data") return emit.call(this, event, ...args);
					pending += args[0];
					if (!pending.includes("\n")) return true;
					const chunk = pending; pending = ""; delivered.push(chunk);
					return emit.call(this, event, chunk);
				});
			}
		}
		return setEncoding.call(this, encoding);
	});
	return { get socket() { assert.ok(client); return client; }, delivered };
}

const statusLine = (status: string) => JSON.stringify({ event: "pane.agent_status_changed", data: { pane_id: "w1:p1", agent_status: status } });

for (const complete of [true, false]) {
	test(`watchPaneState drops an oversized ${complete ? "complete line in one chunk" : "incomplete line"} without delivering it`, async (t) => {
		const herdr = await startFakeHerdr(); t.after(() => herdr.close());
		const client = captureClient(t, complete);
		const seen: (string | null)[] = [];
		const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => seen.push(state.status), { minBackoffMs: 1000 }); t.after(() => watch.close());
		await until(() => watch.status === "idle");
		const line = `${statusLine("working")}${" ".repeat(MAX_LINE)}`;
		herdr.writeSubscribers(complete ? `${line}\n${statusLine("blocked")}\n` : line);
		await until(() => client.socket.destroyed && herdr.subscriberCount === 0, "over-limit socket dropped", 1000);
		assert.equal(watch.status, null);
		assert.deepEqual(seen, ["idle", null], "neither the oversized line nor a later line was delivered");
		if (complete) assert.ok(client.delivered.some((chunk) => chunk.startsWith(line)), "complete oversized line reached readLines in one chunk");
	});
}

test("herdrRequest rejects an oversized complete reply in one chunk instead of accepting success", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setReplyPadding(MAX_LINE);
	const client = captureClient(t, true);
	assert.deepEqual(await herdrRequest(herdr.socketPath, "pane.get", { pane_id: herdr.paneId }, 1000), { ok: false, error: "pane.get connection closed" });
	await until(() => herdr.socketCount === 0, "request socket dropped");
	assert.ok(client.socket.destroyed);
	assert.equal(client.delivered.length, 1);
	assert.ok(client.delivered[0].length > MAX_LINE && client.delivered[0].endsWith("\n"));
});

test("readLines keeps normal, multiple, split and exactly-at-limit lines", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close());
	const client = captureClient(t);
	const seen: (string | null)[] = [];
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => seen.push(state.status)); t.after(() => watch.close());
	await until(() => watch.status === "idle");
	// Deterministic decoded chunks over the connected fake socket exercise both sides of the exact boundary.
	client.socket.emit("data", `${statusLine("working")}\n \n${statusLine("blocked")}\n`);
	const split = statusLine("done");
	client.socket.emit("data", split.slice(0, 15));
	assert.equal(watch.status, "blocked", "incomplete line not delivered");
	client.socket.emit("data", `${split.slice(15)}\n`);
	const last = statusLine("idle");
	client.socket.emit("data", last + " ".repeat(MAX_LINE - last.length));
	assert.equal(watch.status, "done", "at-limit incomplete line waits for newline");
	assert.equal(client.socket.destroyed, false);
	client.socket.emit("data", "\n");
	assert.equal(client.socket.destroyed, false);
	assert.deepEqual(seen, ["idle", "working", "blocked", "done", "idle"]);
});

test("watchPaneState times out an unacknowledged subscription, reconnects with backoff and recovers", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setSubscribeMode("silent");
	const seen: (string | null)[] = [];
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => seen.push(state.status), { requestTimeoutMs: 80, minBackoffMs: 20, maxBackoffMs: 40 }); t.after(() => watch.close());
	const attempts = () => herdr.log.filter((entry) => entry.method === "events.subscribe");
	await until(() => attempts().length >= 3, "unacknowledged subscriptions retried", 1000);
	const times = attempts().slice(0, 3).map((entry) => entry.at);
	assert.ok(times[1] - times[0] >= 90 && times[1] - times[0] < 400, "deadline then first backoff");
	assert.ok(times[2] - times[1] >= 110 && times[2] - times[1] < 400, "deadline then capped backoff");
	assert.equal(watch.status, null); assert.equal(watch.workspaceLabel, null); assert.equal(watch.visible, null);
	assert.deepEqual(seen, [], "never known before acknowledgement");
	assert.equal(herdr.log.some((entry) => entry.method === "pane.get"), false);
	assert.equal(herdr.socketCount, 1, "only one pending subscription; no leaked sockets");
	herdr.setSubscribeMode("ok"); herdr.setStatus("working", false);
	await until(() => watch.status === "working" && watch.visible === true, "recovered after acknowledgement", 1000);
	const count = attempts().length;
	await new Promise((resolve) => setTimeout(resolve, 200));
	assert.equal(attempts().length, count, "ack cleared deadline; no double reconnect");
	assert.equal(herdr.subscriberCount, 1);
	assert.equal(herdr.socketCount, 1);
	assert.deepEqual(seen, ["working"]);
});

for (const exit of ["ack", "error", "close", "stop"] as const) {
	test(`watchPaneState clears its acknowledgement timer on ${exit}`, async (t) => {
		const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setSubscribeMode("silent");
		const client = captureClient(t);
		const timers: NodeJS.Timeout[] = [], timeout = setTimeout;
		t.mock.method(globalThis, "setTimeout", (callback: () => void, ms: number) => {
			const timer = timeout(callback, ms);
			if (ms === 123) timers.push(timer);
			return timer;
		});
		const clear = t.mock.method(globalThis, "clearTimeout");
		const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { requestTimeoutMs: 123, minBackoffMs: 1000 }); t.after(() => watch.close());
		await until(() => herdr.log.some((entry) => entry.method === "events.subscribe"));
		assert.equal(timers.length, 1, "one pending acknowledgement timer");
		const timer = timers[0]; assert.equal(timer.hasRef(), false, "timer is unref'd");
		if (exit === "ack") {
			const id = herdr.log.find((entry) => entry.method === "events.subscribe")!.id;
			client.socket.emit("data", `${JSON.stringify({ id, result: { type: "subscription_started" } })}\n`);
			await until(() => watch.status === "idle");
		} else if (exit === "error") client.socket.emit("error", new Error("fake transport error"));
		else if (exit === "close") client.socket.destroy();
		else watch.close();
		await until(() => clear.mock.calls.some((call) => call.arguments[0] === timer), `timer cleared on ${exit}`);
		watch.close(); watch.close();
		await until(() => herdr.socketCount === 0);
		const count = herdr.log.length;
		await new Promise((resolve) => setTimeout(resolve, 200));
		assert.equal(herdr.log.length, count, "no work after stop");
	});
}

test("herdrRequest returns the reply, Herdr's error code, a timeout, or a connection failure; never throws", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setStatus("working", false);
	const ok = await herdrRequest(herdr.socketPath, "pane.get", { pane_id: herdr.paneId }, 500);
	assert.deepEqual(ok, { ok: true, result: { type: "pane_info", pane: { pane_id: herdr.paneId, workspace_id: "w1", tab_id: "w1:t1", agent_status: "working" } } });
	assert.deepEqual(await herdrRequest(herdr.socketPath, "pane.get", { pane_id: "w9:p9" }, 500), { ok: false, error: "pane.get: pane_not_found" });
	herdr.setPaneGetMode("silent");
	const started = Date.now();
	assert.deepEqual(await herdrRequest(herdr.socketPath, "pane.get", { pane_id: herdr.paneId }, 150), { ok: false, error: "pane.get timed out" });
	assert.ok(Date.now() - started < 400);
	const missing = await herdrRequest(join(herdr.socketPath, "..", "missing.sock"), "pane.get", {}, 500);
	assert.equal(missing.ok, false);
	assert.match(missing.error, /pane.get failed: ENOENT/);
});

test("watchPaneState reconciles after subscribing, follows events, and is unknown while disconnected", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setStatus("done", false);
	const seen: (string | null)[] = [];
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => seen.push(state.status), { minBackoffMs: 20, maxBackoffMs: 80 });
	t.after(() => watch.close());
	await until(() => watch.status === "done", "reconciled status");
	assert.equal(herdr.subscriberCount, 1);
	herdr.setStatus("working");
	await until(() => watch.status === "working", "event");
	// Herdr drops the subscription; the status changes while nobody listens.
	herdr.dropSubscribers();
	await until(() => watch.status === null, "unknown while disconnected");
	herdr.setStatus("blocked", false);
	await until(() => watch.status === "blocked" && herdr.subscriberCount === 1, "reconnected and reconciled");
	// events_lost ends the subscription the same way.
	herdr.dropSubscribers(true);
	herdr.setStatus("idle", false);
	await until(() => watch.status === "idle", "resubscribed after events_lost");
	assert.deepEqual(seen, ["done", "working", null, "blocked", null, "idle"]);
	assert.equal(herdr.log.filter((entry) => entry.method === "events.subscribe").length, 3);
	assert.equal(herdr.log.filter((entry) => entry.method === "pane.get").length, 3);
});

test("watchPaneState retries a rejected subscription with backoff and stops when closed", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setSubscribeMode("error");
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { minBackoffMs: 20, maxBackoffMs: 160 });
	const attempts = () => herdr.log.filter((entry) => entry.method === "events.subscribe").length;
	await until(() => attempts() >= 4, "retries");
	assert.equal(watch.status, null);
	const times = herdr.log.filter((entry) => entry.method === "events.subscribe").map((entry) => entry.at);
	assert.ok(times[3] - times[2] >= times[1] - times[0], "the delay grows");
	herdr.setSubscribeMode("ok");
	herdr.setStatus("working", false);
	await until(() => watch.status === "working", "recovered");
	watch.close();
	herdr.dropSubscribers();
	const count = attempts();
	await new Promise((resolve) => setTimeout(resolve, 250));
	assert.equal(attempts(), count, "no reconnect after close");
	assert.equal(herdr.subscriberCount, 0);
});

test("an event during the reconciling read wins over the read's older answer", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setStatus("idle", false);
	herdr.setPaneGetMode("silent");
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { requestTimeoutMs: 150 });
	t.after(() => watch.close());
	await until(() => herdr.subscriberCount === 1 && herdr.log.some((entry) => entry.method === "pane.get"), "read in flight");
	herdr.setStatus("working");
	await until(() => watch.status === "working", "event");
	herdr.setPaneGetMode("ok");
	await until(() => herdr.log.filter((entry) => entry.method === "pane.get").length >= 2, "repeated read");
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(watch.status, "working");
});

// No refresh() or sender renewal participates: every real-wire event must update the watch directly.
for (const kind of ["renamed", "updated"] as const) {
	test(`snake_case workspace_${kind} updates SPACE without a periodic refresh`, async (t) => {
		const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setWorkspaceLabel("Before", false);
		const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}); t.after(() => watch.close());
		await until(() => watch.workspaceLabel === "Before");
		herdr.setWorkspaceLabel("After", kind);
		await until(() => watch.workspaceLabel === "After", `workspace_${kind}`, 1000);
		const reads = herdr.log.filter((r) => r.method === "workspace.get").length;
		herdr.emit(kind === "renamed" ? "workspace_renamed" : "workspace_updated", kind === "renamed" ? { workspace_id: "other" } : { workspace: { workspace_id: "other" } });
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(herdr.log.filter((r) => r.method === "workspace.get").length, reads, "unrelated workspace ignored");
	});
}

for (const event of ["workspace_focused", "tab_focused", "pane_focused"]) {
	test(`snake_case ${event} updates visibility without a periodic refresh`, async (t) => {
		const herdr = await startFakeHerdr(); t.after(() => herdr.close());
		const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}); t.after(() => watch.close());
		await until(() => watch.visible === true);
		herdr.focus("w1", "w1:t2", "w1:p2", [event]);
		await until(() => watch.visible === false, event, 1000);
		herdr.focus("w1", "w1:t1", herdr.paneId, [event]);
		await until(() => watch.visible === true, `${event} returns`, 1000);
	});
}

for (const move of ["same-ID", "cross-workspace"]) {
	test(`snake_case pane_moved handles a ${move} move without a periodic refresh`, async (t) => {
		const herdr = await startFakeHerdr(); t.after(() => herdr.close());
		const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}); t.after(() => watch.close());
		await until(() => watch.visible === true);
		if (move === "same-ID") {
			herdr.movePaneToTab("w1:t2");
			await until(() => watch.visible === false, "same-ID pane_moved", 1000);
			assert.equal(herdr.log.filter((r) => r.method === "events.subscribe").length, 1);
		} else {
			herdr.movePane("w2", "w2:p2", "Moved");
			await until(() => watch.paneId === "w2:p2" && watch.workspaceLabel === "Moved", "cross-workspace pane_moved", 1000);
			assert.equal(herdr.log.filter((r) => r.method === "events.subscribe").at(-1)!.params.subscriptions[0].pane_id, "w2:p2");
		}
		// Special SubscriptionEventKind remains dotted, including after a move/resubscription.
		const reads = herdr.log.filter((r) => r.method === "pane.get").length;
		herdr.setStatus("working");
		await until(() => watch.status === "working", "dotted pane.agent_status_changed", 1000);
		assert.equal(herdr.log.filter((r) => r.method === "pane.get").length, reads, "status push needs no read");
	});
}

test("fake Herdr rejects dotted lifecycle wire events", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close());
	for (const event of ["workspace.renamed", "workspace.updated", "pane.moved", "workspace.focused", "tab.focused", "pane.focused"]) {
		assert.throws(() => herdr.emit(event, {}), /Lifecycle wire event must be snake_case/);
	}
});

test("workspace label resolves via workspace.get, follows rename/update/move, and re-resolves after reconnect", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setWorkspaceLabel("Initial SPACE", false);
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { minBackoffMs: 20, maxBackoffMs: 80 }); t.after(() => watch.close());
	await until(() => watch.workspaceLabel === "Initial SPACE");
	assert.deepEqual(herdr.log.find((r) => r.method === "workspace.get")!.params, { workspace_id: "w1" });
	assert.deepEqual(herdr.log.find((r) => r.method === "events.subscribe")!.params.subscriptions.map((s: any) => s.type), ["pane.agent_status_changed", "workspace.renamed", "workspace.updated", "pane.moved", "workspace.focused", "tab.focused", "pane.focused"]);
	herdr.setWorkspaceLabel("Renamed SPACE"); await until(() => watch.workspaceLabel === "Renamed SPACE");
	herdr.setWorkspaceLabel("Updated SPACE", "updated"); await until(() => watch.workspaceLabel === "Updated SPACE");
	const reads = herdr.log.filter((r) => r.method === "workspace.get").length;
	herdr.emit("workspace_renamed", { workspace_id: "other", label: "wrong" }); await new Promise((done) => setTimeout(done, 50));
	assert.equal(herdr.log.filter((r) => r.method === "workspace.get").length, reads);
	herdr.dropSubscribers(); await until(() => watch.workspaceLabel === null);
	herdr.setWorkspaceLabel("Reconnect SPACE", false); await until(() => watch.workspaceLabel === "Reconnect SPACE");
	herdr.movePane("w2", "w2:p2", "Moved SPACE"); await until(() => watch.workspaceLabel === "Moved SPACE");
	assert.equal(watch.paneId, "w2:p2");
	assert.equal(herdr.log.filter((r) => r.method === "events.subscribe").at(-1)!.params.subscriptions[0].pane_id, "w2:p2");
	herdr.setStatus("working"); await until(() => watch.status === "working");
});

test("workspace rename during a read wins; reconnect fences an old pending label read", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setWorkspaceLabel("Old", false); herdr.setWorkspaceGetDelay(120);
	const seen: string[] = [], watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => { if (state.workspaceLabel) seen.push(state.workspaceLabel); }, { minBackoffMs: 20 }); t.after(() => watch.close());
	await until(() => herdr.log.some((r) => r.method === "workspace.get"));
	herdr.setWorkspaceLabel("New"); await until(() => watch.workspaceLabel === "New"); assert.ok(!seen.includes("Old"));
	herdr.setWorkspaceLabel("Obsolete"); const count = herdr.log.filter((r) => r.method === "workspace.get").length;
	await until(() => herdr.log.filter((r) => r.method === "workspace.get").length > count);
	herdr.dropSubscribers(); herdr.setWorkspaceLabel("Current", false); herdr.setWorkspaceGetDelay(0);
	await until(() => watch.workspaceLabel === "Current"); await new Promise((done) => setTimeout(done, 200));
	assert.equal(watch.workspaceLabel, "Current"); assert.ok(!seen.includes("Obsolete"));
});

test("visibility: the pane's tab is the focused workspace's active tab, re-resolved on each focus event and reconnect", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close());
	const seen: (boolean | null)[] = [];
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => seen.push(state.visible), { minBackoffMs: 20, maxBackoffMs: 80 }); t.after(() => watch.close());
	await until(() => watch.visible === true, "visible at start");
	// Another tab of the same workspace, then another workspace: either hides the pane.
	herdr.focus("w1", "w1:t2", "w1:p2"); await until(() => watch.visible === false, "another tab");
	herdr.focus("w1", "w1:t1", "w1:p1"); await until(() => watch.visible === true, "back");
	herdr.focus("w3", "w3:t1", "w3:p1"); await until(() => watch.visible === false, "another workspace");
	// Each focus event alone re-resolves through pane.get and workspace.get; the payload is not trusted.
	for (const event of ["workspace_focused", "tab_focused", "pane_focused"]) {
		const reads = herdr.log.filter((r) => r.method === "workspace.get").length;
		herdr.focus("w1", "w1:t1", "w1:p9", [event]); await until(() => watch.visible === true, `${event} shows`);
		assert.ok(herdr.log.filter((r) => r.method === "workspace.get").length > reads, event);
		herdr.focus("w1", "w1:t2", "w1:p2", false); herdr.emit(event, { workspace_id: "w1", tab_id: "w1:t1", pane_id: herdr.paneId });
		await until(() => watch.visible === false, `${event} hides despite its payload`);
	}
	// Unknown while disconnected; a reconnect re-resolves the focus that changed meanwhile.
	herdr.dropSubscribers(); await until(() => watch.visible === null, "unknown while disconnected");
	herdr.focus("w1", "w1:t1", "w1:p1", false);
	await until(() => watch.visible === true && herdr.subscriberCount === 1, "re-resolved after reconnect");
	// Without the workspace read, visibility is unknown, never assumed.
	herdr.setWorkspaceGetMode("error"); herdr.focus("w1", "w1:t2", "w1:p2");
	await until(() => watch.visible === null, "unknown without workspace.get");
	assert.equal(watch.status, "idle");
	assert.deepEqual(seen.slice(0, 5), [true, false, true, false, true]);
});

test("refresh re-reads an automatic SPACE label Herdr changed without an event; only on a live subscription", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setWorkspaceLabel("main", false);
	const labels: (string | null)[] = [];
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => labels.push(state.workspaceLabel), { minBackoffMs: 20, maxBackoffMs: 80 }); t.after(() => watch.close());
	await until(() => watch.workspaceLabel === "main");
	// Herdr's Git refresh recomputes the automatic label silently.
	herdr.setWorkspaceLabel("feature", false); await new Promise((done) => setTimeout(done, 60));
	assert.equal(watch.workspaceLabel, "main");
	watch.refresh(); await until(() => watch.workspaceLabel === "feature", "refreshed");
	// An unchanged refresh pushes nothing.
	const reads = herdr.log.filter((r) => r.method === "workspace.get").length;
	watch.refresh(); await until(() => herdr.log.filter((r) => r.method === "workspace.get").length > reads);
	await new Promise((done) => setTimeout(done, 40));
	assert.deepEqual(labels, ["main", "feature"]);
	watch.close(); const count = herdr.log.length; watch.refresh(); await new Promise((done) => setTimeout(done, 40));
	assert.equal(herdr.log.length, count, "nothing after close");
});

test("a same-workspace pane move keeps the subscription, never flashes unknown, and re-resolves visibility", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setStatus("working", false);
	const states: any[] = [];
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (state: any) => states.push(state), { minBackoffMs: 20 }); t.after(() => watch.close());
	await until(() => watch.visible === true && watch.status === "working");
	herdr.movePaneToTab("w1:t2"); await until(() => watch.visible === false, "the moved pane's tab is not active");
	assert.equal(herdr.log.filter((r) => r.method === "events.subscribe").length, 1, "no resubscription");
	assert.ok(states.every((state) => state.status === "working"), "never unknown");
	assert.equal(watch.paneId, herdr.paneId);
	herdr.setStatus("idle"); await until(() => watch.status === "idle", "the subscription still follows the pane");
});

test("a transient pane.get or workspace.get failure is retried with backoff, without waiting for an event", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setStatus("done", false); herdr.setWorkspaceLabel("SPACE", false);
	herdr.setPaneGetMode("silent");
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { requestTimeoutMs: 80, minBackoffMs: 20, maxBackoffMs: 80 }); t.after(() => watch.close());
	await until(() => herdr.log.filter((r) => r.method === "pane.get").length >= 4, "pane.get retried");
	assert.equal(watch.status, null);
	// The retry delay doubles from 20 ms and stops at 80 ms (each attempt also waits out the 80 ms timeout).
	const times = herdr.log.filter((r) => r.method === "pane.get").map((r) => r.at);
	const gaps = times.slice(1).map((at, i) => at - times[i] - 80);
	assert.ok(gaps[0] >= 15 && gaps[0] < 60, `first gap ${gaps[0]}`);
	assert.ok(gaps[1] >= 35, `second gap ${gaps[1]}`);
	assert.ok(gaps[2] >= 70 && gaps[2] < 140, `capped gap ${gaps[2]}`);
	herdr.setPaneGetMode("ok"); await until(() => watch.status === "done" && watch.workspaceLabel === "SPACE", "recovered by the retry");
	// On a live subscription a failed refresh keeps the known state instead of blanking row 1.
	herdr.setWorkspaceGetMode("silent"); const reads = herdr.log.filter((r) => r.method === "workspace.get").length; watch.refresh();
	await until(() => herdr.log.filter((r) => r.method === "workspace.get").length >= reads + 3, "workspace.get retried");
	assert.equal(watch.workspaceLabel, "SPACE"); assert.equal(watch.visible, true); assert.equal(watch.status, "done");
	herdr.setWorkspaceGetMode("ok"); herdr.setWorkspaceLabel("RENAMED", false);
	await until(() => watch.workspaceLabel === "RENAMED" && watch.visible === true, "recovered by the retry");
	herdr.setPaneGetMode("silent"); const panes = herdr.log.filter((r) => r.method === "pane.get").length; watch.refresh();
	await until(() => herdr.log.filter((r) => r.method === "pane.get").length >= panes + 3, "pane.get retried");
	assert.equal(watch.status, "done"); assert.equal(watch.workspaceLabel, "RENAMED");
	herdr.setPaneGetMode("ok"); await new Promise((done) => setTimeout(done, 250));
	// Success resets the retry: no further reads without a cause.
	const settled = herdr.log.length; await new Promise((done) => setTimeout(done, 200));
	assert.equal(herdr.log.length, settled);
	assert.equal(herdr.log.filter((r) => r.method === "events.subscribe").length, 1);
});
