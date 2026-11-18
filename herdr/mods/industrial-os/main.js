// Industrial OS sidebar for the Herdr desktop app. One mod draws the sidebar's three blocks, chosen by the layout's
// `part` prop: "top" (the crate plate and the shortcut strip), the list (no prop: ACTION REQUIRED, the view switch,
// spaces with their map windows, tabs and panes) and "bottom" (the search hint). Folded to the rail, each draws its
// rail form. This file reads Herdr, keeps the remembered state, runs commands and draws; what the values mean is in
// the pure modules beside it, and how it looks is in herdr/docs/design.md.
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import {
	agents, appHome, checking, exec, focused, fonts, home, keys, layout, nextCommand, openOverlay, panes, props, run, setAgentOrder, setShared, settings, shared,
	spaces, terminals, theme, updates, window,
} from "herdr";
import { mkdir, readdir, unlink, writeFile } from "fs/promises";
import { GROUND_DOT, HALO_PAD, advance, barGlowSvg, dotGridSvg, dotPitch, fadeSvg, groundDots, groundLight, groundSvg as fieldSvg, haloSvg, litDotsSize, litDotsSvg, rulerSvg, scopeBars, scopeGlowSvg, sidewaysSvg } from "./assets.js";
import { FOLD_EXPIRE_MS, FOLD_TIMES, SCAN_BACK_MS, SCAN_OUT_MS, eraseRows, scanSegments } from "./fold.js";
import { FLICKER_AT, READ_STEP_MS, flickerFrame, readoutFrame, readoutSettled, twoDigits, wrapText } from "./format.js";
import { BLEED, CROSSHAIR, DARK, PLATE, SHIMMER, SHIMMER_MS, VEIL_BLEED, VIEW_H, beltAt, beltOf, buildWorld, cameraTarget, edgeSvg, groundSvg, lightSvg, mapFrame, plateCamera, veilSvg } from "./map.js";
import { ACTION_SHOWN, UNIT_ICONS } from "./missions.js";
import { buildSidebar, emptyMemory } from "./model.js";
import { parseAheadBehind, spacePlace } from "./spaces.js";
import { MARK_BOX, MARK_PAD, SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C, markFrame } from "./vocabulary.js";

// This mod's folder under the app's home. A copy under another name (a probe window) rewrites it.
const MOD = "mods/industrial-os";
// Drawings written at run time. Hidden, because saving a visible file in a mod's folder reloads the mod.
const GEN = `${MOD}/.gen`;
// The folder is emptied at start once it holds this many files: names are content hashes, so nothing is stale,
// only unused. shortcut: no per-file age, so a busy month's leftovers go all at once; track use if that ever shows.
const GEN_LIMIT = 1500;

const MEMORY_KEY = "memory", FOLD_KEY = "fold", VIEW_KEY = "view";
// What the list tells the plate: the unit of ACTION REQUIRED under the pointer.
const AIM_KEY = "industrial-os.aim";
// The fold or unfold in motion, for all three blocks: { at, kind, step }.
const MOTION_KEY = "industrial-os.motion";
const GIT_EVERY_MS = 30_000, GIT_TIMEOUT_MS = 5_000;
const STEP_MS = 110; // one step of a state mark; the list redraws at this rate only while a mark moves
const FRAME_MS = 33; // the map and the ground's light: 30 frames a second, as the mockup's map
const SWEEP_MS = 16_000; // the line that sweeps down the ground, top to bottom
const PULSE_EVERY_MS = 2400, PULSE_MS = 1600; // the ring that pulses out from the pointer over the ground
const LAMP = { from: 0.3, to: 1, period: 2800 }; // a lamp's slow pulse: a gutter bar's light, the scanner's corners

// Geometry, in px. Everything in the sidebar starts 18 in and ends 18 from the right.
const INNER = 14, PAD = 4, CH = advance(11), CODE_W = 4 * CH, NAME_X = 14 + CODE_W + CH;
const ROW = 18.5, PLATE_H = ROW * 6, BAND_H = 25, RAIL_PX = 160;
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const BLACK = C.black, WHITE = C.white;

const rgba = (hex, alpha) => `${hex}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0")}`;
const present = (list) => list.filter(Boolean);

// The installed JetBrains Mono Nerd Font has the heavy weights; without it the layout's font is used.
let fontName = null;
const font = () => (fontName ??= fonts().includes("JetBrainsMono NFM") ? "JetBrainsMono NFM" : (settings().font_family ?? "JetBrains Mono"));

// ---- drawings written at run time ----
const gen = { ready: new Map(), pending: new Map(), flight: new Set(), names: null, busy: false, version: 0 };
const fnv = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0; return h; };
/** The file a drawing was written to, or null until it is. `make` returns its SVG; `key` names it. */
function asset(key, make) {
	const path = gen.ready.get(key);
	if (path !== undefined) return path;
	if (!gen.pending.has(key) && !gen.flight.has(key)) gen.pending.set(key, make);
	return null;
}
/** Writes what was asked for since the last call. Views see `gen.version` move and redraw. */
function flush(cx) {
	if (gen.busy || !gen.pending.size || checking()) return;
	gen.busy = true;
	// Owned by no view: a map window may close while its drawings are being written.
	cx.spawn(async () => {
		try {
			const dir = `${appHome()}/${GEN}`;
			if (!gen.names) {
				await mkdir(dir, { recursive: true }).catch(() => {});
				let names = await readdir(dir).catch(() => []);
				if (names.length > GEN_LIMIT) { for (const name of names) await unlink(`${dir}/${name}`).catch(() => {}); names = []; }
				gen.names = new Set(names);
			}
			while (gen.pending.size) {
				const batch = [...gen.pending];
				gen.pending.clear();
				for (const [key] of batch) gen.flight.add(key);
				for (const [key, make] of batch) {
					try {
						const text = make(), name = `${fnv(text).toString(36)}-${text.length.toString(36)}.svg`;
						if (!gen.names.has(name)) { await writeFile(`${dir}/${name}`, text); gen.names.add(name); }
						gen.ready.set(key, `${GEN}/${name}`);
					} catch {
						gen.ready.set(key, null); // could not be drawn or written: the sidebar goes without it
					}
					gen.flight.delete(key);
				}
				gen.version++;
			}
		} finally {
			gen.busy = false;
		}
	}, { owner: null });
}
/** A written drawing placed at a spot, or null until it is written. */
function picture(key, make, x, y, w, h) {
	const path = asset(key, make);
	return path ? image(path).absolute().left(x).top(y).w(w).h(h) : null;
}

// ---- small elements ----
/** A drawn mark: a 9 px sign in its `MARK_BOX` box, tinted, taking `width` px of the row. `draw` scales it. */
function sign(name, color, width = 14, draw = 9, height = 17) {
	const k = draw / 9;
	return div().relative().flex_none().w(width).h(height)
		.child(svg(`${MOD}/marks/${name}.svg`).absolute().left(-MARK_PAD * k).top((height - MARK_BOX * k) / 2).size(MARK_BOX * k).text_color(color));
}
const stateMark = (code, color, now, width = 14) => sign(`${code.toLowerCase()}-${markFrame(code, now)}`, color, width);

