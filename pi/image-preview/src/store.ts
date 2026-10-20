import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { detectSupportedImageMimeTypeFromFile } from "@earendil-works/pi-coding-agent";

/** Files larger than this are neither previewed nor attached; their path text is left alone. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Supported image types by sniffed content, with the extension their cached copy gets. */
const EXTENSION_BY_MIME: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
};

/** A labelled image: `[image <label>]` in the editor stands for `path`. */
export interface ImageRecord {
	label: number;
	/** SHA-256 of the file content, hex. */
	hash: string;
	mimeType: string;
	/** The path the image was first found at. */
	sourcePath: string;
	/** The cached copy, or `sourcePath` when there was no session file to cache into. */
	path: string;
	sizeBytes: number;
}

export type IngestResult =
	| { status: "ok"; record: ImageRecord }
	| { status: "too-large" }
	| { status: "unsupported" }
	| { status: "unreadable" };

/** Process-wide state: labels are never reused, even across `/reload`, which re-evaluates this module. */
interface Registry {
	nextLabel: number;
	byLabel: Map<number, ImageRecord>;
	labelByHash: Map<string, number>;
	/** Source paths already reported as too large, so each warns once. */
	warned: Set<string>;
}

const REGISTRY = Symbol.for("pi-image-preview.registry");

export function registry(): Registry {
	const scope = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
	scope[REGISTRY] ??= { nextLabel: 1, byLabel: new Map(), labelByHash: new Map(), warned: new Set() };
	return scope[REGISTRY];
}

/** Test seam: forget every label. */
export function resetRegistry(): void {
	delete (globalThis as typeof globalThis & { [REGISTRY]?: Registry })[REGISTRY];
}

/** `<session dir>/<session file name without .jsonl>.images` */
export function imagesDirFor(sessionFile: string): string {
	return join(dirname(sessionFile), `${basename(sessionFile, ".jsonl")}.images`);
}

function cachedName(hash: string, mimeType: string): string {
	return `${hash.slice(0, 16)}.${EXTENSION_BY_MIME[mimeType]}`;
}

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/** Write `bytes` to `target` unless it already exists; a temporary name and rename keep it whole. */
async function writeOnce(target: string, bytes: Buffer): Promise<void> {
	try {
		await stat(target);
		return;
	} catch {
		// Not cached yet.
	}
	await mkdir(dirname(target), { recursive: true });
	const temp = `${target}.${randomUUID()}.tmp`;
	try {
		await writeFile(temp, bytes, { flag: "wx" });
		await rename(temp, target);
	} catch (error) {
		await unlink(temp).catch(() => undefined);
		throw error;
	}
}

/**
 * Validate an image file, cache it into the session's images folder by content hash and give it a label.
 * The same content always gets the same label. Without a session file the original path is used.
 */
export async function ingestImage(sourcePath: string, sessionFile: string | undefined): Promise<IngestResult> {
	let mimeType: string | null;
	let bytes: Buffer;
	try {
		const info = await stat(sourcePath);
		if (!info.isFile()) return { status: "unreadable" };
		if (info.size > MAX_IMAGE_BYTES) return { status: "too-large" };
		mimeType = await detectSupportedImageMimeTypeFromFile(sourcePath);
		if (!mimeType || !(mimeType in EXTENSION_BY_MIME)) return { status: "unsupported" };
		bytes = await readFile(sourcePath);
	} catch {
		return { status: "unreadable" };
	}
	if (bytes.length > MAX_IMAGE_BYTES) return { status: "too-large" };

	const hash = sha256(bytes);
	let cached: string | undefined;
	if (sessionFile) {
		const target = join(imagesDirFor(sessionFile), cachedName(hash, mimeType));
		try {
			await writeOnce(target, bytes);
			cached = target;
		} catch {
			// Caching failed; the original path still works for this process.
		}
	}

	const state = registry();
	const label = state.labelByHash.get(hash) ?? state.nextLabel++;
	const previous = state.byLabel.get(label);
	// Without a new cached copy, an earlier record (perhaps cached for another session) still serves.
	const record: ImageRecord = previous && !cached
		? previous
		: { label, hash, mimeType, sourcePath: previous?.sourcePath ?? sourcePath, path: cached ?? sourcePath, sizeBytes: bytes.length };
	state.byLabel.set(label, record);
	state.labelByHash.set(hash, label);
	return { status: "ok", record };
}

/**
 * The bytes and current path of a labelled image, re-copied into the current session's folder if it was
 * cached for another session or its copy is gone. Every copy is checked against the recorded hash.
 */
export async function materialize(
	record: ImageRecord,
	sessionFile: string | undefined,
): Promise<{ path: string; bytes: Buffer } | undefined> {
	const target = sessionFile ? join(imagesDirFor(sessionFile), cachedName(record.hash, record.mimeType)) : undefined;
	const sources = [...new Set([target, record.path, record.sourcePath].filter((path): path is string => !!path))];
	for (const source of sources) {
		let bytes: Buffer;
		try {
			const info = await stat(source);
			if (!info.isFile() || info.size > MAX_IMAGE_BYTES) continue;
			bytes = await readFile(source);
		} catch {
			continue;
		}
		if (sha256(bytes) !== record.hash) continue;
		if (target && source !== target) {
			try {
				await writeOnce(target, bytes);
			} catch {
				return { path: source, bytes };
			}
			record.path = target;
			return { path: target, bytes };
		}
		return { path: source, bytes };
	}
	return undefined;
}
