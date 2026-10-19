import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { updateRecapSettings } from "../index.ts";

function fixture(t) {
	const dir = mkdtempSync(join(tmpdir(), "session-recap-lock-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "session-recap.json");
	return { path, lock: `${path}.lock`, read: () => JSON.parse(readFileSync(path, "utf8")) };
}

test("a save waits for another process's lock and merges what it wrote", async (t) => {
	const { path, lock, read } = fixture(t);
	writeFileSync(path, JSON.stringify({ keep: false }));
	// Another Pi process holds the lock while it saves a model.
	writeFileSync(lock, "");
	const saving = updateRecapSettings(path, (settings) => ({ ...settings, keep: true }));
	await new Promise((resolve) => setTimeout(resolve, 100));
	assert.deepEqual(read(), { keep: false }, "nothing is written while the lock is held");
	writeFileSync(path, JSON.stringify({ model: "google/other", keep: false }));
	rmSync(lock);
	assert.equal(await saving, true);
	assert.deepEqual(read(), { model: "google/other", keep: true }, "the other process's model survives");
	assert.equal(existsSync(lock), false, "the lock is released");
});

test("a lock left by a crashed process is cleared", async (t) => {
	const { path, lock, read } = fixture(t);
	writeFileSync(lock, "");
	const old = new Date(Date.now() - 60_000);
	utimesSync(lock, old, old);
	assert.equal(await updateRecapSettings(path, () => ({ model: "google/x" })), true);
	assert.deepEqual(read(), { model: "google/x" });
	assert.equal(existsSync(lock), false);
});

test("a lock that stays held fails the save without touching the file", async (t) => {
	const { path, lock, read } = fixture(t);
	writeFileSync(path, JSON.stringify({ keep: true }));
	writeFileSync(lock, "");
	await assert.rejects(updateRecapSettings(path, () => ({ keep: false })), /settings lock timeout/);
	assert.deepEqual(read(), { keep: true });
	assert.equal(existsSync(lock), true, "another process's lock is never removed");
});

test("cancelling while waiting writes nothing", async (t) => {
	const { path, lock } = fixture(t);
	writeFileSync(lock, "");
	const controller = new AbortController();
	const saving = updateRecapSettings(path, () => ({ keep: true }), controller.signal);
	controller.abort();
	assert.equal(await saving, false);
	assert.equal(existsSync(path), false);
});
