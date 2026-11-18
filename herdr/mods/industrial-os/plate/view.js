// The Industrial OS pane header: a unit plate over every tab pane, drawn by the design system. The plate says who
// is in the pane (a Pi droid, another agent, or a terminal); the strip under it says what the pane is doing and holds
// the split, zoom and close keys. Props from the app: { pane, terminal }, beside the layout's `part: "plate"`.
// Click: focus the pane. main.js runs this view as the copy's root: it calls init, render and close with its own cx.
//
// The rules live in the pure modules beside this file; this view reads Herdr, looks up the foreground command with
// `hc get`, keeps the remembered times and the motion timeline, runs the pane commands and draws. Herdr interrupts a
// render that runs much past 50 ms, so render never composes: it reads Herdr, and when what it should show changed it
// starts one task that composes the header and its motion frame; render draws the pieces that task left.
//
// The plate is a grid of the terminal's cells, so every piece is placed at x = col × cell, never as flowing text: the
// cell width is measured here (a run of the terminal's font, and Herdr's column count across the header's width),
// and the columns are the header's width over it. Block elements, light lines and the peak's triangles are shapes, as
// a terminal draws them; only text comes from the font.
//
// Motion is native where Herdr can express it: a lighting change (T2, H1) stacks a layer at the new lighting whose
// four banks fade in with delayed opacity transitions, and the reveal shrinks the outgoing plate's rows with width
// transitions. Each is drawn once at its start (opacity 0, full width) and then at its end, PRIME_MS later; Herdr
// animates between them without this script. Only the character-level motions draw frames on a timer.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, terminals, props, run, hc, home, settings, window as herdrWindow } from "herdr";
import { emptyPlateMemory, lightingOf, observe, paneModel, presession } from "./model.js";
import { terminalSignals } from "../signals.js";
import { cellPlan, cellWidthOf, coarsen, columnsOf, composeHeader, KEY_ACTIONS, peakFromOf, PIECE_BUDGET, plannedColumns, ROW_HEIGHTS, ROW_TOPS, ROWS, spreadOf } from "./plate.js";
import { advance, emptyTimeline, frame, frameStep, headerDurations, layerBanks, lightingNow, needsPrime, nextWake, prime, PRIME_MS, REVEAL, settle } from "./motion.js";
import { LabelPublisher } from "./labels.js";
import { Scheduler } from "./clock.js";
import { MOD } from "../parts/drawings.js";

// The terminal's font, as Herdr defaults it, when the settings name none.
const DEFAULT_FONT = "JetBrains Mono";
const DEFAULT_FONT_SIZE = 14;
// The terminal's columns until Herdr reports them.
const DEFAULT_COLUMNS = 80;
// The advance probe: this many characters of the terminal's font, measured once laid out. Short, since an absolute
// element is no wider than its header: a probe that fills the header was cut, and is not used.
const PROBE_CHARS = 16;
const HC_TIMEOUT_MS = 2000;
const CACHE_LIMIT = 48;
// Window activation fallback poll; see windowActive().
const ACTIVATION_POLL_MS = 500;
// A timer that has notified this many times without a render is in a copy that is not shown: it stops.
const UNDRAWN_LIMIT = 2;
const HEADER_PX = ROW_TOPS[ROWS - 1] + ROW_HEIGHTS[ROWS - 1];
const KEY_LABELS = { "split-right": "Split right", "split-down": "Split down", zoom: "Zoom", close: "Close" };
// The ⟁ mark, drawn as its own shape: the terminal font has no such glyph.
const MARK = "⟁";
const MARK_PX = 10;

/**
 * Whether the Herdr window has the platform's focus. herdr's window() is documented as live, so a change should
 * redraw this copy; that could not be checked without a live window. The fallback: while the copy exists, a 500 ms
 * poll (init) redraws when the answer differs from the one last drawn.
 */
function windowActive() {
	try {
		const w = herdrWindow();
		return w ? w.active !== false : true;
	} catch {
		return true;
	}
}

// A task's timers, for the scheduler and the label writes. Taken afresh from each callback's own cx.
const timersOf = (cx) => ({ every: (ms, fn) => cx.timer.every(ms, fn), after: (ms, fn) => cx.timer.after(ms, fn) });
const sleepOf = (cx) => (ms) => new Promise((resolve) => cx.timer.after(ms, () => resolve()));

function command(action, pane) {
	if (action === "split-right") run("pane.split", { direction: "right", pane });
	else if (action === "split-down") run("pane.split", { direction: "down", pane });
	else if (action === "zoom") run("pane.zoom", { pane });
	else if (action === "close") run("pane.close", { pane });
}

