// The token sender against the fake Herdr server: diffing, batching, clearing, TTL renewal, failure state, the
// shutdown clear, and reload safety through the one stable source and clock-based sequence numbers.
import assert from "node:assert/strict";
import test from "node:test";
import { load } from "./host.ts";
import { startFakeHerdr, until } from "./fake-herdr.ts";

const { createTokenSender, nextSeq, SOURCE } = await load("src/sender.ts");
const { herdrRequest } = await load("src/herdr-client.ts");
const { TOKEN_KEYS } = await load("src/tokens.ts");

async function setup(t: any, options: Record<string, unknown> = {}) {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	const request = (params: object, timeoutMs: number) => herdrRequest(herdr.socketPath, "pane.report_metadata", params, timeoutMs);
	const sender = createTokenSender({ paneId: herdr.paneId, request, ...options });
	t.after(() => sender.shutdown());
	return { herdr, sender };
}
const map = (tokens: Map<string, string>) => Object.fromEntries([...tokens].sort());
const sorted = (tokens: object) => Object.fromEntries(Object.entries(tokens).sort());
const FIRST = { g1: "◐ WRK⠀", g2_au0: "??AU", bar_unk: "─────────── --%", cmpx: "CMP×??" };

test("the first report sets the applicable keys and clears every other key, 16 keys per request, clears first", async (t) => {
	const { herdr, sender } = await setup(t);
	herdr.tokens.set("proj", "stale"); herdr.tokens.set("summary", "another reporter's token");
	sender.update(FIRST);
	await until(() => sender.state.synced, "first report");
	const reports = herdr.reports();
	assert.equal(reports.length, 2);
	const keys = reports.flatMap((r) => Object.keys(r.params.tokens));
	assert.deepEqual([...keys].sort(), [...TOKEN_KEYS].sort());
	for (const r of reports) {
		assert.ok(Object.keys(r.params.tokens).length <= 16);
		assert.equal(r.params.source, SOURCE);
		assert.equal(r.params.pane_id, herdr.paneId);
		assert.equal(r.params.ttl_ms, 60_000);
	}
	assert.ok(reports[1].params.seq > reports[0].params.seq);
	const values = reports.flatMap((r) => Object.values(r.params.tokens));
	assert.ok(values.indexOf(null) === 0 && values.lastIndexOf(null) < values.findIndex((value) => value !== null), "clears precede sets");
	// The stale key is gone; a key outside the list is left to its owner.
	assert.deepEqual(map(herdr.tokens), sorted({ ...FIRST, summary: "another reporter's token" }));
	assert.equal(sender.state.accepted, 2);
});

test("later reports send only what changed, clear keys that stopped applying, and send nothing when nothing changed", async (t) => {
	const { herdr, sender } = await setup(t);
	sender.update(FIRST);
	await until(() => sender.state.synced, "first report");
	const before = herdr.reports().length;
	sender.update({ ...FIRST, bar_unk: undefined, bar: "━━━━━━━━─── 67%", proj: "tatsu-cli" });
	await until(() => herdr.reports().length === before + 1 && sender.state.synced, "diff");
	assert.deepEqual(herdr.reports().at(-1)!.params.tokens, { bar_unk: null, bar: "━━━━━━━━─── 67%", proj: "tatsu-cli" });
	sender.update({ ...FIRST, bar_unk: undefined, bar: "━━━━━━━━─── 67%", proj: "tatsu-cli" });
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(herdr.reports().length, before + 1);
	assert.deepEqual(map(herdr.tokens), sorted({ g1: "◐ WRK⠀", g2_au0: "??AU", bar: "━━━━━━━━─── 67%", cmpx: "CMP×??", proj: "tatsu-cli" }));
});

test("rapid updates coalesce: one request in flight, then the latest state", async (t) => {
	const { herdr, sender } = await setup(t);
	herdr.setReportDelay(40);
	sender.update(FIRST);
	for (let n = 0; n < 20; n++) sender.update({ ...FIRST, proj: `p${n}` });
	await until(() => sender.state.synced && herdr.tokens.get("proj") === "p19", "latest state");
	assert.ok(herdr.reports().length <= 4, `${herdr.reports().length} requests`);
});

