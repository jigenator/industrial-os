import type { ImageContent } from "@earendil-works/pi-ai";
import { findLabels, labelText, replaceSpans } from "./draft.ts";
import { formatPath, listCandidatePaths, matchImagePaths } from "./paths.ts";
import { ingestImage, materialize, registry, type ImageRecord, type IngestResult } from "./store.ts";

export interface Submission {
	text: string;
	images: ImageContent[];
	/** Labels whose image could not be read; they were sent as their last known path, unattached. */
	unreadable: number[];
	/** Paths left as text because the file is over the size limit. */
	tooLarge: string[];
}

/**
 * Prepare an interactive submission: cache and label any image path still in the text, then replace each
 * known label with its cached path and attach the image. Images already on the event come first; each
 * distinct image is attached once. Returns undefined when nothing changes.
 */
export async function prepareSubmission(
	text: string,
	existing: ImageContent[] | undefined,
	sessionFile: string | undefined,
): Promise<Submission | undefined> {
	const tooLarge: string[] = [];
	const ingested = new Map<string, ImageRecord>();
	for (const path of listCandidatePaths(text)) {
		const result: IngestResult = await ingestImage(path, sessionFile);
		if (result.status === "ok") ingested.set(path, result.record);
		else if (result.status === "too-large") tooLarge.push(path);
	}
	const paths = matchImagePaths(text, (path) => ingested.has(path));
	const labelled = replaceSpans(text, paths.map((match) => ({ ...match, text: labelText(ingested.get(match.path)!.label) })));

	const { byLabel } = registry();
	const labels = findLabels(labelled, (label) => byLabel.get(label));
	if (labels.length === 0) return undefined;

	const images: ImageContent[] = [...(existing ?? [])];
	const attached = new Map<number, string>();
	const unreadable: number[] = [];
	for (const { record } of labels) {
		if (attached.has(record.label) || unreadable.includes(record.label)) continue;
		const copy = await materialize(record, sessionFile);
		if (!copy) {
			unreadable.push(record.label);
			continue;
		}
		attached.set(record.label, copy.path);
		images.push({ type: "image", data: copy.bytes.toString("base64"), mimeType: record.mimeType });
	}
	const finalText = replaceSpans(labelled, labels.map(({ start, end, record }) => ({
		start,
		end,
		text: formatPath(attached.get(record.label) ?? record.path),
	})));
	return { text: finalText, images, unreadable, tooLarge };
}
