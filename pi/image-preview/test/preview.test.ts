import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters as stripAnsi } from "node:util";
import { resetCapabilitiesCache, setCapabilities, visibleWidth } from "@earendil-works/pi-tui";
import { makeThumbnail, PREVIEW_COLUMNS, PREVIEW_ROWS, PreviewWidget, STACKED_PREVIEWS, type PreviewEntry } from "../src/preview.ts";
import { png, theme } from "./helpers.ts";

const entry = (name: string, overrides: Partial<PreviewEntry> = {}): PreviewEntry => ({
	id: `${name}-id`,
	path: `/tmp/${name}`,
	sizeBytes: 1536,
	thumbnail: null,
	...overrides,
});

test.afterEach(() => resetCapabilitiesCache());

test("without image support each image is one caption line carrying its name and size", () => {
	setCapabilities({ images: null, trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries([entry("shot.png"), entry("drag.jpg")]);
	assert.deepEqual(widget.render(80).map(stripAnsi), [" shot.png · 2 KB", " drag.jpg · 2 KB"]);
});

test("counts images beyond the stacked limit on one line", () => {
	setCapabilities({ images: null, trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries(Array.from({ length: STACKED_PREVIEWS + 2 }, (_, index) => entry(`${index}.png`)));
	const lines = widget.render(80).map(stripAnsi);
	assert.equal(lines.length, STACKED_PREVIEWS + 1);
	assert.equal(lines.at(-1), " +2 more");
});

test("captions fit narrow widths and show control characters as ?", () => {
	setCapabilities({ images: null, trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries([entry("a\x1b[31mvery-long-file-name.png")]);
	for (const width of [1, 5, 12, 30]) {
		for (const line of widget.render(width)) assert.ok(visibleWidth(line) <= width, `width ${width}`);
	}
	assert.match(stripAnsi(widget.render(80)[0]), /a\?\[31mvery/);
});

const square = { data: png().toString("base64"), mimeType: "image/png", width: 400, height: 400 };
const kittyCount = (line: string) => line.split("\x1b_G").length - 1;

test("with Kitty support previews sit side by side, captions above, within the row budget", () => {
	setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries([entry("a.png", { thumbnail: square }), entry("b.png", { thumbnail: square }), entry("c.png", { thumbnail: undefined })]);
	const lines = widget.render(200);
	assert.equal(lines.length, 1 + PREVIEW_ROWS, "one caption row, then the image rows");
	assert.match(stripAnsi(lines[0]), /^ a\.png · 2 KB +b\.png · 2 KB +c\.png · 2 KB · loading preview$/);
	assert.ok(lines[1].startsWith(" \x1b_G"), "Kitty graphics sequence");
	assert.equal(kittyCount(lines[1]), 2, "both thumbnails on one row");
	assert.match(lines[1], /C=1/, "placements leave the cursor in place");
	assert.match(lines[1], /\x1b\[\d+C/, "the cursor moves right to the next cell");
	assert.ok(lines.slice(2).every((line) => line === ""));
	assert.ok(visibleWidth(lines[0]) <= 200);
});

test("previews that pass the right edge are counted as +N more", () => {
	setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries(Array.from({ length: 5 }, (_, index) => entry(`${index}.png`, { thumbnail: square })));
	const wide = widget.render(400);
	assert.equal(kittyCount(wide[1]), 5);
	assert.doesNotMatch(stripAnsi(wide[0]), /more/);
	const narrow = widget.render(60);
	const shown = kittyCount(narrow[1]);
	assert.ok(shown >= 1 && shown < 5, `shown ${shown}`);
	assert.doesNotMatch(stripAnsi(narrow[0]), /more/, "the count is not on the caption row");
	assert.equal(narrow.length, 1 + PREVIEW_ROWS + 1, "captions, image rows, then the count");
	assert.equal(stripAnsi(narrow.at(-1)!), ` +${5 - shown} more`);
	assert.ok(narrow.every((line) => line.includes("\x1b_G") || visibleWidth(line) <= 60));
});

test("one preview is always shown, even when it alone fills a narrow row", () => {
	setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries([entry("a.png", { thumbnail: square }), entry("b.png", { thumbnail: square })]);
	for (const width of [2, 10, 30]) {
		const lines = widget.render(width);
		assert.equal(kittyCount(lines[1]), 1, `width ${width}`);
		assert.ok(visibleWidth(lines[0]) <= width, `width ${width}`);
	}
	assert.ok(PREVIEW_COLUMNS >= 30);
});

test("no thumbnail is made when the terminal cannot show images", async () => {
	setCapabilities({ images: null, trueColor: true, hyperlinks: false });
	assert.equal(await makeThumbnail(png(), "image/png"), null);
});

test("the host resizer makes a PNG thumbnail for Kitty", async () => {
	setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
	const thumbnail = await makeThumbnail(png(), "image/png");
	assert.ok(thumbnail);
	assert.equal(thumbnail.mimeType, "image/png");
	assert.equal(thumbnail.width, 1);
});

test("a thumbnail stays within the byte cap after conversion to PNG", async () => {
	setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
	const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
	const roomy = await makeThumbnail(gif, "image/gif");
	assert.ok(roomy);
	assert.equal(roomy.mimeType, "image/png");
	// Under a cap the GIF meets but its PNG form does not, there is no thumbnail rather than an oversized one.
	const capped = await makeThumbnail(gif, "image/gif", { maxBytes: gif.toString("base64").length + 1 });
	assert.ok(roomy.data.length > gif.toString("base64").length + 1);
	assert.equal(capped, null);
});
