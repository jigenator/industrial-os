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

/**
 * Every candidate for each image-extension ending, nearest start first. A path may contain unescaped
 * spaces (Pi inserts copied file paths raw), so each whitespace-preceded `/` or `~/` before an ending is a
 * candidate; only a filesystem check can say which one is real.
 */
function candidatesByEnding(text: string, home: string): Candidate[][] {
	const groups: Candidate[][] = [];
	let lineStart = 0;
	for (const line of text.split("\n")) {
		for (const ending of line.matchAll(ENDING)) {
			const end = ending.index + ending[0].length;
			const group: Candidate[] = [];
			for (let start = ending.index - 1; start >= 0; start--) {
				const char = line[start];
				if (char !== "/" && !(char === "~" && line[start + 1] === "/")) continue;
				if (start > 0 && !BEFORE_START.test(line[start - 1])) continue;
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
			if (group.length > 0) groups.push(group);
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

/** How a path is written into a submitted message: raw, or double-quoted when it contains whitespace. */
export function formatPath(path: string): string {
	return /\s/.test(path) ? `"${path}"` : path;
}
