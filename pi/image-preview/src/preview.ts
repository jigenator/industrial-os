import { basename } from "node:path";
import { convertToPng, resizeImage, type Theme } from "@earendil-works/pi-coding-agent";
import { getCapabilities, Image, truncateToWidth, type Component } from "@earendil-works/pi-tui";

/** At most this many images are previewed; the rest are counted on one line. */
export const MAX_PREVIEWS = 3;
/** Rows each preview image may take. */
export const PREVIEW_ROWS = 6;
const PREVIEW_COLUMNS = 40;
// Thumbnails keep the bytes sent to the terminal small: a widget's image is re-sent whenever its rows move.
// The cap is on the base64 payload, after any PNG conversion; smaller sizes are tried when it is missed.
const THUMBNAIL_PIXELS = [480, 320, 200];
const THUMBNAIL_BYTES = 256 * 1024;

export interface Thumbnail {
	data: string;
	mimeType: string;
	width: number;
	height: number;
}

/**
 * A thumbnail for the terminal's image protocol whose base64 data is under `maxBytes`, or null when the
 * terminal shows no images or no size fits.
 */
export async function makeThumbnail(
	bytes: Buffer,
	mimeType: string,
	{ maxBytes = THUMBNAIL_BYTES }: { maxBytes?: number } = {},
): Promise<Thumbnail | null> {
	const protocol = getCapabilities().images;
	if (!protocol) return null;
	try {
		for (const pixels of THUMBNAIL_PIXELS) {
			const resized = await resizeImage(new Uint8Array(bytes), mimeType, { maxWidth: pixels, maxHeight: pixels, maxBytes });
			if (!resized) return null;
			let { data, mimeType: type } = resized;
			// Kitty accepts only PNG.
			if (protocol === "kitty" && type !== "image/png") {
				const png = await convertToPng(data, type);
				if (!png) return null;
				({ data, mimeType: type } = png);
			}
			if (data.length < maxBytes) return { data, mimeType: type, width: resized.width, height: resized.height };
		}
		return null;
	} catch {
		return null;
	}
}

export interface PreviewEntry {
	/** Identifies the file and its version; see `ImageFile.id`. */
	id: string;
	path: string;
	sizeBytes: number;
	/** undefined while the thumbnail is being made; null when there is none. */
	thumbnail: Thumbnail | null | undefined;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The above-editor preview: per image a caption with its file name and size, then the thumbnail.
 * The caption is the text form, so meaning never depends on the picture or on color.
 */
export class PreviewWidget implements Component {
	private entries: PreviewEntry[] = [];
	private readonly images = new Map<string, { thumbnail: Thumbnail; image: Image }>();
	private readonly theme: Theme;

	constructor(theme: Theme) {
		this.theme = theme;
	}

	setEntries(entries: PreviewEntry[]): void {
		this.entries = entries;
		const live = new Set(entries.map((entry) => entry.id));
		for (const id of this.images.keys()) if (!live.has(id)) this.images.delete(id);
	}

	invalidate(): void {
		for (const { image } of this.images.values()) image.invalidate();
	}

	private imageFor(entry: PreviewEntry, thumbnail: Thumbnail): Image {
		const existing = this.images.get(entry.id);
		if (existing?.thumbnail === thumbnail) return existing.image;
		const image = new Image(
			thumbnail.data,
			thumbnail.mimeType,
			{ fallbackColor: (text) => this.theme.fg("muted", text) },
			{ maxWidthCells: PREVIEW_COLUMNS, maxHeightCells: PREVIEW_ROWS, filename: entry.path },
			{ widthPx: thumbnail.width, heightPx: thumbnail.height },
		);
		this.images.set(entry.id, { thumbnail, image });
		return image;
	}

	render(width: number): string[] {
		// Indent by one cell, as Pi's own widget text is; the empty rows Pi reserves for an image stay empty.
		const pad = width > 1 ? " " : "";
		const inner = width - pad.length;
		const indent = (line: string) => (line === "" ? line : pad + line);
		const lines: string[] = [];
		const imagesSupported = getCapabilities().images !== null;
		for (const entry of this.entries.slice(0, MAX_PREVIEWS)) {
			const name = basename(entry.path).replace(/\p{Cc}/gu, "?");
			let detail = `${name} · ${formatSize(entry.sizeBytes)}`;
			if (imagesSupported && entry.thumbnail === undefined) detail += " · loading preview";
			if (imagesSupported && entry.thumbnail === null) detail += " · no preview";
			lines.push(indent(truncateToWidth(this.theme.fg("muted", detail), inner)));
			if (entry.thumbnail) lines.push(...this.imageFor(entry, entry.thumbnail).render(inner).map(indent));
		}
		const hidden = this.entries.length - MAX_PREVIEWS;
		if (hidden > 0) lines.push(indent(truncateToWidth(this.theme.fg("muted", `+${hidden} more`), inner)));
		return lines;
	}
}
