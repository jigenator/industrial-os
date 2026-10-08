import assert from "node:assert/strict";
import test from "node:test";
import { compactionReserve, contextSnapshot } from "../src/context.ts";
const model: any = { provider: "fixture", id: "model", contextWindow: 128000 };
test("compactionReserve mirrors Pi defaults, overrides, disabled and invalid settings", () => {
	assert.equal(compactionReserve({}, model), 16384);
	assert.equal(compactionReserve({ compaction: { reserveTokens: 8000 } }, model), 8000);
	assert.equal(compactionReserve({ compaction: { reserveTokens: 8000, modelOverrides: { "fixture/model": { reserveTokens: 64000 } } } }, model), 64000);
	for (const compaction of [{ enabled: false }, { reserveTokens: -1 }, { reserveTokens: 1.5 }, { reserveTokens: "8000" }, { modelOverrides: { "fixture/model": 64000 } }, { reserveTokens: -1, modelOverrides: { "fixture/model": { reserveTokens: 64000 } } }]) assert.equal(compactionReserve({ compaction }, model), null);
});
// Same vectors as status-bar/test/context.test.ts. Settings policy exists only here;
// arithmetic is intentionally duplicated at the renderer's live-token seam.
test("contextSnapshot parity vectors for the footer CTX gauge", () => {
	for (const [tokens, window, percent, reserve, expected] of [
		[32000, 128000, 25, null, 25], [32000, 128000, 25, 128000, 25],
		[32000, 128000, 25, 200000, 25], [32000, 128000, 25, 0, 25],
		[48000, 128000, 37.5, 64000, 75], [null, 128000, null, 16384, null],
		[120000, 128000, 93.75, 16384, 100], [192000, 128000, 150, null, 100],
		[-1280, 128000, -1, null, -1],
	] as const) {
		assert.equal(contextSnapshot({ tokens, contextWindow: window, percent } as any, model, reserve)?.usedPercent, expected);
	}
	assert.equal(contextSnapshot(undefined, undefined, null), null);
	assert.equal(contextSnapshot({ tokens: 1, contextWindow: 0, percent: 1 } as any, undefined, null), null);
	assert.equal(contextSnapshot({ tokens: null, contextWindow: 0, percent: null } as any, model, 16384)?.window, 128000);
});
