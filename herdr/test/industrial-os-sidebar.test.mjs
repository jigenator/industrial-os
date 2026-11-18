// Checks the redesigned sidebar's pure parts: the mod's copy of the design system's sidebar vocabulary and its
// drawn marks, the shared map's world and frames, and the drawings laid under the text. Nothing here opens Herdr.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { markFiles } from "@industrial-os/design-system/foundation/sidebar-vocabulary";
import * as vocabulary from "../mods/industrial-os/vocabulary.js";
import * as source from "@industrial-os/design-system/foundation/sidebar-vocabulary";
import { HALO_PAD, POINTER_REACH, SWEEP_REACH, advance, barGlowSvg, dotGridSvg, dotPitch, fadeSvg, groundDots, groundLight, groundSvg as fieldSvg, haloSvg, lift, litDotsSize, litDotsSvg, rulerSvg, scopeBars, scopeGlowSvg, sidewaysSvg } from "../mods/industrial-os/assets.js";
import { BLEED, CROSSHAIR, DARK, PLATE, VIEW_H, beltAt, beltOf, buildWorld, cameraTarget, edgeSvg, groundSvg, lightSvg, mapFrame, plateCamera, unitAt, veilSvg, zoneOf } from "../mods/industrial-os/map.js";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const MOD = "../mods/industrial-os/";

// An SVG document that a parser will take: one root, every tag closed, no stray values.
function assertSvg(text, name) {
	assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[\d.]+" height="[\d.]+" viewBox="[-\d. ]+">/, name);
	assert.doesNotMatch(text, /NaN|undefined|Infinity|null/, name);
	const open = [];
	for (const [, close, tag, selfClosing] of text.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
		if (close) assert.equal(open.pop(), tag, name);
		else if (!selfClosing) open.push(tag);
	}
	assert.deepEqual(open, [], name);
}

test("vocabulary.js is the design system's sidebar vocabulary through ds/, and marks/ holds exactly its drawn marks", async () => {
	// No values of its own: the one line names the copied file, which droid-plate.test.mjs holds byte for byte to the design system's.
	assert.deepEqual((await read(`${MOD}vocabulary.js`)).split("\n").filter((line) => line && !line.startsWith("//")), ['export * from "./ds/foundation/sidebar-vocabulary.mjs";']);
	assert.equal(await read(`${MOD}ds/foundation/sidebar-vocabulary.mjs`), await read("../../design-system/foundation/sidebar-vocabulary.mjs"));
	assert.deepEqual(Object.keys(vocabulary), Object.keys(source));
	assert.deepEqual(vocabulary.SIDEBAR_COLORS, source.SIDEBAR_COLORS);
	const files = markFiles();
	assert.deepEqual((await readdir(new URL(`${MOD}marks/`, import.meta.url))).sort(), files.map(([name]) => name).sort());
	for (const [name, text] of files) assert.equal(await read(`${MOD}marks/${name}`), text, name);
});

// Missions in the shape model.js builds, with only what the map reads.
const unit = (id, code, tone, extra = {}) => ({ id, code, tone, designation: `DRD-${id}`, status: "ON TASK", name: `unit ${id}`, focused: false, units: null, ...extra });
const missions = () => [
	{ id: "s1", tabs: [
		{ id: "t1", ref: "A01", name: "Sidebar", status: "active", units: [unit("a", "WRK", "working", { focused: true, units: { count: 3 } }), unit("b", "IDL", "idle")] },
		{ id: "t2", ref: "A02", name: "Docs", status: "secure", units: [unit("c", "IDL", "idle")] },
	] },
	{ id: "s2", tabs: [{ id: "t3", ref: "B01", name: "Rollback", status: "halted", units: [unit("d", "BLK", "blocked")] }] },
	{ id: "s3", tabs: [] },
];

