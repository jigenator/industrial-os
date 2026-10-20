import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { imagesDirFor, ingestImage, materialize, MAX_IMAGE_BYTES, registry, resetRegistry } from "../src/store.ts";
import { png, tempDir, writeImage } from "./helpers.ts";

test.beforeEach(() => resetRegistry());

test("names the images folder after the session file", () => {
	assert.equal(imagesDirFor("/s/--proj--/2026_abc.jsonl"), "/s/--proj--/2026_abc.images");
});

test("caches into the session folder by content hash and labels it", async (t) => {
	const dir = await tempDir(t);
	const source = await writeImage(join(dir, "pi-clipboard-1.png"));
	const sessionFile = join(dir, "sessions", "2026_abc.jsonl");
	const result = await ingestImage(source, sessionFile);
	assert.equal(result.status, "ok");
	if (result.status !== "ok") return;
	const hash = createHash("sha256").update(png()).digest("hex");
	assert.equal(result.record.path, join(dir, "sessions", "2026_abc.images", `${hash.slice(0, 16)}.png`));
	assert.equal(result.record.label, 1);
	assert.equal(result.record.mimeType, "image/png");
	assert.deepEqual(await readFile(result.record.path), png());
});

test("dedupes identical content to one label and one file", async (t) => {
	const dir = await tempDir(t);
	const sessionFile = join(dir, "s.jsonl");
	const first = await ingestImage(await writeImage(join(dir, "a.png")), sessionFile);
	const second = await ingestImage(await writeImage(join(dir, "b.png")), sessionFile);
	const other = await ingestImage(await writeImage(join(dir, "c.png"), png("other")), sessionFile);
	assert.ok(first.status === "ok" && second.status === "ok" && other.status === "ok");
	assert.equal(second.record.label, first.record.label);
	assert.equal(other.record.label, first.record.label + 1);
	assert.equal((await readdir(join(dir, "s.images"))).length, 2);
});

test("labels are process-wide and never reused", async (t) => {
	const dir = await tempDir(t);
	registry().nextLabel = 41;
	const result = await ingestImage(await writeImage(join(dir, "a.png")), undefined);
	assert.ok(result.status === "ok");
	assert.equal(result.record.label, 41);
	assert.equal(registry().nextLabel, 42);
});

test("without a session file the original path is used and nothing is written", async (t) => {
	const dir = await tempDir(t);
	const source = await writeImage(join(dir, "a.png"));
	const result = await ingestImage(source, undefined);
	assert.ok(result.status === "ok");
	assert.equal(result.record.path, source);
	assert.deepEqual(await readdir(dir), ["a.png"]);
});

test("rejects missing files, directories, non-image content and files over the cap", async (t) => {
	const dir = await tempDir(t);
	assert.deepEqual(await ingestImage(join(dir, "missing.png"), undefined), { status: "unreadable" });
	await writeImage(join(dir, "folder.png", "inner.png"));
	assert.deepEqual(await ingestImage(join(dir, "folder.png"), undefined), { status: "unreadable" });
	await writeFile(join(dir, "text.png"), "not an image");
	assert.deepEqual(await ingestImage(join(dir, "text.png"), undefined), { status: "unsupported" });
	const large = await writeImage(join(dir, "large.png"));
	await truncate(large, MAX_IMAGE_BYTES + 1);
	assert.deepEqual(await ingestImage(large, join(dir, "s.jsonl")), { status: "too-large" });
	assert.equal(registry().byLabel.size, 0);
});

test("uses the sniffed type, not the extension, for the cached name", async (t) => {
	const dir = await tempDir(t);
	const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
	const result = await ingestImage(await writeImage(join(dir, "really-a-gif.png"), gif), join(dir, "s.jsonl"));
	assert.ok(result.status === "ok");
	assert.equal(result.record.mimeType, "image/gif");
	assert.match(result.record.path, /\.gif$/);
});

test("re-copies into the current session's folder after a session switch", async (t) => {
	const dir = await tempDir(t);
	const source = await writeImage(join(dir, "pi-clipboard-1.png"));
	const result = await ingestImage(source, join(dir, "one.jsonl"));
	assert.ok(result.status === "ok");
	await rm(source);
	const copy = await materialize(result.record, join(dir, "two.jsonl"));
	assert.ok(copy);
	assert.equal(copy.path, join(dir, "two.images", (await readdir(join(dir, "one.images")))[0]));
	assert.deepEqual(copy.bytes, png());
	assert.equal(result.record.path, copy.path);
});

test("refuses a copy whose content no longer matches", async (t) => {
	const dir = await tempDir(t);
	const source = await writeImage(join(dir, "a.png"));
	const result = await ingestImage(source, undefined);
	assert.ok(result.status === "ok");
	await writeImage(source, png("edited"));
	assert.equal(await materialize(result.record, undefined), undefined);
});

test("a corrupt session copy is replaced rather than returned with different bytes", async (t) => {
	const dir = await tempDir(t);
	const sessionFile = join(dir, "s.jsonl");
	const result = await ingestImage(await writeImage(join(dir, "a.png")), sessionFile);
	assert.ok(result.status === "ok");
	await writeFile(result.record.path, png("tampered"));
	const copy = await materialize(result.record, sessionFile);
	assert.ok(copy);
	assert.deepEqual(copy.bytes, png());
	assert.deepEqual(await readFile(copy.path), copy.bytes, "the returned path holds the attached bytes");
});

test("ingest repairs an existing copy whose content does not match its name", async (t) => {
	const dir = await tempDir(t);
	const sessionFile = join(dir, "s.jsonl");
	const hash = createHash("sha256").update(png()).digest("hex");
	const target = await writeImage(join(dir, "s.images", `${hash.slice(0, 16)}.png`), png("stale"));
	const result = await ingestImage(await writeImage(join(dir, "a.png")), sessionFile);
	assert.ok(result.status === "ok");
	assert.equal(result.record.path, target);
	assert.deepEqual(await readFile(target), png());
	assert.deepEqual((await readdir(join(dir, "s.images"))).sort(), [`${hash.slice(0, 16)}.png`], "no temporary file is left");
});

test("a session copy that cannot be written is a cache failure, not a label", async (t) => {
	const dir = await tempDir(t);
	const sessionFile = join(dir, "s.jsonl");
	await writeFile(join(dir, "s.images"), "a file where the folder should be");
	assert.deepEqual(await ingestImage(await writeImage(join(dir, "a.png")), sessionFile), { status: "cache-failed" });
	assert.equal(registry().byLabel.size, 0);
});

test("a label whose copy cannot be made in the current session says so", async (t) => {
	const dir = await tempDir(t);
	const result = await ingestImage(await writeImage(join(dir, "a.png")), join(dir, "one.jsonl"));
	assert.ok(result.status === "ok");
	await writeFile(join(dir, "two.images"), "blocked");
	const copy = await materialize(result.record, join(dir, "two.jsonl"));
	assert.ok(copy);
	assert.equal(copy.saved, false);
	assert.equal(copy.path, result.record.path);
});
