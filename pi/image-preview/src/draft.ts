import { formatPath, matchImagePaths, type PathMatch } from "./paths.ts";
import type { ImageRecord } from "./store.ts";

const LABEL = /\[image (\d+)\]/g;

/** Pi's editor collapses a paste of more than this many lines or characters into a `[paste #N]` marker. */
export const COLLAPSE_LINES = 10;
export const COLLAPSE_CHARS = 1000;

export function labelText(label: number): string {
	return `[image ${label}]`;
}

/**
 * Whether a raw bracketed paste would be collapsed by Pi's editor. Pi measures after normalizing line
 * endings and tabs; measuring the raw text errs towards "collapsed", which only skips a relabel.
 */
export function isCollapsingPaste(data: string): boolean {
	const start = data.indexOf("\x1b[200~");
	if (start === -1) return false;
	const endIndex = data.indexOf("\x1b[201~", start);
	const content = data.slice(start + 6, endIndex === -1 ? undefined : endIndex);
	return content.split(/\r\n|\r|\n/).length > COLLAPSE_LINES || content.length > COLLAPSE_CHARS;
}

/**
 * Bash (`!`) and slash-command drafts must keep real paths: a label would reach the shell or a command. A
 * command's first word has no second `/`, so a draft that starts with an absolute path, as a clipboard paste
 * into an empty editor does, is an ordinary message.
 */
export function keepsPaths(text: string): boolean {
	const trimmed = text.trimStart();
	return trimmed.startsWith("!") || /^\/[^\s/]+(?:\s|$)/.test(trimmed);
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

export interface DraftState {
	/** The draft holds, or may hold, a collapsed `[paste #N]` marker that rewriting would expand. */
	collapsedPaste: boolean;
}

/**
 * The rewritten draft, or undefined to leave it alone. Image paths become labels in an ordinary draft; in a
 * bash or slash-command draft labels go back to paths. Nothing is rewritten while a collapsed paste may be
 * present, because Pi's `setEditorText` would expand it permanently.
 */
export function rewriteDraft(
	text: string,
	state: DraftState,
	recordForPath: (path: string) => ImageRecord | undefined,
	recordForLabel: (label: number) => ImageRecord | undefined,
): string | undefined {
	if (state.collapsedPaste) return undefined;
	if (keepsPaths(text)) {
		const labels = findLabels(text, recordForLabel);
		if (labels.length === 0) return undefined;
		return replaceSpans(text, labels.map((label) => ({ ...label, text: formatPath(label.record.path) })));
	}
	const paths: PathMatch[] = matchImagePaths(text, (path) => recordForPath(path) !== undefined);
	if (paths.length === 0) return undefined;
	return replaceSpans(text, paths.map((match) => ({ ...match, text: labelText(recordForPath(match.path)!.label) })));
}