/** Text that is lit: crisp, with its own colour bleeding under it. */
function lit(text, color, { size = 11, weight = 800, line = 17, glow = true } = {}) {
	const halo = glow ? picture(`halo/${size}/${weight}/${line}/${color}/${text}`, () => haloSvg(text, color, { size, weight, line }), -HALO_PAD, -HALO_PAD, text.length * advance(size) + 2 * HALO_PAD, line + 2 * HALO_PAD) : null;
	return div().relative().flex_none().h(line).line_height(`${line}px`).whitespace_nowrap().text_size(size).font_weight(weight).text_color(color)
		.when(halo, (el) => el.child(halo)).child(text);
}
const word = (text, color, weight = 400) => div().flex_none().whitespace_nowrap().font_weight(weight).text_color(color).child(text);
/** One line that is cut with an ellipsis when it does not fit. */
const cutLine = (text, color, weight = 400) => div().flex_1().min_w(0).truncate().font_weight(weight).text_color(color).child(text);
/** A drawing that pulses slowly, as a lamp does. The pulse is on a box of its own around the image. */
function lamp(key, make, x, y, w, h) {
	const light = picture(key, make, 0, 0, w, h);
	return light ? div().absolute().left(x).top(y).w(w).h(h).loop("opacity", LAMP).child(light) : null;
}
/** A bar with its light: `glow` is the light's colour, absent for none; `pulse` makes it a lamp; `strong` is the gutter bar's, or a share of it. */
function bar(x, y, w, h, color, { radius = 0, glow = null, pulse = false, strong = false } = {}) {
	const light = glow ? (pulse ? lamp : picture)(`glow/${w}x${h}/${radius}/${glow}/${Number(strong)}`, () => barGlowSvg(w, h, glow, { radius, strong }), x - HALO_PAD, y - HALO_PAD, w + 2 * HALO_PAD, h + 2 * HALO_PAD) : null;
	return present([light, div().absolute().left(x).top(y).w(w).h(h).rounded(radius).bg(color)]);
}

// ---- shortcuts: the key bound to an action, as keys.json writes it, or null ----
const boundKey = (action) => keys().find((k) => k.action === action)?.keys ?? null;
const KEY_SIGNS = { ctrl: "⌃", alt: "⌥", shift: "⇧" };
function keyParts(binding) {
	const parts = binding.split("-"), last = parts.pop() || "-";
	return { command: parts.includes("cmd"), text: `${parts.filter((p) => p !== "cmd").map((p) => KEY_SIGNS[p] ?? "").join("")}${last.toUpperCase()}` };
}
/** A shortcut is the same plate everywhere: 11 px, weight 800, the drawn command sign, radius 2. */
function keyPlate(binding, background, ink) {
	const { command, text } = keyParts(binding);
	return h_flex().flex_none().h(17).px(4).gap(1).rounded(2).items_center().bg(background).text_size(11).font_weight(800).text_color(ink)
		.when(command, (el) => el.child(sign("command", ink, 9))).child(text);
}

// ---- the shared stage: what a root view's map windows read ----
const stages = new Map();
let stageCount = 0;

// A window onto the one map. A nested view with its own clock, so the map moves without redrawing the sidebar.
class MapView extends View {
	init(p, cx) {
		this.stage = p?.stage;
		this.space = p?.space ?? null;
		this.plate = p?.plate === true;
		this.cam = null;
		if (checking()) return;
		// It keeps moving while another app is in front: the sidebar is watched from there.
		cx.timer.every(FRAME_MS, (cx) => {
			flush(cx);
			cx.notify();
		});
	}

	place(frame) {
		return [
			...frame.sprites.map((s) => picture(s.key, s.make, s.x, s.y, s.w, s.h)?.opacity(s.o)),
			...frame.dots.map((d) => div().absolute().left(d.x).top(d.y).w(d.s).h(d.sh ?? d.s).bg(d.c).opacity(d.o)),
		];
	}

	// The camera swings to its target, a fifth of the way each frame; a new world or a first look starts on it.
	swing(world, tx, ty) {
		if (!this.cam || this.camWorld !== world.land.key) this.cam = [tx, ty];
		else { this.cam[0] += (tx - this.cam[0]) * 0.2; this.cam[1] += (ty - this.cam[1]) * 0.2; }
		this.camWorld = world.land.key;
		return [Math.round(this.cam[0] * 2) / 2, Math.round(this.cam[1] * 2) / 2];
	}

	render() {
		const stage = stages.get(this.stage), world = stage?.world, now = Date.now(), t = now / 1000;
		if (this.plate) {
			const w = stage?.width ?? 300, base = div().absolute().left(0).top(0).w(w).h(PLATE_H).overflow_hidden();
			const aim = world && stage.watch ? plateCamera(world, stage.watch, t) : null;
			if (!aim) return base;
			// The ground is the belt under the crosshair, so a pan from one space to another has ground all the way.
			const [cx, cy] = this.swing(world, aim.cx, aim.cy), mi = beltAt(world, cy + CROSSHAIR[1]), b = beltOf(world, mi), [lx, ly] = aim.light;
			const frame = mapFrame(world, { plate: true, watch: stage.watch, cx, cy, vw: w, vh: PLATE_H, pal: PLATE }, t);
			return base.children(present([
				// The light falls on the paper under the map's ink, and moves as the watched unit does on its patrol.
				picture(`light/${w}`, () => lightSvg(w, PLATE_H), lx - VEIL_BLEED, ly - VEIL_BLEED, w + 2 * VEIL_BLEED, PLATE_H + 2 * VEIL_BLEED),
				picture(`ground/p/${world.land.key}/${b.y}`, () => groundSvg(world, mi, PLATE), b.x - cx, b.y - cy, b.w, b.h)?.opacity(0.82),
				div().absolute().left(0).top(0).w(w).h(PLATE_H).opacity(0.82).children(present(this.place(frame))),
				picture(`veil/${w}`, () => veilSvg(w, PLATE_H), lx - VEIL_BLEED, ly - VEIL_BLEED, w + 2 * VEIL_BLEED, PLATE_H + 2 * VEIL_BLEED),
			]));
		}
		const vw = (stage?.viewW ?? 264) + 2 * BLEED, vh = VIEW_H + 2 * BLEED, base = div().relative().w(vw).h(vh).overflow_hidden();
		const mi = world ? world.missions.findIndex((m) => m.id === this.space) : -1;
		if (mi < 0) return base;
		const hover = stage.hover && world.units.get(stage.hover)?.mi === mi ? stage.hover : null;
		const hoverZone = !hover && stage.hoverTab ? world.missions[mi].tabs.findIndex((tab) => tab.id === stage.hoverTab) : -1;
		const [tx, ty] = cameraTarget(world, mi, { vw, vh, hover, hoverZone: hoverZone < 0 ? null : hoverZone, t });
		const [cx, cy] = this.swing(world, tx, ty), b = beltOf(world, mi);
		const frame = mapFrame(world, { mi, cx, cy, vw, vh, pal: DARK, hover, hoverZone: hoverZone < 0 ? null : hoverZone }, t);
		const edge = Math.floor(now / SHIMMER_MS) % SHIMMER;
		return base.bg(rgba(C.mapBoard, A.mapBoard)).children(present([
			picture(`ground/d/${world.land.key}/${b.y}`, () => groundSvg(world, mi, DARK), b.x - cx, b.y - cy, b.w, b.h),
			...this.place(frame),
			// No frame: the map dissolves into the ground at its edge, and the edge shimmers.
			picture(`edge/${vw}x${vh}/${edge}`, () => edgeSvg(vw, vh, edge, stage.ground), 0, 0, vw, vh),
		]));
	}
}

