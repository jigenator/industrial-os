// Industrial OS for the Herdr desktop app: one mod, and each copy of it is the piece its `part` prop names.
// The sidebar's three blocks: "top" (the crate plate and the shortcut strip), the list (no prop: ACTION REQUIRED, the
// view switch, spaces with their map windows, tabs and panes) and "bottom" (the search hint); folded to the rail,
// each draws its rail form. "plate" is the pane header (plate/view.js), "reloader" the Pi Reloader's window
// (reloader/view.js, opened by `mod.open:industrial-os` with mod.json's props) and "storybook" the parts alone
// (storybook.js). For the sidebar this file reads Herdr, keeps the remembered state, runs commands and places the
// parts; what the values mean is in the pure modules beside it, each part is in parts/ (herdr/docs/parts.md), and
// how it looks is in herdr/docs/design.md.
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import {
	agents, checking, exec, focused, home, keys, layout, nextCommand, openOverlay, panes, props, run, setAgentOrder, setShared, shared, spaces, terminals,
	theme, updates, window,
} from "herdr";
import { fadeSvg, fieldSvg } from "./assets.js";
import { FOLD_EXPIRE_MS, FOLD_TIMES } from "./fold.js";
import { FLICKER_AT, flickerFrame } from "./format.js";
import { BLEED, VIEW_H, buildWorld } from "./map.js";
import { buildSidebar, emptyMemory } from "./model.js";
import { parseAheadBehind, spacePlace } from "./spaces.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "./vocabulary.js";
import { actionRequired } from "./parts/action-required.js";
import { cratePlate, cratePlateRail } from "./parts/crate-plate.js";
import { drawingsVersion, drawn, flush, picture } from "./parts/drawings.js";
import { foldCovers } from "./parts/fold-covers.js";
import { GroundView } from "./parts/ground-light.js";
import { hideGrip } from "./parts/hide-grip.js";
import { MapView } from "./parts/map-window.js";
import { latchOf, paneRow, paneRowHeight, readoutOf } from "./parts/pane-row.js";
import { railLamp } from "./parts/rail-lamp.js";
import { ReadoutView, scannerFrame, startReadout } from "./parts/scanner.js";
import { searchHint } from "./parts/search-hint.js";
import { CH, INNER, PAD, ROW, STEP_MS, present } from "./parts/sheet.js";
import { shortcutStrip, unfoldStrip } from "./parts/shortcut-strip.js";
import { spaceBand } from "./parts/space-band.js";
import { openStage } from "./parts/stage.js";
import { font } from "./parts/text.js";
import { groupTitle, tabTitle, tabTitleChars } from "./parts/titles.js";
import { viewRuler } from "./parts/view-ruler.js";
import { DroidPlate } from "./plate/view.js";
import { PiReloader } from "./reloader/view.js";
import { Storybook } from "./storybook.js";

const MEMORY_KEY = "memory", FOLD_KEY = "fold", VIEW_KEY = "view";
// What the list tells the plate: the unit of ACTION REQUIRED under the pointer.
const AIM_KEY = "industrial-os.aim";
// The fold or unfold in motion, for all three blocks: { at, kind, step }.
const MOTION_KEY = "industrial-os.motion";
const GIT_EVERY_MS = 30_000, GIT_TIMEOUT_MS = 5_000;
// Narrower than this the sidebar is the rail.
const RAIL_PX = 160;
// The pieces that are a whole copy by themselves: this view hands each its own init, render and close, with its cx,
// so it runs as the mod's root view, as it did when it was a mod of its own.
const WHOLE = { plate: DroidPlate, reloader: PiReloader };
// The storybook's window. Its key keeps one: opening it again replaces the open one, where it was dropped.
const STORYBOOK_WINDOW = { mod: "industrial-os", kind: "window", key: "industrial-os.storybook", width: 900, height: 760, props: { part: "storybook" } };

// The key bound to an action, as keys.json writes it, or null.
const boundKey = (action) => keys().find((k) => k.action === action)?.keys ?? null;

function loadJson(key, fallback) {
	try {
		const value = JSON.parse(localStorage.getItem(key) ?? "null");
		return value && typeof value === "object" ? value : fallback;
	} catch {
		return fallback;
	}
}
const loadMemory = () => { const m = loadJson(MEMORY_KEY, null); return m ? { agents: m.agents ?? {}, spaces: m.spaces ?? {} } : emptyMemory(); };

