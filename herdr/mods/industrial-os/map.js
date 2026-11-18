// ONE MAP. Every space, tab and pane takes place on a single shared map: a space is a belt of it, a tab is a zone in
// that belt, a pane is a unit in its zone. Everything on it is a function of the missions and the clock, so every
// window shows the same moment. Pure: no gpui-kit or herdr import. It returns SVG documents for what stands still
// (the ground, the zones, the tags, the dissolving edge) and, each frame, where those and the moving dots go;
// main.js writes the documents to files and places them.
import { FONT, blur, esc, r2, svg } from "./assets.js";
import { ACTIVE, RANK } from "./missions.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C, ZONE_STATUS } from "./vocabulary.js";

/** A space's window: four terminal rows tall, drawn `BLEED` px past its place on every side. */
export const VIEW_H = 74, BLEED = 10;
/** The crosshair on the plate: the watched unit stays under it. */
export const CROSSHAIR = [178.5, 83.5];
/** Edge frames per shimmer loop, and how long each shows. */
export const SHIMMER = 12, SHIMMER_MS = 150;

const RISE = 1.5, CELLW = 170, BELT = 190, MX = 170, MY = 40, LX = 4, LY = 2, LIFT = 3, TOP = 17;
// How far past its belt a space's ground is drawn, so a window near the belt's edge still has ground.
const REACH = 96;
// A sprite's clear margin, for its halo.
const PAD = 12;

const hash = (text) => { let h = 7; for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0; return h; };
const rs = (key) => (hash(`io-map#${key}`) % 1000) / 1000;
// Exposure: what is drawn is added back over itself out of focus, once as a tight halo and once as a wide one, so
// whatever is lit bleeds light and comes out brighter than it was drawn, as a hologram does. Only on the dark board.
// `w` × `h` is the whole drawing: the light may reach its edge.
const exposed = (lit, w, h, inner) => (lit
	? `<defs><filter id="x" filterUnits="userSpaceOnUse" x="0" y="0" width="${r2(w)}" height="${r2(h)}" color-interpolation-filters="sRGB">`
		+ '<feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b"/>'
		+ '<feComposite in="SourceGraphic" in2="a" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="s"/>'
		+ `<feComposite in="s" in2="b" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter></defs><g filter="url(#x)">${inner}</g>`
	: inner);
const square = (x, y, s) => `M${r2(x)} ${r2(y)}h${s}v${s}h-${s}z`;

// The map's colors on its dark board and printed on the plate. A working unit on paper is ink: paper does not glow.
export const DARK = Object.freeze({
	zone: C.mapZone, halt: C.mapHalt, working: C.mapAcid, blocked: C.mapCritical, done: C.mapInk, idle: C.mapDim, unknown: C.mapDim,
	back: C.mapBack, backAlpha: A.mapBack, road: C.mapRoad, label: C.mapLabel, name: C.mapName, on: C.black, mark: C.white, ground: C.white, lit: true,
});
export const PLATE = Object.freeze({
	zone: C.plateZone, halt: C.orange, working: C.ink, blocked: C.orange, done: C.ink, idle: C.plateDim, unknown: C.plateDim,
	back: C.paper, backAlpha: A.plateBack, road: C.plateRoad, label: C.plateLabel, name: C.plateName, on: C.paper, mark: C.ink, ground: C.ink, lit: false,
});

// A zone's place and size: every zone its own, on the dot lattice, placed loosely in its cell of the belt.
const zones = new Map();
export function zoneOf(mi, ti) {
	const key = `${mi}.${ti}`;
	let z = zones.get(key);
	if (z) return z;
	const q = (x) => rs(`z${key}.${x}`), col = ti >> 1, row = (ti & 1) ^ (rs(`f${mi}.${col}`) < 0.5 ? 1 : 0);
	const w = Math.round((104 + q(3) * 46) / 8) * 8, h = Math.round((46 + q(4) * 16) / 4) * 4;
	z = {
		key, w, h,
		x: Math.round((MX + col * CELLW + (CELLW - w) / 2 + (q(1) - 0.5) * Math.min(44, CELLW - w - 8)) / 8) * 8,
		y: Math.round((MY + mi * BELT + row * (BELT / 2) + (BELT / 2 - h) / 2 + (q(2) - 0.5) * 22) / 4) * 4,
	};
	zones.set(key, z);
	return z;
}