export class DroidPlate extends View {
	init(_props, cx) {
		this.memory = emptyPlateMemory();
		this.timeline = emptyTimeline();
		this.hovered = false;
		this.keyHover = null;
		this.pressed = null;
		this.foreground = null; // { key, argv, cols } from the last `hc get`
		this.lookup = { key: null, busy: false, again: false };
		this.labels = new LabelPublisher();
		this.clock = new Scheduler(timersOf(cx));
		this.cache = new Map();
		this.plans = new WeakMap(); // lines → Map(grid key → cell plan)
		this.want = null; // what render last asked for
		this.wantKey = null;
		this.force = false;
		this.updating = { busy: false, again: false };
		this.shown = null; // { layers, reveal, hits }: what the last task composed
		this.primeAt = null; // when the unprimed layers drawn at their start get their end
		this.undrawn = 0; // notifies from a timer since the last render
		this.drawnActive = windowActive();
		this.width = null; // the header's width in px, once laid out
		this.advance = null; // the terminal font's advance in px, from the probe
		this.poll = null;
		this.startPoll(cx);
	}

	// The window-activation poll: it redraws only when the answer changes, and stops in a copy that is not shown; the
	// next render then asks for an update, whose task starts it again (render itself never starts a timer).
	startPoll(cx) {
		if (this.poll) return;
		let undrawn = 0, notified = this.renders ?? 0;
		this.poll = cx.timer.every(ACTIVATION_POLL_MS, (cx) => {
			if (windowActive() === this.drawnActive) return;
			if ((this.renders ?? 0) === notified) undrawn++; else undrawn = 0;
			if (undrawn > UNDRAWN_LIMIT) { this.poll?.cancel(); this.poll = null; this.force = true; return; }
			notified = this.renders ?? 0;
			cx.notify();
		});
	}

	async close(cx) {
		// Every pending label write is superseded; the terminals that may carry the label are cleared. Best effort: a
		// crash or forced quit leaves the label behind.
		this.clock.stop();
		this.poll?.cancel();
		this.poll = null;
		await this.labels.close({ hc, sleep: sleepOf(cx) });
	}

	// The label handshake: io.droid-plate.v1=1 on the pane's terminal while this copy draws its plate (labels.js).
	label(cx, terminal) {
		if (!this.labels.want(terminal)) return;
		cx.spawn(async (cx) => { await this.labels.run({ hc, sleep: sleepOf(cx) }); });
	}

	// One `hc get` per change of foreground program or title: the running command's argv and the terminal's columns.
	lookUp(cx, pane) {
		const key = pane.terminal ? `${pane.terminal}\u0000${pane.program?.key}\u0000${pane.program?.name}\u0000${pane.title}` : null;
		if (!key || key === this.lookup.key) return;
		this.lookup.key = key;
		if (this.lookup.busy) { this.lookup.again = true; return; }
		this.lookup.busy = true;
		cx.spawn(async (cx) => {
			do {
				this.lookup.again = false;
				const asked = this.lookup.key, address = asked.split("\u0000")[0];
				try {
					const timeout = new Promise((_, fail) => cx.timer.after(HC_TIMEOUT_MS, () => fail(new Error("timeout"))));
					const r = await Promise.race([hc(["get", address, "--json"]), timeout]);
					const data = r && r.code === 0 ? JSON.parse(r.stdout) : null;
					const argv = Array.isArray(data?.foreground?.argv) ? data.foreground.argv : null;
					const cols = Number.isSafeInteger(data?.cols) && data.cols > 0 ? data.cols : null;
					this.foreground = { key: asked, argv, cols };
				} catch {
					this.foreground = { key: asked, argv: null, cols: this.foreground?.cols ?? null };
				}
			} while (this.lookup.again);
			this.lookup.busy = false;
			cx.notify();
		});
	}

	// Composed headers and boot durations, kept while their inputs repeat (a frame, a hover) and dropped when many.
	cached(key, make) {
		let value = this.cache.get(key);
		if (value === undefined) {
			if (this.cache.size >= CACHE_LIMIT) this.cache.clear();
			value = make();
			this.cache.set(key, value);
		}
		return value;
	}

	header(model, width, lighting, zoomed, hover, pressed, peakFrom) {
		const lit = lighting !== "dark";
		const h = lit ? hover : null, p = lit ? pressed : null;
		const key = JSON.stringify([{ ...model, nextAt: null }, width, lighting, zoomed, h, p, peakFrom]);
		return this.cached(key, () => composeHeader(model, { width, lighting, zoomed, hover: h, pressed: p, peakFrom }));
	}