test("the TTL is renewed with a full report well before it expires", async (t) => {
	const { herdr, sender } = await setup(t, { ttlMs: 600, renewMs: 120 });
	sender.update(FIRST);
	await until(() => herdr.reports().length >= 6, "two renewals");
	const reports = herdr.reports();
	for (const r of reports) assert.equal(r.params.ttl_ms, 600);
	// Each renewal is a full report: every key set again or cleared.
	const renewal = reports.slice(2, 4).flatMap((r) => Object.keys(r.params.tokens));
	assert.equal(renewal.length, 28);
	assert.ok(reports[2].at - reports[0].at >= 100 && reports[2].at - reports[0].at < 600);
});

test("each TTL renewal calls onRenew, so unannounced inputs are re-read on the same cycle; none after shutdown", async (t) => {
	let renewals = 0;
	const { herdr, sender } = await setup(t, { ttlMs: 600, renewMs: 80, onRenew: () => { renewals++; } });
	sender.update(FIRST);
	await until(() => renewals >= 2, "two renewals");
	// A full report is two requests (28 keys, 16 per request): the first, then one per renewal.
	await until(() => herdr.reports().length >= 2 * (renewals + 1), "a full report per renewal");
	await sender.shutdown(); const count = renewals;
	await new Promise((done) => setTimeout(done, 200));
	assert.equal(renewals, count);
});

test("a failed report is not success-shaped: unsynced with its cause, then retried in full", async (t) => {
	const { herdr, sender } = await setup(t, { retryMs: 100, requestTimeoutMs: 150 });
	herdr.setReportMode("error");
	sender.update(FIRST);
	await until(() => sender.state.lastError !== undefined, "failure");
	assert.equal(sender.state.synced, false);
	assert.match(sender.state.lastError, /internal_error/);
	herdr.setReportMode("silent");
	await until(() => /timed out/.test(sender.state.lastError ?? ""), "timeout");
	assert.equal(sender.state.synced, false);
	herdr.setReportMode("ok");
	await until(() => sender.state.synced, "recovery");
	assert.equal(sender.state.lastError, undefined);
	assert.deepEqual(map(herdr.tokens), sorted(FIRST));
	// A Herdr-side rejection, such as a pane at its key limit, is a failure too.
	for (let n = 0; n < 30; n++) herdr.tokens.set(`other${n}`, "x");
	sender.update({ ...FIRST, proj: "p", mthink: "m" });
	await until(() => /metadata_token_limit/.test(sender.state.lastError ?? ""), "limit");
	assert.equal(sender.state.synced, false);
});

test("shutdown stops reporting and clears every key, bounded even when Herdr does not answer", async (t) => {
	const { herdr, sender } = await setup(t, { renewMs: 50 });
	sender.update({ ...FIRST, proj: "x" });
	await until(() => sender.state.synced, "first report");
	await sender.shutdown();
	assert.equal(herdr.tokens.size, 0);
	const clears = herdr.reports().slice(-2).flatMap((r) => Object.entries(r.params.tokens));
	assert.equal(clears.length, 28);
	assert.ok(clears.every(([, value]) => value === null));
	const count = herdr.reports().length;
	sender.update(FIRST);
	await new Promise((resolve) => setTimeout(resolve, 150));
	assert.equal(herdr.reports().length, count, "no report or renewal after shutdown");

	const silent = await setup(t, { shutdownTimeoutMs: 300, requestTimeoutMs: 1000 });
	silent.sender.update(FIRST);
	await until(() => silent.sender.state.synced, "first report");
	silent.herdr.setReportMode("silent");
	const started = Date.now();
	await silent.sender.shutdown();
	assert.ok(Date.now() - started < 700, `shutdown took ${Date.now() - started} ms`);
});

