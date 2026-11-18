// Checks that one mod is every piece: the root view (main.js) becomes the pane header for `part: "plate"` and the
// Pi Reloader for `part: "reloader"`, hands each Herdr's close, and no piece answers another's command. Runs on the
// stand-in for the app's modules (../stand-in/), where `hc` always fails and no socket opens. Nothing here opens Herdr.
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("../stand-in/hooks.mjs", import.meta.url);
const { Sim, texts } = await import("../stand-in/sim.mjs");
const { state } = await import("../stand-in/herdr.mjs");
const net = await import("../stand-in/net.mjs");
const { default: IndustrialOs } = await import("../mods/industrial-os/main.js");
const { sampleWindow } = await import("../mods/industrial-os/sample.js");

function open() {
	const sim = new Sim(), w = sampleWindow(sim.now);
	Object.assign(state, { spaces: w.spaces, agents: w.agents, terminals: w.terminals, panes: w.panes, focused: w.focused, git: w.git, hc: [], runs: [], overlays: [] });
	net.asked.length = 0;
	return sim;
}

test("part plate: the root is the pane header; it draws its pane's plate, labels its terminal, and Herdr's close clears the label", async () => {
	const sim = open();
	try {
		const plate = sim.create(IndustrialOs, undefined, { part: "plate", pane: "p-a1", terminal: "a1" });
		sim.snapshot(plate);
		await sim.settle();
		await sim.advance(100);
		const shown = texts(sim.snapshot(plate)).join("");
		assert.match(shown, /INDUSTRIAL-OS®PIAGENTDROID/);
		assert.match(shown, /\[\|\]\[-\]\[\^\]\[x\]$/);
		assert.deepEqual(state.hc.filter(([verb]) => verb === "label"), [["label", "a1", "io.droid-plate.v1=1"]]);
		await plate.view.close(plate.cx);
		assert.deepEqual(state.hc.filter(([verb]) => verb === "label"), [["label", "a1", "io.droid-plate.v1=1"], ["label", "a1", "io.droid-plate.v1="]]);
		// The sidebar's blocks have nothing to close.
		assert.equal(await sim.create(IndustrialOs, undefined, { part: "top" }).view.close(), undefined);
		assert.deepEqual(sim.errors, []);
	} finally {
		sim.close();
	}
});

test("part reloader: the root is the Pi Reloader; only its own commands start it, and a sidebar command never does", async () => {
	const sim = open();
	try {
		const blocks = ["top", "list", "bottom"].map((part) => sim.create(IndustrialOs, undefined, { part }));
		const reloader = sim.create(IndustrialOs, undefined, { part: "reloader", overlay: "mod-industrial-os" });
		await sim.settle();
		const lines = () => texts(sim.snapshot(reloader));
		assert.ok(lines().includes("Pi Reloader") && lines().includes("IDLE OR DONE PI (5)"));
		// Every copy hears every command. The sidebar's, the names the Reloader had as its own mod, and unknown ones start nothing.
		for (const command of ["fold", "storybook", "story-next", "reload", "reset", "close", "reloader-nothing"]) {
			sim.key(command);
			await sim.settle();
		}
		await sim.advance(1000);
		assert.deepEqual(state.hc, []);
		assert.equal(lines().includes("LAST RUN"), false);
		assert.equal(state.runs.some(([name]) => name === "closeOverlay"), false);
		// And the sidebar answered its own: one block opened the storybook's window.
		assert.equal(state.overlays.length, 1);

		sim.key("reloader-reload");
		await sim.settle();
		await sim.advance(2000);
		// With no core behind it every candidate fails at its first look: nothing is typed, quit or reached over a socket.
		assert.deepEqual(state.hc, ["a2", "b2", "d1", "d2", "e1"].map((address) => ["get", address, "--json"]));
		assert.deepEqual(net.asked, []);
		assert.ok(lines().includes("Reloaded: 0 · Skipped: 0 · Failed: 5"));
		sim.key("reloader-close");
		await sim.settle();
		assert.deepEqual(state.runs.filter(([name]) => name === "closeOverlay"), [["closeOverlay", "mod-industrial-os"]]);
		for (const block of blocks) sim.snapshot(block);
		assert.deepEqual(sim.errors, []);
	} finally {
		sim.close();
	}
});
