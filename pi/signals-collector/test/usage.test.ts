import assert from "node:assert/strict";
import test from "node:test";
import { collectUsage, nextPollDelay, nextUsage, pendingUsage, usageSources } from "../src/usage.ts";
import type { UsageSnapshot } from "../src/usage.ts";
import { OK_AT, snapshot, status, usageItem } from "./source-collector-fixture.ts";

const at = (iso: string) => Date.parse(iso);
const ids = ["usage-gpt", "usage-cld"];
const facts = { updatedAt: "2026-10-31T07:59:00Z", h5: true, h5Used: 19, h5ResetsAt: "2026-10-31T12:20:00Z", wk: true, wkUsed: 6.5, wkResetsAt: "2026-11-05T19:00:00+08:00" };
const sample = { windows: { "5h": { usedPercent: 19, resetsAt: at("2026-10-31T12:20:00Z") }, wk: { usedPercent: 6.5, resetsAt: at("2026-11-05T19:00:00+08:00") } }, updatedAt: at("2026-10-31T07:59:00Z"), fetchedAt: at(OK_AT) };
const ok = (reply: unknown, previous: UsageSnapshot = pendingUsage(ids)) => nextUsage(ids, previous, reply);
const one = (source: { id: string }, items: unknown[] = []) => nextUsage([source.id], pendingUsage([source.id]), snapshot([source], items)).providers[0];

test("industrialOs.usageSources: ordered unique valid source ids; absent, invalid or empty is none", () => {
	for (const settings of [undefined, null, {}, { industrialOs: [] }, { industrialOs: {} }, { industrialOs: { usageSources: "usage-cld" } },
		{ industrialOs: { usageSources: [] } }, { industrialOs: { usageSources: ["usage-cld", "Usage"] } }, { industrialOs: { usageSources: ["usage-cld", ""] } },
		{ industrialOs: { usageSources: ["usage-cld", 5] } }, { industrialOs: { usageSources: ["a b"] } }, { industrialOs: { usageSources: ["x".repeat(65)] } },
		{ industrialOs: { usageSources: Array.from({ length: 257 }, (_, i) => `s${i}`) } }]) {
		assert.deepEqual(usageSources(settings), [], JSON.stringify(settings)?.slice(0, 80));
	}
	assert.deepEqual(usageSources({ industrialOs: { usageSources: ["usage-gpt", "usage-cld", "usage-gpt", "kimi_2"] } }), ["usage-gpt", "usage-cld", "kimi_2"]);
	assert.equal(usageSources({ industrialOs: { usageSources: Array.from({ length: 256 }, (_, i) => `s${i}`) } }).length, 256);
	assert.deepEqual(pendingUsage([]), { installed: null, providers: [] });
});

test("state table: configured order, tag/color, data from a valid usage item and failure from source health", () => {
	const reply = snapshot([status("usage-cld", { color: "usage.cld" }), status("usage-gpt", { color: "usage.gpt" })], [usageItem("usage-cld", facts), usageItem("usage-gpt", { wk: true, wkUsed: 25 })]);
	assert.deepEqual(ok(reply), { installed: true, providers: [
		{ provider: "usage-gpt", tag: "GPT", color: "usage.gpt", data: { windows: { wk: { usedPercent: 25, resetsAt: null } }, updatedAt: null, fetchedAt: at(OK_AT) } },
		{ provider: "usage-cld", tag: "CLD", color: "usage.cld", data: sample },
	] });
	assert.deepEqual(ok(snapshot([status("usage-cld")])).providers[0], { provider: "usage-gpt", failure: "failed" }, "absent id");
	const item = usageItem("usage-cld", facts);
	assert.deepEqual(one(status("usage-cld", { state: "stale", error: { code: "timeout", message: "Source timed out" } }), [item]), { provider: "usage-cld", tag: "CLD", data: sample, failure: "timeout" });
	assert.deepEqual(one(status("usage-cld", { state: "stale", error: { code: "command_failed", message: "exit 1" } }), [item]), { provider: "usage-cld", tag: "CLD", data: sample, failure: "failed" });
	for (const state of ["stale", "auth", "error", "planned", "config_error", "disabled", "unknown"]) {
		assert.deepEqual(one(status("usage-cld", { state, okAt: undefined })), { provider: "usage-cld", tag: "CLD", failure: "failed" }, state);
	}
	assert.deepEqual(one(status("usage-cld", { state: "loading", okAt: undefined })), { provider: "usage-cld", tag: "CLD" }, "loading is pending");
	assert.deepEqual(one(status("usage-cld", { state: "loading" }), [item]), { provider: "usage-cld", tag: "CLD", data: sample, failure: "failed" }, "loading with items is not healthy");
	assert.deepEqual(one(status("usage-cld")), { provider: "usage-cld", tag: "CLD" }, "ok without a usage item is no data");
});