test("the map's world: one belt a space, a zone a tab on the lattice, the same every time", () => {
	const world = buildWorld(missions());
	assert.deepEqual([world.W, world.H, world.units.size], [buildWorld(missions()).W, buildWorld(missions()).H, 4]);
	assert.equal(buildWorld(missions()).land, world.land); // the land is built once for a map size
	const zone = zoneOf(0, 0);
	assert.deepEqual(zone, zoneOf(0, 0));
	assert.deepEqual([zone.x % 8, zone.y % 4, zone.w % 8, zone.h % 4], [0, 0, 0, 0]);
	// Each space's zones lie in its own belt, inside the map.
	for (const [mi, m] of world.missions.entries()) for (const ti of m.tabs.keys()) {
		const z = zoneOf(mi, ti), b = beltOf(world, mi);
		assert.ok(z.x >= 0 && z.x + z.w <= world.W && z.y >= b.y && z.y + z.h <= b.y + b.h, z.key);
	}
	assert.ok(beltOf(world, 1).y > beltOf(world, 0).y);
});

test("units: a resting one stands at its station inside its zone; a working one patrols near it", () => {
	const world = buildWorld(missions());
	assert.equal(unitAt(world, "nobody", 0), null);
	for (const id of ["a", "b", "c", "d"]) {
		const e = world.units.get(id), z = zoneOf(e.mi, e.ti), [x, y] = unitAt(world, id, 12.5, true);
		assert.ok(x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h, id);
	}
	assert.deepEqual(unitAt(world, "b", 3), unitAt(world, "b", 300)); // idle: it does not move
	const places = new Set(Array.from({ length: 40 }, (_, k) => unitAt(world, "a", k * 0.5).join()));
	assert.ok(places.size > 4);
	const rest = unitAt(world, "a", 0, true);
	for (let k = 0; k < 40; k++) { const [x, y] = unitAt(world, "a", k * 0.5); assert.ok(Math.abs(x - rest[0]) <= 13 && Math.abs(y - rest[1]) <= 10); }
});

test("cameras: a space's window rests on what is hovered, else focused, else most urgent, inside its belt; the plate keeps its unit under the crosshair", () => {
	const world = buildWorld(missions()), vw = 264 + 2 * BLEED, vh = VIEW_H + 2 * BLEED, view = { vw, vh };
	const centred = (id, [cx, cy]) => { const [x, y] = unitAt(world, id, 0, true), b = beltOf(world, world.units.get(id).mi); return cx === Math.max(0, Math.min(world.W - vw, x - vw / 2)) && cy === Math.max(b.y, Math.min(b.y + b.h - vh, y - vh / 2)); };
	assert.ok(centred("a", cameraTarget(world, 0, view))); // the focused unit
	assert.ok(centred("b", cameraTarget(world, 0, { ...view, hover: "b" })));
	assert.ok(centred("d", cameraTarget(world, 1, view)));
	assert.ok(centred("d", cameraTarget(world, 1, { ...view, hover: "a" }))); // a unit hovered in another space moves nothing here
	const [zx] = cameraTarget(world, 0, { ...view, hoverZone: 1 }), z = zoneOf(0, 1);
	assert.equal(zx, Math.max(0, Math.min(world.W - vw, z.x + z.w / 2 - vw / 2)));
	for (const mi of [0, 1, 2]) { const [, cy] = cameraTarget(world, mi, view), b = beltOf(world, mi); assert.ok(cy >= b.y && cy + vh <= b.y + b.h, `space ${mi}`); }
	for (const t of [0, 1.7, 9.3]) {
		const cam = plateCamera(world, "a", t), [x, y] = unitAt(world, "a", t);
		assert.deepEqual([x - cam.cx, y - cam.cy], CROSSHAIR);
	}
	assert.equal(plateCamera(world, "nobody", 0), null);
	// While the plate pans from one space to another, the belt under the crosshair has ground for the whole window.
	for (let cy = 0; cy + 111 <= world.H; cy += 7) {
		const b = beltOf(world, beltAt(world, cy + CROSSHAIR[1]));
		assert.ok(cy >= b.y && cy + 111 <= b.y + b.h, `camera at ${cy}`);
	}
	assert.deepEqual([beltAt(world, -50), beltAt(world, 1e6)], [0, world.missions.length - 1]);
});

