import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { Theme } from "@earendil-works/pi-coding-agent";

// A valid 1×1 PNG. Bytes appended after IEND keep it a sniffable PNG with a different hash.
const PIXEL = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
	"base64",
);

export function png(variant = ""): Buffer {
	return Buffer.concat([PIXEL, Buffer.from(variant)]);
}

export async function tempDir(t: TestContext): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-image-preview-test-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	return dir;
}

export async function writeImage(path: string, bytes: Buffer = png()): Promise<string> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, bytes);
	return path;
}

export async function until(check: () => boolean, timeoutMs = 3000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > deadline) throw new Error("timed out waiting for condition");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

/** A real Pi theme, so rendering exercises its style calls. */
export const theme = new Theme(
	{ accent: "#5f87ff", muted: "#808080", text: "#d0d0d0", thinkingXhigh: "#d0d0d0" } as ConstructorParameters<typeof Theme>[0],
	{ selectedBg: "#303030" } as ConstructorParameters<typeof Theme>[1],
	"truecolor",
);