test("usage items are validated defensively; any invalid known fact is no data", () => {
	const cld = status("usage-cld"), data = (items: unknown[], source = cld) => one(source, items).data;
	assert.deepEqual(data([usageItem("usage-cld")]), { windows: {}, updatedAt: null, fetchedAt: at(OK_AT) }, "no facts: no windows reported");
	assert.deepEqual(data([usageItem("usage-cld", { h5: false, wk: false, other: "ignored", wkUsed: 3 })]), { windows: {}, updatedAt: null, fetchedAt: at(OK_AT) });
	assert.deepEqual(data([usageItem("usage-cld", { h5: true })]), { windows: { "5h": { usedPercent: null, resetsAt: null } }, updatedAt: null, fetchedAt: at(OK_AT) });
	for (const bad of [{ h5: "yes" }, { h5: 1 }, { h5: true, h5Used: "19" }, { h5: true, h5ResetsAt: "tomorrow" }, { wk: true, wkResetsAt: "2026-10-31" },
		{ updatedAt: 1730000000000 }, { updatedAt: "2026-10-31T07:59:00Z".padEnd(41, "0") }]) {
		assert.equal(data([usageItem("usage-cld", bad)]), undefined, JSON.stringify(bad));
	}
	assert.equal(data([usageItem("usage-cld", undefined, { facts: [] })]), undefined, "facts must be an object");
	assert.equal(data([usageItem("usage-cld", facts)], status("usage-cld", { okAt: undefined })), undefined, "no receipt time");
	assert.equal(data([usageItem("usage-cld", facts)], status("usage-cld", { okAt: "yesterday" })), undefined);
	assert.equal(data([usageItem("usage-cld", facts, { key: "other" }), usageItem("usage-gpt", facts)]), undefined, "only this source's usage key");
	assert.deepEqual(one(status("usage-cld", { tag: "T".repeat(201), color: 7 })), { provider: "usage-cld" }, "tag/color are bounded strings");
});

test("engine unreachable: no earlier success stays unknown; after success data is kept and marked failed", () => {
	for (const reply of [undefined, null, {}, { ...snapshot([]), v: 2 }, { ...snapshot([]), sources: {} }, { ...snapshot([]), items: null }]) {
		assert.deepEqual(ok(reply), pendingUsage(ids), JSON.stringify(reply));
	}
	const success = ok(snapshot([status("usage-cld", { state: "loading", okAt: undefined }), status("usage-gpt")], [usageItem("usage-gpt", facts)]));
	const lost = ok(undefined, success);
	assert.deepEqual(lost, { installed: true, providers: [{ provider: "usage-gpt", tag: "GPT", data: { ...sample }, failure: "failed" }, { provider: "usage-cld", tag: "CLD" }] });
	assert.deepEqual(ok(undefined, lost), lost);
	assert.deepEqual(ok(snapshot([status("usage-gpt")], [usageItem("usage-gpt", facts)]), lost).providers[0], { provider: "usage-gpt", tag: "GPT", data: sample }, "recovery clears failure");
});

