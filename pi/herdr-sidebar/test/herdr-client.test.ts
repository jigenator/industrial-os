// The Herdr socket client against the fake Herdr server: bounded requests, and the agent-status subscription with
// reconciliation, reconnect and backoff.
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { load } from "./host.ts";
import { startFakeHerdr, until } from "./fake-herdr.ts";

const { herdrRequest, watchPaneState } = await load("src/herdr-client.ts");

test("herdrRequest returns the reply, Herdr's error code, a timeout, or a connection failure; never throws", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setStatus("working", false);
	const ok = await herdrRequest(herdr.socketPath, "pane.get", { pane_id: herdr.paneId }, 500);
	assert.deepEqual(ok, { ok: true, result: { type: "pane_info", pane: { pane_id: herdr.paneId, workspace_id: "w1", agent_status: "working" } } });
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

test("workspace label resolves via workspace.get, follows rename/update/move, and re-resolves after reconnect", async (t) => {
	const herdr = await startFakeHerdr(); t.after(() => herdr.close()); herdr.setWorkspaceLabel("Initial SPACE", false);
	const watch = watchPaneState({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { minBackoffMs: 20, maxBackoffMs: 80 }); t.after(() => watch.close());
	await until(() => watch.workspaceLabel === "Initial SPACE");
	assert.deepEqual(herdr.log.find((r) => r.method === "workspace.get")!.params, { workspace_id: "w1" });
	assert.deepEqual(herdr.log.find((r) => r.method === "events.subscribe")!.params.subscriptions.map((s: any) => s.type), ["pane.agent_status_changed", "workspace.renamed", "workspace.updated", "pane.moved"]);
	herdr.setWorkspaceLabel("Renamed SPACE"); await until(() => watch.workspaceLabel === "Renamed SPACE");
	herdr.setWorkspaceLabel("Updated SPACE", "updated"); await until(() => watch.workspaceLabel === "Updated SPACE");
	const reads = herdr.log.filter((r) => r.method === "workspace.get").length;
	herdr.emit("workspace.renamed", { workspace_id: "other", label: "wrong" }); await new Promise((done) => setTimeout(done, 50));
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
