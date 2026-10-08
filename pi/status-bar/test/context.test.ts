import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
const require = createRequire(process.env.PI_HOST_ROOT ? resolve(process.env.PI_HOST_ROOT, "package.json") : import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, alias: { "@earendil-works/pi-tui": require.resolve("@earendil-works/pi-tui") } });
const { startMotion } = await jiti.import(resolve("src/footer.ts"));
// Same vectors as signals-collector/test/context.test.ts; no cross-project import.
test("contextOf parity vectors for the collector CTX gauge", () => {
	for (const [tokens, window, percent, reserve, expected] of [
		[32000, 128000, 25, null, 25], [32000, 128000, 25, 128000, 25],
		[32000, 128000, 25, 200000, 25], [32000, 128000, 25, 0, 25],
		[48000, 128000, 37.5, 64000, 75], [null, 128000, null, 16384, null],
		[120000, 128000, 93.75, 16384, 100], [192000, 128000, 150, null, 100],
		[-1280, 128000, -1, null, -1],
	] as const) {
		const snapshot = { homePath: "/home/example", launchPath: "/repo", activePath: "/repo", pullRequest: { kind: "none" },
			statuses: new Map(), thinking: "high", model: { provider: "fixture", id: "model", contextWindow: window },
			contextUsage: { tokens, contextWindow: window, percent }, compactionReserve: reserve ?? undefined };
		assert.equal(startMotion(snapshot, 0, 1, false).percent ?? null, expected);
	}
});
