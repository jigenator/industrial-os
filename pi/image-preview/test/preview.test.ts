import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters as stripAnsi } from "node:util";
import { resetCapabilitiesCache, setCapabilities, visibleWidth } from "@earendil-works/pi-tui";
import { makeThumbnail, MAX_PREVIEWS, PREVIEW_ROWS, PreviewWidget, type PreviewEntry } from "../src/preview.ts";
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

test("counts images beyond the preview limit on one line", () => {
	setCapabilities({ images: null, trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	widget.setEntries(Array.from({ length: MAX_PREVIEWS + 2 }, (_, index) => entry(`${index}.png`)));
	const lines = widget.render(80).map(stripAnsi);
	assert.equal(lines.length, MAX_PREVIEWS + 1);
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

test("with Kitty support a thumbnail renders below its caption within the row budget", () => {
	setCapabilities({ images: "kitty", trueColor: true, hyperlinks: false });
	const widget = new PreviewWidget(theme);
	const thumbnail = { data: png().toString("base64"), mimeType: "image/png", width: 400, height: 400 };
	widget.setEntries([entry("shot.png", { thumbnail }), entry("next.png", { thumbnail: undefined })]);
	const lines = widget.render(80);
	assert.equal(stripAnsi(lines[0]), " shot.png · 2 KB");
	assert.ok(lines[1].startsWith(" \x1b_G"), "Kitty graphics sequence");
	const rows = lines.indexOf(lines.find((line, index) => index > 1 && line !== "")!) - 1;
	assert.ok(rows >= 1 && rows <= PREVIEW_ROWS, `image rows ${rows}`);
	assert.equal(stripAnsi(lines.at(-1)!), " next.png · 2 KB · loading preview");
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
