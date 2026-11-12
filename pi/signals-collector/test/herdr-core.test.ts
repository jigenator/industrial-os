import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { labelPublisher, runHc, signalsTerminal, SIGNALS_LABEL } from "../src/herdr-core.ts";
import type { SignalsSnapshot } from "../src/snapshot.ts";

// Never the real `hc` or a live herdr-core: the publisher gets an injected runner; runHc gets a fake `hc` on a fixture-only PATH.
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const snap = (seq: number, extra: Partial<SignalsSnapshot> = {}) => ({ version: 1, sessionId: "s", seq, flag: false, backgroundTasks: null, usage: { installed: true, providers: [{ provider: "usage-cld" }] }, ...extra }) as unknown as SignalsSnapshot;
function fakeRun() {
	const calls: { args: string[]; timeoutMs: number; at: number; killed: boolean; settle(ok: boolean): void }[] = [];
	const run = (args: string[], timeoutMs: number) => {
		let settle!: (ok: boolean) => void;
		const done = new Promise<boolean>((resolve) => { settle = resolve; });
		const call = { args, timeoutMs, at: performance.now(), killed: false, settle };
		calls.push(call);
		return { done, kill() { call.killed = true; settle(false); } };
	};
	return { calls, run, value: (n: number) => calls[n].args[2].slice(SIGNALS_LABEL.length + 1),
		async close(publisher: ReturnType<typeof labelPublisher>) { const closing = publisher.close(); calls.at(-1)?.settle(true); await closing; } };
}

test("publication needs a non-empty HC_TERMINAL_ID", () => {
	assert.equal(signalsTerminal({}), undefined);
	assert.equal(signalsTerminal({ HC_TERMINAL_ID: "" }), undefined);
	assert.equal(signalsTerminal({ HC_TERMINAL_ID: "t1" }), "t1");
});

test("label on the own terminal: the snapshot without usage, 2 s timeout, identical values skipped", async () => {
	const fake = fakeRun(), publisher = labelPublisher("t1", fake.run);
	publisher.publish(snap(1, { question: { text: "Quote \" and\nnewline ü", more: 0, since: 1 } } as any));
	assert.equal(fake.calls.length, 1);
	assert.deepEqual(fake.calls[0].args.slice(0, 2), ["label", "t1"]); assert.equal(fake.calls[0].timeoutMs, 2_000);
	assert.ok(fake.calls[0].args[2].startsWith("io.signals.v1="));
	const published = JSON.parse(fake.value(0));
	assert.equal(published.usage, undefined, "usage is not per session"); assert.equal(published.version, 1); assert.equal(published.question.text, "Quote \" and\nnewline ü");
	fake.calls[0].settle(true); await sleep(1_050);
	publisher.publish(snap(1, { question: { text: "Quote \" and\nnewline ü", more: 0, since: 1 } } as any));
	publisher.publish(snap(1, { question: { text: "Quote \" and\nnewline ü", more: 0, since: 1 }, usage: { installed: null, providers: [] } } as any));
	await sleep(20); assert.equal(fake.calls.length, 1, "identical to the last success, including a usage-only change");
	await fake.close(publisher);
});

test("latest wins under a 1000 ms start cap with one call in flight; failures are silent and not retried", async () => {
	const fake = fakeRun(), publisher = labelPublisher("t1", fake.run);
	publisher.publish(snap(1));
	for (let seq = 2; seq <= 5; seq++) publisher.publish(snap(seq));
	await sleep(1_100); assert.equal(fake.calls.length, 1, "one call in flight even after the interval");
	fake.calls[0].settle(true); await sleep(20);
	assert.equal(fake.calls.length, 2); assert.equal(JSON.parse(fake.value(1)).seq, 5, "only the latest queued value is written");
	publisher.publish(snap(6)); publisher.publish(snap(7));
	fake.calls[1].settle(false); await sleep(400); assert.equal(fake.calls.length, 2, "the next start waits for the 1000 ms cap");
	await sleep(700); assert.equal(fake.calls.length, 3); assert.equal(JSON.parse(fake.value(2)).seq, 7);
	assert.ok(fake.calls[2].at - fake.calls[1].at >= 1_000);
	fake.calls[2].settle(false); await sleep(1_100);
	assert.equal(fake.calls.length, 3, "a failed call is not retried until the next change");
	publisher.publish(snap(7)); await sleep(20);
	assert.equal(fake.calls.length, 4, "a value that never succeeded is not skipped as identical");
	fake.calls[3].settle(true); await fake.close(publisher);
});

test("close kills a write in flight, clears with a 1 s timeout, and fences everything after", async () => {
	const fake = fakeRun(), publisher = labelPublisher("t1", fake.run);
	publisher.publish(snap(1)); fake.calls[0].settle(true); await sleep(20);
	publisher.publish(snap(2)); publisher.publish(snap(3)); // second in the cap window, waiting
	await sleep(1_050); publisher.publish(snap(4));
	assert.equal(fake.calls.length, 2);
	const closing = publisher.close();
	assert.equal(fake.calls[1].killed, true, "the write in flight is killed, not awaited");
	assert.deepEqual(fake.calls[2].args, ["label", "t1", "io.signals.v1="]); assert.equal(fake.calls[2].timeoutMs, 1_000);
	fake.calls[2].settle(true); await closing;
	publisher.publish(snap(5)); await sleep(1_100);
	assert.equal(fake.calls.length, 3, "a closed publisher, and the cancelled queue, never write again");
	// Nothing ever attempted: nothing to clear and nothing spawned.
	const idle = fakeRun(); await labelPublisher("t1", idle.run).close(); assert.equal(idle.calls.length, 0);
});

test("runHc: hc from PATH with the inherited environment; exit status, missing hc and timeout are success or a silent false", async (t) => {
	const bin = await mkdtemp(join(tmpdir(), "signals-hc-")), log = join(bin, "log"), saved = process.env.PATH;
	t.after(async () => { process.env.PATH = saved; await rm(bin, { recursive: true, force: true }); });
	process.env.PATH = bin;
	assert.equal(await runHc(["label", "t1", "io.signals.v1="], 2_000).done, false, "missing hc");
	await writeFile(join(bin, "hc"), `#!/bin/sh\nprintf '%s|%s|%s|%s\\n' "$1" "$2" "$3" "$HC_TERMINAL_SOCKET" >> ${JSON.stringify(log)}\nif [ "$2" = slow ]; then exec /bin/sleep 5; fi\n[ "$2" = t1 ]\n`);
	await chmod(join(bin, "hc"), 0o755);
	process.env.HC_TERMINAL_SOCKET = "/fixture/socket"; t.after(() => { delete process.env.HC_TERMINAL_SOCKET; });
	assert.equal(await runHc(["label", "t1", 'io.signals.v1={"a":"b c"}'], 2_000).done, true);
	assert.equal(await runHc(["label", "t2", "io.signals.v1="], 2_000).done, false, "non-zero exit");
	const started = performance.now();
	assert.equal(await runHc(["label", "slow", "x"], 200).done, false, "timed out and killed");
	assert.ok(performance.now() - started < 1_000);
	const killed = runHc(["label", "slow", "x"], 2_000); await sleep(100); killed.kill(); assert.equal(await killed.done, false);
	assert.deepEqual((await readFile(log, "utf8")).trim().split("\n").slice(0, 2), ['label|t1|io.signals.v1={"a":"b c"}|/fixture/socket', "label|t2|io.signals.v1=|/fixture/socket"]);
});
