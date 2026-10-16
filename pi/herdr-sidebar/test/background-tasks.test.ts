import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./host.ts";

const { readBackgroundRunning, isBackgroundUnavailable, isBackgroundTerminal } = await load("src/background-tasks.ts");
const response = (tasks: unknown) => ({ schema_version: "pi-background-tasks.extension-response.v1", operation: "status", ok: true, result: { tasks } });

test("readBackgroundRunning counts running only; malformed or unknown schema/status is unknown, not zero", () => {
	assert.equal(readBackgroundRunning(response([])), 0);
	assert.equal(readBackgroundRunning(response(["running", "completed", "failed", "killed", "running"].map((status, n) => ({ id: String(n), status, ignored: true })))), 2);
	for (const frame of [null, [], {}, response(null), response({}), response([null]), response([{ id: "", status: "running" }]), response([{ id: "a", status: "queued" }]), response([{ id: "a", status: "running" }, { id: "a", status: "running" }]), { ...response([]), schema_version: 2 }, { ...response([]), operation: "run" }, { ...response([]), ok: false }]) assert.equal(readBackgroundRunning(frame), null, JSON.stringify(frame));
});

test("terminal events validate their schema and consumed task fields; they are invalidations, not count deltas", () => {
	for (const status of ["completed", "failed", "killed"]) assert.equal(isBackgroundTerminal({ schema_version: "pi-background-tasks.extension-terminal.v1", task: { id: "a", status } }), true);
	for (const frame of [null, {}, { schema_version: 2, task: { id: "a", status: "completed" } }, { schema_version: "pi-background-tasks.extension-terminal.v1", task: { id: "a", status: "running" } }]) assert.equal(isBackgroundTerminal(frame), false);
});


test("startup retry accepts only the exact validated unavailable-before-session_start refusal", () => {
	const refusal = { ...response([]), ok: false, error: "pi-background-tasks EventBus service is unavailable before session_start" };
	assert.equal(isBackgroundUnavailable(refusal), true);
	for (const data of [null, {}, { ...refusal, schema_version: "unknown" }, { ...refusal, operation: "run" }, { ...refusal, ok: true }, { ...refusal, error: "pi-background-tasks EventBus service is shutting down" }]) assert.equal(isBackgroundUnavailable(data), false);
});
