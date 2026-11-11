import assert from "node:assert/strict";
import test from "node:test";
import { BACKGROUND_REQUEST_CHANNEL as REQUEST, BACKGROUND_RESPONSE_CHANNEL as RESPONSE, BACKGROUND_TERMINAL_CHANNEL as TERMINAL, collectBackgroundTasks, isBackgroundTerminal, isBackgroundUnavailable, readBackgroundRunning } from "../src/background-tasks.ts";

// Fake producer frames follow pi-background-tasks 2.6.9 core/extension-api.ts; no background-task package code is loaded.
const response = (tasks: unknown) => ({ schema_version: "pi-background-tasks.extension-response.v1", operation: "status", ok: true, result: { tasks } });
const reply = (request: any, statuses: string[] = []) => ({ ...response(statuses.map((status, n) => ({ id: `task-${n}`, status }))), request_id: request.request_id });
const refusal = (request: any) => ({ schema_version: "pi-background-tasks.extension-response.v1", request_id: request.request_id, operation: "status", ok: false, error: "pi-background-tasks EventBus service is unavailable before session_start" });
const terminal = { schema_version: "pi-background-tasks.extension-terminal.v1", task: { id: "task", status: "completed" } };

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
	const frame = refusal({ request_id: "r" });
	assert.equal(isBackgroundUnavailable(frame), true);
	for (const data of [null, {}, { ...frame, schema_version: "unknown" }, { ...frame, operation: "run" }, { ...frame, ok: true }, { ...frame, error: "pi-background-tasks EventBus service is shutting down" }]) assert.equal(isBackgroundUnavailable(data), false);
});

// A synchronous in-process bus like Pi's, and every timer the module creates, captured for manual firing.
function harness(t: any, { owned = () => true, answer = (request: any): unknown => reply(request) } = {}) {
	const listeners = new Map<string, Set<(data: unknown) => void>>();
	const events = {
		on(channel: string, listener: (data: unknown) => void) { if (!listeners.has(channel)) listeners.set(channel, new Set()); listeners.get(channel)!.add(listener); return () => { listeners.get(channel)!.delete(listener); }; },
		emit(channel: string, data: unknown) { for (const listener of [...(listeners.get(channel) ?? [])]) listener(data); },
	};
	const timers: { kind: "timeout" | "interval"; callback: () => void; delay: number; timer: NodeJS.Timeout }[] = [];
	for (const [name, kind] of [["setTimeout", "timeout"], ["setInterval", "interval"]] as const) {
		const original = globalThis[name];
		t.mock.method(globalThis, name, (callback: () => void, delay: number) => {
			const timer = (original as any)(() => {}, 1e9); timers.push({ kind, callback, delay, timer }); return timer;
		});
	}
	t.after(() => { for (const { timer } of timers) clearTimeout(timer); });
	const requests: any[] = [], published: (number | null)[] = [];
	events.on(REQUEST, (request) => { requests.push(request); const frame = answer?.(request); if (frame) events.emit(RESPONSE, frame); });
	const collector = collectBackgroundTasks({ events } as any, owned, (count) => published.push(count));
	return { events, timers, requests, published, collector, answer: (next: ((request: any) => unknown) | undefined) => { answer = next as any; },
		last: (delay: number) => timers.findLast((item) => item.delay === delay)! };
}

test("status request shape, count publication, terminal re-query and an unref'd 20 s re-query interval", (t) => {
	const h = harness(t);
	assert.deepEqual(h.requests.map(({ request_id: _id, ...rest }) => rest), [{ schema_version: "pi-background-tasks.extension-request.v1", operation: "status", payload: {} }]);
	assert.match(h.requests[0].request_id, /^[0-9a-f-]{36}$/);
	assert.deepEqual(h.published, [0]);
	h.answer((request) => reply(request, ["running", "completed", "running"]));
	h.events.emit(TERMINAL, { ...terminal, schema_version: "unknown" }); assert.equal(h.requests.length, 1, "invalid terminal frame");
	h.events.emit(TERMINAL, terminal); assert.deepEqual(h.published, [0, 2]);
	h.events.emit(TERMINAL, terminal); assert.deepEqual(h.published, [0, 2, 2], "duplicate terminal events re-read, never decrement");
	const interval = h.timers.find((item) => item.kind === "interval")!;
	assert.equal(interval.delay, 20_000); assert.equal(interval.timer.hasRef(), false);
	interval.callback(); assert.equal(h.requests.length, 4, "re-query starts /bg and UI tasks the producer never announces");
	h.collector.dispose();
	assert.equal((interval.timer as any)._destroyed, true);
	interval.callback(); h.events.emit(TERMINAL, terminal); h.collector.refresh(); assert.equal(h.requests.length, 4, "nothing after disposal");
});