test("reload safety: a replaced runtime's late clear is ignored, and every runtime uses the one source", async (t) => {
	const herdr = await startFakeHerdr();
	t.after(() => herdr.close());
	const live = (params: object, timeoutMs: number) => herdrRequest(herdr.socketPath, "pane.report_metadata", params, timeoutMs);
	const old = createTokenSender({ paneId: herdr.paneId, request: live });
	old.update({ ...FIRST, proj: "old" });
	await until(() => old.state.synced, "old runtime report");
	// The old runtime's shutdown clear is composed now but its requests are delayed in transit.
	const held: object[] = [];
	const late = createTokenSender({ paneId: herdr.paneId, request: async (params: object) => { held.push(params); return { ok: true, result: {} }; } });
	late.update({ ...FIRST, proj: "old" });
	await until(() => late.state.synced, "held runtime");
	held.length = 0;
	await late.shutdown();
	assert.equal(held.length, 2);
	const replacement = createTokenSender({ paneId: herdr.paneId, request: live });
	t.after(() => replacement.shutdown());
	replacement.update({ ...FIRST, proj: "new" });
	await until(() => replacement.state.synced, "new runtime report");
	for (const params of held) assert.equal(herdr.apply(params), undefined);
	assert.equal(herdr.tokens.get("proj"), "new", "the late clear's lower seq is ignored");
	assert.equal(herdr.tokens.get("g1"), "◐ WRK⠀");
	await old.shutdown();

	// Forty runtimes in one pane still use one sequenced source, far from Herdr's limit of 32.
	for (let n = 0; n < 40; n++) {
		const runtime = createTokenSender({ paneId: herdr.paneId, request: live });
		runtime.update({ ...FIRST, proj: `r${n}` });
		await until(() => runtime.state.synced || runtime.state.lastError !== undefined, `runtime ${n}`);
		assert.equal(runtime.state.lastError, undefined);
		await runtime.shutdown();
	}
	assert.deepEqual([...herdr.sources], [SOURCE]);
});

test("nextSeq is microsecond wall-clock time and never repeats or goes backwards", () => {
	const a = nextSeq(1_000), b = nextSeq(1_000), c = nextSeq(500), d = nextSeq(Date.now());
	assert.ok(b > a && c > b && d > c);
	assert.ok(d >= Date.now() * 1000 - 1e6);
	assert.ok(Number.isSafeInteger(d));
});

test("persistent rejection backs off exponentially with jitter up to 60s, gates updates/renewals, resets after success", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_800_000_000_000 });
	t.mock.method(Math, "random", () => 0.5);
	const attempts: number[] = []; let reject = true;
	const sender = createTokenSender({ paneId: "fixture", request: async () => { attempts.push(Date.now()); return reject ? { ok: false, error: "rejected" } : { ok: true, result: {} }; } });
	t.after(() => sender.shutdown());
	const settle = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
	sender.update(FIRST); await settle(); assert.equal(attempts.length, 1);
	for (const delay of [5500, 11000, 22000, 44000, 60000, 60000]) {
		const count = attempts.length, at = Date.now();
		sender.update({ ...FIRST, proj: `p${count}` }); await settle();
		t.mock.timers.tick(delay - 1); await settle(); assert.equal(attempts.length, count);
		t.mock.timers.tick(1); await settle(); assert.equal(attempts.length, count + 1);
		assert.equal(attempts.at(-1)! - at, delay);
	}
	reject = false; t.mock.timers.tick(60000); await settle(); assert.equal(sender.state.synced, true);
	// Successful full report arms renewal; a failing diff cancels it until recovery.
	reject = true; sender.update({ ...FIRST, proj: "new" }); await settle(); const count = attempts.length;
	t.mock.timers.tick(5499); await settle(); assert.equal(attempts.length, count);
	t.mock.timers.tick(1); await settle(); assert.equal(attempts.length, count + 1, "success resets to 5s plus jitter");
	t.mock.timers.tick(11000); await settle(); assert.equal(attempts.length, count + 2);
	t.mock.timers.tick(20000 - 5500 - 11000); await settle(); assert.equal(attempts.length, count + 2, "renewal cannot bypass backoff");
});

test("success of the first batch does not reset backoff when every second batch is rejected", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_800_000_000_000 }); t.mock.method(Math, "random", () => 0);
	let requests = 0;
	const sender = createTokenSender({ paneId: "fixture", request: async () => ++requests % 2 ? { ok: true, result: {} } : { ok: false, error: "limit" } });
	t.after(() => sender.shutdown());
	const settle = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
	sender.update(FIRST); await settle(); assert.equal(requests, 2);
	t.mock.timers.tick(5000); await settle(); assert.equal(requests, 4);
	t.mock.timers.tick(9999); await settle(); assert.equal(requests, 4);
	t.mock.timers.tick(1); await settle(); assert.equal(requests, 6); assert.equal(sender.state.synced, false);
});