test("frames: still drawings keyed for reuse plus dots, the same for the same instant; the plate names only its unit", () => {
	const world = buildWorld(missions()), vw = 284, vh = 94;
	const [cx, cy] = cameraTarget(world, 0, { vw, vh }), view = { mi: 0, cx, cy, vw, vh, pal: DARK, hover: null, hoverZone: null };
	const frame = mapFrame(world, view, 4.2);
	const strip = (f) => ({ sprites: f.sprites.map(({ make, ...rest }) => rest), dots: f.dots });
	assert.deepEqual(strip(frame), strip(mapFrame(world, view, 4.2)));
	const keys = frame.sprites.map((s) => s.key);
	assert.ok(keys.includes("mk/d/working") && keys.some((k) => k.startsWith("z/d/0.0/")));
	// A key names one drawing: the same key always writes the same document, and every document parses.
	const written = new Map();
	for (const t of [0, 0.8, 4.2, 6.5, 23.4]) for (const v of [view, { ...view, hover: "b" }, { plate: true, watch: "a", ...plateCamera(world, "a", t), vw: 300, vh: 111, pal: PLATE }]) {
		for (const s of mapFrame(world, v, t).sprites) {
			const text = s.make();
			assertSvg(text, s.key);
			if (written.has(s.key)) assert.equal(written.get(s.key), text, s.key);
			written.set(s.key, text);
			assert.ok(Number.isFinite(s.x + s.y + s.w + s.h + s.o), s.key);
		}
		for (const d of mapFrame(world, v, t).dots) assert.ok(Number.isFinite(d.x + d.y + d.s + d.o) && /^#[0-9a-f]{6}$/.test(d.c));
	}
	// The hovered unit is bracketed: eight more bars than the same frame without it.
	assert.equal(mapFrame(world, { ...view, hover: "b" }, 4.2).dots.length, frame.dots.length + 8);
	// Its three subagents are three detachments in the map's acid.
	assert.ok(frame.dots.filter((d) => d.c === DARK.working && d.s === 2 && d.o === 1).length >= 3);
	const plate = mapFrame(world, { plate: true, watch: "a", ...plateCamera(world, "a", 4.2), vw: 300, vh: 111, pal: PLATE }, 4.2);
	assert.equal(plate.sprites.filter((s) => s.key.startsWith("tag/")).length, 1);
	assert.ok(plate.sprites.every((s) => !s.key.startsWith("zn/") && !s.key.startsWith("zs/")));
	for (const [name, text] of [["ground", groundSvg(world, 0, DARK)], ["plate ground", groundSvg(world, 1, PLATE)], ["edge", edgeSvg(284, 94, 3, "#090a0c")], ["veil", veilSvg(300, 111)], ["light", lightSvg(300, 111)]]) assertSvg(text, name);
	assert.notEqual(edgeSvg(284, 94, 3, "#090a0c"), edgeSvg(284, 94, 4, "#090a0c")); // the edge shimmers
});

test("drawings under the text: sized to what they light, whole dots, well-formed", () => {
	assert.equal(advance(11), 6.6);
	const size = (text) => text.match(/^<svg[^>]* width="([\d.]+)" height="([\d.]+)"/).slice(1).map(Number);
	assert.deepEqual(size(haloSvg("WRK", "#c0fe04")), [3 * 6.6 + 2 * HALO_PAD, 17 + 2 * HALO_PAD]);
	assert.deepEqual(size(barGlowSvg(3, 40, "#c0fe04", { radius: 2 })), [3 + 2 * HALO_PAD, 40 + 2 * HALO_PAD]);
	assert.match(haloSvg('a<b&"c"', "#ffffff"), />a&lt;b&amp;&quot;c&quot;<\/text>/);
	// A whole number of cells about 4 px wide fits each way.
	for (const [w, h] of [[272, 35], [272, 117], [300, 24], [3, 3]]) {
		const [px, py] = dotPitch(w, h);
		assert.ok(Number.isInteger(Math.round((w / px) * 1e6) / 1e6) && Number.isInteger(Math.round((h / py) * 1e6) / 1e6), `${w}x${h}`);
		assert.ok(w < 4 || (px >= 4 && px < 8 && py >= 4 && py < 8));
		const [lw, lh] = litDotsSize(w, h);
		assert.deepEqual(size(litDotsSvg(w, h, "#ffffff", 0.2)), [Math.round(lw * 100) / 100, Math.round(lh * 100) / 100]);
	}
	assert.equal(scopeBars(100, 40).length, 8);
	for (const [x, y, w, h] of scopeBars(100, 40)) assert.ok(x >= 0 && y >= 0 && x + w <= 100 && y + h <= 40);
	const documents = {
		halo: haloSvg("ON TASK", "#c0fe04", { size: 10, weight: 400, line: 15 }), glow: barGlowSvg(7, 13, "#c0fe04"), "strong glow": barGlowSvg(3, 33, "#c0fe04", { radius: 2, strong: true }), dots: dotGridSvg(272, 35, "#ffffff", 0.17),
		lit: litDotsSvg(272, 35, "#ffffff", 0.2), scope: scopeGlowSvg(274, 37, "#c0fe04"), field: fieldSvg(300, 863), ruler: rulerSvg(264), side: sidewaysSvg("HIDE", "#000000"),
		...Object.fromEntries(["right", "left", "up", "down"].map((to) => [`fade ${to}`, fadeSvg(26, 17, "#090a0c", to)])),
	};
	for (const [name, text] of Object.entries(documents)) assertSvg(text, name);
	// The gutter bar's light is a lamp: more of it than a plain bar's, in the same box.
	assert.deepEqual(size(barGlowSvg(3, 33, "#c0fe04", { strong: true })), size(barGlowSvg(3, 33, "#c0fe04")));
	assert.ok(barGlowSvg(3, 33, "#c0fe04", { strong: true }).split("<rect").length > barGlowSvg(3, 33, "#c0fe04").split("<rect").length);
	// Its light fades out inside its margin, so it has no edge: three deviations of the widest blur fit.
	for (const deviation of barGlowSvg(3, 33, "#c0fe04", { strong: true }).match(/stdDeviation="[\d.]+"/g).map((m) => Number(m.slice(14, -1)))) assert.ok(1 + 3 * deviation <= HALO_PAD + 1, deviation);
});

test("the ground's light: dots at rest are held back; near the pointer, on its pulse and under the sweep they come up", () => {
	const dots = groundDots(300, 863), at = (x, y) => dots.reduce((best, d) => (Math.hypot(d.x - x, d.y - y) < Math.hypot(best.x - x, best.y - y) ? d : best));
	// Every fourth column from the third cell and every second row from the second: 8.4 × 18.5 px cells.
	assert.deepEqual([dots[0].x, dots[0].y, dots[0].major], [21, 27.75, true]);
	assert.ok(dots.every((d) => d.x < 300 && d.y < 863) && dots.filter((d) => d.major).length < dots.length / 10);
	assert.equal(fieldSvg(300, 863).split("<circle").length - 1, dots.length);
	assert.match(fieldSvg(300, 863), new RegExp(`fill-opacity="${vocabulary.SIDEBAR_ALPHA.groundDotRest}"`));
	assert.equal(lift("#2a2b30", 26), "#44454a");
	assert.equal(lift("#f0f0f0", 60), "#ffffff");
	// Nothing lit without a pointer or a sweep.
	assert.deepEqual(groundLight(dots), []);
	assert.deepEqual(groundLight(dots, { pointer: { x: 150, y: 400 }, strength: 0 }), []);
	// Near the pointer: only within its reach, brighter the closer, and nothing moves.
	const near = groundLight(dots, { pointer: { x: 150, y: 400 }, strength: 1 });
	assert.ok(near.length > 4 && near.every((d) => Math.hypot(d.x - 150, d.y - 400) < POINTER_REACH && /^#[0-9a-f]{6}$/.test(d.color) && d.alpha > vocabulary.SIDEBAR_ALPHA.groundDotRest && d.alpha <= 1));
	assert.ok(near.every((d) => dots.some((o) => o.x === d.x && o.y === d.y)));
	const closest = at(150, 400), found = near.find((d) => d.x === closest.x && d.y === closest.y);
	assert.equal(found.alpha, 1);
	assert.ok(groundLight(dots, { pointer: { x: 150, y: 400 }, strength: 0.3 }).length <= near.length);
	// The pulse lights a ring further out than the pointer reaches, and fades as it grows.
	const ring = groundLight(dots, { pointer: { x: 150, y: 400 }, strength: 1, pulse: 0.9 });
	assert.ok(ring.some((d) => Math.hypot(d.x - 150, d.y - 400) > POINTER_REACH));
	assert.deepEqual(groundLight(dots, { pointer: { x: 150, y: 400 }, strength: 1, pulse: 1.2 }), near);
	// The sweep lights the rows around its line.
	const swept = groundLight(dots, { sweep: 400 });
	assert.ok(swept.length > 0 && swept.every((d) => Math.abs(d.y - 400) < SWEEP_REACH));
});
