// The installed Pi host, found through PI_HOST_ROOT: its width helpers and a jiti loader that resolves the Pi peers
// the way Pi does when it loads the extension. Tests never install or vendor a host.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.PI_HOST_ROOT;
assert.ok(root, "PI_HOST_ROOT names the installed Pi package; see CONTRIBUTING.md");
const require = createRequire(resolve(root, "package.json"));
const tuiEntry = require.resolve("@earendil-works/pi-tui");
export const hostEntry = resolve(root, "dist/index.js");
export const tui = await import(pathToFileURL(tuiEntry).href);
export const measure: (text: string) => number = tui.visibleWidth;
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, {
	moduleCache: false, fsCache: false,
	alias: { "@earendil-works/pi-coding-agent": hostEntry, "@earendil-works/pi-tui": tuiEntry },
});
/** Imports a source module with the Pi peers aliased to the installed host. */
export const load = (path: string) => jiti.import(resolve(path));