// The folder ahead/behind is asked of: a space's machine, and where it is now.
function placeKey(space, ps) {
	const cwd = spacePlace(space, ps);
	return cwd ? JSON.stringify([space.machine ?? null, cwd]) : null;
}

function findNode(node, id) {
	if (!node || typeof node !== "object") return null;
	if (node.id === id) return node;
	for (const child of node.children ?? []) {
		const found = findNode(child, id);
		if (found) return found;
	}
	return null;
}
// Herdr's sidebar rail goes by width; the shipped header uses these shared keys too, so either can unfold it.
const sidebarWidth = () => findNode(layout(), "sidebar")?.size?.px ?? Infinity;
function toggleSidebar() {
	const narrow = sidebarWidth() < RAIL_PX;
	if (!narrow) setShared("sidebar.width", sidebarWidth());
	setShared("sidebar.collapsed", !narrow);
	run("layout.resize", { id: "sidebar", px: narrow ? (shared("sidebar.width") ?? 300) : window()?.platform === "macos" ? 76 : 44 });
}
/** The fold in motion, or null. One left behind by a mod that was reloaded mid-fold is ignored once it is old. */
function motion() {
	const m = shared(MOTION_KEY);
	return m && typeof m === "object" && Date.now() - m.at < FOLD_EXPIRE_MS ? m : null;
}
// Folds the sidebar to the rail, or unfolds it, as motion: the block that was asked steps all three through it.
// One at a time, which also makes one fold of a key press that every block hears.
function foldSidebar(cx) {
	if (motion()) return;
	const at = Date.now(), kind = sidebarWidth() < RAIL_PX ? "unfold" : "fold", [go, snap, show, done] = FOLD_TIMES[kind];
	const step = (n) => setShared(MOTION_KEY, { at, kind, step: n });
	step(0);
	cx.timer.after(go, () => step(1));
	// The sidebar changes width under full cover.
	cx.timer.after(snap, () => { step(2); toggleSidebar(); });
	cx.timer.after(show, () => step(3));
	cx.timer.after(done, () => setShared(MOTION_KEY, null));
}

const openPicker = () => run("mod.open", { name: "picker" });
// The pane the keyboard goes back to: the one that has it, or the shown tab's focused pane.
const keyboardPane = () => { const k = focused(); return k?.pane ?? panes().find((p) => p.focused && p.tab === k?.tab)?.pane ?? null; };

export default class IndustrialOs extends View {
	init(initProps, cx) {
		// A layout's props come from props(); a nested copy (the probe window's three parts) gets its own.
		const p = initProps?.part ? initProps : (props() ?? {});
		this.part = p.part ?? "list";
		this.rail = p.rail === true; // a probe's rail, whatever the real sidebar's width
		if (WHOLE[this.part]) {
			this.whole = new WHOLE[this.part]();
			this.whole.init(p, cx);
			return;
		}
		if (this.part === "storybook") {
			this.book = cx.new(Storybook);
			return;
		}
		this.hov = {};
		[this.stageId, this.stage] = openStage();
		this.genSeen = 0;
		if (this.part === "all") {
			this.kids = ["top", "list", "bottom"].map((part) => cx.new(IndustrialOs, { part, rail: this.rail }));
			return;
		}
		this.memory = loadMemory();
		this.fold = loadJson(FOLD_KEY, {});
		this.view = localStorage.getItem(VIEW_KEY) === "agents" ? "agents" : "missions";
		this.git = {}; // place key → { ahead, behind } | null
		this.checked = {}; // place key → when it was last looked up
		this.refreshing = false;
		this.nextAt = Infinity;
		this.maps = new Map(); // space ID → its map window
		this.wantMaps = new Set();
		this.codes = new Map(); // unit ID → the state code it last showed
		this.latch = new Map(); // unit ID → when its state changed
		this.more = false;
		// The scanner: one frame per list. Where it is, whether it is on, and which element it is.
		this.scopes = { list: { rect: null, on: false, shown: false, gen: 0 }, act: { rect: null, on: false, shown: false, gen: 0 } };
		this.measured = {};
		this.machine = "";
		this.ticks = 0;
		this.plate = this.part === "top" ? cx.new(MapView, { stage: this.stageId, plate: true }) : null;
		this.groundLight = this.part === "list" ? cx.new(GroundView, { stage: this.stageId }) : null;
		this.readout = this.part === "list" ? cx.new(ReadoutView, { stage: this.stageId }) : null;
		if (checking()) return;
		cx.spawn(async (cx) => {
			for (;;) {
				// keys.json: "<key>": "industrial-os.fold" folds the sidebar to the rail and back, and
				// "industrial-os.storybook" opens the storybook's window. Every block hears a command; the list answers that one.
				const command = await nextCommand();
				if (command === "fold") foldSidebar(cx);
				else if (command === "storybook" && this.part === "list") openOverlay(STORYBOOK_WINDOW);
			}
		});
		if (this.part === "top") {
			cx.spawn(async (cx) => {
				// This computer's name, for the plate.
				const r = await exec("hostname", ["-s"], { timeout: GIT_TIMEOUT_MS }).catch(() => null);
				this.machine = r?.code === 0 ? r.stdout.trim().toUpperCase() : "";
				cx.notify();
			});
		}
		if (this.part === "list") {
			// Shared values persist: an aim left over from the last run would hold the plate's crosshair.
			if (shared(AIM_KEY) != null) setShared(AIM_KEY, null);
		}
		cx.timer.every(STEP_MS, (cx) => this.tick(cx));
	}

