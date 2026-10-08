import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { collectUsage, parseUsageCache } from "../src/usage-cache.ts";
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function until(check: () => boolean | Promise<boolean>) {
	for (let n = 0; n < 400; n++) { if (await check()) return; await sleep(20); }
	throw new Error("cache fixture timed out");
}
async function fixture(t: any) {
	const root = await mkdtemp(join(tmpdir(), "pi-signals-cache-")), bin = join(root, "bin"), cache = join(root, "cache"), directory = join(cache, "industrial-os", "signals-collector"), log = join(root, "calls.jsonl");
	await mkdir(bin); await mkdir(directory, { recursive: true });
	const saved = { ...process.env };
	Object.assign(process.env, { PATH: bin, XDG_CACHE_HOME: cache, SIGNALS_FIXTURE: root });
	const fake = join(bin, "codexbar");
	await writeFile(fake, `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'); const root=process.env.SIGNALS_FIXTURE,provider=process.argv[4];
fs.appendFileSync(path.join(root,'calls.jsonl'),JSON.stringify({pid:process.pid,provider,args:process.argv.slice(2)})+'\\n');
let mode='good'; try { mode=fs.readFileSync(path.join(root,'mode'),'utf8'); } catch {}
if(mode==='hold') { setInterval(()=>{},1000); }
else if(mode==='failed') { console.log(JSON.stringify([{provider,error:{message:'Secret person@example.invalid'}}])); process.exitCode=1; }
else console.log(JSON.stringify([{provider,identity:{email:'person@example.invalid'},usage:{updatedAt:new Date().toISOString(),primary:{windowMinutes:300,usedPercent:25,resetsAt:new Date(Date.now()+3600000).toISOString(),account:'Secret'},extraRateWindows:[{secret:'Secret'}]}}]));
`); await chmod(fake, 0o755);
	const file = join(directory, "usage.json"), lock = join(directory, "usage.lock");
	const calls = async () => { try { return (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map((s) => JSON.parse(s)); } catch { return []; } };
	const read = async () => JSON.parse(await readFile(file, "utf8"));
	t.after(async () => { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); await rm(root, { recursive: true, force: true }); });
	return { root, bin, directory, file, lock, calls, read };
}
const sample = (fetchedAt = Date.now(), usedPercent = 10) => ({ installed: true, fetchedAt, providers: ["codex", "claude", "kimi"].map((provider) => ({ provider, data: { fetchedAt, updatedAt: null, windows: { wk: { usedPercent, resetsAt: null } } } })) });
async function atomic(file: string, value: unknown) { const temporary = file + ".fixture"; await writeFile(temporary, JSON.stringify(value), { mode: 0o600 }); await rename(temporary, file); }

test("cache whitelist validates numbers/unions and never retains identity/raw output/unknown fields", () => {
	const raw = sample(); Object.assign(raw, { identity: "secret" }); Object.assign(raw.providers[0], { account: "secret" }); Object.assign(raw.providers[0].data, { identity: "secret" }); Object.assign(raw.providers[0].data.windows.wk, { email: "secret" });
	assert.doesNotMatch(JSON.stringify(parseUsageCache(raw)), /secret|identity|email|account/);
	for (const value of [null, {}, { ...raw, installed: null }, { ...raw, fetchedAt: NaN }, { ...raw, providers: [] }, { ...raw, providers: [raw.providers[0], raw.providers[0], raw.providers[2]] }, { ...raw, providers: [{ provider: "codex", failure: "cancelled" }, ...raw.providers.slice(1)] }]) assert.equal(parseUsageCache(value), null);
});

