import { homedir } from "node:os";
import { join } from "node:path";

// An image extension that ends a token: followed by the end of the line, whitespace, a closing quote or
// bracket, or sentence punctuation.
const ENDING = /\.(?:png|jpe?g|gif|webp)(?=$|[\s"'),;:!?\]}>]|\.(?:$|\s))/gi;
// Characters that may precede the start of a path.
const BEFORE_START = /[\s"'(<]/;

/** One image path found in text; `start`/`end` cover the whole token, including any quotes. */
export interface PathMatch {
	start: number;
	end: number;
	/** Absolute filesystem path the token names. */
	path: string;
}

interface Candidate {
	start: number;
	end: number;
	path: string;
}

/**
 * Turn the token text between `start` and `end` into an absolute path, undoing drag-and-drop shell
 * escaping and expanding `~/`. Returns undefined for anything that is not absolute.
 */
function resolveToken(raw: string, quoted: boolean, home: string): string | undefined {
	const text = quoted ? raw : raw.replace(/\\(.)/g, "$1");
	if (text.startsWith("~/")) return join(home, text.slice(2));
	if (text.startsWith("/")) return text;
	return undefined;
}

// Bounds that keep a scan cheap on any draft: no path is longer than Linux's PATH_MAX, each ending tries
// its nearest few starts, and a whole draft yields a capped number of candidates to check on disk.
const MAX_PATH_CHARS = 4096;
const MAX_STARTS_PER_ENDING = 8;
/** At most this many candidate paths are taken from one text, in reading order. */
export const MAX_CANDIDATES = 256;

/** Indexes in `line` where a path may start: `/` or `~/` at the line start or after `BEFORE_START`. */
function pathStarts(line: string): number[] {
	const starts: number[] = [];
	for (let index = line.indexOf("/"); index !== -1; index = line.indexOf("/", index + 1)) {
		const start = index > 0 && line[index - 1] === "~" ? index - 1 : index;
		if (start === 0 || BEFORE_START.test(line[start - 1])) starts.push(start);
	}
	return starts;
}

/** How many of the ascending `starts` lie before `index`. */
function countBefore(starts: number[], index: number): number {
	let low = 0;
	let high = starts.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (starts[middle] < index) low = middle + 1;
		else high = middle;
	}
	return low;
}

/**
 * Candidates for each image-extension ending, nearest start first. A path may contain unescaped spaces
 * (Pi inserts copied file paths raw), so each whitespace-preceded `/` or `~/` before an ending is a
 * candidate; only a filesystem check can say which one is real. Work is linear in the text length.
 */
function candidatesByEnding(text: string, home: string): Candidate[][] {
	const groups: Candidate[][] = [];
	let total = 0;
	let lineStart = 0;
	for (const line of text.split("\n")) {
		let starts: number[] | undefined;
		for (const ending of line.matchAll(ENDING)) {
			starts ??= pathStarts(line);
			const end = ending.index + ending[0].length;
			const group: Candidate[] = [];
			const room = Math.min(MAX_STARTS_PER_ENDING, MAX_CANDIDATES - total);
			for (let at = countBefore(starts, ending.index) - 1; at >= 0 && group.length < room; at--) {
				const start = starts[at];
				if (end - start > MAX_PATH_CHARS) break;
				const quote = start > 0 ? line[start - 1] : "";
				const quoted = (quote === '"' || quote === "'") && line[end] === quote;
				const path = resolveToken(line.slice(start, end), quoted, home);
				if (!path) continue;
				group.push({
					start: lineStart + (quoted ? start - 1 : start),
					end: lineStart + (quoted ? end + 1 : end),
					path,
				});
			}
			if (group.length > 0) {
				groups.push(group);
				total += group.length;
				if (total >= MAX_CANDIDATES) return groups;
			}
		}
		lineStart += line.length + 1;
	}
	return groups;
}

/** Every absolute path that could be an image token in `text`, for the caller to check on disk. */
export function listCandidatePaths(text: string, home = homedir()): string[] {
	return [...new Set(candidatesByEnding(text, home).flat().map((candidate) => candidate.path))];
}

/**
 * The image path tokens in `text`, left to right, without overlaps. For each ending the nearest start whose
 * path `isImage` accepts wins, so two space-separated paths stay two tokens.
 */
export function matchImagePaths(text: string, isImage: (path: string) => boolean, home = homedir()): PathMatch[] {
	const matches: PathMatch[] = [];
	let consumed = 0;
	for (const group of candidatesByEnding(text, home)) {
		const found = group.find((candidate) => candidate.start >= consumed && isImage(candidate.path));
		if (!found) continue;
		matches.push(found);
		consumed = found.end;
	}
	return matches;
}
