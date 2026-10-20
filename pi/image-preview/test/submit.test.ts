import assert from "node:assert/strict";
import { readdir, truncate } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import type { ImageContent } from "@earendil-works/pi-ai";
import { ingestImage, MAX_IMAGE_BYTES, resetRegistry } from "../src/store.ts";
import { prepareSubmission } from "../src/submit.ts";
import { png, tempDir, writeImage } from "./helpers.ts";

test.beforeEach(() => resetRegistry());

test("replaces labels with cached paths and attaches each image once", async (t) => {
	const dir = await tempDir(t);
	const sessionFile = join(dir, "s.jsonl");
	const a = await ingestImage(await writeImage(join(dir, "a.png")), sessionFile);
	const b = await ingestImage(await writeImage(join(dir, "b.png"), png("b")), sessionFile);
	assert.ok(a.status === "ok" && b.status === "ok");
	const submission = await prepareSubmission("compare [image 1] with [image 2], then [image 1] again", undefined, sessionFile);
	assert.ok(submission);
	assert.equal(submission.text, `compare ${a.record.path} with ${b.record.path}, then ${a.record.path} again`);
	assert.deepEqual(submission.images, [
		{ type: "image", data: png().toString("base64"), mimeType: "image/png" },
		{ type: "image", data: png("b").toString("base64"), mimeType: "image/png" },
	]);
});

test("keeps images already on the event first", async (t) => {
	const dir = await tempDir(t);
	await ingestImage(await writeImage(join(dir, "a.png")), undefined);
	const existing: ImageContent[] = [{ type: "image", data: "AAAA", mimeType: "image/jpeg" }];
	const submission = await prepareSubmission("see [image 1]", existing, undefined);
	assert.ok(submission);
	assert.equal(submission.images.length, 2);
	assert.deepEqual(submission.images[0], existing[0]);
});

test("caches, rewrites and attaches a path that was never relabelled", async (t) => {
	const dir = await tempDir(t);
	const source = await writeImage(join(dir, "My Shots", "a b.png"));
	const sessionFile = join(dir, "s.jsonl");
	const submission = await prepareSubmission(`what is ${source}`, undefined, sessionFile);
	assert.ok(submission);
	const [cached] = await readdir(join(dir, "s.images"));
	assert.equal(submission.text, `what is ${join(dir, "s.images", cached)}`);
	assert.equal(submission.images.length, 1);
});

test("leaves unmapped labels and text without images untouched", async () => {
	assert.equal(await prepareSubmission("[image 7] is not mine; nor /no/such.png", undefined, undefined), undefined);
});

test("sends an unreadable label as its path without an attachment", async (t) => {
	const dir = await tempDir(t);
	const source = await writeImage(join(dir, "a.png"));
	const result = await ingestImage(source, undefined);
	assert.ok(result.status === "ok");
	await writeImage(source, png("changed"));
	const submission = await prepareSubmission("see [image 1]", undefined, undefined);
	assert.ok(submission);
	assert.equal(submission.text, `see ${source}`);
	assert.deepEqual(submission.images, []);
	assert.deepEqual(submission.unreadable, [1]);
});

test("reports a too-large path and leaves its text", async (t) => {
	const dir = await tempDir(t);
	const large = await writeImage(join(dir, "large.png"));
	await truncate(large, MAX_IMAGE_BYTES + 1);
	assert.equal(await prepareSubmission(`see ${large}`, undefined, undefined), undefined);
	await ingestImage(await writeImage(join(dir, "small.png")), undefined);
	const submission = await prepareSubmission(`see ${large} and [image 1]`, undefined, undefined);
	assert.ok(submission);
	assert.deepEqual(submission.tooLarge, [large]);
	assert.equal(submission.text, `see ${large} and ${join(dir, "small.png")}`);
});
