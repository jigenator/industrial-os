import assert from "node:assert/strict";
import test from "node:test";
import { listCandidatePaths, matchImagePaths, MAX_CANDIDATES } from "../src/paths.ts";

const HOME = "/home/me";
const exists = (...paths: string[]) => (path: string) => paths.includes(path);
const tokens = (text: string, isImage: (path: string) => boolean) =>
	matchImagePaths(text, isImage, HOME).map((match) => ({ token: text.slice(match.start, match.end), path: match.path }));

test("finds a plain absolute path, such as Pi's clipboard temp file", () => {
	const path = "/var/folders/xy/T/pi-clipboard-0b9e.png";
	assert.deepEqual(tokens(`look at ${path} please`, exists(path)), [{ token: path, path }]);
});

test("undoes drag-and-drop escaping of spaces", () => {
	const text = String.raw`/Users/me/My\ Shots/a\ b.png`;
	assert.deepEqual(tokens(text, exists("/Users/me/My Shots/a b.png")), [{ token: text, path: "/Users/me/My Shots/a b.png" }]);
});

test("takes a quoted path literally and replaces the quotes with it", () => {
	const path = "/Users/me/My Shots/a b.jpeg";
	assert.deepEqual(tokens(`see '${path}' and "${path}"`, exists(path)), [
		{ token: `'${path}'`, path },
		{ token: `"${path}"`, path },
	]);
});

test("expands ~/ to the home directory", () => {
	assert.deepEqual(tokens("~/Desktop/shot.webp", exists(`${HOME}/Desktop/shot.webp`)), [
		{ token: "~/Desktop/shot.webp", path: `${HOME}/Desktop/shot.webp` },
	]);
});

test("accepts an unescaped path with spaces only when that file exists", () => {
	const path = "/Users/me/My Shots/a b.png";
	assert.deepEqual(tokens(`compare ${path}`, exists(path)), [{ token: path, path }]);
	assert.deepEqual(tokens(`compare ${path}`, exists()), []);
});

test("keeps two space-separated paths apart, and one per line", () => {
	const isImage = exists("/a/one.png", "/b/two.gif");
	assert.deepEqual(tokens("/a/one.png /b/two.gif", isImage).map((match) => match.token), ["/a/one.png", "/b/two.gif"]);
	assert.deepEqual(tokens("/a/one.png\n/b/two.gif", isImage).map((match) => match.token), ["/a/one.png", "/b/two.gif"]);
});

test("allows sentence punctuation after the extension", () => {
	assert.deepEqual(tokens("is it /a/one.png? or (/b/two.gif).", exists("/a/one.png", "/b/two.gif")).map((match) => match.token), [
		"/a/one.png",
		"/b/two.gif",
	]);
});

test("ignores non-image extensions, relative paths and missing files", () => {
	assert.deepEqual(listCandidatePaths("/a/notes.txt /a/archive.png.zip", HOME), []);
	assert.deepEqual(listCandidatePaths("docs/a.png ./b.png word/c.png", HOME), []);
	assert.deepEqual(tokens("/a/missing.png", exists()), []);
});

test("lists every candidate start for the caller to check", () => {
	assert.deepEqual(listCandidatePaths("/x/dir /y/a.png", HOME).sort(), ["/x/dir /y/a.png", "/y/a.png"]);
});

test("candidate search stays bounded on adversarial text", () => {
	const text = "/missing.png ".repeat(5000);
	const started = performance.now();
	const candidates = listCandidatePaths(text, HOME);
	assert.deepEqual(matchImagePaths(text, () => false, HOME), []);
	const elapsed = performance.now() - started;
	assert.ok(elapsed < 250, `took ${Math.round(elapsed)} ms`);
	assert.ok(candidates.length > 0 && candidates.length <= MAX_CANDIDATES, `${candidates.length} candidates`);
	assert.equal(candidates[0], "/missing.png");
});

test("many endings without a start, and one very long line, stay bounded", () => {
	const started = performance.now();
	assert.deepEqual(listCandidatePaths("a.png ".repeat(20000), HOME), []);
	assert.deepEqual(listCandidatePaths(`/${"x".repeat(200000)}.png`, HOME), []);
	assert.ok(performance.now() - started < 250);
});

test("the candidate cap is exact, in reading order", () => {
	const paths = Array.from({ length: MAX_CANDIDATES + 50 }, (_, index) => `/d/${index}.png`);
	assert.deepEqual(listCandidatePaths(paths.join("\n"), HOME), paths.slice(0, MAX_CANDIDATES));
	// Seven starts per ending do not divide the cap, so the last group is cut short.
	const crowded = Array.from({ length: 40 }, (_, index) => `/a /b /c /d /e /f /${index}.png`).join("\n");
	assert.equal(listCandidatePaths(crowded, HOME).length, MAX_CANDIDATES);
});