// The ground's light. Its dots come up near the pointer, a ring of brighter shade pulses out from it, and a faint
// line sweeps down with brighter dots around it. A nested view on the map's clock, so the list is not redrawn for it.
class GroundView extends View {
	init(p, cx) {
		this.stage = p?.stage;
		this.dots = { key: "", list: [] };
		if (checking()) return;
		cx.timer.every(FRAME_MS, (cx) => cx.notify());
	}

	render() {
		const stage = stages.get(this.stage), size = stage?.size, base = div().absolute().left(0).top(0);
		if (!size?.height) return base;
		const { width, height } = size, key = `${width}x${height}`, now = Date.now(), p = stage.pointer;
		if (this.dots.key !== key) this.dots = { key, list: groundDots(width, height) };
		// The pointer's light comes up in 200 ms and goes in 500.
		const strength = p ? (p.in ? Math.min(1, (now - p.since) / 200) : Math.max(0, 1 - (now - p.since) / 500)) : 0;
		const sweep = Math.round(((now % SWEEP_MS) / SWEEP_MS) * (height + 240) - 120);
		const lit = groundLight(this.dots.list, { pointer: p, strength, pulse: p ? ((now - p.start) % PULSE_EVERY_MS) / PULSE_MS : 2, sweep });
		return base.w(width).h(height).overflow_hidden()
			.children(lit.map((d) => div().absolute().left(d.x - GROUND_DOT).top(d.y - GROUND_DOT).size(2 * GROUND_DOT).rounded(GROUND_DOT).bg(d.color).opacity(d.alpha)))
			.child(div().absolute().left(0).top(sweep).w(width).h(1).bg(rgba(theme().working, A.sweep)));
	}
}

// The scanner's readout: a pane's designation and status, exactly as on the map. It types in from the right and its
// digits re-read until they settle. A nested view, redrawn only while it changes, so the list is not redrawn for it.
class ReadoutView extends View {
	init(p) {
		this.stage = p?.stage;
	}

	render() {
		const stage = stages.get(this.stage), r = stage?.readout;
		if (!r) return div();
		const elapsed = Date.now() - stage.readAt, settled = elapsed >= readoutSettled(r.text), shown = readoutFrame(r.text, elapsed);
		return h_flex().w(readoutWidth(r.text)).h(17).justify_end().items_center().whitespace_nowrap()
			// The corner mark is the readout's first sign, so it is the last to be typed.
			.when(shown.length === r.text.length, (el) => el.child(div().flex_none().w(4).h(6).border_l(1).border_t(1).border_color(r.color)))
			// Lit in its unit's state colour; the light comes once the digits hold still.
			.child(lit(shown, r.color, { glow: settled }));
	}
}
/** The room a readout takes at the end of its row: a space, its corner mark and its text. */
const readoutWidth = (text) => CH + 4 + text.length * CH;

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

// A press on a control in the window-drag header must not start a drag.
const hold = (_event, cx) => cx.stop_propagation();

