import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { inspectSharedPullRequest, parsePrCache, prAuthContext } from "../src/pr-cache.ts";
const repository = { kind: "repository" as const, name: "Owner/project", url: "https://github.com/Owner/project" };
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
async function until(check: () => boolean | Promise<boolean>) {
	for (let n = 0; n < 400; n++) { if (await check()) return; await sleep(20); }
	throw new Error("PR fixture timed out");
}
async function fixture(t: any) {
	const root = await mkdtemp(join(tmpdir(), "pi-pr-cache-")), bin = join(root, "bin"), home = join(root, "home");
	await mkdir(bin); await mkdir(home);
	const saved = { ...process.env }, keep = setInterval(() => {}, 1000);
	Object.assign(process.env, { PATH: bin, HOME: home, XDG_CACHE_HOME: join(root, "cache"), PR_FIXTURE: root });
	for (const key of ["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA"]) delete process.env[key];
	await writeFile(join(bin, "gh"), `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),root=process.env.PR_FIXTURE;
fs.appendFileSync(path.join(root,'calls'),JSON.stringify({args:process.argv.slice(2),pid:process.pid})+'\\n');
let mode='good';try{mode=fs.readFileSync(path.join(root,'mode'),'utf8')}catch{}
if(mode==='hold')setInterval(()=>{},1000);
else if(mode==='open')console.log(JSON.stringify([{number:7,state:'open',html_url:'https://github.com/Owner/project/pull/7',head:{ref:'feature/safe',repo:{full_name:'Owner/project'}},base:{repo:{full_name:'Owner/project'}},identity:'Secret'}]));
else if(mode==='failed'){process.stderr.write('HTTP 401 private-token person@example.invalid');process.exitCode=1}
else setTimeout(()=>console.log('[]'),100);
`); await chmod(join(bin, "gh"), 0o755);
	const directory = join(root, "cache", "industrial-os", "signals-collector", "pr"), file = join(directory, "cache.json"), lock = join(directory, "refresh.lock");
	const calls = async () => { try { return (await readFile(join(root, "calls"), "utf8")).trim().split("\n").filter(Boolean).map((v) => JSON.parse(v)); } catch { return []; } };
	const read = async () => JSON.parse(await readFile(file, "utf8"));
	t.after(async () => { clearInterval(keep); for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); await rm(root, { recursive: true, force: true }); });
	return { root, home, bin, directory, file, lock, calls, read };
}
async function worker(t: any, branch = "feature/safe", env = process.env) {
	const module = pathToFileURL(resolve("src/pr-cache.ts")).href;
	const code = `import {inspectSharedPullRequest} from ${JSON.stringify(module)};
const keep=setInterval(()=>{},1000),controller=new AbortController();
process.on('message',async m=>{if(m==='abort')controller.abort();else if(m==='go'){const r=await inspectSharedPullRequest(${JSON.stringify(repository)},${JSON.stringify(branch)},{signal:controller.signal});process.send(r);clearInterval(keep);process.disconnect();}});process.send('ready');`;
	const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], { env: { ...env }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
	let ready = false, result: any, stderr = "";
	child.stderr.on("data", (s) => { stderr += s; }); child.on("message", (s) => { if (s === "ready") ready = true; else result = s; });
	t.after(async () => { if (child.connected) child.send("abort"); if (child.exitCode === null) child.kill("SIGKILL"); await new Promise((done) => { if (child.exitCode !== null || child.signalCode !== null) done(undefined); else child.once("close", done); }); });
	await until(() => ready);
	return { child, go: () => child.send("go"), result: () => result, stderr: () => stderr };
}

test("whitelist rejects invalid keys/unions/timestamps and drops unknown/raw fields", () => {
	const entry = { key: "a".repeat(64), at: Date.now(), value: { kind: "none", token: "Secret" }, identity: "Secret" };
	const raw = { version: 1, entries: [entry], raw: "Secret" };
	assert.doesNotMatch(JSON.stringify(parsePrCache(raw)), /Secret|token|identity|raw/);
	for (const entries of [[{ ...entry, key: "../escape" }], [{ ...entry, at: NaN }], [{ ...entry, value: { kind: "unavailable", reason: "raw secret" } }], [entry, entry], Array(129).fill(entry)]) assert.equal(parsePrCache({ version: 1, entries }), null);
	assert.equal(parsePrCache({ version: 2, entries: [] }), null);
	assert.equal(parsePrCache({ version: 1, entries: [{ ...entry, value: { kind: "open", number: 1, url: `https://github.com/Owner/${"a".repeat(500)}/pull/1` } }] }), null);
});

