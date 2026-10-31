import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getSources, socketPath } from "../src/source-collector.ts";
import { fakeSourceCollector, snapshot, status } from "./source-collector-fixture.ts";

test("socket path resolves SOURCE_COLLECTOR_HOME like source-collector's paths()", () => {
	const home = "/fixture/home";
	assert.equal(socketPath({ HOME: home }), "/fixture/home/Library/Application Support/source-collector/feed.sock");
	assert.equal(socketPath({ HOME: home, SOURCE_COLLECTOR_HOME: "~/runtime" }), "/fixture/home/runtime/feed.sock");
	assert.equal(socketPath({ HOME: home, SOURCE_COLLECTOR_HOME: "/abs/runtime" }), "/abs/runtime/feed.sock");
	assert.equal(socketPath({ HOME: home, SOURCE_COLLECTOR_HOME: "relative/runtime" }), "/fixture/home/relative/runtime/feed.sock");
	assert.equal(socketPath({}), join(homedir(), "Library/Application Support/source-collector/feed.sock"));
});

test("one scoped get per connection returns the result; other RPCs are never sent", async (t) => {
	const sc = await fakeSourceCollector(t), result = snapshot([status("usage-cld")]);
	sc.result = result;
	assert.deepEqual(await getSources(sc.path, ["usage-cld", "usage-gpt"]), result);
	assert.deepEqual(sc.requests, [{ jsonrpc: "2.0", id: 1, method: "get", params: { sources: ["usage-cld", "usage-gpt"] } }]);
	assert.equal(sc.connections, 1);
});

test("error, mismatched, malformed and closed replies are failures, not results", async (t) => {
	const sc = await fakeSourceCollector(t);
	for (const line of [
		JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "invalid" } }),
		JSON.stringify({ jsonrpc: "2.0", id: 2, result: {} }),
		JSON.stringify({ id: 1, result: {} }),
		JSON.stringify([{ jsonrpc: "2.0", id: 1, result: {} }]),
		"{not json",
	]) {
		sc.line = line;
		assert.equal(await getSources(sc.path, ["a"]), undefined, line);
	}
	sc.line = undefined; sc.hold = true;
	const pending = getSources(sc.path, ["a"]);
	await until(() => sc.requests.length === 6); sc.disconnect();
	assert.equal(await pending, undefined);
	assert.equal(await getSources(join(sc.home, "missing.sock"), ["a"]), undefined);
});

test("a reply split across chunks parses; an oversized reply is cut off", async (t) => {
	const sc = await fakeSourceCollector(t), result = snapshot([status("usage-cld", { label: "x".repeat(64 * 1024) })]);
	sc.line = JSON.stringify({ jsonrpc: "2.0", id: 1, result });
	assert.deepEqual(await getSources(sc.path, ["usage-cld"]), result);
	sc.line = JSON.stringify({ jsonrpc: "2.0", id: 1, result: snapshot([status("usage-cld", { label: "x".repeat(1024 * 1024) })]) });
	assert.equal(await getSources(sc.path, ["usage-cld"]), undefined);
});

test("timeout and abort settle at once; a pre-aborted request never connects", async (t) => {
	const sc = await fakeSourceCollector(t);
	sc.hold = true;
	const started = Date.now();
	assert.equal(await getSources(sc.path, ["a"], { timeoutMs: 50 }), undefined);
	assert.ok(Date.now() - started < 1000);
	const controller = new AbortController(), pending = getSources(sc.path, ["a"], { signal: controller.signal });
	await until(() => sc.requests.length === 2); controller.abort();
	assert.equal(await pending, undefined);
	await until(() => sc.connections === 2);
	const before = sc.connections;
	assert.equal(await getSources(sc.path, ["a"], { signal: AbortSignal.abort() }), undefined);
	await new Promise((done) => setTimeout(done, 50));
	assert.equal(sc.connections, before, "a pre-aborted request never connects");
});

async function until(check: () => boolean) {
	for (let n = 0; n < 200; n++) { if (check()) return; await new Promise((done) => setTimeout(done, 10)); }
	throw new Error("Timed out waiting for fake source-collector");
}
