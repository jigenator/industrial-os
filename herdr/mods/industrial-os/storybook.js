// The storybook: each part of the sidebar alone, in its states, on invented data. A view of this mod, shown with
// the layout prop `part: "storybook"` or opened as a window by the `industrial-os.storybook` command. It reads no
// space, pane or agent from Herdr, and its stories' handlers do nothing.
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { checking, closeOverlay, nextCommand, props, theme } from "herdr";
import { buildWorld } from "./map.js";
import { buildSidebar, emptyMemory } from "./model.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "./vocabulary.js";
import { drawingsVersion, flush } from "./parts/drawings.js";
import { GroundView } from "./parts/ground-light.js";
import { bar } from "./parts/light.js";
import { MapView } from "./parts/map-window.js";
import { readoutOf } from "./parts/pane-row.js";
import { ReadoutView, startReadout } from "./parts/scanner.js";
import { BLACK, INNER, ROW, STEP_MS, WHITE, hold, present, rgba, scoped } from "./parts/sheet.js";
import { openStage } from "./parts/stage.js";
import { font, word } from "./parts/text.js";
import { sampleWindow } from "./sample.js";
import { STORIES, storySpaces } from "./stories.js";

const STORY_KEY = "storybook.story";
// A state that has two forms (at rest, under the pointer) changes between them this often, so its motion shows.
const FLIP_MS = 1600;
// The readout types itself again this often.
const REREAD_MS = 3000;
// The pane the sample window is focused on while a story shows panes at rest: one no story shows.
const REST = "e1";
const NESTED = {
	plateMap: (stage) => [MapView, { stage, plate: true }],
	spaceMap: (stage) => [MapView, { stage, space: "s1" }],
	ground: (stage) => [GroundView, { stage }],
	readout: (stage) => [ReadoutView, { stage }],
};

const unitsOf = (result) => result.missions.flatMap((m) => m.tabs.flatMap((tab) => tab.units));

/**
 * What a story's `render(s)` is given:
 * `t` the theme; `now` the clock; `flip`, which changes every FLIP_MS; `rest`, model.js's `buildSidebar` result for
 * the sample window with no shown pane focused; `open(key)`, the same with that pane focused; `unit(key, focus?)`,
 * one pane's unit; `stage`, the stage the nested views read; and the nested views the story said it `uses`.
 */
export class Storybook extends View {
	init(_p, cx) {
		[this.stageId, this.stage] = openStage();
		this.stage.size = { width: 300, height: 220 };
		this.views = {};
		this.built = new Map();
		this.seen = 0;
		this.flip = false;
		this.now = Date.now();
		const saved = localStorage.getItem(STORY_KEY);
		this.show(STORIES.some((s) => s.id === saved) ? saved : STORIES[0].id, cx);
		if (checking()) return;
		cx.timer.every(STEP_MS, (cx) => this.tick(cx));
		cx.spawn(async (cx) => {
			for (;;) {
				// keys.json: "<key>": "industrial-os.story-next" and "industrial-os.story-prev" turn the page while it is shown.
				const command = await nextCommand(), step = command === "story-next" ? 1 : command === "story-prev" ? -1 : 0;
				if (step) this.show(STORIES[(STORIES.indexOf(this.story) + step + STORIES.length) % STORIES.length].id, cx);
			}
		});
	}

	// Shows a story: only its nested views exist, so nothing else keeps a clock running.
	show(id, cx) {
		this.story = STORIES.find((s) => s.id === id);
		localStorage.setItem(STORY_KEY, id);
		for (const entity of Object.values(this.views)) entity.release();
		this.reading?.cancel();
		this.views = Object.fromEntries((this.story.uses ?? []).map((name) => { const [Class, init] = NESTED[name](this.stageId); return [name, cx.new(Class, init)]; }));
		if (this.views.readout && !checking()) this.read(cx);
		cx.notify();
	}

	// A readout is redrawn by its owner, as the sidebar does it.
	read(cx) {
		this.reading = startReadout(cx, this.stage, this.views.readout, this.reading);
	}

	tick(cx) {
		flush(cx);
		const now = Date.now(), flip = Math.floor(now / FLIP_MS) % 2 === 1;
		const dirty = drawingsVersion() !== this.seen || flip !== this.flip || this.story.moves === true;
		this.seen = drawingsVersion();
		this.flip = flip;
		if (this.views.readout && now - this.stage.readAt >= REREAD_MS) this.read(cx);
		if (dirty) cx.notify();
	}

