import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { ACID_BLACK } from "@industrial-os/design-system/foundation/palette";
import { SIGNAL_COLORS } from "@industrial-os/design-system/foundation/signal-colors";

const require = createRequire(process.env.PI_HOST_ROOT ? resolve(process.env.PI_HOST_ROOT, "package.json") : import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, alias: { "@earendil-works/pi-tui": require.resolve("@earendil-works/pi-tui") } });
const { hueOf } = await jiti.import(resolve("src/footer.ts"));

// A design-system color without a footer alias would throw inside renderFooter and blank the footer.
test("every design-system role and signal color maps to a footer hue", () => {
	for (const role of Object.keys(ACID_BLACK)) assert.equal(typeof hueOf(role, "text"), "string", role);
	for (const [key, hex] of Object.entries(SIGNAL_COLORS)) assert.equal(typeof hueOf(hex, "text"), "string", key);
	assert.equal(hueOf(undefined, "field"), "field");
	assert.equal(hueOf("warning", "text"), "warn");
	assert.equal(hueOf("critical", "text"), "high");
	assert.throws(() => hueOf("#010203", "text"), TypeError);
});