	// The header getters for what render last asked for: at a lighting level, and the droid's pre-session plate.
	getters(want) {
		const { model, cols, zoomed, hover, pressed, peakFrom } = want;
		const get = (lv) => this.header(model, cols, lv, zoomed, hover, pressed, peakFrom);
		const pre = model.kind === "droid" ? presession(model) : null;
		const getUnknown = (lv) => (pre ? this.header(pre, cols, lv, zoomed, hover, pressed, peakFrom) : get(lv));
		const durations = pre ? this.cached(JSON.stringify(["durations", model.plate, cols, want.lighting, peakFrom]), () => headerDurations(getUnknown(want.lighting), get(want.lighting))) : {};
		return { get, getUnknown, durations };
	}

	// The cell plan of `lines` on the current grid, widened to the header's columns, within the piece budget render can
	// draw in time; the same lines (a cached header) give the same plan.
	plan(lines, want, keys, banks, budget = PIECE_BUDGET) {
		let byGrid = this.plans.get(lines);
		if (!byGrid) { byGrid = new Map(); this.plans.set(lines, byGrid); }
		const columns = plannedColumns(want.cols), spread = spreadOf(lines[0]?.reduce((n, span) => n + [...span.text].length, 0) ?? columns, columns);
		const key = `${want.cell}|${want.scale}|${want.width}|${columns}|${banks.length}|${budget}|${keys.map((k) => `${k.hitCol},${k.hitLen}`).join(";")}`;
		let plan = byGrid.get(key);
		if (!plan) {
			plan = coarsen(cellPlan(lines, { cell: want.cell, scale: want.scale, width: want.width, keys, banks, spread }), budget);
			byGrid.set(key, plan);
		}
		return plan;
	}

	// What to draw at `now`: each lighting layer's frame and the reveal's outgoing plate, as pieces on the cell grid.
	compose(now, advanceTimeline) {
		const want = this.want;
		const { get, getUnknown, durations } = this.getters(want);
		if (advanceTimeline) {
			const m = want.model;
			this.timeline = advance(this.timeline, {
				kind: m.kind, state: m.state, known: m.known === true, seed: m.plate.seed ?? 0, pi: m.pi,
				lighting: want.lighting, idle: m.idle, lit: want.lighting === "lit",
			}, now, { outgoing: this.shown?.layers.at(-1)?.lines ?? null, durations });
		}
		if (this.primeAt !== null && now >= this.primeAt) { this.timeline = prime(this.timeline, now); this.primeAt = null; }
		this.timeline = settle(this.timeline, now);
		if (this.primeAt === null && needsPrime(this.timeline)) this.primeAt = now + PRIME_MS;
		const t = this.timeline;
		const keys = get(lightingNow(t) ?? want.lighting).keys;
		const columns = plannedColumns(want.cols); // the banks span the widened header
		// Every layer and the reveal share one render's piece budget.
		const budget = Math.floor(PIECE_BUDGET / (t.layers.length + (t.reveal ? 1 : 0)));
		const layers = t.layers.map((l) => {
			const lines = frame(t, now, l.level, get, getUnknown, durations);
			const schedule = l.enter ? layerBanks(columns, l.enter) : null;
			return { id: l.id, primed: l.primedAt !== null, lines, schedule, plan: this.plan(lines, want, keys, schedule ?? [], budget) };
		});
		const reveal = t.reveal ? { id: t.reveal.id, primed: t.reveal.primedAt !== null, plan: this.plan(t.reveal.outgoing, want, [], [], budget) } : null;
		this.shown = { layers, reveal, hits: layers.at(-1)?.plan.hits ?? [] };
		return durations;
	}

	// The timers after a compose: the frame timer while a character-level motion plays, and one wake for the next
	// change the plate makes by itself (a clock, the next ghost, priming, a layer or reveal settling).
	schedule(cx, now, durations) {
		this.clock.use(timersOf(cx));
		this.clock.frame(frameStep(this.timeline, now, durations), (cx) => this.tick(cx));
		const at = [nextWake(this.timeline, this.want.model.nextAt, now, durations), this.primeAt].filter((x) => typeof x === "number");
		if (at.length) this.clock.wake(Math.min(...at), (cx) => { this.force = true; this.nudge(cx); });
	}

	// A frame of a character-level motion: compose without advancing, draw, and step or stop the timer.
	tick(cx) {
		if (!this.nudge(cx)) return;
		const now = Date.now();
		let durations = {};
		try { durations = this.compose(now, false); } catch (error) { console.log(`droid-plate: ${error?.message ?? error}`); }
		this.schedule(cx, now, durations);
	}

