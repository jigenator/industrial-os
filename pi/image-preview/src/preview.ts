import { basename } from "node:path";
import { convertToPng, resizeImage, type Theme } from "@earendil-works/pi-coding-agent";
import { getCapabilities, Image, truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { labelText } from "./draft.ts";

/** At most this many images are previewed; the rest are counted on one line. */
export const MAX_PREVIEWS = 3;
/** Rows each preview image may take. */
export const PREVIEW_ROWS = 6;
const PREVIEW_COLUMNS = 40;
// Thumbnails keep the bytes sent to the terminal small: a widget's image is re-sent whenever its rows move.
const THUMBNAIL_PIXELS = 480;
const THUMBNAIL_BYTES = 256 * 1024;

export interface Thumbnail {
	data: string;
	mimeType: string;
	width: number;
	height: number;
}

/** A thumbnail for the terminal's image protocol, or null when it has none or conversion failed. */
export async function makeThumbnail(bytes: Buffer, mimeType: string): Promise<Thumbnail | null> {
	const protocol = getCapabilities().images;
	if (!protocol) return null;
	try {
		const resized = await resizeImage(new Uint8Array(bytes), mimeType, {
			maxWidth: THUMBNAIL_PIXELS,
			maxHeight: THUMBNAIL_PIXELS,
			maxBytes: THUMBNAIL_BYTES,
		});
		if (!resized) return null;
		let { data, mimeType: type } = resized;
		// Kitty accepts only PNG.
		if (protocol === "kitty" && type !== "image/png") {
			const png = await convertToPng(data, type);
			if (!png) return null;
			({ data, mimeType: type } = png);
		}
		return { data, mimeType: type, width: resized.width, height: resized.height };
	} catch {
		return null;
	}
}

export interface PreviewEntry {
	/** The editor label, or undefined for a path that has not been relabelled. */
	label: number | undefined;
	hash: string;
	sourcePath: string;
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
 * The above-editor preview: per image a caption with its label, file name and size, then the thumbnail.
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
		const live = new Set(entries.map((entry) => entry.hash));
		for (const hash of this.images.keys()) if (!live.has(hash)) this.images.delete(hash);
	}

	invalidate(): void {
		for (const { image } of this.images.values()) image.invalidate();
	}

	private imageFor(entry: PreviewEntry, thumbnail: Thumbnail): Image {
		const cached = this.images.get(entry.hash);
		if (cached?.thumbnail === thumbnail) return cached.image;
		const image = new Image(
			thumbnail.data,
			thumbnail.mimeType,
			{ fallbackColor: (text) => this.theme.fg("muted", text) },
			{ maxWidthCells: PREVIEW_COLUMNS, maxHeightCells: PREVIEW_ROWS, filename: entry.sourcePath },
			{ widthPx: thumbnail.width, heightPx: thumbnail.height },
		);
		this.images.set(entry.hash, { thumbnail, image });
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
			const label = entry.label === undefined ? "" : `${this.theme.fg("accent", labelText(entry.label))} `;
			const name = basename(entry.sourcePath).replace(/\p{Cc}/gu, "?");
			let detail = `${name} · ${formatSize(entry.sizeBytes)}`;
			if (imagesSupported && entry.thumbnail === undefined) detail += " · loading preview";
			if (imagesSupported && entry.thumbnail === null) detail += " · no preview";
			lines.push(indent(truncateToWidth(label + this.theme.fg("muted", detail), inner)));
			if (entry.thumbnail) lines.push(...this.imageFor(entry, entry.thumbnail).render(inner).map(indent));
		}
		const hidden = this.entries.length - MAX_PREVIEWS;
		if (hidden > 0) lines.push(indent(truncateToWidth(this.theme.fg("muted", `+${hidden} more`), inner)));
		return lines;
	}
}