// The fixed land for one map size: its hills, and its roads as beads about 4 px apart. Built once per size.
const lands = new Map();
function landOf(W, H, belts, cols) {
	const key = `${W}x${H}`;
	let land = lands.get(key);
	if (land) return land;
	const peaks = [];
	for (let gy = 0; gy * 170 < H; gy++) for (let gx = 0; gx * 170 < W; gx++) for (let k = 0; k < 2; k++) {
		const q = (x) => rs(`p${gx}.${gy}.${k}.${x}`);
		peaks.push({ x: (gx + q(1)) * 170, y: (gy + q(2)) * 170, a: (q(3) < 0.22 ? -1 : 1) * (4 + q(4) * 6), sx: 30 + q(5) * 80, sy: 14 + q(6) * 44 });
	}
	const at = (a, b, c, e, u) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - e) * u * u + (3 * b - a - 3 * c + e) * u * u * u);
	const curve = (pts) => {
		const out = [pts[0]];
		let acc = 0, prev = pts[0];
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
			for (let u = 0.02; u <= 1; u += 0.02) {
				const p = [at(p0[0], p1[0], p2[0], p3[0], u), at(p0[1], p1[1], p2[1], p3[1], u)];
				acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
				prev = p;
				if (acc >= 4) { out.push(p); acc = 0; }
			}
		}
		return out;
	};
	// One road along each row of zones and between rows, and one down each column, each wandering.
	const roads = [];
	for (let k = 0; k <= belts * 2; k++) {
		const pts = [];
		for (let x = -40; x <= W + 170; x += 170) pts.push([x, MY + k * (BELT / 2) + (rs(`rh${k}.${x}`) - 0.5) * 84]);
		roads.push(curve(pts));
	}
	for (let k = 0; k <= cols; k++) {
		const pts = [];
		for (let y = -40; y <= H + 190; y += 190) pts.push([MX + k * CELLW + (rs(`rv${k}.${y}`) - 0.5) * 96, y]);
		roads.push(curve(pts));
	}
	// about one droid a road
	const droids = Array.from({ length: roads.length }, (_, i) => ({ road: Math.floor(rs(`dr${i}`) * roads.length), v: 3.5 + rs(`dv${i}`) * 3, ph: rs(`dp${i}`) * 400, dir: rs(`dd${i}`) < 0.5 ? 1 : -1 }));
	land = { key, peaks, roads, droids };
	lands.set(key, land);
	return land;
}

/** The world for these missions (model.js's): its size, its land and where each unit is listed. */
export function buildWorld(missions) {
	const cols = Math.max(4, ...missions.map((m) => Math.ceil(m.tabs.length / 2)));
	const W = MX * 2 + cols * CELLW, H = MY * 2 + missions.length * BELT;
	const units = new Map();
	missions.forEach((m, mi) => m.tabs.forEach((tab, ti) => tab.units.forEach((unit, ai) => units.set(unit.id, { mi, ti, ai, n: tab.units.length, unit, tab }))));
	return { W, H, cols, missions, units, land: landOf(W, H, missions.length, cols) };
}

// A unit stands in its zone; while it works it patrols a small loop there.
const MOVES = { WRK: 0.5, SUB: 0.5, RUN: 0.28 };
/** Where a unit is at `t` seconds; `rest` gives its station, where it stands when it does not work. */
export function unitAt(world, id, t, rest = false) {
	const e = world.units.get(id);
	if (!e) return null;
	const z = zoneOf(e.mi, e.ti), h = hash(id), slot = z.w / (e.n + 1), w = rest ? 0 : MOVES[e.unit.code] ?? 0;
	let x = z.x + z.w * 0.2 + slot * 0.6 * (e.ai + 1) + ((h % 7) - 3), y = z.y + z.h * (0.4 + ((h >>> 4) % 20) / 100);
	if (w) {
		x += Math.min(12, slot * 0.25) * Math.sin(t * w + (h % 7));
		y += z.h * 0.12 * Math.sin(t * w * 1.37 + (h % 5));
	}
	return [Math.round(x), Math.round(y)];
}

/** The part of the map a space's ground image covers: its belt and `REACH` px above and below, the map's full width. */
/** The space whose belt a height on the map is in; past either end, the nearest. */
export const beltAt = (world, y) => Math.max(0, Math.min(world.missions.length - 1, Math.floor((y - MY) / BELT)));
export const beltOf = (world, mi) => {
	const y0 = Math.max(0, MY + mi * BELT - REACH), y1 = Math.min(world.H, MY + (mi + 1) * BELT + REACH);
	return { x: 0, y: y0, w: world.W, h: y1 - y0 };
};