	// Asks for a render from a timer. A copy that is not shown never renders: after UNDRAWN_LIMIT unanswered asks
	// every timer stops, and the next render (the copy shown again) starts what is due.
	nudge(cx) {
		if (this.undrawn >= UNDRAWN_LIMIT) { this.clock.stop(); this.force = true; return false; }
		this.undrawn++;
		cx.notify();
		return true;
	}

	// One task composes what render asked for; asks made meanwhile are folded into one more pass.
	update(cx) {
		if (this.updating.busy) { this.updating.again = true; return; }
		this.updating.busy = true;
		cx.spawn(async (cx) => {
			do {
				this.updating.again = false;
				const now = Date.now();
				let durations = {};
				try { durations = this.compose(now, true); } catch (error) { console.log(`droid-plate: ${error?.message ?? error}`); }
				try {
					this.schedule(cx, now, durations);
					this.startPoll(cx);
				} catch (error) { console.log(`droid-plate: ${error?.message ?? error}`); }
			} while (this.updating.again);
			this.updating.busy = false;
			cx.notify();
		});
	}

	// What the plate should show now, from Herdr: the pane's model, columns and lighting. Starts the label handshake
	// and the foreground lookup as needed.
	read(cx, p, now) {
		const term = p.terminal ? terminals().find((t) => t.address === p.terminal) ?? null : null;
		this.label(cx, p.terminal ?? null);
		this.lookUp(cx, p);
		this.memory = observe(this.memory, p, now);
		const fg = this.foreground && this.foreground.key === this.lookup.key ? this.foreground.argv : null;
		const model = paneModel({ pane: p, terminal: term, signals: terminalSignals(term, p.app), foreground: fg, memory: this.memory, now, home: home() });
		const active = windowActive();
		this.drawnActive = active;
		const lighting = lightingOf({ focused: p.focused, hovered: this.hovered, active });
		const termCols = Number.isSafeInteger(term?.cols) && term.cols > 0 ? term.cols : this.foreground?.cols ?? null;
		const look = this.look();
		let { cell, scale } = cellWidthOf({ advance: this.advance, multiplier: look.multiplier, width: this.width, cols: termCols });
		if (!cell) cell = look.size * 0.6; // monospace advance, until the probe is laid out
		const cols = this.width ? columnsOf(this.width, cell) : termCols ?? DEFAULT_COLUMNS;
		// The peak keeps clear of Herdr's drag grip at the pane's top centre.
		const peakFrom = peakFromOf(this.width ?? cols * cell, cell);
		return { model, cols, cell, scale, width: this.width, lighting, zoomed: p.zoomed === true, hover: this.keyHover, pressed: this.pressed, peakFrom };
	}

	// The terminal's font, size and column-width multiplier, as the app runs them.
	look() {
		const s = settings() ?? {};
		const font = typeof s.font_family === "string" && s.font_family ? s.font_family : typeof s.font === "string" && s.font ? s.font : DEFAULT_FONT;
		const size = Number.isFinite(s.font_size) && s.font_size > 0 ? s.font_size : DEFAULT_FONT_SIZE;
		const multiplier = Number.isFinite(s.terminal_cell_width) && s.terminal_cell_width > 0 ? s.terminal_cell_width : 1;
		return { font, size, multiplier };
	}

	render(cx) {
		const now = Date.now();
		this.renders = (this.renders ?? 0) + 1;
		this.undrawn = 0;
		const p = panes().find((x) => x.pane === props()?.pane);
		if (!p) return div();
		const want = this.read(cx, p, now);
		const wantKey = JSON.stringify({ ...want, model: { ...want.model, nextAt: null } });
		if (wantKey !== this.wantKey || this.force) {
			this.wantKey = wantKey;
			this.want = want;
			this.force = false;
			this.update(cx);
		}
		return this.draw(p);
	}

	// The pieces of a plan, each placed at its x minus `dx` (a bank's or clip's left), keeping those `keep` accepts.
	pieces(plan, dx = 0, dy = 0, keep = () => true) {
		const at = (el, piece) => el.absolute().left(piece.x - dx).top(piece.y - dy).w(piece.w).h(piece.h);
		const out = [];
		for (const b of plan.bgs) if (keep(b)) out.push(at(div(), b).bg(b.color));
		for (const r of plan.rects) if (keep(r)) out.push(at(div(), r).bg(r.color));
		for (const t of plan.texts) {
			if (!keep(t)) continue;
			if (t.ch === MARK) {
				out.push(svg(`${MOD}/plate/mark.svg`).absolute().left(t.x - dx + (t.w - MARK_PX) / 2).top(t.y - dy + (t.h - MARK_PX) / 2).size(MARK_PX).text_color(t.color));
				continue;
			}
			let el = at(h_flex(), t).justify_center().items_center().line_height(`${t.h}px`).text_color(t.color ?? "#ffffff");
			if (t.bold) el = el.font_weight(700);
			out.push(el.child(t.ch));
		}
		return out;
	}

