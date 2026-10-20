import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { inspectImage, readImage, type ImageFile } from "./image.ts";
import { listCandidatePaths, matchImagePaths } from "./paths.ts";
import { makeThumbnail, MAX_PREVIEWS, PreviewWidget, type PreviewEntry, type Thumbnail } from "./preview.ts";

/** How often the editor text is checked; Pi has no editor-change event for extensions. */
const POLL_MS = 200;
export const WIDGET_KEY = "image-preview";
const MAX_THUMBNAILS = 16;

/**
 * Watch the TUI editor for image paths and keep the above-editor preview in step with them. The editor is
 * only read, never written. Returns the stop function.
 */
function watchEditor(ctx: ExtensionContext): () => void {
	const thumbnails = new Map<string, Thumbnail | null | undefined>();
	/** The text the last scan started from. */
	let lastScanned: string | undefined;
	/** The text last shown, with the images its candidate paths name. */
	let shown: { text: string; images: Map<string, ImageFile> } | undefined;
	let running = false;
	let dirty = false;
	let stopped = false;
	let widget: PreviewWidget | undefined;
	let tui: TUI | undefined;

	function show(entries: PreviewEntry[]): void {
		if (stopped) return;
		if (entries.length === 0) {
			if (widget) ctx.ui.setWidget(WIDGET_KEY, undefined);
			widget = undefined;
			return;
		}
		if (widget) {
			widget.setEntries(entries);
			tui?.requestRender();
			return;
		}
		ctx.ui.setWidget(WIDGET_KEY, (host, theme) => {
			tui = host;
			const created = new PreviewWidget(theme);
			created.setEntries(entries);
			widget = created;
			return created;
		}, { placement: "aboveEditor" });
	}

	/** The distinct images named in `text`, in reading order. */
	function entriesFor(text: string, images: Map<string, ImageFile>): PreviewEntry[] {
		const entries = new Map<string, PreviewEntry>();
		for (const { path } of matchImagePaths(text, (candidate) => images.has(candidate))) {
			const image = images.get(path)!;
			if (entries.has(image.id)) continue;
			if (entries.size < MAX_PREVIEWS) ensureThumbnail(image);
			entries.set(image.id, { id: image.id, path, sizeBytes: image.sizeBytes, thumbnail: thumbnails.get(image.id) });
		}
		return [...entries.values()];
	}

	function ensureThumbnail(image: ImageFile): void {
		if (thumbnails.has(image.id)) return;
		thumbnails.set(image.id, undefined);
		while (thumbnails.size > MAX_THUMBNAILS) thumbnails.delete(thumbnails.keys().next().value!);
		void (async () => {
			const bytes = await readImage(image);
			const thumbnail = bytes ? await makeThumbnail(bytes, image.mimeType) : null;
			if (stopped || !thumbnails.has(image.id)) return;
			thumbnails.set(image.id, thumbnail);
			if (shown) show(entriesFor(shown.text, shown.images));
		})().catch(() => undefined);
	}

	async function scanOnce(): Promise<void> {
		const text = ctx.ui.getEditorText();
		lastScanned = text;
		const images = new Map<string, ImageFile>();
		for (const path of text.trim() === "" ? [] : listCandidatePaths(text)) {
			const image = await inspectImage(path);
			if (image) images.set(path, image);
		}
		if (stopped) return;
		// Text typed during the checks is scanned again before anything is shown for it.
		if (ctx.ui.getEditorText() !== text) {
			dirty = true;
			return;
		}
		shown = { text, images };
		show(entriesFor(text, images));
	}

	function scan(): void {
		if (running) {
			dirty = true;
			return;
		}
		running = true;
		void (async () => {
			try {
				do {
					dirty = false;
					await scanOnce();
				} while (dirty && !stopped);
			} catch {
				// The UI went away; the next change is checked again.
			} finally {
				running = false;
			}
		})();
	}

	const timer = setInterval(() => {
		if (stopped) return;
		try {
			if (ctx.ui.getEditorText() !== lastScanned) scan();
		} catch {
			// The UI went away; shutdown stops the timer.
		}
	}, POLL_MS);
	timer.unref?.();

	return () => {
		if (stopped) return;
		stopped = true;
		clearInterval(timer);
		if (widget) {
			try {
				ctx.ui.setWidget(WIDGET_KEY, undefined);
			} catch {
				// Already torn down.
			}
		}
		widget = undefined;
	};
}

export default function imagePreview(pi: ExtensionAPI): void {
	let stopWatch: (() => void) | undefined;

	pi.on("session_start", (_event, ctx) => {
		stopWatch?.();
		stopWatch = ctx.mode === "tui" ? watchEditor(ctx) : undefined;
	});

	pi.on("session_shutdown", () => {
		stopWatch?.();
		stopWatch = undefined;
	});
}
