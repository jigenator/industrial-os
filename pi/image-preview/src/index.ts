import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { findLabels, isCollapsingPaste, labelText, rewriteDraft, type DraftState } from "./draft.ts";
import { listCandidatePaths, matchImagePaths } from "./paths.ts";
import { makeThumbnail, MAX_PREVIEWS, PreviewWidget, type PreviewEntry, type Thumbnail } from "./preview.ts";
import { prepareSubmission } from "./submit.ts";
import { ingestImage, materialize, MAX_IMAGE_BYTES, registry, type ImageRecord, type IngestResult } from "./store.ts";

/** How often the editor text is checked; Pi has no editor-change event for extensions. */
const POLL_MS = 200;
export const WIDGET_KEY = "image-preview";
const MAX_KNOWN_PATHS = 64;
const MAX_THUMBNAILS = 16;

function notifyOnce(ctx: ExtensionContext, key: string, message: string): void {
	const { warned } = registry();
	if (warned.has(key)) return;
	warned.add(key);
	try {
		ctx.ui.notify(message, "warning");
	} catch {
		// UI gone; nothing to report to.
	}
}

function warnTooLarge(ctx: ExtensionContext, path: string): void {
	notifyOnce(ctx, path, `image-preview: ${basename(path)} is over ${MAX_IMAGE_BYTES / (1024 * 1024)} MB; left as text, not attached`);
}

/**
 * Watch the TUI editor for image paths: cache and label them, rewrite the draft where that is safe, and keep
 * the above-editor preview in step with the labels and paths the draft holds. Returns the stop function.
 */
function watchDraft(ctx: ExtensionContext): () => void {
	const draft: DraftState = { collapsedPaste: false };
	const known = new Map<string, { key: string; result: IngestResult }>();
	const thumbnails = new Map<string, Thumbnail | null | undefined>();
	let lastText: string | undefined;
	let running = false;
	let dirty = false;
	let stopped = false;
	let widget: PreviewWidget | undefined;
	let tui: TUI | undefined;

	const recordForPath = (path: string): ImageRecord | undefined => {
		const result = known.get(path)?.result;
		return result?.status === "ok" ? result.record : undefined;
	};
	const recordForLabel = (label: number): ImageRecord | undefined => registry().byLabel.get(label);

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

	function entriesFor(text: string): PreviewEntry[] {
		const found = [
			...findLabels(text, recordForLabel).map((match) => ({ start: match.start, record: match.record, labelled: true })),
			...matchImagePaths(text, (path) => recordForPath(path) !== undefined)
				.map((match) => ({ start: match.start, record: recordForPath(match.path)!, labelled: false })),
		].sort((a, b) => a.start - b.start);
		const entries = new Map<string, PreviewEntry>();
		for (const { record, labelled } of found) {
			if (entries.has(record.hash)) continue;
			if (entries.size < MAX_PREVIEWS) ensureThumbnail(record);
			entries.set(record.hash, {
				label: labelled ? record.label : undefined,
				hash: record.hash,
				sourcePath: record.sourcePath,
				sizeBytes: record.sizeBytes,
				thumbnail: thumbnails.get(record.hash),
			});
		}
		return [...entries.values()];
	}

	function refresh(): void {
		if (stopped) return;
		try {
			show(entriesFor(ctx.ui.getEditorText()));
		} catch {
			// The UI went away between checks.
		}
	}

	function ensureThumbnail(record: ImageRecord): void {
		if (thumbnails.has(record.hash)) return;
		thumbnails.set(record.hash, undefined);
		while (thumbnails.size > MAX_THUMBNAILS) thumbnails.delete(thumbnails.keys().next().value!);
		void (async () => {
			const source = (await materialize(record, undefined))?.bytes;
			const thumbnail = source ? await makeThumbnail(source, record.mimeType) : null;
			if (!thumbnails.has(record.hash)) return;
			thumbnails.set(record.hash, thumbnail);
			refresh();
		})().catch(() => undefined);
	}

	async function lookup(path: string, sessionFile: string | undefined): Promise<void> {
		const info = await stat(path).catch(() => undefined);
		if (!info?.isFile()) {
			known.delete(path);
			return;
		}
		const key = `${info.size}:${info.mtimeMs}:${sessionFile ?? ""}`;
		if (known.get(path)?.key === key) return;
		const result = await ingestImage(path, sessionFile);
		known.delete(path);
		known.set(path, { key, result });
		while (known.size > MAX_KNOWN_PATHS) known.delete(known.keys().next().value!);
		if (result.status === "too-large") warnTooLarge(ctx, path);
	}

	async function scanOnce(): Promise<void> {
		const text = ctx.ui.getEditorText();
		lastText = text;
		if (text.trim() === "") {
			draft.collapsedPaste = false;
			show([]);
			return;
		}
		const sessionFile = ctx.sessionManager.getSessionFile();
		for (const path of listCandidatePaths(text)) await lookup(path, sessionFile);
		if (stopped) return;
		// Rewrite against the text as it is now, in one synchronous step, so no keystroke is lost.
		let current = ctx.ui.getEditorText();
		const rewritten = rewriteDraft(current, draft, recordForPath, recordForLabel);
		if (rewritten !== undefined && rewritten !== current) {
			ctx.ui.setEditorText(rewritten);
			current = rewritten;
			lastText = current;
		}
		show(entriesFor(current));
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
				// Leave the draft as it is; the next change is checked again.
			} finally {
				running = false;
			}
		})();
	}

	const stopInput = ctx.ui.onTerminalInput((data) => {
		if (isCollapsingPaste(data)) draft.collapsedPaste = true;
		return undefined;
	});
	const timer = setInterval(() => {
		if (stopped) return;
		try {
			if (ctx.ui.getEditorText() !== lastText) scan();
		} catch {
			// The UI went away; shutdown stops the timer.
		}
	}, POLL_MS);
	timer.unref?.();

	return () => {
		if (stopped) return;
		stopped = true;
		clearInterval(timer);
		stopInput();
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
		stopWatch = ctx.mode === "tui" ? watchDraft(ctx) : undefined;
	});

	pi.on("session_shutdown", () => {
		stopWatch?.();
		stopWatch = undefined;
	});

	pi.on("input", async (event, ctx) => {
		if (event.source !== "interactive" || ctx.mode !== "tui") return { action: "continue" };
		try {
			const submission = await prepareSubmission(event.text, event.images, ctx.sessionManager.getSessionFile());
			if (!submission) return { action: "continue" };
			for (const path of submission.tooLarge) warnTooLarge(ctx, path);
			for (const label of submission.unreadable) {
				notifyOnce(ctx, `unreadable:${label}`, `image-preview: ${labelText(label)} could not be read; sent as its path without the image`);
			}
			return { action: "transform", text: submission.text, images: submission.images };
		} catch {
			return { action: "continue" };
		}
	});
}
