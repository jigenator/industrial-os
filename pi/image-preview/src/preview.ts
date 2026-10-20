import { basename } from "node:path";
import { convertToPng, resizeImage, type Theme } from "@earendil-works/pi-coding-agent";
import { allocateImageId, deleteKittyImage, getCapabilities, Image, renderImage, truncateToWidth, visibleWidth, type Component } from "@earendil-works/pi-tui";

/** At most this many images get a thumbnail; the rest are counted. */
export const MAX_PREVIEWS = 8;
/** Without Kitty graphics images stack vertically, so fewer are listed. */
export const STACKED_PREVIEWS = 3;
/** Rows each preview image may take. */
export const PREVIEW_ROWS = 12;
export const PREVIEW_COLUMNS = 80;
/** Columns between side-by-side previews. */
const GAP = 2;
/** A caption keeps at least this many columns even above a narrow image. */
const MIN_CAPTION_COLUMNS = 24;
// Thumbnails keep the bytes sent to the terminal small: a widget's image is re-sent whenever its rows move.
// The cap is on the base64 payload, after any PNG conversion; smaller sizes are tried when it is missed.
const THUMBNAIL_PIXELS = [640, 480, 320];
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

function caption(entry: PreviewEntry, imagesSupported: boolean): string {
	const name = basename(entry.path).replace(/\p{Cc}/gu, "?");
	let detail = `${name} · ${formatSize(entry.sizeBytes)}`;
	if (imagesSupported && entry.thumbnail === undefined) detail += " · loading preview";
	if (imagesSupported && entry.thumbnail === null) detail += " · no preview";
	return detail;
}

interface Placed {
	thumbnail: Thumbnail;
	maxColumns: number;
	imageId: number;
	sequence: string;
	columns: number;
	rows: number;
}

/**
 * The above-editor preview: per image a caption with its file name and size, then the thumbnail.
 * With Kitty graphics the previews sit side by side until the row is full; otherwise they stack.
 * The caption is the text form, so meaning never depends on the picture or on color.
 */
export class PreviewWidget implements Component {
	private entries: PreviewEntry[] = [];
	private readonly images = new Map<string, { thumbnail: Thumbnail; image: Image }>();
	private readonly placed = new Map<string, Placed>();
	/** Kitty image IDs this widget last put on screen beside the row's first, which Pi does not track. */
	private drawn = new Set<number>();
	private readonly theme: Theme;
	private readonly write: (data: string) => void;

	/** `write` sends Kitty delete commands straight to the terminal. */
	constructor(theme: Theme, write: (data: string) => void = () => {}) {
		this.theme = theme;
		this.write = write;
	}

	/**
	 * Pi deletes a changed row's images by ID but reads only the row's first image, so the widget deletes
	 * the others itself when they leave the screen.
	 */
	private forgetDrawn(keep: Set<number> = new Set()): void {
		let deletes = "";
		for (const id of this.drawn) if (!keep.has(id)) deletes += deleteKittyImage(id);
		this.drawn = keep;
		if (deletes) this.write(deletes);
	}

	dispose(): void {
		this.forgetDrawn();
	}

	setEntries(entries: PreviewEntry[]): void {
		this.entries = entries;
		const live = new Set(entries.map((entry) => entry.id));
		for (const id of this.images.keys()) if (!live.has(id)) this.images.delete(id);
		for (const id of this.placed.keys()) if (!live.has(id)) this.placed.delete(id);
	}

	invalidate(): void {
		for (const { image } of this.images.values()) image.invalidate();
		// Cell size may have changed; keep each image ID so the terminal replaces rather than adds.
		for (const placed of this.placed.values()) placed.columns = 0;
	}

