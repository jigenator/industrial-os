import assert from "node:assert/strict";
import test from "node:test";
import { findLabels, isCollapsingPaste, keepsPaths, rewriteDraft } from "../src/draft.ts";
import type { ImageRecord } from "../src/store.ts";

const record = (label: number, path: string): ImageRecord => ({
	label,
	hash: `hash${label}`,
	mimeType: "image/png",
	sourcePath: path,
	path: `/cache/${label}.png`,
	sizeBytes: 10,
});
const one = record(1, "/tmp/pi-clipboard-1.png");
const two = record(2, "/Users/me/My Shots/b.png");
const forPath = (path: string) => [one, two].find((candidate) => candidate.sourcePath === path);
const forLabel = (label: number) => [one, two].find((candidate) => candidate.label === label);
const rewrite = (text: string, collapsedPaste = false) => rewriteDraft(text, { collapsedPaste }, forPath, forLabel);

test("relabels known image paths in an ordinary draft", () => {
	assert.equal(rewrite("what is /tmp/pi-clipboard-1.png vs '/Users/me/My Shots/b.png'?"), "what is [image 1] vs [image 2]?");
});

test("leaves a draft without known paths alone", () => {
	assert.equal(rewrite("what is /tmp/other.png"), undefined);
	assert.equal(rewrite("already [image 1]"), undefined);
});

test("never relabels bash or slash-command drafts", () => {
	assert.equal(rewrite("!open /tmp/pi-clipboard-1.png"), undefined);
	assert.equal(rewrite("  /skill:review /tmp/pi-clipboard-1.png"), undefined);
	assert.ok(keepsPaths("!!ls") && keepsPaths(" /cmd") && keepsPaths("/skill:a b") && !keepsPaths("hi /x"));
});

test("a draft that starts with an absolute path is a message, not a command", () => {
	assert.equal(keepsPaths("/tmp/pi-clipboard-1.png what is this"), false);
	assert.equal(rewrite("/tmp/pi-clipboard-1.png what is this"), "[image 1] what is this");
});

test("puts paths back when a labelled draft becomes a bash or slash-command draft", () => {
	assert.equal(rewrite("!open [image 1] [image 2] [image 9]"), "!open /cache/1.png /cache/2.png [image 9]");
	const spaced = { ...one, path: "/my cache/1.png" };
	assert.equal(rewriteDraft("/cmd [image 1]", { collapsedPaste: false }, forPath, () => spaced), '/cmd "/my cache/1.png"');
});

test("skips every rewrite while a collapsed paste may be in the draft", () => {
	assert.equal(rewrite("see /tmp/pi-clipboard-1.png", true), undefined);
	assert.equal(rewrite("!open [image 1]", true), undefined);
});

test("only labels this process assigned are matches", () => {
	assert.deepEqual(findLabels("[image 1] [image 3] [image x]", forLabel).map((match) => match.record.label), [1]);
});

test("detects a paste Pi's editor would collapse", () => {
	assert.equal(isCollapsingPaste("plain typing"), false);
	assert.equal(isCollapsingPaste("\x1b[200~short\x1b[201~"), false);
	assert.equal(isCollapsingPaste(`\x1b[200~${"x\n".repeat(11)}\x1b[201~`), true);
	assert.equal(isCollapsingPaste(`\x1b[200~${"x".repeat(1001)}\x1b[201~`), true);
	assert.equal(isCollapsingPaste(`\x1b[200~${"x".repeat(1000)}\x1b[201~`), false);
});