// Printed three passes deep, the ground's faint dots hold on paper.
const deep = (alpha) => 1 - (1 - alpha) ** 3;

/** The ground of one belt: the dot floor (a 2:1 isometric lattice), the contours, each at its own height, the roads. */
export function groundSvg(world, mi, pal) {
	const b = beltOf(world, mi), { peaks, roads } = world.land, ink = pal.ground, a = pal.lit ? (v) => v : deep;
	let floor = "";
	for (let y = Math.ceil(b.y / 6) * 6; y < b.y + b.h; y += 6) for (let x = ((y / 6) & 1) * 12; x < b.w; x += 24) floor += square(x, y - b.y, 1);
	// The heightfield on a 2.5 px lattice, with room above and below for contours standing off the ground.
	const st = 2.5, lift = 24, j0 = Math.floor((b.y - lift) / st), j1 = Math.ceil((b.y + b.h + lift) / st), fc = Math.ceil(b.w / st) + 1, fr = j1 - j0 + 1, f = new Float32Array(fc * fr);
	for (let j = 0; j < fr; j++) for (let i = 0; i < fc; i++) {
		const x = i * st, y = (j + j0) * st;
		f[j * fc + i] = 0.5 * (0.6 * Math.sin(x * 0.021 + y * 0.047) + 0.4 * Math.sin(x * 0.057 - y * 0.031 + 1.3));
	}
	for (const p of peaks) {
		const i0 = Math.max(0, Math.floor((p.x - p.sx * 2.7) / st)), i1 = Math.min(fc - 1, Math.ceil((p.x + p.sx * 2.7) / st));
		const ja = Math.max(0, Math.floor((p.y - p.sy * 2.7) / st) - j0), jb = Math.min(fr - 1, Math.ceil((p.y + p.sy * 2.7) / st) - j0);
		for (let j = ja; j <= jb; j++) {
			const ey = p.a * Math.exp(-((((j + j0) * st - p.y) / p.sy) ** 2));
			for (let i = i0; i <= i1; i++) f[j * fc + i] += ey * Math.exp(-(((i * st - p.x) / p.sx) ** 2));
		}
	}
	let line = "", index = "";
	for (let j = 0; j < fr - 1; j++) for (let i = 0; i < fc - 1; i++) {
		const p = Math.floor(f[j * fc + i] / 1.4), q = Math.floor(f[j * fc + i + 1] / 1.4), e = Math.floor(f[(j + 1) * fc + i] / 1.4);
		if (p === q && p === e) continue;
		const lv = Math.max(p, q, e), y = (j + j0) * st - lv * RISE - b.y;
		if (y < -2 || y > b.h) continue;
		if (lv % 4 === 0) index += square(i * st, y, 1.3); else line += square(i * st, y, 1.3);
	}
	let road = "";
	for (const r of roads) for (let i = 0; i < r.length; i += 2) {
		const y = r[i][1] - b.y;
		if (y > -2 && y < b.h && r[i][0] > -2 && r[i][0] < b.w) road += square(r[i][0] - 0.75, y - 0.75, 1.5);
	}
	const marks = `<path d="${line}" fill="${ink}" fill-opacity="${r2(a(0.12))}"/><path d="${index}" fill="${ink}" fill-opacity="${r2(a(0.22))}"/><path d="${road}" fill="${ink}" fill-opacity="${r2(a(0.2))}"/>`;
	return svg(b.w, b.h, `<path d="${floor}" fill="${ink}" fill-opacity="${r2(a(0.06))}"/>${exposed(pal.lit, b.w, b.h, marks)}`);
}