test("one request in flight: triggers coalesce, stale and wrong-id answers never supply a count, late answers are fenced", (t) => {
	const h = harness(t, { answer: () => undefined });
	const first = h.requests[0];
	h.collector.refresh(); h.events.emit(TERMINAL, terminal); assert.equal(h.requests.length, 1, "one in flight");
	h.events.emit(RESPONSE, { ...reply(first, ["running"]), request_id: "wrong" }); assert.equal(h.requests.length, 1);
	h.events.emit(RESPONSE, reply(first, ["running"])); assert.equal(h.requests.length, 2, "one coalesced follow-up");
	assert.deepEqual(h.published, [], "a stale running count is not published");
	h.events.emit(RESPONSE, reply(h.requests[1], ["running"])); assert.deepEqual(h.published, [1]);
	h.events.emit(RESPONSE, reply(first)); assert.deepEqual(h.published, [1], "late answer to an old id");
	for (const malformed of [(r: any) => ({ ...reply(r, ["running"]), schema_version: "v2" }), (r: any) => ({ ...reply(r), ok: false }), (r: any) => ({ ...reply(r), result: { tasks: [{ id: "a", status: "queued" }] } }), (r: any) => ({ request_id: r.request_id })]) {
		h.collector.refresh(); h.events.emit(RESPONSE, malformed(h.requests.at(-1)));
	}
	assert.deepEqual(h.published, [1, null, null, null, null], "malformed is unknown, never zero");
	h.collector.refresh(); const timedOut = h.requests.at(-1), deadline = h.last(1_500);
	assert.equal(deadline.timer.hasRef(), false); deadline.callback(); assert.equal(h.published.at(-1), null, "timeout is unknown");
	h.events.emit(RESPONSE, reply(timedOut, ["running"])); assert.equal(h.published.at(-1), null, "late answer after the deadline");
	h.collector.refresh(); const pending = h.requests.at(-1), open = h.last(1_500); h.collector.dispose();
	assert.equal((open.timer as any)._destroyed, true, "disposal clears the request deadline");
	const count = h.published.length; h.events.emit(RESPONSE, reply(pending, ["running"])); assert.equal(h.published.length, count);
});

test("the readiness refusal retries once after an unref'd second; triggers coalesce into it and a second refusal cannot loop", (t) => {
	let ready = false;
	const h = harness(t, { answer: (request) => ready ? reply(request, ["running"]) : refusal(request) });
	assert.deepEqual(h.published, [null], "a refusal is unknown");
	const retry = h.last(1_000);
	assert.ok(retry); assert.equal(retry.timer.hasRef(), false);
	h.collector.refresh(); h.events.emit(TERMINAL, terminal); assert.equal(h.requests.length, 1, "triggers wait for the pending retry");
	retry.callback(); assert.equal(h.requests.length, 2); assert.deepEqual(h.published, [null, null]);
	assert.equal(h.timers.filter((item) => item.delay === 1_000).length, 1, "a second refusal schedules no retry");
	ready = true; h.collector.refresh(); assert.deepEqual(h.published, [null, null, 1], "a later trigger recovers");
	h.collector.dispose();
});

test("disposal clears a pending startup retry and fences its callback", (t) => {
	const second = harness(t, { answer: refusal });
	const pending = second.last(1_000); second.collector.dispose();
	assert.equal((pending.timer as any)._destroyed, true);
	pending.callback(); assert.equal(second.requests.length, 1);
});

test("an obsolete session owner neither requests nor publishes", (t) => {
	let owned = true;
	const h = harness(t, { owned: () => owned, answer: () => undefined });
	owned = false;
	h.events.emit(RESPONSE, reply(h.requests[0], ["running"])); h.collector.refresh(); h.events.emit(TERMINAL, terminal);
	assert.equal(h.requests.length, 1); assert.deepEqual(h.published, []);
	h.collector.dispose();
});
