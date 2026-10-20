import assert from "node:assert/strict";
import { truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { inspectImage, MAX_IMAGE_BYTES, readImage } from "../src/image.ts";
import { png, tempDir, writeImage } from "./helpers.ts";

test("accepts a regular image file and reads its bytes", async (t) => {
	const dir = await tempDir(t);
	const path = await writeImage(join(dir, "a.png"));
	const image = await inspectImage(path);
	assert.ok(image);
	assert.deepEqual({ path: image.path, mimeType: image.mimeType, sizeBytes: image.sizeBytes }, { path, mimeType: "image/png", sizeBytes: png().length });
	assert.deepEqual(await readImage(image), png());
});

test("takes the type from the content, not the extension", async (t) => {
	const dir = await tempDir(t);
	const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
	assert.equal((await inspectImage(await writeImage(join(dir, "really-a-gif.png"), gif)))?.mimeType, "image/gif");
});

test("rejects missing files, directories, non-image content and files over the cap", async (t) => {
	const dir = await tempDir(t);
	assert.equal(await inspectImage(join(dir, "missing.png")), undefined);
	await writeImage(join(dir, "folder.png", "inner.png"));
	assert.equal(await inspectImage(join(dir, "folder.png")), undefined);
	await writeFile(join(dir, "text.png"), "not an image");
	assert.equal(await inspectImage(join(dir, "text.png")), undefined);
	const large = await writeImage(join(dir, "large.png"));
	await truncate(large, MAX_IMAGE_BYTES + 1);
	assert.equal(await inspectImage(large), undefined);
});

test("a file that grew past the cap or vanished after inspection is not read", async (t) => {
	const dir = await tempDir(t);
	const path = await writeImage(join(dir, "a.png"));
	const image = (await inspectImage(path))!;
	await truncate(path, MAX_IMAGE_BYTES + 1);
	assert.equal(await readImage(image), undefined);
	assert.equal(await readImage({ ...image, path: join(dir, "gone.png") }), undefined);
});