// A zone has no outline and no straight side: a patch of ground with a wandering edge, blanketed by a dot matrix on
// the floor's lattice. A column of dots stands at each lattice point, taller towards the middle, and the edge is
// thinned by an ordered dither. Three settled frames (`phase` 0–2) make it stir.
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function blanket(z, phase) {
	const { w, h } = z, q = (x) => rs(`b${z.key}.${x}`) * 6.283, paths = new Map();
	for (let j = 0; j * LY <= h; j++) for (let i = 0; i * 8 + (j & 1) * LX <= w; i++) {
		const px = i * 8 + (j & 1) * LX, py = j * LY, u = (px - w / 2) / (w / 2), v = (py - h / 2) / (h / 2), th = Math.atan2(v, u);
		const edge = 0.74 * (1 + 0.17 * Math.sin(2 * th + q(1)) + 0.13 * Math.sin(3 * th + q(2)) + 0.08 * Math.sin(5 * th + q(3))), dd = 1 - Math.hypot(u, v) / edge;
		if (dd <= 0) continue;
		if ((B4[(j & 3) * 4 + (Math.floor(px / LX) & 3)] + 0.5) / 16 >= (dd < 0.13 ? 0.34 : dd < 0.28 ? 0.7 : 1)) continue;
		const n = Math.min(4, Math.floor(dd * 8)) + (Math.sin(i * 0.9 + j * 1.7 + phase * 2.1) > 0.5 ? 1 : 0);
		for (let k = 0; k <= n; k++) {
			const alpha = k === n ? 0.74 : r2(0.12 + k * 0.06);
			paths.set(alpha, (paths.get(alpha) ?? "") + square(PAD + px, PAD + TOP + py - k * LIFT, 1.5));
		}
	}
	return [...paths].map(([alpha, d]) => `<path d="${d}" fill-opacity="${alpha}"/>`).join("");
}
/** A zone sprite's box around its zone: `PAD` clear on every side, and `TOP` above for its tallest columns. */
export const zoneBox = (z) => ({ x: z.x - PAD, y: z.y - TOP - PAD, w: z.w + 2 + 2 * PAD, h: z.h + TOP + 2 + 2 * PAD });
/** One settled frame of a zone's dot matrix, in `color`; `lit` adds its light. */
export function zoneSvg(z, color, phase, lit) {
	const b = zoneBox(z);
	return svg(b.w, b.h, exposed(lit, b.w, b.h, `<g fill="${color}">${blanket(z, phase)}</g>`));
}
/** On the plate the watched unit's zone has its dot matrix exposed in acid: the same dots out of focus, as light on paper. */
export function zoneGlowSvg(z) {
	const b = zoneBox(z), wide = '<use href="#m" filter="url(#b)"/>', tight = '<use href="#m" filter="url(#a)"/>';
	return svg(b.w, b.h, `<defs>${blur(1.5, "a", 50)}${blur(5, "b", 50)}<g id="m" fill="${C.light}">${blanket(z, 0)}</g></defs>${wide.repeat(5)}${tight.repeat(2)}`);
}

/** A unit's marker, centred in a `MARKER` px box: its state as a shape, on its own small board. */
export const MARKER = 34;
export function markerSvg(tone, pal) {
	const c = MARKER / 2, color = pal[tone];
	const diamond = (r) => `M${c} ${c - r}L${c + r} ${c}L${c} ${c + r}L${c - r} ${c}z`;
	const shape = tone === "working" ? `<path d="${diamond(3.6)}" fill="${color}"/>`
		: tone === "blocked" ? `<path d="${diamond(4)}" fill="none" stroke="${color}" stroke-width="1.2"/><rect x="${c - 1}" y="${c - 1}" width="2" height="2" fill="${color}"/>`
		: tone === "done" ? `<rect x="${c - 2.5}" y="${c - 2.5}" width="5" height="5" fill="${color}"/>`
		: `<circle cx="${c}" cy="${c}" r="2.6" fill="none" stroke="${color}" stroke-width="1.2"/>`;
	return svg(MARKER, MARKER, `<rect x="${c - 5}" y="${c - 5}" width="10" height="10" fill="${pal.back}" fill-opacity="${pal.backAlpha}"/>${exposed(pal.lit, MARKER, MARKER, shape)}`);
}
/** A road droid, in the road's color. */
export const droidSvg = (pal) => svg(8, 8, `<path d="M4 1.4L6.6 4L4 6.6L1.4 4z" fill="${pal.road}" fill-opacity="0.95"/>`);
/** A flyer: an arrowhead pointing right. */
export const flyerSvg = (pal) => svg(10, 8, `<path d="M9 4L2 1L4 4L2 7z" fill="${pal.road}"/>`);

const CH8 = 4.85, CH7 = 4.22;
const text = (x, y, size, fill, content) => `<text x="${r2(x)}" y="${r2(y)}" font-family="${FONT}" font-size="${size}" font-weight="800" fill="${fill}">${esc(content)}</text>`;
const board = (x, y, w, h, pal, fill, alpha = 1) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${fill ?? pal.back}" fill-opacity="${fill ? alpha : pal.backAlpha}"/>`;
// Exposure multiplies a filled plate far more than it does thin strokes, and burns it out. Drawn this much weaker, a
// plate lands on its colour as text does: the map's acid comes out as the theme's accent.
const PLATE_EXPOSED = 0.78;
const cut = (name, max) => (name.length > max ? `${name.slice(0, max - 1)}…` : name).toUpperCase();

