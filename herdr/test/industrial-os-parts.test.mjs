// Loads the sidebar's drawing code on the stand-in for the app's modules (../stand-in/) and checks the parts as the
// storybook and the sidebar draw them: every part has a story, every story draws, and the sidebar still draws from
// the same parts. The stand-in rejects any gpui-kit method it does not know. Nothing here opens Herdr.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";

register("../stand-in/hooks.mjs", import.meta.url);
const { Sim, find, texts } = await import("../stand-in/sim.mjs");
const { state } = await import("../stand-in/herdr.mjs");
const { default: IndustrialOs } = await import("../mods/industrial-os/main.js");
const { STORIES } = await import("../mods/industrial-os/stories.js");
const { sampleWindow } = await import("../mods/industrial-os/sample.js");
const { partId, scoped } = await import("../mods/industrial-os/parts/sheet.js");
const { ReadoutView } = await import("../mods/industrial-os/parts/scanner.js");

const MOD = new URL("../mods/industrial-os/", import.meta.url);
const ids = (tree) => find(tree, (node) => node.id).map((node) => node.id);
const repeated = (list) => [...new Set(list.filter((id, i) => list.indexOf(id) !== i))];

test("every part is shown by the storybook", async () => {
	const shown = `${await readFile(new URL("stories.js", MOD), "utf8")}${await readFile(new URL("storybook.js", MOD), "utf8")}`;
	for (const file of (await readdir(new URL("parts/", MOD))).filter((f) => f.endsWith(".js"))) assert.ok(shown.includes(`"./parts/${file}"`), `no story uses parts/${file}`);
	assert.deepEqual(repeated(STORIES.map((story) => story.id)), []);
});

test("every story draws each of its states, labelled, over time, with no element named twice", async () => {
	const sim = new Sim();
	try {
		const book = sim.create(IndustrialOs, undefined, { part: "storybook" });
		let clock = 0;
		for (const story of STORIES) {
			sim.snapshot(book);
			sim.fire(`isb-i-${story.id}`, "on_click", {});
			// Past a flip of the two-form states and a re-read of the readout.
			for (const ms of [50, 400, 1700, 3300]) {
				clock += ms;
				await sim.advance(clock);
				const tree = sim.snapshot(book), shown = texts(tree);
				assert.ok(shown.includes(story.title), story.id);
				const states = story.states();
				assert.ok(states.length > 0, story.id);
				for (const { label } of states) assert.ok(shown.includes(label), `${story.id}: ${label}`);
				assert.deepEqual(repeated(ids(tree)), [], story.id);
			}
			assert.equal(localStorage.getItem("storybook.story"), story.id);
		}
		// The page turns from the keys, round the ends.
		const shownStory = () => localStorage.getItem("storybook.story"), last = STORIES.at(-1).id;
		for (const [key, id] of [["story-next", STORIES[0].id], ["story-next", STORIES[1].id], ["story-prev", STORIES[0].id], ["story-prev", last]]) {
			sim.key(key);
			await sim.settle();
			assert.equal(shownStory(), id, key);
		}
		assert.deepEqual(sim.errors, []);
	} finally {
		sim.close();
	}
});

test("a story keeps only its own clocks: the readout rests once it has settled, and a page left stops", async () => {
	const sim = new Sim();
	try {
		const book = sim.create(IndustrialOs, undefined, { part: "storybook" });
		const clocks = () => sim.timers.filter((t) => t.live && t.entity.live).length;
		const show = async (id, at) => { sim.snapshot(book); sim.fire(`isb-i-${id}`, "on_click", {}); await sim.advance(at); sim.snapshot(book); };
		await show("marks", 100);
		const quiet = clocks();
		await show("scanner", 1700);
		const readout = sim.entities.find((e) => e.view instanceof ReadoutView);
		assert.ok(readout && clocks() >= quiet);
		// Typed and lit by now (1.2 s); it types again at 3 s. In between nothing redraws it.
		await sim.advance(2600);
		assert.equal(readout.dirty, false);
		await sim.advance(3400);
		assert.equal(readout.dirty, true);
		await show("map-window", 3600);
		assert.ok(clocks() > quiet);
		await show("marks", 3800);
		assert.equal(clocks(), quiet);
		assert.equal(sim.entities.some((e) => e.live && e.view instanceof ReadoutView), false);
	} finally {
		sim.close();
	}
});

test("drawings are written where the app refuses to list their folder, and never during a check", async () => {
	const fs = await import("../stand-in/fs.mjs");
	// Its own copy of the module, so its queue has listed nothing yet.
	const { asset, drawn, flush } = await import("../mods/industrial-os/parts/drawings.js?unlisted");
	const cx = { spawn: (run) => { run(cx).catch(() => {}); } }, settle = () => new Promise((done) => setImmediate(done));
	try {
		assert.equal(asset("test/one", () => "<svg/>"), null);
		state.checking = true;
		flush(cx);
		await settle();
		assert.equal(drawn("test/one"), undefined);
		state.checking = false;
		fs.refuse.list = true;
		flush(cx);
		await settle();
		const path = drawn("test/one");
		assert.match(path ?? "", /^mods\/industrial-os\/\.gen\/[\w-]+\.svg$/);
		assert.equal(fs.written.get(`/app/${path}`), "<svg/>");
		assert.equal(asset("test/one", () => "<svg/>"), path);
	} finally {
		state.checking = false;
		fs.refuse.list = false;
	}
});

test("partId: a part's ids end in the scope it is drawn under, and the scope ends with the drawing", () => {
	assert.equal(partId("ios-row"), "ios-row");
	assert.equal(scoped("#1", () => partId("ios-row") + scoped("#b", () => partId("x"))), "ios-row#1x#1#b");
	assert.throws(() => scoped("#2", () => { throw new Error("drawing failed"); }), /drawing failed/);
	assert.equal(partId("ios-row"), "ios-row");
});

test("the sidebar draws the sample window from the parts, and its storybook command opens one window", async () => {
	const sim = new Sim();
	try {
		const w = sampleWindow(sim.now);
		Object.assign(state, { spaces: w.spaces, agents: w.agents, terminals: w.terminals, panes: w.panes, focused: w.focused, git: w.git });
		const [top, list, bottom] = ["top", "list", "bottom"].map((part) => sim.create(IndustrialOs, undefined, { part }));
		await sim.settle();
		sim.snapshot(list);
		sim.fire("ios-list", "on_size_change", { width: 300, height: 824 });
		await sim.advance(2000);
		const [plate, rows, search] = [top, list, bottom].map((view) => sim.snapshot(view));
		assert.ok(texts(plate).some((text) => text.startsWith("INDUSTRIAL-OS")));
		assert.ok(texts(rows).includes("Rebuild the ingest queue"));
		assert.ok(texts(rows).includes("ACTION REQUIRED"));
		assert.ok(texts(search).some((text) => text.startsWith("search")));
		for (const tree of [plate, rows, search]) assert.deepEqual(repeated(ids(tree)), []);

		assert.deepEqual(state.overlays, []);
		sim.key("storybook");
		await sim.settle();
		// Every block hears the command; one answers.
		assert.deepEqual(state.overlays, [{ mod: "industrial-os", kind: "window", key: "industrial-os.storybook", width: 900, height: 760, props: { part: "storybook" } }]);
		assert.deepEqual(sim.errors, []);
	} finally {
		sim.close();
	}
});
