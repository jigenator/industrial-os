import assert from "node:assert/strict";
import test from "node:test";
import { watchVisibility } from "../src/herdr.ts";
import { fakeHerdr } from "./herdr-fixture.ts";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean) {
	for (let n = 0; n < 200; n++) { if (check()) return; await sleep(5); }
	throw new Error("Herdr fixture timed out");
}

test("visibility resolves workspace/tab/zoom, moves and all subscribed invalidations without polling", async (t) => {
	const f = await fakeHerdr(t), values: (boolean | null)[] = [];
	const watcher = watchVisibility((v) => values.push(v)); t.after(() => watcher.dispose());
	await until(() => values.at(-1) === true);
	assert.deepEqual(f.subscriptions[0], ["workspace.created", "workspace.focused", "workspace.updated", "workspace.closed", "tab.created", "tab.focused", "tab.closed", "tab.moved", "pane.created", "pane.focused", "pane.moved", "pane.closed", "layout.updated"]);
	const quiet = f.requests.length;
	f.event("workspace_updated", { workspace: { workspace_id: "w9" } }); f.event("layout_updated", { layout: { tab_id: "w9:t1" } });
	await sleep(30); assert.equal(f.requests.length, quiet, "other workspaces/tabs cost no reads");
	for (const [event, change, expected] of [
		["workspace_focused", () => { f.workspace.focused = false; }, false],
		["workspace_updated", () => { f.workspace.focused = true; f.workspace.active_tab_id = "w1:t2"; }, false],
		["tab_focused", () => { f.workspace.active_tab_id = "w1:t1"; }, true],
		["layout_updated", () => { f.layout.zoomed = true; }, false],
		["pane_focused", () => { f.layout.focused_pane_id = "w1:p1"; }, true],
		["tab_closed", () => { f.layout.focused_pane_id = "w1:p2"; }, false],
		["layout_updated", () => { f.layout.zoomed = false; }, true],
	] as const) {
		change(); const before = f.requests.length; f.event(event);
		await until(() => f.requests.length > before && values.at(-1) === expected);
	}
	f.pane.pane_id = "w2:p1"; f.layout.focused_pane_id = "w2:p1";
	const before = f.requests.length;
	f.event("pane_moved", { previous_pane_id: "w1:p1", pane: f.pane });
	await until(() => f.requests.length >= before + 3);
	assert.deepEqual(f.params.slice(before), [{ pane_id: "w2:p1" }, { workspace_id: "w1" }, { pane_id: "w2:p1" }]);
	await sleep(30); const count = f.requests.length; await sleep(60); assert.equal(f.requests.length, count, "no poll");
	watcher.dispose(); f.event("layout_updated"); await sleep(30); assert.equal(f.requests.length, count);
});

test("disconnect and failed reads become unknown; reconnect resolves afresh; disposal fences pending reads", async (t) => {
	const f = await fakeHerdr(t), values: (boolean | null)[] = [];
	const watcher = watchVisibility((v) => values.push(v), { timeoutMs: 80, minBackoffMs: 10, maxBackoffMs: 20 }); t.after(() => watcher.dispose());
	await until(() => values.at(-1) === true);
	f.hold = true; f.disconnect(); await until(() => values.at(-1) === null);
	await until(() => f.subscriptions.length >= 2); assert.equal(values.at(-1), null);
	f.hold = false; f.workspace.focused = false; f.event("workspace_focused"); await until(() => values.at(-1) === false);
	f.fail = true; f.event("tab_focused"); await until(() => values.at(-1) === null);
	f.fail = false; await until(() => values.at(-1) === false);
	f.hold = true; f.event("layout_updated"); await sleep(10); watcher.dispose();
	const count = values.length, requests = f.requests.length; f.hold = false; f.event("pane_focused");
	await sleep(120); assert.equal(values.length, count); assert.equal(f.requests.length, requests);
});

test("missing Herdr environment stays unknown without connecting", async (t) => {
	const f = await fakeHerdr(t); delete process.env.HERDR_ENV;
	const watcher = watchVisibility(() => assert.fail("unknown must not fabricate visibility")); watcher.dispose();
	await sleep(20); assert.equal(f.requests.length, 0);
});


test("malformed/oversized socket lines and invalid layout are unknown, never known hidden", async (t) => {
	const f = await fakeHerdr(t), values: (boolean | null)[] = [];
	const watcher = watchVisibility((v) => values.push(v), { minBackoffMs: 10, maxBackoffMs: 20 }); t.after(() => watcher.dispose());
	await until(() => values.at(-1) === true);
	for (const line of ["{bad json\n", "x".repeat(1024 * 1024 + 1)]) {
		f.hold = true; f.wire(line); await until(() => values.at(-1) === null);
		f.hold = false; await until(() => values.at(-1) === true);
	}
	(f.layout as any).zoomed = "false"; f.event("layout_updated"); await until(() => values.at(-1) === null);
	assert.ok(!values.includes(false));
});
