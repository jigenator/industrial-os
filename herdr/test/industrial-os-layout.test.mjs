// Checks the industrial-os layout and mod folder: the layout is the shipped `main` layout with the sidebar's header,
// two lists and footer each replaced by an industrial-os block, and Lunalee's column added on the right, and the mod
// imports nothing from outside its folder but the host's own modules.
// The recorded shipped layout is fixtures/herdr-app-0.1.15-main.json (Herdr app 0.1.15's layouts/main.json).
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const MOD = "../mods/industrial-os/";

function find(node, id) {
	if (node?.id === id) return node;
	for (const child of node?.children ?? []) {
		const found = find(child, id);
		if (found) return found;
	}
	return null;
}

test("the layout differs from shipped main.json only in terminal padding, the window buttons' place, flat panes, the pane header, the sidebar width, the sidebar's three blocks and the lunalee column", async () => {
	const shipped = JSON.parse(await read("./fixtures/herdr-app-0.1.15-main.json"));
	const layout = JSON.parse(await read("../layouts/industrial-os.json"));
	// Zero so her chat fills its column; Herdr 0.1.16 reads terminal padding only from the root.
	assert.deepEqual(shipped.terminal_padding, [14, 12]);
	assert.deepEqual(layout.terminal_padding, [0, 0]);
	shipped.terminal_padding = layout.terminal_padding;
	// The window buttons stand on the plate's 18 px gutter, level with its heading. Herdr draws them 1 px right of
	// and 2 px below this point (measured on macOS, herdr-app 0.1.16).
	assert.deepEqual([shipped.traffic_lights, layout.traffic_lights], [[12, 16], [17, 10]]);
	shipped.traffic_lights = layout.traffic_lights;
	// Flat panes: square corners, no border and no focus outline.
	const shippedPane = find(shipped, "main").content.pane, pane = find(layout, "main").content.pane;
	assert.deepEqual([shippedPane.radius, shippedPane.border, shippedPane.focus], [10, { width: 1, color: "border" }, { width: 1, color: "accent" }]);
	assert.deepEqual([pane.radius, "border" in pane, "focus" in pane], [0, false, false]);
	// The pane header: the droid-plate mod's unit plate (six 18.5 px rows and a 19 px strip) for the shipped pane mod.
	assert.deepEqual(shippedPane.header, { content: { mod: "pane" }, height: 30, position: "top", reveal: "always" });
	assert.deepEqual(pane.header, { content: { mod: "droid-plate" }, height: 130, position: "top", reveal: "always" });
	find(shipped, "main").content.pane = pane;
	assert.deepEqual(find(shipped, "sidebar-lists").children.map((c) => c.id), ["spaces", "agents"]);
	assert.deepEqual(find(layout, "sidebar-lists").children, [{ id: "industrial-os", type: "block", content: { mod: "industrial-os" } }]);
	find(shipped, "sidebar-lists").children = find(layout, "sidebar-lists").children;
	// The top block is the crate plate over the shortcut strip: six terminal rows and one, 18.5 px each.
	assert.deepEqual([find(shipped, "brand").size, find(shipped, "brand").content], [{ px: 46 }, { mod: "workspace-chrome" }]);
	assert.deepEqual([find(layout, "brand").size, find(layout, "brand").content], [{ px: 130 }, { mod: "industrial-os", props: { part: "top" } }]);
	Object.assign(find(shipped, "brand"), { size: find(layout, "brand").size, content: find(layout, "brand").content });
	// The footer is the search bar; its two rows, settings and add machine, are the top block's shortcut strip.
	assert.deepEqual([find(shipped, "sidebar-footer").size, find(shipped, "sidebar-footer").content], [{ px: 69 }, { mod: "workspace-chrome", props: { footer: true } }]);
	assert.deepEqual([find(layout, "sidebar-footer").size, find(layout, "sidebar-footer").content], [{ px: 46 }, { mod: "industrial-os", props: { part: "bottom" } }]);
	Object.assign(find(shipped, "sidebar-footer"), { size: find(layout, "sidebar-footer").size, content: find(layout, "sidebar-footer").content });
	// The mockup's width: everything in the sidebar is set on a 300 px sheet.
	assert.deepEqual([find(shipped, "sidebar").size, find(layout, "sidebar").size], [{ px: 268 }, { px: 300 }]);
	find(shipped, "sidebar").size = find(layout, "sidebar").size;
	// The frozen Lunalee column contract: ids, terminal name and 580 px (about 67 columns at font 14, no terminal padding).
	assert.deepEqual(layout.children[2], {
		id: "lunalee",
		type: "column",
		size: { px: 580 },
		min: 420,
		max: 900,
		background: "chrome",
		children: [
			{ id: "lunalee-host", type: "block", size: { px: 1 }, content: { mod: "lunalee" } },
			{ id: "lunalee-chat", type: "block", content: { terminal: "lunalee-chat" } },
		],
	});
	shipped.children.push(layout.children[2]);
	assert.deepEqual(layout, shipped);
});

test("mod.json places the mod nowhere by itself; only the layout puts it in the sidebar", async () => {
	assert.deepEqual(JSON.parse(await read(`${MOD}mod.json`)), { place: "none", title: "Industrial OS" });
});

// What each file may import from the app. Everything else is a file of this mod.
const DRAWS = ["gpui-kit", "gpui-base", "herdr"];
const hostOf = (file) => file === "parts/drawings.js" ? [...DRAWS, "fs/promises"] // the one file that writes: SVG drawings are all Herdr can show them from
	: /^(parts\/[\w-]+|main|storybook|stories)\.js$/.test(file) ? DRAWS
	: []; // a pure module: rules and data, loadable by Node as it is

test("imports stay inside the mod folder; only main.js, the storybook and parts/ draw, and only parts/drawings.js writes files", async () => {
	const top = (await readdir(new URL(MOD, import.meta.url))).filter((f) => f.endsWith(".js"));
	const parts = (await readdir(new URL(`${MOD}parts/`, import.meta.url))).filter((f) => f.endsWith(".js")).map((f) => `parts/${f}`);
	assert.ok(top.includes("main.js") && parts.includes("parts/sheet.js"));
	const files = [...top, ...parts], root = new URL(MOD, import.meta.url).href;
	for (const file of files) {
		const source = await read(`${MOD}${file}`);
		const specifiers = [...source.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
		for (const specifier of specifiers) {
			if (hostOf(file).includes(specifier)) continue;
			assert.match(specifier, /^\.\.?\//, `${file} imports ${specifier}`);
			const target = new URL(specifier, new URL(file, root)).href;
			assert.ok(target.startsWith(root) && files.includes(target.slice(root.length)), `${file} imports ${specifier}`);
			// A part is used by the sidebar and the storybook, never the other way round, and shows no invented data of its own.
			if (file.startsWith("parts/")) assert.doesNotMatch(target.slice(root.length), /^(main|storybook|stories|sample)\.js$/, `${file} imports ${specifier}`);
		}
		// No host features the runtime lacks.
		assert.doesNotMatch(source, /\b(setTimeout|setInterval|Intl\.|TextDecoder|WebSocket|require\()/, file);
	}
});
