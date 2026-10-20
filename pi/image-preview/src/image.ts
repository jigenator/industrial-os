import { open, stat } from "node:fs/promises";
import { detectSupportedImageMimeTypeFromFile } from "@earendil-works/pi-coding-agent";

/** Files larger than this are not previewed. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** An image file found on disk; `id` changes whenever the file's size or modification time does. */
export interface ImageFile {
	id: string;
	path: string;
	mimeType: string;
	sizeBytes: number;
}

/** The image at `path`, if it is a regular file within the size cap whose content is a supported image type. */
export async function inspectImage(path: string): Promise<ImageFile | undefined> {
	try {
		const info = await stat(path);
		if (!info.isFile() || info.size > MAX_IMAGE_BYTES) return undefined;
		const mimeType = await detectSupportedImageMimeTypeFromFile(path);
		if (!mimeType || !SUPPORTED_TYPES.has(mimeType)) return undefined;
		return { id: `${path}\0${info.size}\0${info.mtimeMs}`, path, mimeType, sizeBytes: info.size };
	} catch {
		return undefined;
	}
}

/** The file's bytes, or undefined when it cannot be read or has grown past the size cap. */
export async function readImage(image: ImageFile): Promise<Buffer | undefined> {
	try {
		const file = await open(image.path, "r");
		try {
			const info = await file.stat();
			if (!info.isFile() || info.size > MAX_IMAGE_BYTES) return undefined;
			const bytes = await file.readFile();
			return bytes.length <= MAX_IMAGE_BYTES ? bytes : undefined;
		} finally {
			await file.close();
		}
	} catch {
		return undefined;
	}
}
