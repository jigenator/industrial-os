import type { KeybindingsManager } from "@earendil-works/pi-tui";
import { countCandidatePaths, formatPath, matchImagePaths, type PathMatch } from "./paths.ts";
import type { ImageRecord } from "./store.ts";

const LABEL = /\[image (\d+)\]/g;
const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/** Pi's editor collapses a paste of more than this many lines or characters into a `[paste #N]` marker. */
export const COLLAPSE_LINES = 10;
export const COLLAPSE_CHARS = 1000;

export function labelText(label: number): string {
	return `[image ${label}]`;
}

/**
 * The text pi-tui 1.3.0 `Editor.handlePaste` measures: CSI-u control keys decoded, line endings normalized,
 * tabs expanded to four spaces and other control characters dropped. A copy of that code; recheck it on a
 * host upgrade.
 */
function pastedText(content: string): string {
	const decoded = content.replace(/\x1b\[(\d+);5u/g, (match, code: string) => {
		const point = Number(code);
		if (point >= 97 && point <= 122) return String.fromCharCode(point - 96);
		if (point >= 65 && point <= 90) return String.fromCharCode(point - 64);
		return match;
	});
	const normalized = decoded.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, "    ");
	return normalized
		.split("")
		.filter((char) => char === "\n" || char.charCodeAt(0) >= 32)
		.join("");
}

/**
 * Whether raw terminal input holds a bracketed paste that Pi's editor would collapse, following
 * `Editor.handleInput` and `handlePaste`. Pi prefixes a pasted path with a space when a word character
 * precedes the cursor; the cursor is not visible here, so that space is always counted. An unterminated
 * paste cannot be measured and counts as collapsed.
 */
export function isCollapsingPaste(data: string): boolean {
	if (!data.includes(PASTE_START)) return false;
	const buffer = data.replace(PASTE_START, "");
	const endIndex = buffer.indexOf(PASTE_END);
	if (endIndex === -1) return true;
	const content = buffer.substring(0, endIndex);
	if (content.length > 0) {
		const text = pastedText(content);
		const chars = text.length + (/^[/~.]/.test(text) ? 1 : 0);
		if (text.split("\n").length > COLLAPSE_LINES || chars > COLLAPSE_CHARS) return true;
	}
	return isCollapsingPaste(buffer.substring(endIndex + PASTE_END.length));
}

/** What a raw input does to the draft, by the user's keybindings. */
export interface InputKind {
	/** Undo or history navigation: the draft becomes text the user already had, which stays as it is. */
	recall: boolean;
	/** The key may submit the draft. */
	submit: boolean;
}

/**
 * Classify raw terminal input by Pi's editor keybindings. Up and Down count as recall because the editor
 * browses history with them; when they only move the cursor the draft does not change, so nothing follows.
 */
export function classifyInput(data: string, keys: Pick<KeybindingsManager, "matches">): InputKind {
	return {
		recall: keys.matches(data, "tui.editor.undo")
			|| keys.matches(data, "tui.editor.historyPrevious")
			|| keys.matches(data, "tui.editor.historyNext")
			|| keys.matches(data, "tui.editor.cursorUp")
			|| keys.matches(data, "tui.editor.cursorDown"),
		submit: (keys.matches(data, "tui.input.submit") || keys.matches(data, "tui.select.confirm"))
			&& !keys.matches(data, "tui.input.newLine"),
	};
}

/**
 * Bash (`!`) and slash-command drafts must keep real paths: a label would reach the shell or a command. A
 * command's first word has no second `/` and is not itself an image, so a draft that starts with an image
 * path, as a clipboard paste into an empty editor does, is an ordinary message.
 */
export function keepsPaths(text: string, isImage: (path: string) => boolean = () => false): boolean {
	const trimmed = text.trimStart();
	if (trimmed.startsWith("!")) return true;
	const command = /^\/[^\s/]+(?=\s|$)/.exec(trimmed);
	return command !== null && !isImage(command[0]);
}

export interface LabelMatch {
	start: number;
	end: number;
	record: ImageRecord;
}

/** Known `[image N]` labels in `text`; labels this process never assigned are not matches. */
export function findLabels(text: string, lookup: (label: number) => ImageRecord | undefined): LabelMatch[] {
	const found: LabelMatch[] = [];
	for (const match of text.matchAll(LABEL)) {
		const record = lookup(Number(match[1]));
		if (record) found.push({ start: match.index, end: match.index + match[0].length, record });
	}
	return found;
}

/** Replace non-overlapping spans, given in ascending order. */
export function replaceSpans(text: string, spans: { start: number; end: number; text: string }[]): string {
	let result = "";
	let cursor = 0;
	for (const span of spans) {
		result += text.slice(cursor, span.start) + span.text;
		cursor = span.end;
	}
	return result + text.slice(cursor);
}

/** `text` with every known label turned back into its path, or undefined when it has none. */
export function restorePaths(text: string, recordForLabel: (label: number) => ImageRecord | undefined): string | undefined {
	const labels = findLabels(text, recordForLabel);
	if (labels.length === 0) return undefined;
	return replaceSpans(text, labels.map((label) => ({ ...label, text: formatPath(label.record.path) })));
}

export interface DraftState {
	/** The draft holds, or may hold, a collapsed `[paste #N]` marker that rewriting would expand. */
	collapsedPaste: boolean;
	/** The draft was last changed by undo or history recall; nothing is rewritten until the user edits it. */
	recalled: boolean;
	/** Path tokens the user restored by undo or recall, which stay as typed, counted per path. */
	kept: Map<string, number>;
}

export function newDraftState(): DraftState {
	return { collapsedPaste: false, recalled: false, kept: new Map() };
}

/**
 * Update `state.kept` for a new draft. After undo or recall every path token in it is kept as typed; after
 * any other change, kept tokens that are gone are forgotten, and new tokens may be relabelled.
 */
export function noteDraftChange(state: DraftState, text: string, recall: boolean): void {
	const counts = countCandidatePaths(text);
	if (recall) {
		state.kept = counts;
		return;
	}
	for (const [path, kept] of state.kept) {
		const left = Math.min(kept, counts.get(path) ?? 0);
		if (left > 0) state.kept.set(path, left);
		else state.kept.delete(path);
	}
}

/**
 * The rewritten draft, or undefined to leave it alone. Image paths become labels in an ordinary draft; in a
 * bash or slash-command draft labels go back to paths. Nothing is rewritten while a collapsed paste may be
 * present, because Pi's `setEditorText` would expand it permanently, nor straight after undo or history
 * recall, because the rewrite would push an undo step or end history browsing. Kept paths stay as typed.
 */
export function rewriteDraft(
	text: string,
	state: DraftState,
	recordForPath: (path: string) => ImageRecord | undefined,
	recordForLabel: (label: number) => ImageRecord | undefined,
): string | undefined {
	if (state.collapsedPaste || state.recalled) return undefined;
	const isImage = (path: string) => recordForPath(path) !== undefined;
	if (keepsPaths(text, isImage)) return restorePaths(text, recordForLabel);
	const kept = new Map(state.kept);
	const spans: (PathMatch & { text: string })[] = [];
	for (const match of matchImagePaths(text, isImage)) {
		const left = kept.get(match.path) ?? 0;
		if (left > 0) {
			kept.set(match.path, left - 1);
			continue;
		}
		spans.push({ ...match, text: labelText(recordForPath(match.path)!.label) });
	}
	return spans.length === 0 ? undefined : replaceSpans(text, spans);
}