	/** A Kitty placement that leaves the cursor where it was, so the next preview can follow on the same row. */
	private placeFor(entry: PreviewEntry, thumbnail: Thumbnail, maxColumns: number): Placed | undefined {
		const existing = this.placed.get(entry.id);
		if (existing?.thumbnail === thumbnail && existing.maxColumns === maxColumns && existing.columns > 0) return existing;
		const imageId = existing?.imageId ?? allocateImageId();
		const result = renderImage(
			thumbnail.data,
			{ widthPx: thumbnail.width, heightPx: thumbnail.height },
			{ maxWidthCells: maxColumns, maxHeightCells: PREVIEW_ROWS, imageId, moveCursor: false },
		);
		if (!result) return undefined;
		const placed = { thumbnail, maxColumns, imageId, sequence: result.sequence, columns: result.columns, rows: result.rows };
		this.placed.set(entry.id, placed);
		return placed;
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
		const protocol = getCapabilities().images;
		if (protocol === "kitty") return this.renderRow(pad, inner);
		this.forgetDrawn();
		return this.renderStacked(pad, inner, protocol !== null);
	}

	private more(hidden: number): string {
		return `+${hidden} more`;
	}

	/** Previews side by side, captions on the first row, until the next one would pass the right edge; the rest are counted below. */
	private renderRow(pad: string, inner: number): string[] {
		const maxColumns = Math.max(1, Math.min(PREVIEW_COLUMNS, inner));
		const candidates = this.entries.slice(0, MAX_PREVIEWS);
		const cells: { text: string; columns: number; placed?: Placed }[] = [];
		let used = 0;
		for (const entry of candidates) {
			const text = caption(entry, true);
			const placed = entry.thumbnail ? this.placeFor(entry, entry.thumbnail, maxColumns) : undefined;
			const textColumns = Math.min(visibleWidth(text), maxColumns);
			const columns = placed ? Math.max(placed.columns, Math.min(textColumns, MIN_CAPTION_COLUMNS)) : textColumns;
			const start = cells.length > 0 ? used + GAP : 0;
			if (cells.length > 0 && start + columns > inner) break;
			cells.push({ text, columns, placed });
			used = start + columns;
		}
		const hidden = this.entries.length - cells.length;
		const gap = " ".repeat(GAP);
		const captions = cells.map(({ text, columns }) => {
			const fitted = truncateToWidth(text, columns);
			return this.theme.fg("muted", fitted) + " ".repeat(columns - visibleWidth(fitted));
		});
		const lines = [pad + truncateToWidth(captions.join(gap), inner)];
		const rows = Math.max(0, ...cells.map(({ placed }) => placed?.rows ?? 0));
		const drawn = new Set<number>();
		if (rows > 0) {
			// One row carries every placement: draw, then move right past the cell and gap without printing.
			// Pi parses only the first Kitty command on a row, so it must be the first placement. Each later
			// placement deletes its old copy first: when the row moves, Pi deletes only the first image.
			let imageLine = pad;
			let placedAny = false;
			for (const [index, { columns, placed }] of cells.entries()) {
				if (placed) {
					if (placedAny) {
						imageLine += deleteKittyImage(placed.imageId);
						drawn.add(placed.imageId);
					}
					imageLine += placed.sequence;
					placedAny = true;
				}
				if (index < cells.length - 1) imageLine += `\x1b[${columns + GAP}C`;
			}
			lines.push(imageLine, ...Array.from({ length: rows - 1 }, () => ""));
		}
		this.forgetDrawn(drawn);
		if (hidden > 0) lines.push(pad + truncateToWidth(this.theme.fg("muted", this.more(hidden)), inner));
		return lines;
	}

	/** One preview under another, for terminals whose image protocol moves the cursor or that show none. */
	private renderStacked(pad: string, inner: number, imagesSupported: boolean): string[] {
		const indent = (line: string) => (line === "" ? line : pad + line);
		const lines: string[] = [];
		for (const entry of this.entries.slice(0, STACKED_PREVIEWS)) {
			lines.push(indent(truncateToWidth(this.theme.fg("muted", caption(entry, imagesSupported)), inner)));
			if (entry.thumbnail) lines.push(...this.imageFor(entry, entry.thumbnail).render(inner).map(indent));
		}
		const hidden = this.entries.length - STACKED_PREVIEWS;
		if (hidden > 0) lines.push(indent(truncateToWidth(this.theme.fg("muted", this.more(hidden)), inner)));
		return lines;
	}
}
