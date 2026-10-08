// The Herdr socket client against the fake Herdr server: bounded requests, and the agent-status subscription with
// reconciliation, reconnect and backoff.
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { load } from "./host.ts";
import { startFakeHerdr, until } from "./fake-herdr.ts";

const { herdrRequest, watchAgentStatus } = await load("src/herdr-client.ts");

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

test("watchAgentStatus reconciles after subscribing, follows events, and is unknown while disconnected", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setStatus("done", false);
	const seen: (string | null)[] = [];
	const watch = watchAgentStatus({ socketPath: herdr.socketPath, paneId: herdr.paneId }, (status: string | null) => seen.push(status), { minBackoffMs: 20, maxBackoffMs: 80 });
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

test("watchAgentStatus retries a rejected subscription with backoff and stops when closed", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	herdr.setSubscribeMode("error");
	const watch = watchAgentStatus({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { minBackoffMs: 20, maxBackoffMs: 160 });
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
	const watch = watchAgentStatus({ socketPath: herdr.socketPath, paneId: herdr.paneId }, () => {}, { requestTimeoutMs: 150 });
	t.after(() => watch.close());
	await until(() => herdr.subscriberCount === 1 && herdr.log.some((entry) => entry.method === "pane.get"), "read in flight");
	herdr.setStatus("working");
	await until(() => watch.status === "working", "event");
	herdr.setPaneGetMode("ok");
	await until(() => herdr.log.filter((entry) => entry.method === "pane.get").length >= 2, "repeated read");
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(watch.status, "working");
});