export default class IndustrialOs extends View {
	init(initProps, cx) {
		// A layout's props come from props(); a nested copy (the probe window's three parts) gets its own.
		const p = initProps?.part ? initProps : (props() ?? {});
		this.part = p.part ?? "list";
		this.rail = p.rail === true; // a probe's rail, whatever the real sidebar's width
		this.hov = {};
		this.stageId = ++stageCount;
		this.stage = { world: null, watch: null, hover: null, hoverTab: null, viewW: 264, width: 300, ground: C.groundBottom, size: null, pointer: null, readout: null, readAt: 0 };
		stages.set(this.stageId, this.stage);
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
				// keys.json: "<key>": "industrial-os.fold" folds the sidebar to the rail and back.
				if ((await nextCommand()) === "fold") foldSidebar(cx);
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
		let dirty = gen.version !== this.genSeen;
		this.genSeen = gen.version;
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

	render() {
		if (this.part === "all") {
			return v_flex().size_full().bg(C.groundBottom)
				.child(div().flex_none().w_full().h(130).child(this.kids[0]))
				.child(div().flex_1().min_h(0).w_full().child(this.kids[1]))
				.child(div().flex_none().w_full().h(46).child(this.kids[2]));
		}
		const t = theme(), folded = this.rail || sidebarWidth() < RAIL_PX, block = this.draw(t, folded), over = this.motionLayer(t, folded);
		return over ? block.relative().child(over) : block;
	}

	// A fold in motion, over this block. Nothing here is clipped or scaled: rows are erased and typed in by covers of
	// ground that grow or shrink from the right, and the unfold's scan line is the left edge of one such cover.
	motionLayer(t, folded) {
		const m = motion();
		if (!m) return null;
		const part = this.part, W = Math.min(sidebarWidth(), 1200), H = part === "top" ? 130 : part === "bottom" ? 46 : (this.size?.height || 1400);
		const rows = Math.ceil(H / ROW), key = `${part}-${m.at}-${folded ? "r" : "w"}`, seed = `${m.at}/${part}`;
		// The ground a row is erased to: the list's own dotted ground where it has one, else the block's colour.
		const size = this.size, field = part === "list" && !folded && size?.height ? gen.ready.get(`field/${size.width}x${size.height}`) : null;
		// A flickering cover lets its row show through in bursts until it goes.
		const cover = (id, y, h, w, flicker = false) => div().id(id).absolute().right(0).top(y).h(h).w(w).overflow_hidden()
			.child(div().absolute().right(0).top(0).w(W).h(h).bg(part === "top" ? C.groundTop : C.groundBottom)
				.when(field, (el) => el.child(image(field).absolute().right(0).top(-y).w(size.width).h(size.height)))
				.when(flicker, (el) => el.loop("opacity", { from: 0.25, to: 1, period: 100 })));
		const els = [];
		if (m.kind === "fold" && m.step < 2) {
			eraseRows(seed, rows).forEach((row, i) => {
				if (row.flicker && m.step === 1) els.push(cover(`ios-flick-${key}-${i}`, i * ROW, ROW, W).loop("opacity", { from: 0, to: 0.75, period: 100 }));
				els.push(cover(`ios-erase-${key}-${i}`, i * ROW, ROW, m.step ? W : 0).transition("width", { duration: row.duration, delay: row.delay, easing: row.easing }));
			});
		}
		if (m.step >= 2) {
			// The new rows come in as the old ones went: in no order, some at once, some after a flicker, some slowly.
			eraseRows(`${seed}/in`, rows).forEach((row, i) => els.push(cover(`ios-type-${key}-${i}`, i * ROW, ROW, m.step < 3 ? W : 0, row.flicker && m.step === 3)
				.transition("width", { duration: row.duration, delay: row.delay, easing: row.easing })));
		}
		if (m.kind === "unfold") {
			// Power-on: the line runs to the left edge and the rail goes dark behind it; the sidebar opens; the line runs back.
			const out = m.step < 2, moved = out ? m.step >= 1 : m.step >= 3, policy = out ? { duration: SCAN_OUT_MS, easing: "ease-in" } : { duration: SCAN_BACK_MS, easing: "ease-out" };
			els.push(cover(`ios-wipe-${key}-${out ? "a" : "b"}`, 0, H, out === moved ? W : 0).transition("width", policy));
			els.push(div().id(`ios-scan-${key}-${out ? "a" : "b"}`).absolute().top(0).left(out === moved ? 2 : W - 2).w(2).h(H).opacity(!out && moved ? 0 : 1)
				.transition("left", policy).transition("opacity", { duration: 120, delay: SCAN_BACK_MS - 20 })
				.child(div().absolute().left(-3).top(0).w(8).h(H).bg(rgba(t.working, A.sweep)))
				.children(scanSegments(seed, H).map((sg) => {
					const piece = div().absolute().left(sg.dx).top(sg.y).w(sg.w).h(sg.h).bg(t.working);
					return sg.broken ? piece.loop("opacity", { from: sg.opacity * 0.3, to: sg.opacity, period: 100 + (sg.y % 7) * 12 }) : piece;
				})));
		}
		return div().absolute().left(0).top(0).size_full().overflow_hidden().children(els);
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
		const at = this.stage.readAt = Date.now();
		cx.notify(this.readout);
		this.reading?.cancel();
		this.reading = cx.timer.every(READ_STEP_MS, (cx) => {
			cx.notify(this.readout);
			if (Date.now() - at > 1200) this.reading.cancel();
		});
	}

	// ================= the top: the crate plate and the shortcut strip =================
	renderTop(t, result) {
		const stage = this.stage, units = result.missions.flatMap((m) => m.tabs.flatMap((tab) => tab.units));
		// The plate's camera keeps the focused unit under the crosshair; only a row of ACTION REQUIRED under the pointer takes it.
		const aim = shared(AIM_KEY);
		const here = result.missions.find((m) => m.current)?.tabs.flatMap((tab) => tab.units)[0];
		stage.watch = (units.find((u) => u.id === aim) ?? units.find((u) => u.focused) ?? here ?? units[0])?.id ?? null;
		const label = (text) => word(text, C.paperLabel);
		const reading = (mark, children) => h_flex().h(ROW).items_center().whitespace_nowrap().text_size(11).text_color(C.ink)
			.child(sign(mark, C.ink)).children(children);
		// The machine's name: capitals, at most 12 characters; a longer one runs as ticker tape under the pointer.
		const name = this.machine || "LOCAL", long = name.length > 12;
		const machine = long && this.hov.plate
			? div().flex_none().w(12 * CH).overflow_hidden().font_weight(800).frames(tape(name, 12), STEP_MS)
			: word(long ? name.slice(0, 12) : name, C.ink, 800);
		const key = (id, text, first, action) => h_flex().id(id).flex_none().h_full().pl(first ? 18 : 7).pr(7).items_center().cursor_pointer()
			.text_color(C.keyText).hover((s) => s.bg(t.working).text_color(BLACK)).active((s) => s.bg(C.keyPressed))
			.on_mouse_down("left", hold).on_click(action).child(text);
		return v_flex().id("ios-top").size_full().bg(C.groundTop).font_family(font()).text_size(11)
			.child(div().id("ios-plate").relative().flex_none().w_full().h(PLATE_H).bg(C.paper).overflow_hidden().on_hover(this.enter({ plate: true }))
				.on_size_change((size, cx) => { if (size.width !== stage.width) { stage.width = size.width; cx.notify(); } })
				.child(div().absolute().left(114).top(0).w(1).h(PLATE_H).bg(C.paperRule))
				.child(div().absolute().left(234).top(0).w(1).h(PLATE_H).bg(C.paperRule))
				.child(div().absolute().left(150).right(0).top(ROW * 4.5).h(1).bg(C.paperRule))
				.child(this.plate)
				// The crosshair is literal: the watched unit is under it.
				.child(div().absolute().left(CROSSHAIR[0] - 0.5).top(CROSSHAIR[1] - 7.5).w(1).h(15).bg(C.crosshair))
				.child(div().absolute().left(CROSSHAIR[0] - 7.5).top(CROSSHAIR[1] - 0.5).w(15).h(1).bg(C.crosshair))
				.child(div().absolute().left(0).right(0).bottom(0).h(1).bg(C.paperHair))
				.child(div().absolute().right(4).top(ROW * 5 + 3).text_size(11).line_height("11px").text_color(C.paperMark).child("+"))
				// The maker is the plate's heading, on its own paper over the map.
				.child(div().absolute().right(15).top(8).px(3).py(3).bg(C.paper).line_height("14px").font_weight(800).text_color(C.ink).whitespace_nowrap().child("INDUSTRIAL-OS ®"))
				.child(v_flex().absolute().left(18).top(ROW * 2 - 1)
					.child(reading("machine", [machine, div().w(CH), label("·"), div().w(CH), label(result.counts.droids > 0 ? "RUNNING" : "STANDBY")]))
					.child(reading("droid", [word(twoDigits(result.counts.droids), C.ink, 800), div().w(CH), label("DRD")]))
					.child(reading("spaces", [word(twoDigits(result.counts.spaces), C.ink, 800), div().w(CH), label("SPACES")]))))
			// The shortcut strip is glass, like a space's band.
			.child(h_flex().flex_none().w_full().h(ROW).bg(rgba(WHITE, A.glass)).items_center()
				.child(key("ios-settings", "SETTINGS", true, () => run("app.settings"))
					// An update that is ready to install shows as a lit dot on the key that installs it.
					.when(Boolean(updates().app?.ready), (el) => el.gap(5).child(div().relative().flex_none().w(5).h(5).children(bar(0, 0, 5, 5, t.working, { radius: 3, glow: t.working })))))
				.child(div().flex_none().text_size(12).text_color(t.input).child("│"))
				.child(key("ios-machine", "ADD MACHINE", false, () => run("mod.open", { name: "machine-add" }))));
	}

	// Folded: the paper carries the two counts as plates.
	renderRailTop(t, result) {
		const hot = this.hov.strip === true;
		const tag = (background, children) => h_flex().w(51).h(14).gap(4).rounded(2).items_center().justify_center().bg(background).text_size(11).font_weight(800).text_color(BLACK).children(children);
		return v_flex().size_full().bg(C.groundTop).font_family(font()).text_size(11)
			.child(div().relative().flex_none().w_full().h(PLATE_H).bg(C.paper).overflow_hidden()
				.child(div().absolute().left(0).right(0).top(ROW * 4.5).h(1).bg(C.paperRule))
				.child(div().absolute().left(0).right(0).bottom(0).h(1).bg(C.paperHair))
				.child(div().absolute().right(12).top(ROW * 2 + 1).line_height("14px").text_color(C.paperLabel).child(result.counts.droids > 0 ? "RUNNING" : "STANDBY"))
				.child(v_flex().absolute().left(12).top(ROW * 3 + 2).gap(ROW - 14)
					.child(tag(t.working, [sign("droid", BLACK, 9, 9, 14), twoDigits(result.counts.droids)]))
					.when(result.counts.need > 0, (el) => el.child(tag(C.orange, ["×", twoDigits(result.counts.need)])))))
			// Where the shortcut strip was: the strip that unfolds the sidebar.
			.child(h_flex().id("ios-show").relative().flex_none().w_full().h(ROW).pl(18.75).items_center().cursor_pointer().overflow_hidden()
				.bg(rgba(WHITE, A.glass)).text_size(13).font_weight(800).text_color(hot ? BLACK : t.foreground)
				.on_hover(this.enter({ strip: true })).on_mouse_down("left", hold).on_click((_e, cx) => foldSidebar(cx))
				// Under the pointer the acid fills it from the left.
				.child(div().id("ios-show-fill").absolute().left(0).top(0).h(ROW).w(hot ? Math.min(RAIL_PX, sidebarWidth()) : 0).bg(t.working).transition("width", { duration: 170, easing: "ease-out" }))
				.child(div().relative().map((el) => (hot ? el.frames(["›  ", "›› ", "›››"], 200) : el.child("»")))));
	}

	// ================= the bottom: the search hint =================
	// Not a field: a line that says search exists and which key opens it. A click opens Herdr's picker too.
	renderBottom(t, folded) {
		const key = boundKey("mod.open:picker"), hot = this.hov.search === true;
		// Reached by the pointer it flickers once, in hard steps, with a pixel of red and of cyan on its two ends.
		const flick = flickerFrame(Date.now() - this.flickAt);
		const enter = (hovered, cx) => {
			this.enter({ search: true })(hovered, cx);
			if (!hovered) return;
			this.flickAt = Date.now();
			for (const ms of FLICKER_AT) cx.timer.after(ms + 1, (cx) => cx.notify());
		};
		const fringes = flick.fringe && [div().absolute().left(-1).top(0).w(1).h_full().bg(rgba(C.fringeRed, A.fringeRed)), div().absolute().right(-1).top(0).w(1).h_full().bg(rgba(C.fringeCyan, A.fringeCyan))];
		if (folded) {
			return div().size_full().bg(C.groundBottom).font_family(font()).pl(12).pt(8)
				.child(h_flex().id("ios-find").relative().w(51).h(17).gap(5).rounded(2).items_center().justify_center().cursor_pointer().bg(hot ? t.working : t.input).opacity(flick.opacity)
					.on_hover(enter).on_click(openPicker)
					.child(sign("search", hot ? BLACK : WHITE, 10, 10)).when(key, (el) => el.child(keyPlate(key, rgba(BLACK, 0), hot ? BLACK : WHITE).px(0)))
					.children(present([fringes].flat())));
		}
		return div().size_full().bg(C.groundBottom).font_family(font()).px(INNER).pt(8).pb(10)
			// Glass comes up under the pointer, as on a space's band, so the hint reads as one thing to click.
			.child(h_flex().id("ios-search").relative().w_full().h(28).px(PAD).gap(7).items_center().cursor_pointer().bg(rgba(WHITE, hot ? A.glass : 0)).opacity(flick.opacity)
				.on_hover(enter).on_click(openPicker).children(present([fringes].flat()))
				.child(sign("search", hot ? t.working : C.nameIdle, 12, 12))
				.child(div().flex_1().min_w(0).truncate().text_size(12).text_color(hot ? C.value : C.nameIdle).child("search spaces, agents, tabs"))
				.when(key, (el) => el.child(keyPlate(key, hot ? t.working : t.input, hot ? BLACK : WHITE))));
	}

	// ================= the list =================
	renderList(t, result, now) {
		const stage = this.stage, width = this.size?.width ?? 300, height = this.size?.height ?? 0, inner = width - 2 * INNER;
		stage.viewW = inner - 2 * PAD;
		const tone = { working: t.working, blocked: t.blocked, done: t.done ?? WHITE, idle: C.detail, unknown: C.detail };
		const lights = { working: true, blocked: true };
		const zone = { ok: t.working, warn: C.warn, crit: t.blocked, off: C.detail };
		const ground = picture(`field/${width}x${height}`, () => fieldSvg(width, height), 0, 0, width, height);
		const focus = (u) => () => run("pane.focus", { pane: u.id });

		// One line of a pane's second row or detail lines, on the name's column.
		const line = (h, children) => h_flex().h(h).pl(14).items_center().whitespace_nowrap().children(present(children));
		const labelCell = (text, color = C.label) => div().flex_none().w(CODE_W + CH).text_color(color).child(text);
		// Subagents: the count, then one spinning icon each (a count is all Pi reports), then +N.
		const unitIcons = (u) => {
			const n = u.units.count ?? 0;
			return [
				...Array.from({ length: Math.min(n, UNIT_ICONS) }, (_, i) => div().flex_none().w(CH).text_color(t.working).frames([...SPIN.slice(i % SPIN.length), ...SPIN.slice(0, i % SPIN.length)], 80)),
				n > UNIT_ICONS && word(`+${n - UNIT_ICONS}`, C.detail),
			];
		};
		// Lit only above zero: `00AU` and `??AU` are grey.
		const unitCount = (u) => (u.units.count ? lit(u.units.text, t.working, { weight: 400, line: 15 }) : word(u.units.text, C.detail));
		const context = (u) => (u.context.zone === "off" ? word(u.context.text, zone.off) : lit(u.context.text, zone[u.context.zone], { weight: 400, line: 15 }));

		// A pane's height is known before it is laid out, so its dot grid, bars and scanner fit it exactly.
		const askLines = (u) => (u.detail?.ask ? wrapText(u.detail.ask.text, Math.floor((inner - 2 * PAD - NAME_X) / CH), 3) : []);
		// A pane at rest: its two rows. The focused pane's bar is never taller, however far the pane opens.
		const TWO_ROWS = 2 + 17 + 16;
		const openOf = (u) => u.focused && u.kind === "drd";
		const heightOf = (u, where) => {
			if (!openOf(u)) return TWO_ROWS;
			const d = u.detail, lines = (where === "g" ? 1 : 0) + (d.act ? 1 : 0) + (d.model ? 1 : 0) + (d.goal ? 1 : 0) + (u.units.count !== 0 ? 1 : 0) + 1 + askLines(u).length;
			return 1 + 17 + lines * 15 + 6;
		};

		// A pane: two quiet rows; the focused one opens instead, so nothing is shown twice.
		const unitItem = (u, where) => {
			const open = openOf(u), h = heightOf(u, where), w = inner, hov = this.hov.unit === u.id && this.hov.at === where;
			const at = this.latch.get(u.id), stage1 = at !== undefined && now - at < 130, latched = at !== undefined && now - at < 260;
			// A state change latches: black on acid, then on its new colour, then settled.
			const paint = (color) => (latched ? BLACK : color), color = tone[u.tone], glow = !latched && lights[u.tone] === true;
			const name = paint(u.focused ? t.foreground : u.tone === "idle" || u.tone === "unknown" ? C.nameIdle : C.name);
			const readout = { working: t.working, blocked: t.blocked, done: WHITE, idle: C.name, unknown: C.name }[u.tone], read = `${u.designation} · ${u.status}`;
			if (hov && !latched) stage.readout = { text: read, color: readout };
			const row1 = h_flex().h(17).items_center().whitespace_nowrap()
				.child(stateMark(u.mark, paint(color), now))
				.child(div().flex_none().w(CODE_W + CH).child(lit(u.code, paint(color), { glow })))
				.child(cutLine(u.name, name))
				.children(present(hov && !latched ? [
					// The scanner's readout, typed in at the end of the row.
					div().flex_none().w(readoutWidth(read)).h(17).child(this.readout),
				] : [
					u.flag && div().flex_none().w(CH), u.flag && sign(glow ? "flag-lit" : "flag", paint(t.blocked), 9),
					u.age && div().flex_none().w(CH), u.age && word(u.age, paint(C.reading)),
				]));
			const d = u.detail, place = where === "g" ? cutLine(u.tab, paint(C.detail)) : null;
			const rows = open ? [
				place && line(15, [labelCell(""), place]),
				d.act && line(15, [labelCell("ACT"), div().flex_shrink_1().min_w(0).truncate().text_color(C.value).child(d.act.dirty ? d.act.text.slice(0, -1) : d.act.text),
					d.act.dirty && lit("*", C.warn, { weight: 400, line: 15 }), div().flex_1(), d.pr && word(d.pr.text, C.reading)]),
				d.model && line(15, [labelCell("MDL"), cutLine(d.model.replace("/", " "), C.value), word(d.compactions, C.reading)]),
				d.goal && line(15, [labelCell("GOAL"), cutLine(d.goal, C.value)]),
				// The count is the line's title.
				u.units.count !== 0 && line(15, [div().flex_none().w(CODE_W + CH).child(unitCount(u)), ...unitIcons(u)]),
				line(15, [labelCell("CTX"),
					div().relative().flex_1().h(2).bg(C.track).children(u.context.percent === null ? [] : bar(0, 0, Math.round((w - 2 * PAD - NAME_X - 4 * CH) * u.context.percent / 100), 2, zone[u.context.zone], { glow: u.context.zone === "off" ? null : zone[u.context.zone], strong: 0.55 })),
					div().flex_none().w(4 * CH).h_flex().justify_end().child(context(u))]),
				...askLines(u).map((text, i) => line(15, [labelCell(i ? "" : d.ask.label, t.blocked), i || !lights.blocked ? word(text, t.blocked) : lit(text, t.blocked, { weight: 400, line: 15 })])),
			] : [line(16, [
				labelCell(""),
				...(where === "g" ? [place, u.note && div().flex_none().w(CH), u.note && word(u.note, paint(C.reading)), u.units && unitCount(u) && div().flex_none().w(CH), u.units && unitCount(u)]
					: [u.note && word(u.note, paint(C.reading)), u.units && unitCount(u), ...(u.units && u.units.count ? [div().flex_none().w(3), ...unitIcons(u)] : []), div().flex_1()]),
				u.context && div().flex_none().w(CH), u.context && (latched ? word(u.context.text, BLACK) : context(u)),
			])];
			const [px, py] = dotPitch(w, h), [lw, lh] = litDotsSize(w, h), near = this.lit?.id === u.id ? this.lit : null;
			return v_flex().id(`ios-u-${where}-${u.id}`).relative().flex_none().w(w).h(h).px(PAD).pt(1).cursor_pointer()
				.on_hover(this.enter(where === "m" ? { unit: u.id, at: where, unitTab: u.tabId, unitSpace: u.spaceId } : { unit: u.id, at: where }))
				.on_click(focus(u))
				.when(latched, (el) => el.bg(rgba(stage1 ? t.working : color, A.latch)))
				.on_mouse_move((e, cx) => { if (u.focused && !latched) this.near(u.id, e, px, py, cx); this.measure("unit", e, cx); })
				.when(u.focused && !latched, (el) => el.bg(rgba(WHITE, A.focusGlass))
					.children(present([
						// The focused pane's block: a square grid of whole dots that thins out to the right.
						picture(`dots/${w}x${h}/w`, () => dotGridSvg(w, h, WHITE, A.focusDot), 0, 0, w, h),
						near && div().absolute().left(0).top(0).w(w).h(h).overflow_hidden().children(present([picture(`lit/${w}x${h}/w`, () => litDotsSvg(w, h, WHITE, A.focusDotLit), near.x - lw / 2, near.y - lh / 2, lw, lh)])),
					])))
				// The gutter bar: acid beside the focused pane, white and pulsing beside the pane under the pointer.
				.children(u.focused ? bar(-8, 1, 3, Math.min(h, TWO_ROWS) - 2, t.working, { radius: 2, glow: t.working, pulse: true, strong: true }) : hoverBar(`${where}-${u.id}`, h, hov))
				// Until the list has been measured there is no sliding scanner, so the pane shows its own.
				.when(hov && !latched && !this.measured.body, (el) => el.children(scope(w, h, t.working)))
				.child(row1).children(present(rows));
		};
		// The white gutter bar beside the pane under the pointer: it grows from its middle, then its lamp pulses.
		const hoverBar = (id, h, on) => [
			...(on ? bar(-8, 1, 3, h - 2, C.paper, { radius: 2, glow: WHITE, pulse: true, strong: true }).slice(0, -1) : []),
			div().id(`ios-bar-${id}`).absolute().left(-8).top(on ? 1 : 1 + (h - 2) * 0.325).w(3).h(on ? h - 2 : (h - 2) * 0.35).rounded(2).bg(C.paper).opacity(on ? 1 : 0)
				.transition("top", { duration: 130, easing: "ease-out" }).transition("height", { duration: 130, easing: "ease-out" }).transition("opacity", { duration: 90 }),
		];
		// The scanner: one frame per list that slides to the pane the pointer reaches, and stays on the last one until the
		// pointer leaves the list. Its corner marks hold to its corners while it changes height.
		const scopeBox = (which) => {
			const sc = this.scopes[which], r = sc.rect;
			if (!r) return null;
			const w = r.w + 2, h = r.h + 2, color = t.working, slide = { duration: 170, easing: "ease-out" };
			const corners = [["left", "top"], ["left", "bottom"], ["right", "top"], ["right", "bottom"]]
				.flatMap(([x, y]) => [div().absolute()[x](1.5)[y](0).w(7).h(1.5).bg(color), div().absolute()[x](0)[y](1.5).w(1.5).h(7).bg(color)]);
			return div().id(`ios-scope-${which}-${sc.gen}`).absolute().left(r.x - 1).top(r.y - 1).w(w).h(h).bg(rgba(color, A.scopeGlass)).opacity(sc.on && sc.shown ? 1 : 0)
				.transition("top", slide).transition("height", slide).transition("left", slide).transition("width", slide).transition("opacity", { duration: 120 })
				.children(present([lamp(`scope/${w}x${h}/${color}`, () => scopeGlowSvg(w, h, color), -HALO_PAD, -HALO_PAD, w + 2 * HALO_PAD, h + 2 * HALO_PAD), ...corners]));
		};
		// A pane's own scanner, still: faint acid glass and four corner marks that glow and pulse.
		const scope = (w, h, color) => present([
			div().absolute().left(-1).top(-1).w(w + 2).h(h + 2).bg(rgba(color, A.scopeGlass)),
			lamp(`scope/${w + 2}x${h + 2}/${color}`, () => scopeGlowSvg(w + 2, h + 2, color), -1 - HALO_PAD, -1 - HALO_PAD, w + 2 + 2 * HALO_PAD, h + 2 + 2 * HALO_PAD),
			...scopeBars(w + 2, h + 2).map(([x, y, bw, bh]) => div().absolute().left(x - 1).top(y - 1).w(bw).h(bh).bg(color)),
		]);

		// A tab is a title over its panes: capitals, one line. It is a label, not a control.
		const titleChars = Math.floor((inner - 2 * PAD - 8 - 3 * 6) / advance(12));
		const tabBlock = (m, tab, first) => {
			const name = tab.name.toUpperCase(), long = name.length > titleChars, running = long && this.hov.tab === tab.id;
			for (const u of tab.units) { u.tabId = tab.id; u.spaceId = m.id; }
			return v_flex().flex_none().px(INNER).pt(first ? 10 : 22)
				.child(h_flex().id(`ios-tab-${tab.id}`).h(17).mb(1).px(PAD).gap(8).items_center().on_hover(this.enter({ tab: tab.id, tabSpace: m.id }))
					// A right click opens Herdr's own tab menu, as on its tab bar: Rename, New tab, Close.
					.on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab.id, space: m.id } } }); })
					.child(div().relative().flex_1().min_w(0).h(17).line_height("17px").overflow_hidden().whitespace_nowrap().text_size(12).text_color(tab.quiet ? C.titleQuiet : C.title)
						// One too long for its line fades out at the right, and runs as ticker tape under the pointer.
						.map((el) => (running ? el.frames(tape(name, titleChars), STEP_MS) : el.child(name)))
						.when(long && !running, (el) => el.children(present([picture(`fade/26x17/${stage.ground}/left`, () => fadeSvg(26, 17, stage.ground, "left"), titleChars * advance(12) - 26 + 4, 0, 26, 17)]))))
					.child(div().flex_none().text_size(10).text_color(C.label).child(tab.ref)))
				.child(v_flex().gap(5).children(tab.units.map((u) => unitItem(u, "m"))));
		};

		// A space is a band across the whole sidebar: its name, a caret, the add-tab key, and at the right only what needs you there.
		const tabKey = boundKey("tab.new"), tabKeyParts = tabKey ? keyParts(tabKey) : null;
		// The add-tab key's label and shortcut plate, as wide as they are set: it opens to this width.
		const newTabW = 7 * CH + 4 + (tabKeyParts ? 8 + 8 + (tabKeyParts.command ? 10 : 0) + tabKeyParts.text.length * CH : 0);
		const band = (m) => {
			const hot = this.hov.band === m.id, add = this.hov.add === m.id;
			return h_flex().id(`ios-band-${m.id}`).relative().flex_none().w_full().h(BAND_H).pl(18).pr(18).items_center().cursor_pointer().whitespace_nowrap()
				.border_t(1).border_color(rgba(WHITE, m.open ? A.glassEdge : A.glassShutEdge)).bg(rgba(WHITE, m.open ? A.glass : A.glassShut))
				.on_hover(this.enter({ band: m.id })).on_click((_e, cx) => this.toggleFold(m, cx))
				// The space you are in has a quiet acid dot grid on its band, from the left.
				.when(m.current, (el) => el.children(present([picture(`dots/${width}x${BAND_H - 1}/a`, () => dotGridSvg(width, BAND_H - 1, t.working, A.currentDot, [[0, 1], [0.26, 0.4], [0.52, 0]]), 0, 0, width, BAND_H - 1)])))
				.child(div().flex_shrink_1().min_w(0).truncate().text_size(12).font_weight(800).text_color(hot && !add ? t.working : m.open ? t.foreground : C.titleQuiet).child(m.name.toUpperCase()))
				.child(div().flex_none().ml(5).text_size(11).text_color(hot && !add ? t.working : C.caret).child(m.open ? "▾" : "▸"))
				// The add-tab key opens to the right under the pointer, over the band's counts.
				.child(h_flex().id(`ios-add-${m.id}`).flex_none().h(BAND_H - 1).ml(5).items_center()
					.when(add, (el) => el.bg(t.working)).on_hover(this.enter({ add: m.id })).on_mouse_down("left", hold)
					.on_click((_e, cx) => { cx.stop_propagation(); run("tab.new", { space: m.id }); })
					.child(div().flex_none().w(24).h_flex().justify_center().text_size(14).font_weight(add ? 800 : 400).text_color(add ? BLACK : C.keyRest).child("+"))
					.child(h_flex().id(`ios-add-label-${m.id}`).flex_none().w(add ? newTabW : 0).overflow_hidden().transition("width", { duration: 150, easing: "ease-out" })
						.child(h_flex().flex_none().gap(8).pr(4).items_center().whitespace_nowrap().font_weight(800).text_color(BLACK).child("NEW TAB").when(tabKey, (x) => x.child(keyPlate(tabKey, BLACK, t.working))))))
				.child(div().flex_1())
				.when(!add, (el) => el.child(h_flex().flex_none().gap(10).items_center().text_size(10)
					.when(m.need > 0, (x) => x.child(h_flex().gap(advance(10)).items_center().child(lit(twoDigits(m.need), t.blocked, { size: 10, line: 14 })).child(word("NEED YOU", C.reading))))
					.when(m.behind > 0, (x) => x.child(word(`↓${m.behind}`, C.keyRest)))));
		};
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
			.child(h_flex().h(14).mt(14).mb(3).px(PAD).gap(8).items_center().text_size(10).text_color(C.detail)
				.child(word(g.name.toUpperCase(), C.detail)).child(div().flex_1().h(1).bg(C.rule)).child(word(twoDigits(g.units.length), C.detail)))
			.child(v_flex().gap(5).children(g.units.map((u) => unitItem(u, "g"))));

		// ACTION REQUIRED: pinned; the focused pane's block in red. Its rows are set like pane rows.
		const whereChars = Math.floor((inner - 2 * PAD - NAME_X - 2 * CH - 4 * CH) / CH);
		const waitChars = Math.floor((inner - 2 * PAD - NAME_X) / CH);
		const shown = this.more ? result.action : result.action.slice(0, ACTION_SHOWN), hidden = result.action.length - shown.length;
		const actionRows = shown.map((u) => ({ u, lines: wrapText(u.waits ?? "", waitChars, 2) }));
		const actionH = 2 + 3 + actionRows.reduce((n, r) => n + 2 + 17 + r.lines.length * 15, 0) + Math.max(0, actionRows.length - 1) * 5 + (hidden > 0 ? 5 + 15 : 0);
		const actionItem = ({ u, lines }, i) => {
			const where = `${u.space} › ${u.tab}`.toUpperCase(), long = where.length > whereChars, running = long && this.hov.unit === u.id && this.hov.at === "a", color = tone[u.tone];
			const hov = this.hov.unit === u.id && this.hov.at === "a", h = 2 + 17 + lines.length * 15;
			return v_flex().id(`ios-act-${u.id}`).relative().flex_none().w(inner).h(h).px(PAD).pt(1).cursor_pointer()
				.on_hover((hovered, cx) => {
					setShared(AIM_KEY, hovered ? u.id : null);
					this.enter({ unit: u.id, at: "a" })(hovered, cx);
					// These rows do not scroll, so each one's place is known.
					if (hovered) this.aimScope("act", { x: 0, y: 2 + actionRows.slice(0, i).reduce((n, row) => n + 2 + 17 + row.lines.length * 15 + 5, 0), w: inner, h }, cx);
				})
				.on_click(focus(u))
				.children(hoverBar(`a-${u.id}`, h, hov))
				.child(h_flex().h(17).items_center().whitespace_nowrap()
					.child(stateMark(u.mark, color, now))
					.child(div().flex_none().w(CODE_W + CH).child(lit(u.code, color, { glow: lights[u.tone] === true })))
					.child(div().flex_1().min_w(0).h(17).line_height("17px").overflow_hidden().text_color(C.name)
						.map((el) => (running ? el.frames(tape(where, whereChars), STEP_MS) : el.child(long ? `${where.slice(0, whereChars - 1)}…` : where))))
					.children(present([u.flag && div().flex_none().w(CH), u.flag && sign("flag-lit", t.blocked, 9), u.age && div().flex_none().w(CH), u.age && word(u.age, C.reading)])))
				// What it is waiting on, set as a pane's second row is.
				.children(lines.map((text) => line(15, [labelCell(""), word(text, u.code === "DNE" ? C.detail : C.value)])));
		};
		const nearAct = this.lit?.id === "act" ? this.lit : null, [apx, apy] = dotPitch(inner, actionH), [alw, alh] = litDotsSize(inner, actionH);
		const actionZone = v_flex().flex_none().mt(10)
			.child(h_flex().h(18).px(PAD).gap(8).items_center()
				.child(word("ACTION REQUIRED", t.foreground, 800)).child(div().flex_1().h(1).bg(C.ruleStrong)).child(lit(twoDigits(result.action.length), t.blocked)))
			.child(v_flex().id("ios-act").relative().flex_none().w(inner).h(actionH).mt(6).pt(2).gap(5).bg(rgba(t.blocked, A.alertGlass))
				.on_mouse_move((e, cx) => this.near("act", e, apx, apy, cx)).on_hover((hovered, cx) => { if (hovered) return; this.dropScope("act", cx); if (this.lit?.id === "act") { this.lit = null; cx.notify(); } })
				.children(present([
					picture(`dots/${inner}x${actionH}/r`, () => dotGridSvg(inner, actionH, t.blocked, A.alertDot, [[0, 0.55], [0.45, 0.36], [0.94, 0]]), 0, 0, inner, actionH),
					nearAct && div().absolute().left(0).top(0).w(inner).h(actionH).overflow_hidden().children(present([picture(`lit/${inner}x${actionH}/r`, () => litDotsSvg(inner, actionH, t.blocked, A.alertDotLit), nearAct.x - alw / 2, nearAct.y - alh / 2, alw, alh)])),
				]))
				.children(actionRows.map(actionItem)).children(present([scopeBox("act")]))
				.when(hidden > 0, (el) => el.child(div().id("ios-more").h(15).pl(PAD + 14).text_size(10).text_color(C.nameIdle).cursor_pointer().hover((s) => s.text_color(t.working))
					.on_click((_e, cx) => { this.more = true; cx.notify(); }).child(`+ ${twoDigits(hidden)} MORE`))));

		// The view switch: a ruler with an index pointer under the active view, in acid; it follows the pointer in white.
		const views = [["missions", "MISSIONS", 0], ["agents", "AGENTS", 8 * CH + 14]];
		const home_ = views.find(([key]) => key === this.view)[2], roam = this.hov.ruler === true && this.roam !== undefined;
		const viewSwitch = div().id("ios-views").relative().flex_none().h(24).mt(10).mx(PAD)
			.on_hover(this.enter({ ruler: true })).on_mouse_move((e, cx) => { const x = Math.max(0, Math.min(stage.viewW - 8, Math.round((e.local_position?.x ?? 0) / 4) * 4 - 4)); if (x !== this.roam) { this.roam = x; cx.notify(); } })
			.child(h_flex().h(22).gap(14).items_center().children(views.map(([key, text]) => div().id(`ios-view-${key}`).flex_none().line_height("22px").cursor_pointer()
				.text_color(this.view === key ? t.foreground : t.dim).hover((s) => s.text_color(t.foreground))
				.on_click((_e, cx) => { this.view = key; localStorage.setItem(VIEW_KEY, key); cx.notify(); }).child(text))))
			.children(present([picture(`ruler/${stage.viewW}`, () => rulerSvg(stage.viewW), 0, 20, stage.viewW, 4)]))
			.child(svg(`${MOD}/marks/pointer-lit.svg`).absolute().left((roam ? this.roam : home_) - MARK_PAD - 0.5).top(24 - 7 - MARK_PAD).size(MARK_BOX).text_color(roam ? C.paper : t.working).transition("left", { duration: 150, easing: "ease-out" }));

		// The hide grip: a knurled band in the right gutter; under the pointer it grows open to say what it does.
		const foldKey = boundKey("industrial-os.fold"), gripHot = this.hov.grip === true, gh = gripHot ? 150 : 46, gw = gripHot ? 17 : 9;
		const grow = { duration: 160, easing: "ease-out" }, march = Math.floor(now / 240);
		// Its light is as large as the open grip, so it comes on once the grip has grown.
		const gripGlow = picture(`glow/17x150/2/${t.working}/0`, () => barGlowSvg(17, 150, t.working, { radius: 2 }), width - 18 - HALO_PAD, Math.max(0, height / 2 - 75) - HALO_PAD, 17 + 2 * HALO_PAD, 150 + 2 * HALO_PAD)
			?.id("ios-grip-glow").opacity(gripHot ? 1 : 0).transition("opacity", { duration: 120, delay: gripHot ? 120 : 0 });
		const grip = v_flex().id("ios-grip").absolute().left(width - (gripHot ? 1 : 3) - gw).top(Math.max(0, height / 2 - gh / 2)).w(gw).h(gh).items_center().justify_center().cursor_pointer().rounded(2).overflow_hidden()
			.transition("left", grow).transition("top", grow).transition("width", grow).transition("height", grow)
			.on_hover(this.enter({ grip: true })).on_click((_e, cx) => foldSidebar(cx))
			.map((el) => (gripHot
				? el.bg(t.working).child(v_flex().flex_none().items_center().gap(9)
					// Three chevrons march left, one after another.
					.child(v_flex().items_center().text_size(12).line_height("11px").font_weight(800).text_color(BLACK)
						.children([0, 1, 2].map((i) => { const step = (((march - i) % 3) + 3) % 3; return div().relative().left(3 - 3 * step).opacity(step === 1 ? 1 : 0.35).child("‹"); })))
					.child(div().relative().flex_none().w(13).h(34).children(present([picture("side/HIDE", () => sidewaysSvg("HIDE", BLACK), 0, 0, 13, 34)])))
					.when(foldKey, (x) => { const text = keyParts(foldKey), label = `${text.command ? "⌘" : ""}${text.text}`, len = label.length * (CH + 1.3);
						return x.child(div().relative().flex_none().w(15).h(len + 8).rounded(2).bg(BLACK).children(present([picture(`side/${label}`, () => sidewaysSvg(label, t.working), 1, 4, 13, len)]))); }))
				// At rest its ridges breathe.
				: el.child(v_flex().gap(3).children(Array.from({ length: 9 }, () => div().flex_none().w(5).h(1).bg(t.dim))).loop("opacity", { from: 0.3, to: 1, period: 2800 }))));

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
					.children(body).children(present([scopeBox("list")])))
				.child(div().flex_none().h(28)))
			// The list fades out before the edge it scrolls under, rather than being cut mid-line.
			.children(present([height ? picture(`fade/${width}x24/${C.groundBottom}/up`, () => fadeSvg(width, 24, C.groundBottom, "up"), 0, height - 24, width, 24) : null]))
			.children(present([gripGlow])).child(grip);
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
	// One lamp per pane, grouped by mission, in the list's order.
	renderRail(t, result) {
		const tone = { working: t.working, blocked: t.blocked, done: t.done ?? WHITE, idle: t.dim, unknown: t.dim };
		const lamp = (l) => h_flex().id(`ios-lamp-${l.id}`).flex_none().w(51).h(20).px(6).gap(5).rounded(4).items_center().cursor_pointer()
			.when(l.gap, (el) => el.mt(5)).when(l.focused, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
			.on_click(() => run("pane.focus", { pane: l.id }))
			.child(div().flex_none().w(9).h_flex().justify_center().child(l.tone === "working" || l.tone === "blocked" ? lit(l.lamp, tone[l.tone], { weight: 400, line: 20 }) : word(l.lamp, tone[l.tone])))
			.child(word(l.code, l.tone === "idle" || l.tone === "unknown" ? t.dim : t.muted));
		return v_flex().id("ios-rail").size_full().min_h(0).bg(C.groundBottom).font_family(font()).text_size(12)
			.child(v_flex().id("ios-lamps").flex_1().min_h(0).pt(4).pl(12).gap(2).overflow_y_scroll().children(result.lamps.map(lamp)));
	}
}

/** Ticker tape: the text, a separator, the text again, stepping left one character at a time, `chars` wide. */
function tape(text, chars) {
	const loop = `${text}  ·  `, twice = loop + loop + loop;
	return Array.from({ length: loop.length }, (_, i) => twice.slice(i, i + chars));
}
