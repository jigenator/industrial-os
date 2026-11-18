// A simulation of the app around a mod's views: a clock its timers run on (Date.now reads it), views re-rendered
// only when notified, as gpui does, and the rendered tree as plain data. Events are given by element id.
import { current } from "./kit.mjs";
import { command, state } from "./herdr.mjs";

function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Sim {
	constructor({ start = Date.UTC(2026, 10, 18, 9, 0, 0), seed = 7 } = {}) {
		this.start = start; this.now = start;
		this.timers = []; this.entities = []; this.live = new Map();
		this.real = { now: Date.now, random: Math.random, storage: globalThis.localStorage };
		Date.now = () => this.now;
		Math.random = seeded(seed);
		globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };
		state.changed = () => { for (const e of this.entities) e.dirty = true; };
	}

	/** Gives the clock, the dice and localStorage back. */
	close() {
		Date.now = this.real.now; Math.random = this.real.random; globalThis.localStorage = this.real.storage;
		state.changed = () => {};
	}

	/** A view as the app makes one: `props` is what the layout gives it (read through `props()`), `init` what a parent passes. */
	create(Class, init, props) {
		const entity = { view: new Class(), tree: null, dirty: true, live: true, __entity: true, release: () => { entity.live = false; } };
		const sim = this;
		entity.cx = {
			notify: (target) => { (target ?? entity).dirty = true; },
			stop_propagation: () => { sim.stopped = true; },
			new: (C, p) => sim.create(C, p),
			spawn: (fn) => { Promise.resolve().then(() => fn(entity.cx)).catch((e) => { sim.errors.push(e); }); return { cancel() {} }; },
			timer: { every: (ms, fn) => sim.timer(entity, ms, fn, true), after: (ms, fn) => sim.timer(entity, ms, fn, false) },
		};
		this.entities.push(entity);
		if (props !== undefined) state.props = props;
		entity.view.init?.(init, entity.cx);
		return entity;
	}

	errors = [];

	timer(entity, ms, fn, repeat) {
		const t = { due: this.now + ms, ms: Math.max(1, ms), fn, repeat, entity, live: true, cancel() { t.live = false; } };
		this.timers.push(t);
		return t;
	}

	// Lets the mod's promises run.
	async settle() { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); }

	/** Runs the clock to `to` ms since the start, firing every timer due on the way, in order. */
	async advance(to) {
		const until = this.start + to;
		for (;;) {
			let next = null;
			for (const t of this.timers) if (t.live && t.entity.live && t.due <= until && (!next || t.due < next.due)) next = t;
			if (!next) break;
			this.now = Math.max(this.now, next.due);
			if (next.repeat) next.due += next.ms; else next.live = false;
			next.fn(next.entity.cx);
			await this.settle();
		}
		this.now = until;
		this.timers = this.timers.filter((t) => t.live && t.entity.live);
	}

	render() {
		for (let pass = 0; pass < 4; pass++) {
			const dirty = this.entities.filter((e) => e.live && e.dirty);
			if (!dirty.length) break;
			for (const e of dirty) { e.dirty = false; current.entity = e; e.tree = e.view.render(e.cx); }
		}
		current.entity = null;
		this.entities = this.entities.filter((e) => e.live);
	}

	/** What a view draws now, as plain data: every element's kind, id, style, motion, handler names and children. */
	snapshot(entity) {
		this.render();
		const walk = (item, owner) => {
			if (item === null || item === undefined || item === false) return null;
			if (typeof item === "string" || typeof item === "number") return String(item);
			if (!item.__node) return { view: walk(item.tree, item) }; // a nested view, where it is placed
			const n = item.__node, out = { kind: n.kind };
			if (n.arg !== undefined) out.arg = n.arg;
			if (n.id) out.id = n.id;
			if (Object.keys(n.style).length) out.style = n.style;
			if (n.hover) out.hover = n.hover;
			if (n.active) out.active = n.active;
			if (n.transitions.length) out.transitions = n.transitions;
			if (n.loop) out.loop = n.loop;
			if (n.frames) out.frames = n.frames;
			const handlers = Object.keys(n.handlers).sort();
			if (handlers.length) { out.handlers = handlers; if (n.id) this.live.set(n.id, { node: n, cx: (n.owner ?? owner)?.cx }); }
			const kids = n.kids.map((kid) => walk(kid, owner)).filter((kid) => kid !== null);
			if (kids.length) out.kids = kids;
			return out;
		};
		return walk(entity, entity);
	}

	/** Calls one handler of the element with that id, as last drawn. */
	fire(id, handler, ...args) {
		const h = this.live.get(id);
		if (!h?.node.handlers[handler]) throw new Error(`no ${handler} on ${id}`);
		this.stopped = false;
		h.node.handlers[handler](...args, h.cx);
	}

	key(name) { command(name); }
}

/** Every text an element tree shows, in order. */
export function texts(tree, out = []) {
	if (typeof tree === "string") out.push(tree);
	else if (tree?.view) texts(tree.view, out);
	else for (const kid of tree?.kids ?? []) texts(kid, out);
	return out;
}

/** Every element of a tree for which `match` holds. */
export function find(tree, match, out = []) {
	if (!tree || typeof tree === "string") return out;
	if (tree.view) return find(tree.view, match, out);
	if (match(tree)) out.push(tree);
	for (const kid of tree.kids ?? []) find(kid, match, out);
	return out;
}
