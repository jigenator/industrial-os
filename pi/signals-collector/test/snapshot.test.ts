import assert from "node:assert/strict";
import test from "node:test";
import { goalSnapshot, pendingQuestion, phaseTarget } from "../src/snapshot.ts";
test("phaseTarget follows only the contracted tools and bounds raw UTF-16", () => {
	for (const tool of ["read", "edit", "write"]) assert.equal(phaseTarget(tool, { path: "raw\x1b[2Jpath" }), "raw\x1b[2Jpath");
	assert.equal(phaseTarget("bash", { command: "first line\nsecond line" }), "first line");
	assert.equal(phaseTarget("web_search", { queries: ["query1", "query2"] }), "query1");
	assert.equal(phaseTarget("fetch_content", { urls: ["https://example.invalid"] }), "https://example.invalid");
	assert.equal(phaseTarget("subagent", { agent: "worker" }), "worker");
	assert.equal(phaseTarget("other", { path: "not a target" }), null);
	assert.equal(phaseTarget("read", { path: "x".repeat(300) })?.length, 200);
	assert.equal(phaseTarget("read", null), null);
});
test("pendingQuestion validates rpiv questions and preserves raw bounded text", () => {
	assert.deepEqual(pendingQuestion({ questions: [{ question: "Q?" }, { question: "Another?" }] }, 12), { text: "Q?", more: 1, since: 12 });
	assert.equal(pendingQuestion({ questions: [{ question: "\x1b[2J" + "x".repeat(300) }] }, 1)?.text.length, 200);
	for (const args of [null, {}, { questions: [] }, { questions: [{ text: "Q?" }] }, { questions: [{ question: 1 }] }]) assert.equal(pendingQuestion(args, 1), null);
});
const goal = { id: "id", text: "Objective", status: "active", startedAt: 1, updatedAt: 2, iteration: 0, tokensUsed: 0, timeUsedSeconds: 12, baselineTokens: 0, activeStartedAt: 3 };
const entry = (data: unknown) => ({ type: "custom", customType: "goal-state", data });
test("goalSnapshot validates inspected pi-goal 0.54.10 private shape and only latest selected-branch record", () => {
	assert.deepEqual(goalSnapshot([entry({ goal })]), { status: "active", usedSeconds: 12, activeSince: 3 });
	for (const status of ["paused", "blocked", "usage_limited", "budget_limited"]) assert.deepEqual(goalSnapshot([entry({ goal: { ...goal, status } })]), { status, usedSeconds: 12, activeSince: null });
	for (const data of [{ goal: null }, { goal: { ...goal, status: "complete" } }, { goal: { ...goal, status: "queued" } }, { goal: { ...goal, status: "future" } }, { goal: { status: "active", timeUsedSeconds: 1 } }, { goal: { ...goal, timeUsedSeconds: NaN } }, { goal: { ...goal, activeStartedAt: -1 } }, { goal, queue: [] }, null]) assert.equal(goalSnapshot([entry({ goal }), entry(data)]), null);
	assert.equal(goalSnapshot([{ type: "custom", customType: "goals-state", data: { goal } }]), null);
	assert.equal(goalSnapshot([]), null);
});