	// One clock: writes drawings, opens and closes map windows, steps the marks, and once a second looks at the data.
	tick(cx) {
		flush(cx);
		let dirty = drawingsVersion() !== this.genSeen;
		this.genSeen = drawingsVersion();
		// A fold's covers go when it ends, also when its last step never came.
		const m = motion(), moving = m ? `${m.at}/${m.step}` : "";
		if (moving !== this.moving) { this.moving = moving; dirty = true; }
		if (this.part === "list") {
			for (const id of this.wantMaps) {
				if (this.maps.has(id)) continue;
				this.maps.set(id, cx.new(MapView, { stage: this.stageId, space: id }));
				dirty = true;
			}
			for (const [id, entity] of this.maps) {
				if (this.wantMaps.has(id)) continue;
				entity.release();
				this.maps.delete(id);
			}
			const now = Date.now();
			for (const [id, at] of this.latch) if (now - at >= 260) this.latch.delete(id);
			// The marks keep stepping while another app is in front, and the open grip's chevrons march.
			if (this.animated || this.latch.size || this.hov.grip) dirty = true;
		}
		if (++this.ticks % 9 === 0) {
			const now = Date.now();
			if (this.part === "list") this.refreshGit(cx, now);
			if (now >= this.nextAt) { this.nextAt = Infinity; dirty = true; }
		}
		if (dirty) cx.notify();
	}