/** A unit's tag: designation and status on one line, its name under them. `left` sets it right-aligned, for a tag to the unit's left. */
export function tagOf(unit, pal, { hover = false, left = false } = {}) {
	const dg = unit.designation, word = unit.status, name = cut(unit.name, 18), color = pal[unit.tone];
	const dw = dg.length * CH8 + 5, sw = word.length * CH8 + 5, nw = name.length * CH8 + 5, w = Math.max(dw + 2 + sw, nw), x1 = left ? w - (dw + 2 + sw) : 0, nx = left ? w - nw : 0;
	// Under the pointer its status is printed on a plate of its own colour. Plate and print are exposed together, so
	// the plate's light falls across the print and the two read as one lit block.
	const status = board(PAD + x1 + dw + 2, PAD, sw, 10, pal, hover ? color : null, pal.lit ? PLATE_EXPOSED : 1), said = text(PAD + x1 + dw + 4.5, PAD + 8, 8, hover ? pal.on : color, word);
	const boards = board(PAD + x1, PAD, dw, 10, pal) + (hover ? "" : status) + board(PAD + nx, PAD + 10, nw, 10, pal);
	const words = text(PAD + x1 + 2.5, PAD + 8, 8, pal.done, dg) + (hover ? status : "") + said + text(PAD + nx + 2.5, PAD + 18, 8, hover ? pal.name : pal.label, name);
	return { key: `tag/${pal.lit ? "d" : "p"}/${hover ? 1 : 0}${left ? 1 : 0}/${unit.tone}/${dg}/${word}/${name}`, w, h: 20, make: () => svg(w + 2 * PAD, 20 + 2 * PAD, boards + exposed(pal.lit, w + 2 * PAD, 20 + 2 * PAD, words)) };
}
/** A zone's name over it: its grid reference and its tab's name. */
export function zoneNameOf(tab, pal, { halt = false, hover = false } = {}) {
	const label = `${tab.ref} ${cut(tab.name, 24)}`, w = (label.length + 1) * CH7 + 4, color = halt ? pal.blocked : hover ? pal.name : pal.label;
	// The corner bracket before the reference is drawn: the font may not have the glyph.
	const corner = `<path d="M${PAD + 2} ${PAD + 7.5}v-5.5h3.2" fill="none" stroke="${color}" stroke-width="1"/>`;
	return { key: `zn/${halt ? 1 : 0}${hover ? 1 : 0}/${label}`, w, h: 9, make: () => svg(w + 2 * PAD, 9 + 2 * PAD, board(PAD, PAD, w, 9, pal) + exposed(pal.lit, w + 2 * PAD, 9 + 2 * PAD, corner + text(PAD + 2 + CH7, PAD + 7, 7, color, label))) };
}
/** A zone's status under it. */
export function zoneStatusOf(status, pal) {
	const word = ZONE_STATUS[status], w = word.length * CH7, color = status === "halted" ? pal.blocked : pal.label;
	return { key: `zs/${status}`, w, h: 8, make: () => svg(w + 2 * PAD, 8 + 2 * PAD, exposed(pal.lit, w + 2 * PAD, 8 + 2 * PAD, text(PAD, PAD + 7, 7, color, word))) };
}

// The string hash runs in streaks down a column, so the edge has its own.
const noise = (x, y, n) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(n + 1, 0x9e3779b1); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (k) => k * k * (3 - 2 * k);
// Which 2 px cells of a `w` × `h` window are dropped in edge frame `n`: every cell has its own phase and its
// keep-or-drop threshold swings with it, so cells near the threshold wink in and out. Returned as row runs.
function dropped(w, h, n, keep) {
	const cw = Math.ceil(w / 2), ch = Math.ceil(h / 2);
	let d = "";
	for (let y = 0; y < ch; y++) {
		let run = -1;
		for (let x = 0; x <= cw; x++) {
			const k = x < cw ? keep(x * 2 + 1, y * 2 + 1) : 1;
			const gone = !(k >= 1 || (k > 0 && noise(x, y, 3) + 0.2 * Math.sin((n / SHIMMER + noise(y, x, 80)) * 2 * Math.PI) < smooth(k)));
			if (gone && run < 0) run = x;
			if (!gone && run >= 0) { d += `M${run * 2} ${y * 2}h${(x - run) * 2}v2h-${(x - run) * 2}z`; run = -1; }
		}
	}
	return d;
}
/**
 * A window has no frame: its map dissolves into the ground through a random one-bit dither, 2 px cells that thin
 * out towards the edge. This is frame `n` of that edge for a `w` × `h` window, as cells of `ground` laid over the map.
 */