test("next poll follows the engine's nextAt: just after the earliest run, shortly while one runs, clamped", () => {
	const now = at(OK_AT), next = (ms: number) => new Date(now + ms).toISOString();
	const delay = (sources: unknown[]) => nextPollDelay(ids, snapshot(sources), now);
	assert.equal(delay([status("usage-gpt", { nextAt: next(120_000) }), status("usage-cld", { nextAt: next(240_000) })]), 125_000, "earliest nextAt plus margin");
	assert.equal(delay([status("usage-gpt", { nextAt: next(120_000) }), status("usage-cld")]), 10_000, "a running source (no nextAt) is checked shortly");
	assert.equal(delay([status("usage-gpt", { nextAt: next(-60_000) })]), 10_000, "overdue clamps to the minimum");
	assert.equal(delay([status("usage-gpt", { nextAt: next(15 * 60_000) })]), 5 * 60_000, "long idle intervals cap at five minutes");
	assert.equal(delay([status("usage-gpt", { state: "disabled" }), status("usage-cld", { state: "planned" }), status("other")]), 5 * 60_000, "never-running and unconfigured sources are ignored");
	assert.equal(delay([status("usage-gpt", { state: "config_error", nextAt: "nonsense" })]), 5 * 60_000);
	assert.equal(delay([]), 5 * 60_000, "no configured source in the reply");
	for (const reply of [undefined, {}, { ...snapshot([]), v: 2 }]) assert.equal(nextPollDelay(ids, reply, now), 60_000, "unreachable retries in a minute");
});

test("collector polls at once, then on the nextAt schedule while visible, on show, one request at a time; dispose aborts and fences", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: at(OK_AT) });
	const published: UsageSnapshot[] = [], signals: AbortSignal[] = [];
	let release: ((value: unknown) => void) | undefined;
	const request = (signal: AbortSignal) => { signals.push(signal); return new Promise((done) => { release = done; }); };
	const flush = () => new Promise((done) => setImmediate(done));
	const answer = async (value: unknown) => { release!(value); await flush(); };
	const scheduled = (ms: number) => snapshot([status("usage-cld", { nextAt: new Date(Date.now() + ms).toISOString() })], [usageItem("usage-cld", facts)]);

	const none = collectUsage([], () => assert.fail("no publish without sources"), () => assert.fail("no request without sources"));
	t.mock.timers.tick(5 * 60_000); none.setVisible(false); none.setVisible(true); none.dispose();

	const usage = collectUsage(["usage-cld"], (u) => published.push(u), request);
	assert.equal(signals.length, 1, "immediately at start");
	t.mock.timers.tick(10 * 60_000); assert.equal(signals.length, 1, "never overlaps an in-flight request");
	await answer(scheduled(120_000));
	assert.equal(published.at(-1)!.installed, true);
	t.mock.timers.tick(124_999); assert.equal(signals.length, 1, "waits for the next run");
	t.mock.timers.tick(1); assert.equal(signals.length, 2, "polls just after nextAt");
	await answer(snapshot([status("usage-cld")], [usageItem("usage-cld", facts)]));
	t.mock.timers.tick(10_000); assert.equal(signals.length, 3, "checks shortly while the source runs");
	await answer(undefined); assert.equal(published.at(-1)!.providers[0].failure, "failed");
	usage.setVisible(false); t.mock.timers.tick(10 * 60_000); assert.equal(signals.length, 3, "hidden panes do not poll");
	usage.setVisible(true); assert.equal(signals.length, 4, "showing polls at once");
	usage.setVisible(false); await answer(scheduled(30_000)); t.mock.timers.tick(10 * 60_000);
	assert.equal(signals.length, 4, "a reply that lands while hidden schedules nothing");
	usage.setVisible(true); assert.equal(signals.length, 5);
	await answer(Promise.reject(new Error("transport"))); await flush();
	t.mock.timers.tick(60_000); assert.equal(signals.length, 6, "unreachable retries in a minute");
	const before = published.length; usage.dispose();
	assert.equal(signals[5].aborted, true, "dispose aborts the in-flight request");
	await answer(scheduled(30_000)); t.mock.timers.tick(10 * 60_000); usage.setVisible(false); usage.setVisible(true);
	assert.equal(published.length, before, "no publish after dispose"); assert.equal(signals.length, 6, "no poll after dispose");
});