	refreshGit(cx, now) {
		if (this.refreshing) return;
		const ps = panes();
		const active = window()?.active ?? true;
		const due = [...new Set(spaces().map((s) => placeKey(s, ps)).filter(Boolean))]
			.filter((key) => !(key in this.checked) || (active && now - this.checked[key] >= GIT_EVERY_MS));
		if (!due.length) return;
		this.refreshing = true;
		cx.spawn(async (cx) => {
			let changed = false;
			for (const key of due) {
				const [on, cwd] = JSON.parse(key);
				this.checked[key] = Date.now();
				try {
					const r = await exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on, timeout: GIT_TIMEOUT_MS });
					// Not a repository, no upstream or a detached HEAD: nothing to show.
					const next = r.code === 0 ? parseAheadBehind(r.stdout) : null;
					if (JSON.stringify(next) !== JSON.stringify(this.git[key] ?? null)) changed = true;
					this.git[key] = next;
				} catch {
					// Could not ask (the machine is away): keep what it showed; look again later.
				}
			}
			this.refreshing = false;
			if (changed) cx.notify();
		});
	}

	// Herdr's live lists as the sidebar's data. The list keeps the memory; the plate only reads what was saved.
	read(now) {
		const sp = spaces(), ps = panes(), list = agents();
		// The pane with the keyboard; while a layout terminal has it, the shown tab's focused pane.
		const focusedPane = keyboardPane();
		const git = Object.fromEntries(sp.map((s) => [s.id, this.git[placeKey(s, ps)] ?? null]));
		return buildSidebar({ spaces: sp, agents: list, terminals: terminals(), panes: ps, git, home: home(), now, memory: this.memory, fold: this.fold, focusedPane, view: this.view });
	}

	// Herdr calls this on the root view only, when its pane, block or window goes.
	close(cx) {
		return this.whole?.close?.(cx);
	}

	render(cx) {
		if (this.whole) return this.whole.render(cx);
		if (this.part === "storybook") return div().size_full().child(this.book);
		if (this.part === "all") {
			return v_flex().size_full().bg(C.groundBottom)
				.child(div().flex_none().w_full().h(130).child(this.kids[0]))
				.child(div().flex_1().min_h(0).w_full().child(this.kids[1]))
				.child(div().flex_none().w_full().h(46).child(this.kids[2]));
		}
		const t = theme(), folded = this.rail || sidebarWidth() < RAIL_PX, block = this.draw(t, folded), over = this.motionLayer(t, folded);
		return over ? block.relative().child(over) : block;
	}

	// A fold in motion, over this block.
	motionLayer(t, folded) {
		const m = motion();
		if (!m) return null;
		const part = this.part, size = this.size, height = part === "top" ? 130 : part === "bottom" ? 46 : (size?.height || 1400);
		// The ground a row is erased to: the list's own dotted ground where it has one, else the block's colour.
		const path = part === "list" && !folded && size?.height ? drawn(`field/${size.width}x${size.height}`) : null;
		return foldCovers(t, { motion: m, part, folded, width: Math.min(sidebarWidth(), 1200), height, field: path ? { path, width: size.width, height: size.height } : null });
	}

	draw(t, folded) {
		const now = Date.now();
		if (this.part === "bottom") return this.renderBottom(t, folded);
		const result = this.read(now);
		this.stage.world = buildWorld(result.missions);
		if (this.part === "top") return folded ? this.renderRailTop(t, result) : this.renderTop(t, result);

		this.memory = result.memory;
		if (result.dirty) localStorage.setItem(MEMORY_KEY, JSON.stringify(result.memory));
		this.nextAt = result.nextChangeAt ?? Infinity;
		setAgentOrder(result.order);
		// A pane whose state changed latches for a moment.
		const units = result.missions.flatMap((m) => m.tabs.flatMap((tab) => tab.units));
		for (const u of units) {
			if (this.codes.has(u.id) && this.codes.get(u.id) !== u.code) this.latch.set(u.id, now);
			this.codes.set(u.id, u.code);
		}
		if (this.codes.size > units.length) for (const id of [...this.codes.keys()]) if (!units.some((u) => u.id === id)) this.codes.delete(id);
		this.animated = units.some((u) => u.mark === "WRK" || u.mark === "SUB" || u.mark === "RUN" || u.mark === "QNS");
		this.wantMaps = new Set(folded || this.view !== "missions" ? [] : result.missions.filter((m) => m.open).map((m) => m.id));
		return folded ? this.renderRail(t, result) : this.renderList(t, result, now);
	}

	// ---- hover: what the pointer is on, for the scanner, the map and the ticker tape ----
	enter(patch) {
		return (hovered, cx) => {
			// Each element owns its keys, so leaving one never clears what the next one entered.
			if (hovered) Object.assign(this.hov, patch);
			else for (const name of Object.keys(patch)) if (this.hov[name] === patch[name]) delete this.hov[name];
			this.stage.hover = this.hov.unit ?? null;
			this.stage.hoverTab = this.hov.unitTab ?? this.hov.tab ?? null;
			if (hovered && patch.unit && this.readout) this.startReadout(cx);
			cx.notify();
		};
	}

	// The readout starts over on each pane the scanner reaches, and is stepped until it has settled and its light is drawn.
	startReadout(cx) {
		this.reading = startReadout(cx, this.stage, this.readout, this.reading);
	}

	// ================= the top: the crate plate and the shortcut strip =================
	renderTop(t, result) {
		const stage = this.stage, units = result.missions.flatMap((m) => m.tabs.flatMap((tab) => tab.units));
		// The plate's camera keeps the focused unit under the crosshair; only a row of ACTION REQUIRED under the pointer takes it.
		const aim = shared(AIM_KEY);
		const here = result.missions.find((m) => m.current)?.tabs.flatMap((tab) => tab.units)[0];
		stage.watch = (units.find((u) => u.id === aim) ?? units.find((u) => u.focused) ?? here ?? units[0])?.id ?? null;
		return v_flex().id("ios-top").size_full().bg(C.groundTop).font_family(font()).text_size(11)
			.child(cratePlate({
				machine: this.machine, droids: result.counts.droids, spaces: result.counts.spaces, hot: this.hov.plate === true, map: this.plate,
				onHover: this.enter({ plate: true }),
				onSize: (size, cx) => { if (size.width !== stage.width) { stage.width = size.width; cx.notify(); } },
			}))
			.child(shortcutStrip(t, [
				// An update that is ready to install shows as a lit dot on the key that installs it.
				{ id: "ios-settings", text: "SETTINGS", onClick: () => run("app.settings"), ready: updates().app?.ready },
				{ id: "ios-machine", text: "ADD MACHINE", onClick: () => run("mod.open", { name: "machine-add" }) },
			]));
	}

	// Folded: the paper carries the two counts as plates, over the strip that unfolds the sidebar.
	renderRailTop(t, result) {
		return v_flex().size_full().bg(C.groundTop).font_family(font()).text_size(11)
			.child(cratePlateRail(t, { droids: result.counts.droids, need: result.counts.need }))
			.child(unfoldStrip(t, { hot: this.hov.strip === true, width: Math.min(RAIL_PX, sidebarWidth()), onHover: this.enter({ strip: true }), onClick: (_e, cx) => foldSidebar(cx) }));
	}

	// ================= the bottom: the search hint =================
	// A click opens Herdr's picker, as its key does.
	renderBottom(t, folded) {
		const onHover = (hovered, cx) => {
			this.enter({ search: true })(hovered, cx);
			if (!hovered) return;
			this.flickAt = Date.now();
			for (const ms of FLICKER_AT) cx.timer.after(ms + 1, (cx) => cx.notify());
		};
		const hint = searchHint(t, { binding: boundKey("mod.open:picker"), hot: this.hov.search === true, flick: flickerFrame(Date.now() - this.flickAt), folded, onHover, onClick: openPicker });
		const block = div().size_full().bg(C.groundBottom).font_family(font());
		return (folded ? block.pl(12).pt(8) : block.px(INNER).pt(8).pb(10)).child(hint);
	}

	// ================= the list =================
	renderList(t, result, now) {
		const stage = this.stage, width = this.size?.width ?? 300, height = this.size?.height ?? 0, inner = width - 2 * INNER;
		stage.viewW = inner - 2 * PAD;
		const ground = picture(`field/${width}x${height}`, () => fieldSvg(width, height), 0, 0, width, height);
		const focus = (u) => () => run("pane.focus", { pane: u.id });

		// A pane in a list: `where` is "m" under its tab, "g" under its space in the agents view.
		const unitItem = (u, where) => {
			const hovered = this.hov.unit === u.id && this.hov.at === where, latchAt = this.latch.get(u.id);
			if (hovered && !latchOf(latchAt, now).latched) stage.readout = readoutOf(t, u);
			return paneRow(t, {
				unit: u, where, inner, now, latchAt, hovered, readout: this.readout, near: this.lit?.id === u.id ? this.lit : null,
				// Until the list has been measured there is no sliding scanner, so the pane shows its own.
				ownScanner: !this.measured.body,
				onHover: this.enter(where === "m" ? { unit: u.id, at: where, unitTab: u.tabId, unitSpace: u.spaceId } : { unit: u.id, at: where }),
				onClick: focus(u),
				onMove: (e, cx, pitch) => { if (pitch) this.near(u.id, e, pitch[0], pitch[1], cx); this.measure("unit", e, cx); },
			});
		};
		// A list's scanner: one frame that slides to the pane the pointer reaches.
		const scanner = (which) => { const sc = this.scopes[which]; return scannerFrame(t.working, { id: `ios-scope-${which}-${sc.gen}`, rect: sc.rect, on: sc.on && sc.shown }); };

		// A tab is a title over its panes.
		const titleChars = tabTitleChars(inner);
		const tabBlock = (m, tab, first) => {
			for (const u of tab.units) { u.tabId = tab.id; u.spaceId = m.id; }
			return v_flex().flex_none().px(INNER).pt(first ? 10 : 22)
				.child(tabTitle({
					tab, chars: titleChars, running: this.hov.tab === tab.id, ground: stage.ground, onHover: this.enter({ tab: tab.id, tabSpace: m.id }),
					// A right click opens Herdr's own tab menu, as on its tab bar: Rename, New tab, Close.
					onMenu: (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab.id, space: m.id } } }); },
				}))
				.child(v_flex().gap(5).children(tab.units.map((u) => unitItem(u, "m"))));
		};

		const tabKey = boundKey("tab.new");
		const band = (m) => spaceBand(t, {
			space: m, width, hot: this.hov.band === m.id, add: this.hov.add === m.id, tabKey,
			onHover: this.enter({ band: m.id }), onToggle: (_e, cx) => this.toggleFold(m, cx),
			onAddHover: this.enter({ add: m.id }), onAdd: () => run("tab.new", { space: m.id }),
		});
		const pointed = this.hov.band ?? this.hov.tabSpace ?? this.hov.unitSpace ?? null;
		const mission = (m, first) => v_flex().flex_none().w_full().mt(first ? 8 : 3).pb(m.open ? 30 : 0)
			.child(band(m))
			.when(m.open, (el) => el
				// Its window onto the one map: no frame, drawn BLEED px past its place, at full strength for the space you are in or point at.
				.child(div().relative().flex_none().w_full().h(12 + VIEW_H + 4)
					.child(div().id(`ios-map-${m.id}`).absolute().left(INNER + PAD - BLEED).top(12 - BLEED).w(stage.viewW + 2 * BLEED).h(VIEW_H + 2 * BLEED)
						.opacity(m.current || pointed === m.id ? 1 : A.mapRest).transition("opacity", { duration: 200 })
						.when(this.maps.get(m.id), (x) => x.child(this.maps.get(m.id)))))
				.children(m.tabs.map((tab, i) => tabBlock(m, tab, i === 0))));

		// The agents view: every pane in one fixed order, each space's panes together under its name.
		const group = (g) => v_flex().flex_none().px(INNER)
			.child(groupTitle(g.name, g.units.length))
			.child(v_flex().gap(5).children(g.units.map((u) => unitItem(u, "g"))));

		// ACTION REQUIRED: pinned. The plate's crosshair goes to the row under the pointer.
		const actionZone = actionRequired(t, {
			units: result.action, more: this.more, inner, now, hover: this.hov.at === "a" ? this.hov.unit ?? null : null,
			near: this.lit?.id === "act" ? this.lit : null, scanner: scanner("act"),
			onRow: (u, rect, hovered, cx) => {
				setShared(AIM_KEY, hovered ? u.id : null);
				this.enter({ unit: u.id, at: "a" })(hovered, cx);
				if (hovered) this.aimScope("act", rect, cx);
			},
			onPick: (u) => focus(u)(),
			onMove: (e, cx, pitch) => this.near("act", e, pitch[0], pitch[1], cx),
			onLeave: (cx) => { this.dropScope("act", cx); if (this.lit?.id === "act") { this.lit = null; cx.notify(); } },
			onMore: (cx) => { this.more = true; cx.notify(); },
		});

		const viewSwitch = viewRuler(t, {
			views: [["missions", "MISSIONS", 0], ["agents", "AGENTS", 8 * CH + 14]], active: this.view, width: stage.viewW,
			roam: this.hov.ruler === true && this.roam !== undefined ? this.roam : null,
			onHover: this.enter({ ruler: true }),
			onRoam: (x, cx) => { if (x !== this.roam) { this.roam = x; cx.notify(); } },
			onPick: (key, cx) => { this.view = key; localStorage.setItem(VIEW_KEY, key); cx.notify(); },
		});

		const grip = hideGrip(t, { width, height, hot: this.hov.grip === true, binding: boundKey("industrial-os.fold"), now, onHover: this.enter({ grip: true }), onClick: (_e, cx) => foldSidebar(cx) });

		const body = this.view === "agents"
			? (result.roster.length ? result.roster.map(group) : [div().px(INNER + PAD).pt(12).text_color(C.detail).child("No panes.")])
			: (result.missions.length ? result.missions.map((m, i) => mission(m, i === 0)) : [div().px(INNER + PAD).pt(12).text_color(C.detail).child("No spaces.")]);
		return v_flex().id("ios-list").relative().size_full().overflow_hidden().bg(C.groundBottom).font_family(font()).text_size(11).text_color(t.foreground)
			.on_size_change((size, cx) => { if (size.width !== this.size?.width || size.height !== this.size?.height) { this.size = stage.size = { width: Math.round(size.width), height: Math.round(size.height) }; cx.notify(); } })
			// Where the pointer is over the ground, for its light. Nothing is redrawn here: the light has its own clock.
			.on_mouse_move((e) => { const p = stage.pointer, at = Date.now(); stage.pointer = { ...(p?.in ? p : { in: true, since: at, start: at }), x: e.local_position.x, y: e.local_position.y }; })
			.on_hover((hovered) => { if (!hovered && stage.pointer?.in) stage.pointer = { ...stage.pointer, in: false, since: Date.now() }; })
			.children(present([ground, ground && this.groundLight]))
			.child(v_flex().flex_none().px(INNER).when(result.action.length > 0, (el) => el.child(actionZone)).child(viewSwitch))
			.child(v_flex().id("ios-scroll").flex_1().min_h(0).w_full().overflow_y_scroll()
				.on_hover((hovered, cx) => { if (hovered) return; this.dropScope("list", cx); if (this.lit && this.lit.id !== "act") { this.lit = null; cx.notify(); } })
				.child(v_flex().id("ios-body").relative().flex_none().w_full().on_mouse_move((e, cx) => this.measure("body", e, cx))
					.children(body).children(present([scanner("list")])))
				.child(div().flex_none().h(28)))
			// The list fades out before the edge it scrolls under, rather than being cut mid-line.
			.children(present([height ? picture(`fade/${width}x24/${C.groundBottom}/up`, () => fadeSvg(width, 24, C.groundBottom, "up"), 0, height - 24, width, 24) : null]))
			.children(grip);
	}

	// Moves a list's scanner to a pane. Coming from nowhere it does not slide: it is placed, then fades in.
	aimScope(which, rect, cx) {
		const sc = this.scopes[which], r = sc.rect;
		if (sc.on && r && r.x === rect.x && r.y === rect.y && r.w === rect.w && r.h === rect.h) return;
		if (!sc.on) {
			sc.gen++;
			sc.shown = false;
			cx.timer.after(20, (cx) => { sc.shown = true; cx.notify(); });
		}
		sc.on = true;
		sc.rect = rect;
		cx.notify();
	}

	dropScope(which, cx) {
		if (!this.scopes[which].on) return;
		this.scopes[which].on = false;
		cx.notify();
	}

	// Where a pane is in the scrolling list: its bounds against the list body's. Both are taken from the same pointer
	// move, so a scroll cannot come between them.
	measure(what, event, cx) {
		this.measured[what] = { bounds: event.bounds, x: event.position.x, y: event.position.y };
		const { unit, body } = this.measured;
		if (!unit?.bounds || !body?.bounds || unit.x !== body.x || unit.y !== body.y) return;
		const half = (n) => Math.round(n * 2) / 2;
		this.aimScope("list", { x: half(unit.bounds.x - body.bounds.x), y: half(unit.bounds.y - body.bounds.y), w: half(unit.bounds.width), h: half(unit.bounds.height) }, cx);
	}

	// The dots near the pointer come up a little: where the pointer is in a block, snapped to the block's dot grid.
	near(id, event, px, py, cx) {
		const p = event.local_position;
		if (!p) return;
		const x = (Math.floor(p.x / (2 * px)) + 0.5) * 2 * px, y = (Math.floor(p.y / (2 * py)) + 0.5) * 2 * py;
		if (this.lit?.id === id && this.lit.x === x && this.lit.y === y) return;
		this.lit = { id, x, y };
		cx.notify();
	}

	toggleFold(m, cx) {
		this.fold = { ...this.fold, [m.id]: m.open };
		// Remembered only for spaces that exist.
		const live = new Set(spaces().map((s) => s.id));
		for (const id of Object.keys(this.fold)) if (!live.has(id)) delete this.fold[id];
		localStorage.setItem(FOLD_KEY, JSON.stringify(this.fold));
		cx.notify();
	}

	// ================= folded: the rail =================
	renderRail(t, result) {
		return v_flex().id("ios-rail").size_full().min_h(0).bg(C.groundBottom).font_family(font()).text_size(12)
			.child(v_flex().id("ios-lamps").flex_1().min_h(0).pt(4).pl(12).gap(2).overflow_y_scroll().children(result.lamps.map((l) => railLamp(t, l, () => run("pane.focus", { pane: l.id })))));
	}
}