test("independent simultaneous processes share one invocation, exact timestamp, private bounded atomic cache", async (t) => {
	const f = await fixture(t), a = await worker(t), b = await worker(t);
	a.go(); b.go(); await until(() => !!a.result() && !!b.result());
	assert.deepEqual(a.result(), b.result()); assert.equal(a.result().value.kind, "none"); assert.equal((await f.calls()).length, 1);
	assert.equal((await stat(f.directory)).mode & 0o777, 0o700); assert.equal((await stat(f.file)).mode & 0o777, 0o600);
	assert.deepEqual(await readdir(f.directory), ["cache.json"]);
	assert.equal(parsePrCache(await f.read())?.length, 1);
	const hit = await inspectSharedPullRequest(repository, "feature/safe"); assert.equal(hit.at, a.result().at); assert.equal((await f.calls()).length, 1);
});

test("expiry refreshes; repository, branch and default HOME/config metadata isolate keys", async (t) => {
	const f = await fixture(t); await inspectSharedPullRequest(repository, "feature/safe");
	const old = await f.read(); old.entries[0].at = Date.now() - 60001; await writeFile(f.file, JSON.stringify(old));
	await inspectSharedPullRequest(repository, "feature/safe"); assert.equal((await f.calls()).length, 2);
	await inspectSharedPullRequest(repository, "other");
	await inspectSharedPullRequest({ ...repository, name: "Other/project", url: "https://github.com/Other/project" }, "other");
	const context = prAuthContext(); await mkdir(join(f.home, ".config", "gh"), { recursive: true }); await writeFile(join(f.home, ".config", "gh", "hosts.yml"), "not credentials");
	assert.notEqual(prAuthContext(), context); await inspectSharedPullRequest(repository, "feature/safe");
	const alternate = join(f.root, "alternate-home"); await mkdir(alternate); process.env.HOME = alternate;
	await inspectSharedPullRequest(repository, "feature/safe"); assert.equal((await f.calls()).length, 6);
	assert.doesNotMatch(await readFile(f.file, "utf8"), /not credentials|alternate-home|hosts.yml/);
});

test("explicit token/config overrides never read or write shared positive/negative results", async (t) => {
	const f = await fixture(t); await inspectSharedPullRequest(repository, "feature/safe"); const before = await readFile(f.file, "utf8");
	for (const key of ["GH_TOKEN", "GITHUB_TOKEN", "GH_CONFIG_DIR", "XDG_CONFIG_HOME", "APPDATA"]) {
		process.env[key] = "private-token"; assert.equal(prAuthContext(), null);
		await writeFile(join(f.root, "mode"), "failed");
		assert.equal((await inspectSharedPullRequest(repository, "feature/safe")).value.kind, "unavailable");
		assert.equal(await readFile(f.file, "utf8"), before); delete process.env[key];
	}
	assert.equal((await f.calls()).length, 6); assert.doesNotMatch(before, /private-token/);
	// Divergent auth processes both use their own gh calls, not the default negative cached above.
	const a = await worker(t, "feature/safe", { ...process.env, GH_TOKEN: "a-private-token" }), b = await worker(t, "feature/safe", { ...process.env, GITHUB_TOKEN: "b-private-token" });
	a.go(); b.go(); await until(() => !!a.result() && !!b.result()); assert.equal((await f.calls()).length, 8);
});

test("failures are safely cached; oversized/malformed files recover without diagnostics", async (t) => {
	const f = await fixture(t); await writeFile(join(f.root, "mode"), "failed");
	const a = await inspectSharedPullRequest(repository, "feature/safe"), b = await inspectSharedPullRequest(repository, "feature/safe");
	assert.deepEqual(a, b); assert.equal(a.value.kind, "unavailable"); assert.equal((await f.calls()).length, 1);
	assert.doesNotMatch(await readFile(f.file, "utf8"), /private-token|person@|HTTP 401/);
	for (const body of ["not json", "x".repeat(1024 * 1024 + 1)]) {
		await writeFile(f.file, body); await inspectSharedPullRequest(repository, "feature/safe"); assert.ok(parsePrCache(await f.read()));
	}
	assert.equal((await f.calls()).length, 3);
	// Long valid branch names are hashed, never turned into paths or an uncoordinated bypass.
	await inspectSharedPullRequest(repository, "x".repeat(2048)); await inspectSharedPullRequest(repository, "x".repeat(2048));
	assert.equal((await f.calls()).length, 4);
});