	// The sample window as the sidebar's data, with one pane focused. Built once a second, as its ages change.
	build(focus) {
		const second = Math.floor(this.now / 1000);
		if (this.builtAt !== second) { this.built.clear(); this.builtAt = second; }
		if (!this.built.has(focus)) {
			const w = sampleWindow(this.now, { spaces: storySpaces(), focus });
			const git = Object.fromEntries(w.spaces.map((space) => { const g = w.git[space.folder]; return [space.id, g ? { ahead: g[0], behind: g[1] } : null]; }));
			this.built.set(focus, buildSidebar({ spaces: w.spaces, agents: w.agents, terminals: w.terminals, panes: w.panes, git, home: w.home, now: this.now, memory: emptyMemory(), fold: {}, focusedPane: w.focused?.pane ?? null, view: "missions" }));
			if (focus === REST) this.stage.world = buildWorld(this.built.get(focus).missions);
		}
		return this.built.get(focus);
	}

	render() {
		const t = theme(), story = this.story;
		this.now = Date.now();
		const rest = this.build(REST), unit = (key, focus = REST) => unitsOf(this.build(focus)).find((u) => u.id === `p-${key}`);
		this.stage.watch = "p-a1";
		this.stage.readout = readoutOf(t, unit("c1"));
		const s = { t, now: this.now, flip: this.flip, rest, open: (focus) => this.build(focus), unit, stage: this.stage, ...this.views };

		const overlay = props()?.overlay;
		const header = h_flex().flex_none().w_full().h(ROW + 8).px(18).gap(10).items_center().bg(C.paper).text_color(C.ink).whitespace_nowrap()
			.child(word("INDUSTRIAL-OS ®", C.ink, 800)).child(word("PARTS", C.ink)).child(div().flex_1())
			.child(word(`${String(STORIES.length).padStart(2, "0")} STORIES · INVENTED DATA`, C.paperLabel))
			.when(overlay, (el) => el.child(h_flex().id("isb-close").flex_none().h(17).px(6).rounded(2).items_center().cursor_pointer().bg(C.ink).font_weight(800).text_color(C.paper)
				.hover((x) => x.bg(t.working).text_color(BLACK)).on_mouse_down("left", hold).on_click(() => closeOverlay(overlay)).child("CLOSE")));
		const index = v_flex().id("isb-index").flex_none().w(190).h_full().py(10).overflow_y_scroll()
			.children(STORIES.map((entry) => {
				const on = entry.id === story.id;
				return h_flex().id(`isb-i-${entry.id}`).relative().flex_none().w_full().h(ROW).pl(18).items_center().cursor_pointer().whitespace_nowrap()
					.text_color(on ? t.foreground : C.nameIdle).hover((x) => x.bg(rgba(WHITE, A.glass)).text_color(t.foreground))
					.on_mouse_down("left", hold).on_click((_e, cx) => this.show(entry.id, cx))
					// The shown story has the focused pane's gutter bar.
					.children(on ? bar(8, 3, 3, ROW - 6, t.working, { radius: 2, glow: t.working, pulse: true, strong: true }) : [])
					.child(entry.title);
			}));
		const specimen = (state, i) => {
			// Each specimen draws under its own names, so two of one part keep their own motion.
			const width = state.width ?? 300, made = scoped(`#${i}`, () => state.render(s)), list = present(Array.isArray(made) ? made : [made]);
			return v_flex().flex_none().w(Math.max(width, 220)).gap(5)
				.child(div().text_size(10).line_height("13px").text_color(C.label).child(state.label))
				.child(div().relative().flex_none().w(width).bg(state.ground ?? C.groundBottom).text_size(11)
					.when(!state.full, (el) => el.px(INNER).py(8))
					.map((el) => (state.height ? el.child(div().relative().w_full().h(state.height).children(list)) : el.children(list))));
		};
		const page = v_flex().id(`isb-story-${story.id}`).flex_1().min_w(0).h_full().px(24).pt(14).pb(28).gap(12).overflow_y_scrollbar().bg(C.black)
			.child(div().flex_none().text_size(13).font_weight(800).child(story.title))
			.child(div().flex_none().max_w(640).line_height("16px").text_color(C.reading).child(story.about))
			.child(div().flex_none().w_full().h(1).bg(C.ruleStrong))
			.child(h_flex().flex_none().flex_wrap().items_start().gap(24).children(story.states().map(specimen)));
		return v_flex().id("isb").size_full().bg(C.groundBottom).font_family(font()).text_size(11).text_color(t.foreground)
			.child(header)
			.child(h_flex().flex_1().min_h(0).w_full().child(index).child(page));
	}
}