	// A lighting layer: whole when it entered with nothing below it, else one box per bank whose opacity goes from 0
	// (drawn first, unprimed) to 1 after the bank's delay.
	layer(pane, layer) {
		const box = (id) => div().id(id).absolute().top(0).h(HEADER_PX).overflow_hidden();
		if (!layer.schedule) return [box(`dp-${pane}-l${layer.id}`).left(0).size_full().children(this.pieces(layer.plan))];
		return layer.schedule.map((bank, k) => {
			const { x, w } = layer.plan.banks[k];
			return box(`dp-${pane}-l${layer.id}-b${k}`).left(x).w(w)
				.opacity(layer.primed ? 1 : 0)
				.transition("opacity", { duration: bank.duration, delay: bank.delay, easing: "linear" })
				.children(this.pieces(layer.plan, x, 0, (piece) => piece.bank === k));
		});
	}

	// The reveal: the outgoing plate's rows, each a clip on the right whose width goes from the whole header to 0 (60 ms
	// after the row above, 540 ms each), so the new plate under it is wiped in from the left.
	revealRows(pane, reveal) {
		const width = this.width ?? reveal.plan.cols * reveal.plan.cell;
		return Array.from({ length: ROWS }, (_, row) => div().id(`dp-${pane}-r${reveal.id}-${row}`).absolute().right(0)
			.top(ROW_TOPS[row]).h(ROW_HEIGHTS[row]).w(reveal.primed ? 0 : width).overflow_hidden()
			.transition("width", { duration: REVEAL.duration, delay: row * REVEAL.stagger, easing: "linear" })
			.child(div().absolute().right(0).top(0).w(width).h(ROW_HEIGHTS[row]).children(this.pieces(reveal.plan, 0, ROW_TOPS[row], (piece) => piece.row === row))));
	}

	draw(p) {
		const pane = p.pane, shown = this.shown, look = this.look();
		// The probe: a transparent run of the terminal's font whose laid-out width gives its advance.
		const probe = div().id(`dp-${pane}-probe`).absolute().left(0).top(0).flex_none().whitespace_nowrap()
			.font_family(look.font).text_size(look.size).text_color("#00000000").child("0".repeat(PROBE_CHARS))
			.on_size_change((size, cx) => {
				const advance = this.width && size.width >= this.width ? null : size.width / PROBE_CHARS;
				if (advance !== this.advance) { this.advance = advance > 0 ? advance : null; cx.notify(); }
			});
		const root = div().id(`dp-${pane}`).relative().size_full().overflow_hidden().font_family(look.font).text_size(look.size)
			.on_size_change((size, cx) => { if (size.width > 0 && size.width !== this.width) { this.width = size.width; cx.notify(); } })
			.on_hover((hovered, cx) => { this.hovered = hovered; if (!hovered) { this.keyHover = null; this.pressed = null; } cx.notify(); })
			.on_click(() => run("pane.focus", { pane }))
			.child(probe);
		if (!shown) return root; // the first task has not composed yet
		const children = [];
		for (const layer of shown.layers) children.push(...this.layer(pane, layer));
		if (shown.reveal) children.push(...this.revealRows(pane, shown.reveal));
		shown.hits.forEach((hit, i) => {
			const action = KEY_ACTIONS[i];
			const label = action === "zoom" && p.zoomed ? "Unzoom" : KEY_LABELS[action];
			children.push(div().absolute().left(hit.x).top(hit.y).w(hit.w).h(hit.h).id(`dp-${pane}-key-${action}`).cursor_pointer().tooltip(label)
				.on_hover((hovered, cx) => {
					if (hovered) this.keyHover = i;
					else if (this.keyHover === i) { this.keyHover = null; if (this.pressed === i) this.pressed = null; }
					cx.notify();
				})
				.on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.pressed = i; cx.notify(); })
				.on_click((_e, cx) => { cx.stop_propagation(); this.pressed = null; command(action, pane); cx.notify(); }));
		});
		return root.children(children);
	}
}
