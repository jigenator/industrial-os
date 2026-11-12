// Checks the industrial-os layout and mod folder: the layout is the shipped `main` layout with the sidebar's two
// lists replaced by the one industrial-os block and Lunalee's column added on the right, and the mod imports
// nothing from outside its folder.
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

test("the layout differs from shipped main.json only in the sidebar-lists block and the lunalee column", async () => {
	const shipped = JSON.parse(await read("./fixtures/herdr-app-0.1.15-main.json"));
	const layout = JSON.parse(await read("../layouts/industrial-os.json"));
	assert.deepEqual(find(shipped, "sidebar-lists").children.map((c) => c.id), ["spaces", "agents"]);
	assert.deepEqual(find(layout, "sidebar-lists").children, [{ id: "industrial-os", type: "block", content: { mod: "industrial-os" } }]);
	find(shipped, "sidebar-lists").children = find(layout, "sidebar-lists").children;
	// The frozen Lunalee column contract: ids, terminal name and 580 px (64 columns at font 14, padding [14,12]).
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

test("imports stay inside the mod folder; the pure modules import neither gpui-kit nor herdr", async () => {
	const files = (await readdir(new URL(MOD, import.meta.url))).filter((f) => f.endsWith(".js"));
	assert.ok(files.includes("main.js"));
	for (const file of files) {
		const source = await read(`${MOD}${file}`);
		const specifiers = [...source.matchAll(/^\s*import\s[^"']*["']([^"']+)["']/gm)].map((m) => m[1]);
		const allowed = file === "main.js" ? ["gpui-kit", "gpui-base", "herdr"] : [];
		for (const specifier of specifiers) {
			const local = /^\.\/[\w-]+\.js$/.test(specifier) && files.includes(specifier.slice(2));
			assert.ok(local || allowed.includes(specifier), `${file} imports ${specifier}`);
		}
		// No host features the runtime lacks.
		assert.doesNotMatch(source, /\b(setTimeout|setInterval|Intl\.|TextDecoder|WebSocket|require\()/, file);
	}
});