test("abandoned stale lock recovers; cancellation kills holder, releases lock and wakes waiter without aborted write", async (t) => {
	const f = await fixture(t); await mkdir(f.directory, { recursive: true });
	await writeFile(f.lock, "abandoned", { mode: 0o600 }); const old = new Date(Date.now() - 31000); await utimes(f.lock, old, old);
	await inspectSharedPullRequest(repository, "feature/safe"); assert.equal((await f.calls()).length, 1);
	await rm(f.file); await writeFile(join(f.root, "mode"), "hold");
	const controller = new AbortController(), holder = inspectSharedPullRequest(repository, "feature/safe", { signal: controller.signal });
	await until(async () => (await f.calls()).length === 2);
	const waiter = await worker(t); waiter.go(); await sleep(150); assert.equal((await f.calls()).length, 2);
	await writeFile(join(f.root, "mode"), "good"); controller.abort(); assert.equal((await holder).value.kind, "unavailable");
	await until(() => !!waiter.result()); assert.equal(waiter.result().value.kind, "none"); assert.equal((await f.calls()).length, 3);
	const pid = (await f.calls())[1].pid; await until(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
	assert.deepEqual(await readdir(f.directory), ["cache.json"]);
});

test("waiter cancellation and filesystem/symlink failures do not invoke uncoordinated gh", async (t) => {
	const f = await fixture(t); await mkdir(f.directory, { recursive: true }); await writeFile(f.lock, "held");
	const controller = new AbortController(), pending = inspectSharedPullRequest(repository, "feature/safe", { signal: controller.signal });
	await sleep(150); controller.abort(); assert.equal((await pending).value.kind, "unavailable"); assert.equal((await f.calls()).length, 0);
	await rm(f.lock); await rm(f.directory, { recursive: true }); await symlink(f.home, f.directory);
	assert.equal((await inspectSharedPullRequest(repository, "feature/safe")).value.kind, "unavailable"); assert.equal((await f.calls()).length, 0); assert.deepEqual(await readdir(f.home), []);
});

test("positive results are whitelisted and repository-validated; refresh evicts to 128 entries", async (t) => {
	const f = await fixture(t); await writeFile(join(f.root, "mode"), "open");
	const result = await inspectSharedPullRequest(repository, "feature/safe");
	assert.deepEqual(result.value, { kind: "open", number: 7, url: "https://github.com/Owner/project/pull/7" });
	assert.deepEqual(await inspectSharedPullRequest(repository, "feature/safe"), result); assert.equal((await f.calls()).length, 1);
	assert.doesNotMatch(await readFile(f.file, "utf8"), /Secret|identity/);
	const raw = await f.read(); raw.entries[0].value.url = "https://github.com/Other/project/pull/7";
	await writeFile(f.file, JSON.stringify(raw)); await inspectSharedPullRequest(repository, "feature/safe"); assert.equal((await f.calls()).length, 2);
	await writeFile(f.file, JSON.stringify({ version: 1, entries: Array.from({ length: 128 }, (_, i) => ({ key: i.toString(16).padStart(64, "0"), at: Date.now(), value: { kind: "none" } })) }));
	await inspectSharedPullRequest(repository, "feature/safe"); assert.equal((await f.read()).entries.length, 128); assert.equal((await f.calls()).length, 3);
	// Future timestamps are not fresh (nor used to renew session freshness).
	const future = await f.read(); future.entries.at(-1).at = Date.now() + 60000; await writeFile(f.file, JSON.stringify(future));
	await inspectSharedPullRequest(repository, "feature/safe"); assert.equal((await f.calls()).length, 4);
});

test("failed atomic rename cleans temporary/lock files without success-shaped fallback", async (t) => {
	const f = await fixture(t); await mkdir(f.file, { recursive: true });
	assert.deepEqual((await inspectSharedPullRequest(repository, "feature/safe")).value, { kind: "unavailable", reason: "GitHub lookup cache unavailable" });
	assert.equal((await f.calls()).length, 1); assert.deepEqual(await readdir(f.directory), ["cache.json"]);
});

test("gh timeout is bounded and cached for the next process", async (t) => {
	const f = await fixture(t); await writeFile(join(f.root, "mode"), "hold"); const started = Date.now();
	const result = await inspectSharedPullRequest(repository, "feature/safe");
	assert.deepEqual(result.value, { kind: "unavailable", reason: "gh lookup timed out" }); assert.ok(Date.now() - started < 12000);
	const next = await worker(t); next.go(); await until(() => !!next.result()); assert.deepEqual(next.result(), result); assert.equal((await f.calls()).length, 1);
});

test("fresh lock contention has a bounded deadline without a gh fallback", async (t) => {
	const f = await fixture(t); await mkdir(f.directory, { recursive: true }); await writeFile(f.lock, "held");
	const started = Date.now(), result = await inspectSharedPullRequest(repository, "feature/safe");
	assert.deepEqual(result.value, { kind: "unavailable", reason: "GitHub lookup cache busy" });
	assert.ok(Date.now() - started < 14000); assert.equal((await f.calls()).length, 0);
});