test("two independent processes contend: one winner runs three providers, loser only watches; atomic 0600 whitelist", async (t) => {
	const f = await fixture(t), module = pathToFileURL(resolve("src/usage-cache.ts")).href;
	const children: any[] = [], outputs: any[] = [], seen: unknown[] = [];
	const watcher = watch(f.directory, async (_e, name) => { if (name?.toString() === "usage.json") { try { seen.push(await f.read()); } catch (e) { seen.push(e); } } });
	t.after(() => watcher.close());
	const code = `import {collectUsage} from ${JSON.stringify(module)};
const keep=setInterval(()=>{},1000); const collector=collectUsage(s=>{if(s.installed===true)process.send(s)});
process.on('message',()=>{collector.dispose();clearInterval(keep);process.disconnect();});`;
	for (let n = 0; n < 2; n++) {
		const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe", "ipc"] }); children.push(child);
		let stderr = ""; child.stderr.on("data", (s) => { stderr += s; }); child.on("message", (s) => outputs.push({ child, s }));
		t.after(async () => { if (child.connected) child.send("dispose"); if (child.exitCode === null) await new Promise((done) => child.once("close", done)); assert.equal(child.exitCode, 0, stderr); });
	}
	await until(() => new Set(outputs.map((o) => o.child.pid)).size === 2); await until(async () => (await f.calls()).length === 3);
	const calls = await f.calls(); assert.deepEqual(calls.map((c) => c.provider).sort(), ["claude", "codex", "kimi"]);
	assert.equal((await stat(f.file)).mode & 0o777, 0o600); assert.doesNotMatch(await readFile(f.file, "utf8"), /Secret|person@|identity|extraRateWindows|account/);
	assert.ok(seen.length > 0 && seen.every((s: any) => parseUsageCache(s) !== null));
	await until(async () => !(await readdir(f.directory)).includes("usage.lock"));
	assert.deepEqual(await readdir(f.directory), ["usage.json"]);
	await sleep(300); assert.equal((await f.calls()).length, 3, "fresh cache never invokes CodexBar");
});

test("fs.watch reloads another session's atomic writes without polling or CLI calls", async (t) => {
	const f = await fixture(t); await atomic(f.file, sample()); const values: any[] = [];
	const collector = collectUsage((s) => values.push(s)); t.after(() => collector.dispose());
	assert.equal(values.at(-1).providers[0].data.windows.wk.usedPercent, 10);
	await atomic(f.file, sample(Date.now(), 55)); await until(() => values.at(-1).providers[0].data.windows.wk.usedPercent === 55);
	assert.equal((await f.calls()).length, 0);
	collector.dispose(); const count = values.length; await atomic(f.file, sample(Date.now(), 70)); await sleep(300); assert.equal(values.length, count);
});

test("fresh lock losers never fetch; stale lock takeover is allowed after three minutes", async (t) => {
	const f = await fixture(t); await writeFile(f.lock, JSON.stringify({ pid: 1234, time: Date.now() }), { mode: 0o600 });
	const values: any[] = [], loser = collectUsage((s) => values.push(s)); await sleep(500); assert.equal((await f.calls()).length, 0); loser.dispose();
	await writeFile(f.lock, JSON.stringify({ pid: 1234, time: Date.now() - 4 * 60000 }));
	const winner = collectUsage((s) => values.push(s)); t.after(() => winner.dispose()); await until(() => values.at(-1).installed === true);
	assert.equal((await f.calls()).length, 3); assert.equal((await f.read()).installed, true);
});

test("failures keep last good per-provider sample and cache failure so another collector does not retry", async (t) => {
	const f = await fixture(t), old = sample(Date.now() - 6 * 60000); await atomic(f.file, old); await writeFile(join(f.root, "mode"), "failed");
	let last: any; const collector = collectUsage((s) => { last = s; }); t.after(() => collector.dispose());
	await until(() => last.providers.every((p: any) => p.failure === "failed"));
	const cache = await f.read(); assert.ok(cache.fetchedAt > old.fetchedAt); assert.deepEqual(cache.providers.map((p: any) => p.data), old.providers.map((p) => p.data));
	assert.doesNotMatch(JSON.stringify(cache), /Secret|person@/); const other = collectUsage(() => {}); t.after(() => other.dispose()); await sleep(400); assert.equal((await f.calls()).length, 3);
});