export function edgeSvg(w, h, n, ground) {
	const keep = (px, py) => Math.min(1, Math.min(px, w - px) / 28) * Math.min(1, Math.min(py, h - py) / 16);
	return svg(w, h, `<path d="${dropped(w, h, n, keep)}" fill="${ground}"/>`);
}

/** The light on the plate: a slanted band, `[x, y]` corners in plate px. */
export const LIGHT_BAND = Object.freeze([[93, -16], [155, -16], [118, 127], [56, 127]]);
// Where the plate's map starts and how far it takes to reach full strength: the readings stand on clean paper.
const PLATE_CLEAR = 122, PLATE_FADE = 60;
/** How much the veil and the light are drawn past the plate, so they can move with the watched unit. */
export const VEIL_BLEED = 12;
/**
 * The plate's veil: the map dissolves leftwards into the paper, so the text stands on clean ground. Cells of paper,
 * with the light falling across them as it falls across the paper under the map, laid over the map. It moves with
 * the light.
 */
export function veilSvg(w, h) {
	const B = VEIL_BLEED, keep = (px) => smooth(Math.max(0, Math.min(1, (px - B - PLATE_CLEAR) / PLATE_FADE)));
	const band = LIGHT_BAND.map(([x, y]) => `${x + B},${y + B}`).join(" ");
	return svg(w + 2 * B, h + 2 * B, `<defs><clipPath id="c"><path d="${dropped(w + 2 * B, h + 2 * B, 0, keep)}"/></clipPath>`
		+ `<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.light}" stop-opacity="${A.lightTop}"/><stop offset="1" stop-color="${C.light}" stop-opacity="${A.lightBottom}"/></linearGradient></defs>`
		+ `<g clip-path="url(#c)"><rect width="100%" height="100%" fill="${C.paper}"/><polygon points="${band}" fill="url(#l)"/></g>`);
}
/** The light itself, under the map: the same band on a clear ground. */
export function lightSvg(w, h) {
	const B = VEIL_BLEED, band = LIGHT_BAND.map(([x, y]) => `${x + B},${y + B}`).join(" ");
	return svg(w + 2 * B, h + 2 * B, `<defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.light}" stop-opacity="${A.lightTop}"/><stop offset="1" stop-color="${C.light}" stop-opacity="${A.lightBottom}"/></linearGradient></defs><polygon points="${band}" fill="url(#l)"/>`);
}

// A camera at rest looks at what is active first, then by the missions' own priority (RANK).
/**
 * Where a space's camera rests: on the hovered unit, else the hovered zone, else the focused unit's station if it is
 * in this space, else the unit that most needs a look, else its first zone. The window's top-left corner, held
 * inside the map.
 */
export function cameraTarget(world, mi, { vw, vh, hover = null, hoverZone = null, t = 0 }) {
	const m = world.missions[mi], units = m.tabs.flatMap((tab) => tab.units);
	const pick = (hover && world.units.get(hover)?.mi === mi ? units.find((u) => u.id === hover) : null)
		?? (hoverZone === null ? units.find((u) => u.focused) ?? [...units].sort((a, b) => (ACTIVE.has(b.code) - ACTIVE.has(a.code)) || (RANK[a.tone] - RANK[b.tone]))[0] : null);
	const z = hoverZone !== null ? zoneOf(mi, hoverZone) : zoneOf(mi, 0);
	const [x, y] = pick ? unitAt(world, pick.id, t, true) : [z.x + z.w / 2, z.y + z.h / 2];
	const b = beltOf(world, mi);
	return [Math.max(0, Math.min(world.W - vw, x - vw / 2)), Math.max(b.y, Math.min(b.y + b.h - vh, y - vh / 2))];
}

const TONE_OF = { working: "working", blocked: "blocked", done: "done", idle: "idle", unknown: "unknown" };

/**
 * One frame of a window onto the map, in window px: `sprites` are still drawings to place (`key` names one, `make`
 * writes it), `dots` single squares. `view` is `{ mi, cx, cy, vw, vh, pal, hover, hoverZone }` for a space's
 * window, or `{ plate: true, watch, cx, cy, vw, vh, pal }` for the plate, whose camera keeps `watch` under the crosshair.
 */
