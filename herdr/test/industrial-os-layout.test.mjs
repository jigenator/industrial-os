// Checks the industrial-os layout and mod folder: the layout is the shipped `main` layout with the sidebar's header,
// two lists and footer each replaced by an industrial-os block, the pane header drawn by the same mod, and Lunalee's
// column added on the right; mod.json; and the mod imports nothing from outside its folder but the host's own modules.
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
	// The pane header: the mod's unit plate, `part: "plate"` (six 18.5 px rows and a 19 px strip), for the shipped pane mod.
	assert.deepEqual(shippedPane.header, { content: { mod: "pane" }, height: 30, position: "top", reveal: "always" });
	assert.deepEqual(pane.header, { content: { mod: "industrial-os", props: { part: "plate" } }, height: 130, position: "top", reveal: "always" });
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

test("mod.json places the mod nowhere by itself, and its one window is the Pi Reloader, acting on every eligible Pi", async () => {
	// `mod.open:industrial-os` opens this overlay with these props. No `only` prop: that limits a test copy to its own terminals.
	assert.deepEqual(JSON.parse(await read(`${MOD}mod.json`)), { place: "none", title: "Industrial OS", overlay: { kind: "window", width: 620, height: 460, props: { part: "reloader" } } });
});

// What each file may import from the app. Everything else is a file of this mod.
const DRAWS = ["gpui-kit", "gpui-base", "herdr"];
const hostOf = (file) => file === "parts/drawings.js" ? [...DRAWS, "fs/promises"] // the one file that writes: SVG drawings are all Herdr can show them from
	: file === "reloader/view.js" ? [...DRAWS, "net"] // the one file that opens a socket: the Pi Reloader's, to each Pi's guard on loopback
	: /^(parts\/[\w-]+|plate\/view|main|storybook|stories)\.js$/.test(file) ? DRAWS
	: []; // a pure module: rules and data, loadable by Node as it is
// The mod's own folders. ds/ is the design system's files, copied by a script and checked in droid-plate.test.mjs.
const FOLDERS = ["parts", "plate", "reloader"];

// Every module a source names: `import "x"`, `import … from "x"` and `export … from "x"`, however it is spaced or
// broken over lines. It reads text, not syntax, so it also takes a `from "x"` in a comment or string for an import:
// it can only refuse too much. What it cannot read is refused by UNREADABLE: `import(`, and a comment before a name.
const specifiersOf = (source) => [...source.matchAll(/\b(?:import|from)\s*["']([^"']+)["']/g)].map((m) => m[1]);
const UNREADABLE = /\bimport\s*\(|\b(?:import|from)\s*\/[/*]/;

test("the import reader sees an import however it is written, and refuses what it cannot read", () => {
	const forms = ['import "a";', "import b from 'b';", 'import{c}from"c";', 'export*from"d";', 'export { e }\n\tfrom\n\t"e";', 'const x = 1; import * as f from "f";', 'import g, { h } from "g";'];
	assert.deepEqual(specifiersOf(forms.join("\n")), ["a", "b", "c", "d", "e", "f", "g"]);
	for (const hidden of ['import("net")', 'import ("net")', 'await import\n("net")', 'import /* */ "net"', 'export * from // x\n"net"']) assert.match(hidden, UNREADABLE, hidden);
	for (const plain of ['import { a } from "./a.js";', "// the layout's important (and only) block", "const from = 1;"]) assert.doesNotMatch(plain, UNREADABLE, plain);
});

test("imports stay inside the mod folder; only the views and parts/ draw, only parts/drawings.js writes files, only reloader/view.js opens a socket, and only pure modules reach ds/", async () => {
	const scripts = async (folder) => (await readdir(new URL(`${MOD}${folder}`, import.meta.url))).filter((f) => f.endsWith(".js")).map((f) => `${folder}${f}`);
	const files = [...await scripts(""), ...(await Promise.all(FOLDERS.map((folder) => scripts(`${folder}/`)))).flat()], root = new URL(MOD, import.meta.url).href;
	for (const known of ["main.js", "parts/sheet.js", "plate/view.js", "reloader/view.js"]) assert.ok(files.includes(known), known);
	// Nothing else holds scripts: a new folder is added to FOLDERS, so its files are checked too.
	const folders = (await readdir(new URL(MOD, import.meta.url), { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
	assert.deepEqual(folders.sort(), [...FOLDERS, "ds", "marks"].sort());
	for (const file of files) {
		const source = await read(`${MOD}${file}`);
		assert.doesNotMatch(source, UNREADABLE, `${file} imports in a form this check cannot read`);
		for (const specifier of specifiersOf(source)) {
			if (hostOf(file).includes(specifier)) continue;
			assert.match(specifier, /^\.\.?\//, `${file} imports ${specifier}`);
			const target = new URL(specifier, new URL(file, root)).href;
			assert.ok(target.startsWith(root), `${file} imports ${specifier}`);
			const inside = target.slice(root.length);
			if (inside.startsWith("ds/")) {
				// The design-system copy is rules and lines, never drawing: a view draws what a pure module composed.
				assert.deepEqual(hostOf(file), [], `${file} imports ${specifier}`);
				assert.ok((await read(`${MOD}${inside}`)).length > 0, `${file} imports ${specifier}`);
				continue;
			}
			assert.ok(files.includes(inside), `${file} imports ${specifier}`);
			// A part is used by the sidebar and the storybook, never the other way round, and shows no invented data of its own.
			if (file.startsWith("parts/")) assert.doesNotMatch(inside, /^(main|storybook|stories|sample)\.js$|^(plate|reloader)\//, `${file} imports ${specifier}`);
			// From outside its own folder the Pi Reloader takes only the mod's folder name, and the pane header that and
			// the mod's one reader of the signals label.
			if (/^(plate|reloader)\//.test(file) && !inside.startsWith(file.split("/")[0] + "/")) assert.ok(inside === "parts/drawings.js" || (file === "plate/view.js" && inside === "signals.js"), `${file} imports ${specifier}`);
		}
		// No host features the runtime lacks.
		assert.doesNotMatch(source, /\b(setTimeout|setInterval|Intl\.|structuredClone|TextDecoder|WebSocket|require\()/, file);
	}
});