test("missing executable hides usage and is cached; timeout is shared and disposal cancels without stale write", async (t) => {
	const f = await fixture(t); await rm(join(f.bin, "codexbar")); let last: any;
	const absent = collectUsage((s) => { last = s; }); await until(() => last.installed === false); absent.dispose();
	assert.equal((await f.read()).installed, false); assert.equal((await f.calls()).length, 0);
	await rm(f.file);
	// Fake hung providers respond only to process termination; mock deadlines, not subprocess delivery.
	await writeFile(join(f.bin, "codexbar"), `#!${process.execPath}\nrequire('node:fs').appendFileSync(${JSON.stringify(join(f.root, "calls.jsonl"))},JSON.stringify({pid:process.pid})+'\\n');setInterval(()=>{},1000);`); await chmod(join(f.bin, "codexbar"), 0o755);
	const realSetTimeout = setTimeout;
	t.mock.timers.enable({ apis: ["setTimeout"], now: Date.now() });
	const hung = collectUsage((s) => { last = s; }); t.after(() => hung.dispose()); t.mock.timers.tick(250);
	for (let i = 0; i < 100 && (await f.calls()).length < 3; i++) await new Promise((done) => realSetTimeout(done, 20));
	assert.equal((await f.calls()).length, 3); t.mock.timers.tick(60000);
	for (let i = 0; i < 100 && !last.providers.every((p: any) => p.failure === "timeout"); i++) await new Promise((done) => realSetTimeout(done, 20));
	assert.ok(last.providers.every((p: any) => p.failure === "timeout")); hung.dispose();
	t.mock.timers.reset();
	await atomic(f.file, sample(Date.now() - 6 * 60000)); const saved = await readFile(f.file, "utf8");
	const cancelled = collectUsage(() => {}); await until(async () => (await f.calls()).length === 6); cancelled.dispose(); await sleep(150);
	assert.equal(await readFile(f.file, "utf8"), saved, "disposed collector never writes aborted results");
});

test("one five-minute freshness timer plus jitter: no early fetch, next round failure stays shared", async (t) => {
	const f = await fixture(t); const at = Date.now(); await atomic(f.file, sample(at));
	const realTimer = setTimeout; t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: at });
	let last: any; const collector = collectUsage((s) => { last = s; }); t.after(() => collector.dispose());
	t.mock.timers.tick(299999); assert.equal((await f.calls()).length, 0);
	t.mock.timers.tick(251);
	const wait = async (check: () => boolean | Promise<boolean>) => {
		for (let i = 0; i < 150; i++) { if (await check()) return; await new Promise((done) => realTimer(done, 20)); }
		throw new Error("timed refresh fixture did not complete");
	};
	await wait(() => last.providers.every((p: any) => p.data?.windows["5h"]?.usedPercent === 25));
	await wait(async () => !(await readdir(f.directory)).includes("usage.lock"));
	assert.equal((await f.calls()).length, 3); const good = await f.read();
	await writeFile(join(f.root, "mode"), "failed"); t.mock.timers.tick(299999); assert.equal((await f.calls()).length, 3);
	t.mock.timers.tick(251); await wait(() => last.providers.every((p: any) => p.failure === "failed"));
	assert.equal((await f.calls()).length, 6); assert.ok((await f.read()).fetchedAt > good.fetchedAt); assert.deepEqual((await f.read()).providers.map((p: any) => p.data), good.providers.map((p: any) => p.data));
	collector.dispose();
});

test("a waiting collector retries promptly when a disposed lock holder releases without writing", async (t) => {
	const f = await fixture(t); await writeFile(join(f.root, "mode"), "hold");
	const holder = collectUsage(() => {}); t.after(() => holder.dispose());
	await until(async () => (await f.calls()).length === 3);
	let last: any; const waiter = collectUsage((s) => { last = s; }); t.after(() => waiter.dispose());
	await sleep(500); assert.equal((await f.calls()).length, 3, "waiter lost the fresh lock");
	await writeFile(join(f.root, "mode"), "good"); const released = Date.now(); holder.dispose();
	await until(() => last.installed === true);
	assert.ok(Date.now() - released < 4000, "not the three-minute stale deadline");
	assert.equal((await f.calls()).length, 6); assert.equal((await f.read()).installed, true);
});