export function mapFrame(world, view, t) {
	const { cx, cy, vw, vh, pal, plate = false } = view, sprites = [], dots = [], land = world.land;
	const seen = (x, y, w, h, pad) => x + w > cx - pad && x < cx + vw + pad && y + h > cy - pad && y < cy + vh + pad;
	const dot = (x, y, s, c, o) => dots.push({ x: x - cx, y: y - cy, s, c, o });
	const ring = (x, y, r, n, c, o) => { for (let k = 0; k < n; k++) { const a = (k / n) * 6.283; dot(Math.round(x + Math.cos(a) * r) - 0.5, Math.round(y + Math.sin(a) * r * 0.5) - 0.5, 1.5, c, o); } };
	const side = pal.lit ? "d" : "p", phase = Math.floor(t / 0.7) % 3;
	const mine = plate ? world.units.get(view.watch) : null, hz = view.hover ? `${world.units.get(view.hover)?.mi}.${world.units.get(view.hover)?.ti}` : view.hoverZone != null ? `${view.mi}.${view.hoverZone}` : "";

	// zones
	world.missions.forEach((m, mi) => m.tabs.forEach((tab, ti) => {
		const z = zoneOf(mi, ti);
		if (!seen(z.x, z.y - TOP, z.w, z.h + TOP + 12, 4)) return;
		const b = zoneBox(z), halt = tab.status === "halted", ph = tab.units.length ? phase : 0, color = halt ? pal.halt : pal.zone, on = hz === z.key;
		if (plate && !halt && mine && mine.mi === mi && mine.ti === ti) sprites.push({ key: `zg/${z.key}`, make: () => zoneGlowSvg(z), x: b.x - cx, y: b.y - cy, w: b.w, h: b.h, o: 1 });
		sprites.push({ key: `z/${side}/${z.key}/${color}/${ph}`, make: () => zoneSvg(z, color, ph, pal.lit), x: b.x - cx, y: b.y - cy, w: b.w, h: b.h, o: on ? 1 : 0.74 });
		if (plate) return;
		// Its status under it and its name over it, both kept inside the window while their zone is in it.
		const mid = z.y + z.h / 2 > cy && z.y + z.h / 2 < cy + vh, st = zoneStatusOf(tab.status, pal), nm = zoneNameOf(tab, pal, { halt, hover: on });
		const sy = mid ? Math.min(z.y + z.h + 1, cy + vh - 3 - 15) : z.y + z.h + 1, ny = mid ? Math.max(z.y - 5, cy + 9 + 15) : z.y - 5;
		sprites.push({ ...st, x: z.x - cx - PAD, y: sy - 7 - cy - PAD, w: st.w + 2 * PAD, h: st.h + 2 * PAD, o: 1 });
		sprites.push({ ...nm, x: z.x - 2 - cx - PAD, y: ny - 7 - cy - PAD, w: nm.w + 2 * PAD, h: nm.h + 2 * PAD, o: 1 });
	}));

	// traffic: droids on the roads, each with a fading trail of beads
	for (const d of land.droids) {
		const r = land.roads[d.road], L = r.length, i = Math.floor((d.ph + t * d.v) % (L + 70));
		if (i >= L) continue;
		const k = d.dir > 0 ? i : L - 1 - i, [x, y] = r[k];
		if (!seen(x, y, 0, 0, 44)) continue;
		for (let b = 1; b <= 7; b++) { const q = r[k - b * d.dir]; if (!q) break; dot(q[0] - 1, q[1] - 1, 2, pal.road, 0.55 * (1 - b / 8)); }
		sprites.push({ key: `droid/${side}`, make: () => droidSvg(pal), x: x - 4 - cx, y: y - 4 - cy, w: 8, h: 8, o: 1 });
	}
	// a flyer crosses the whole map every 23 s or so, on its own line
	{
		const e = Math.floor(t / 23), dt = t - (e * 23 + rs(`fl${e}`) * 6), y0 = rs(`fy${e}`) * world.H, y1 = y0 + (rs(`fz${e}`) - 0.5) * 320, x = -20 + dt * 72, y = y0 + (y1 - y0) * (x / world.W);
		if (dt > 0 && x < world.W + 80 && seen(x - 70, y - 20, 80, 40, 0)) {
			const sl = (y1 - y0) / world.W;
			for (let b = 1; b <= 11; b++) dot(x - b * 6, y - b * 6 * sl, 1.2, pal.road, 0.6 * (1 - b / 12));
			sprites.push({ key: `flyer/${side}`, make: () => flyerSvg(pal), x: x - 5 - cx, y: y - 4 - cy, w: 10, h: 8, o: 1 });
		}
	}
	// a contact ping near some zone every 6 s or so: two rings of dots growing and fading
	if (world.missions.length) {
		const e = Math.floor(t / 6), dt = t - (e * 6 + rs(`pg${e}`) * 2), mi = Math.floor(rs(`pm${e}`) * world.missions.length), z = zoneOf(mi, Math.floor(rs(`pt${e}`) * Math.max(1, world.missions[mi].tabs.length)));
		const x = z.x + z.w / 2 + (rs(`px${e}`) - 0.5) * 150, y = z.y + z.h / 2 + (rs(`py${e}`) - 0.5) * 70;
		if (dt > 0 && dt < 2.2 && seen(x - 40, y - 30, 80, 60, 0)) for (const o of [0, 0.45]) { const q = dt - o; if (q > 0) ring(x, y, 4 + q * 15, 18, pal.label, Math.max(0, 0.9 * (1 - q / 1.75))); }
	}

	// units; on the plate the watched one last, so its tag is over its neighbours
	const all = [...world.units.values()];
	if (plate) all.sort((p, q) => (p.unit.id === view.watch) - (q.unit.id === view.watch));
	for (const e of all) {
		const u = e.unit, [x, y] = unitAt(world, u.id, t);
		if (!seen(x, y, 0, 0, 70)) continue;
		const tone = TONE_OF[u.tone] ?? "unknown", color = pal[tone], hov = !plate && view.hover === u.id, h = hash(u.id);
		if (MOVES[u.code]) for (let b = 1; b <= 6; b++) { const [px, py] = unitAt(world, u.id, t - b * 0.45); dot(px - 0.75, py - 0.75, 1.5, color, 0.5 * (1 - b / 7)); }
		// Its subagents are detachments that sortie out and back. A count is all that is known of them.
		const subs = Math.min(12, u.units?.count ?? 0);
		for (let si = 0; si < subs; si++) {
			const ang = si * 2.4 + (h % 6) + t * 0.3, r = 10 + 5 * Math.sin(t * 0.9 + si * 2);
			dot(Math.round(x + Math.cos(ang) * r * 1.3) - 1, Math.round(y + Math.sin(ang) * r * 0.8) - 1, 2, pal.working, 1);
		}
		// A unit that works or needs the person pings.
		if (tone === "blocked" || tone === "working") { const per = tone === "blocked" ? 1.6 : 3.2, q = ((t + (h % 10) / 3) % per) / (per * 0.5); if (q < 1) ring(x, y, 4 + q * 10, 14, color, 0.9 * (1 - q)); }
		sprites.push({ key: `mk/${side}/${tone}`, make: () => markerSvg(tone, pal), x: x - MARKER / 2 - cx, y: y - MARKER / 2 - cy, w: MARKER, h: MARKER, o: 1 });
		if (plate && u.id !== view.watch) continue; // on the plate only the unit under the crosshair is named
		// Its tag: to the left for the left half of a zone's units, and staggered up and down in a crowded zone.
		const left = !plate && e.n > 1 && e.ai < e.n / 2, mid = !plate && e.n > 2 && e.ai > 0 && e.ai < e.n - 1, tag = tagOf(u, pal, { hover: hov, left });
		const ty = y - 10 + (mid ? (e.ai & 1 ? -21 : 21) : 0), tx = left ? x - 8 - tag.w : x + 8;
		sprites.push({ ...tag, x: tx - cx - PAD, y: ty - cy - PAD, w: tag.w + 2 * PAD, h: tag.h + 2 * PAD, o: 1 });
		// The hovered unit is bracketed.
		if (hov) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			dots.push({ x: x + sx * 9 - (sx > 0 ? 4 : 0) - cx, y: y + sy * 9 - (sy > 0 ? 1 : 0) - cy, s: 4, sh: 1, c: pal.mark, o: 1 });
			dots.push({ x: x + sx * 9 - (sx > 0 ? 1 : 0) - cx, y: y + sy * 9 - (sy > 0 ? 4 : 0) - cy, s: 1, sh: 4, c: pal.mark, o: 1 });
		}
	}
	return { sprites, dots };
}

/** The plate's camera and how far the light has moved: both follow the watched unit on its patrol. */
export function plateCamera(world, watch, t) {
	const at = unitAt(world, watch, t), rest = unitAt(world, watch, t, true);
	if (!at) return null;
	const dx = at[0] - rest[0], dy = at[1] - rest[1];
	return { cx: at[0] - CROSSHAIR[0], cy: at[1] - CROSSHAIR[1], light: [dx * 0.4, dy * 0.6] };
}
