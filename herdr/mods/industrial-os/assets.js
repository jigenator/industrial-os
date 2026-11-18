// Still drawings the sidebar lays under or over its text: halos, dot grids, the ground, fades. Pure: each returns an
// SVG document; main.js writes it to a file once and places it. herdr-app's own elements have no blur, mask or
// pattern, and its SVG images have all three.
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "./vocabulary.js";

// What every drawing is written with, here and in map.js: the font stack, two decimals, escaped text, the document.
export const FONT = "JetBrainsMono NFM, JetBrains Mono, monospace";
export const r2 = (n) => Math.round(n * 100) / 100;
export const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w)}" height="${r2(h)}" viewBox="0 0 ${r2(w)} ${r2(h)}">${inner}</svg>`;
/** A blur filter named `id`, which reaches `reach` percent of the shape's box past each of its sides. */
export const blur = (deviation, id = "g", reach = 100) => `<filter id="${id}" x="-${reach}%" y="-${reach}%" width="${100 + 2 * reach}%" height="${100 + 2 * reach}%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`;

/** A halo's clear margin on every side. */
export const HALO_PAD = 8;
/** A monospace advance: 0.6 of the font size. */
export const advance = (size) => size * 0.6;

/**
 * Colour is light: whatever is acid, red or yellow bleeds a little of its own colour. This is that light for one
 * line of text, without the text; it lies under the crisp text, `HALO_PAD` past it on every side.
 */
export function haloSvg(text, color, { size = 11, weight = 800, line = 17 } = {}) {
	const w = text.length * advance(size) + 2 * HALO_PAD, h = line + 2 * HALO_PAD;
	return svg(w, h, `<defs>${blur(3)}</defs><text x="${HALO_PAD}" y="${r2(HALO_PAD + line / 2 + size * 0.35)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" fill-opacity="${A.glow}" filter="url(#g)">${esc(text)}</text>`);
}

/**
 * The light a lit bar bleeds: a rounded rectangle out of focus, `HALO_PAD` past the bar on every side. `strong` is
 * the gutter bar's: a soft bloom a little wider than the bar and a fainter one close to it, so a 3 px bar reads as
 * a lamp. Both fade out inside the margin, so the light has no edge. A number between 0 and 1 is that lamp turned
 * down, as on the thin context bar.
 */
export function barGlowSvg(w, h, color, { radius = 0, strong = false } = {}) {
	const P = HALO_PAD, rect = (grow, filter, opacity) => `<rect x="${P - grow}" y="${P - grow}" width="${r2(w + 2 * grow)}" height="${r2(h + 2 * grow)}" rx="${radius + grow}" fill="${color}" fill-opacity="${opacity}" filter="url(#${filter})"/>`;
	return svg(w + 2 * P, h + 2 * P, strong ? `<defs>${blur(2.6)}${blur(1.2, "t")}</defs>${rect(1, "g", r2(0.75 * strong))}${rect(0, "t", r2(0.5 * strong))}` : `<defs>${blur(3)}</defs>${rect(0, "g", 0.6)}`);
}

// Whole dots only: a whole number of cells about 4 px wide fits each way and shares out what is left over.
const pitch = (length) => length / Math.max(1, Math.floor(length / 4));
const dots = (w, h, color, alpha) => `<pattern id="p" width="${r2(pitch(w))}" height="${r2(pitch(h))}" patternUnits="userSpaceOnUse"><circle cx="${r2(pitch(w) / 2)}" cy="${r2(pitch(h) / 2)}" r="0.85" fill="${color}" fill-opacity="${alpha}"/></pattern>`;
/** The dot pitch of a `w` × `h` grid, `[x, y]`. */
export const dotPitch = (w, h) => [pitch(w), pitch(h)];

/**
 * A square grid of whole dots that thins out to the right, as on the focused pane's block (`stops`: its strength
 * at the left, at 45% and where it ends), or from the left over half the width, as on the current space's band.
 */
export function dotGridSvg(w, h, color, alpha, stops = [[0, 0.5], [0.45, 0.36], [0.94, 0]]) {
	const fade = stops.map(([at, strength]) => `<stop offset="${at}" stop-color="#fff" stop-opacity="${strength}"/>`).join("");
	return svg(w, h, `<defs>${dots(w, h, color, alpha)}<linearGradient id="f" x1="0" y1="0" x2="1" y2="0">${fade}</linearGradient><mask id="m"><rect width="${r2(w)}" height="${r2(h)}" fill="url(#f)"/></mask></defs><rect width="${r2(w)}" height="${r2(h)}" fill="url(#p)" mask="url(#m)"/>`);
}

/** How far from the pointer a block's dots come up. */
export const LIT_RADIUS = 46;
/** The dots near the pointer come up a little: a disc of brighter dots on a block's own pitch, centred on the pointer. */
export function litDotsSvg(w, h, color, alpha) {
	const [px, py] = dotPitch(w, h), nx = Math.ceil(LIT_RADIUS / px) * 2, ny = Math.ceil(LIT_RADIUS / py) * 2, sw = nx * px, sh = ny * py;
	return svg(sw, sh, `<defs><pattern id="p" width="${r2(px)}" height="${r2(py)}" patternUnits="userSpaceOnUse"><circle cx="${r2(px / 2)}" cy="${r2(py / 2)}" r="0.85" fill="${color}" fill-opacity="${alpha}"/></pattern>`
		+ `<radialGradient id="f" gradientUnits="userSpaceOnUse" cx="${r2(sw / 2)}" cy="${r2(sh / 2)}" r="${LIT_RADIUS}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="m"><rect width="${r2(sw)}" height="${r2(sh)}" fill="url(#f)"/></mask></defs>`
		+ `<rect width="${r2(sw)}" height="${r2(sh)}" fill="url(#p)" mask="url(#m)"/>`);
}
/** That disc's size, `[w, h]`. */
export const litDotsSize = (w, h) => { const [px, py] = dotPitch(w, h); return [Math.ceil(LIT_RADIUS / px) * 2 * px, Math.ceil(LIT_RADIUS / py) * 2 * py]; };

/** The hover scanner's corner marks: at each corner two small bars that meet only at their corner point, out of focus. */
export function scopeGlowSvg(w, h, color) {
	const P = HALO_PAD, bars = scopeBars(w, h)
		.map(([x, y, bw, bh]) => `<rect x="${r2(x + P)}" y="${r2(y + P)}" width="${bw}" height="${bh}"/>`).join("");
	return svg(w + 2 * P, h + 2 * P, `<defs>${blur(3)}${blur(1, "t")}</defs><g fill="${color}"><g filter="url(#g)" opacity="0.85">${bars}${bars}${bars}</g><g filter="url(#t)">${bars}</g></g>`);
}
/** A scanner corner bar: how long it is and how thick. Each starts its own thickness in from the corner. */
export const SCOPE_ARM = 7, SCOPE_STROKE = 1.5;
/** Those corner bars' places in a `w` × `h` frame, `[x, y, w, h]` each. */
export function scopeBars(w, h) {
	const L = SCOPE_ARM, T = SCOPE_STROKE;
	return [[T, 0, L, T], [0, T, T, L], [T, h - T, L, T], [0, h - T - L, T, L], [w - T - L, 0, L, T], [w - T, T, T, L], [w - T - L, h - T, L, T], [w - T, h - T - L, T, L]];
}

// One terminal cell at Herdr's 14 px font: the ground's dots stand on its grid, every fourth column and second row.
const CELL_W = 8.4, CELL_H = 18.5;
/** A ground dot's radius. */
export const GROUND_DOT = 1.3;
/** The ground's dots in a `w` × `h` block: `{ x, y, major }` each, its centre, a brighter one every fifth. */
export function groundDots(w, h) {
	const dots = [];
	for (let y = 1; y * CELL_H < h; y += 2) for (let x = 2; x * CELL_W < w; x += 4) {
		dots.push({ x: r2((x + 0.5) * CELL_W), y: r2((y + 0.5) * CELL_H), major: ((x - 2) / 4) % 5 === 0 && ((y - 1) / 2) % 5 === 0 });
	}
	return dots;
}
/** The sidebar's ground: the surface's gradient from top to bottom, and its dots at rest, held back. */
export function groundSvg(w, h) {
	const circles = (major) => groundDots(w, h).filter((d) => d.major === major).map((d) => `<circle cx="${d.x}" cy="${d.y}" r="${GROUND_DOT}"/>`).join("");
	return svg(w, h, `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.groundTop}"/><stop offset="1" stop-color="${C.groundBottom}"/></linearGradient></defs>`
		+ `<rect width="${r2(w)}" height="${r2(h)}" fill="url(#f)"/><g fill-opacity="${A.groundDotRest}"><g fill="${C.groundDot}">${circles(false)}</g><g fill="${C.groundDotMajor}">${circles(true)}</g></g>`);
}

/** How far from the pointer the ground's dots come up, how far its pulse travels, and how far from the sweep line. */
export const POINTER_REACH = 110, PULSE_REACH = 150, SWEEP_REACH = 70;
/** A grey raised by `levels` on every channel. */
export const lift = (hex, levels) => `#${[1, 3, 5].map((i) => Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + levels)).toString(16).padStart(2, "0")).join("")}`;
/**
 * The ground's light for one frame: which of `dots` are up, and by how much. Only shade changes; no dot moves.
 * Near the `pointer` (`{ x, y }`) dots brighten with closeness, and a ring of brighter shade pulses out from it:
 * `pulse` is how far the ring has gone, 0 to 1, and 1 or more is between pulses. `strength` (0 to 1) fades all of
 * that in and out. Dots near the `sweep` line (its y) brighten too. Returns `{ x, y, color, alpha }` for each lit dot.
 */
export function groundLight(dots, { pointer = null, strength = 0, pulse = 2, sweep = null } = {}) {
	const lit = [];
	for (const d of dots) {
		const near = sweep === null ? 0 : Math.max(0, 1 - Math.abs(d.y - sweep) / SWEEP_REACH);
		let hover = 0;
		if (pointer && strength > 0) {
			const dist = Math.hypot(d.x - pointer.x, d.y - pointer.y);
			const ring = pulse < 1 ? Math.max(0, 1 - Math.abs(dist - pulse * PULSE_REACH) / 16) * (1 - pulse) : 0;
			hover = strength * (Math.max(0, 1 - dist / POINTER_REACH) * 45 + ring * 60);
		}
		const up = Math.round(near * 26 + hover);
		if (up > 0) lit.push({ x: d.x, y: d.y, color: lift(d.major ? C.groundDotMajor : C.groundDot, up), alpha: r2(A.groundDotRest + (1 - A.groundDotRest) * Math.min(1, up / 26)) });
	}
	return lit;
}

/** A fade from `color` to clear: `to` is the side that is clear ("right", "left", "up" or "down"). */
export function fadeSvg(w, h, color, to) {
	const [x2, y2] = to === "right" ? [1, 0] : to === "left" ? [-1, 0] : to === "down" ? [0, 1] : [0, -1];
	const x1 = x2 < 0 ? 1 : 0, y1 = y2 < 0 ? 1 : 0;
	return svg(w, h, `<defs><linearGradient id="f" x1="${x1}" y1="${y1}" x2="${Math.max(0, x2)}" y2="${Math.max(0, y2)}"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><rect width="${r2(w)}" height="${r2(h)}" fill="url(#f)"/>`);
}

/** The view switch's ruler: a tick every 8 px under a line. */
export function rulerSvg(w) {
	let ticks = "";
	for (let x = 0; x < w; x += 8) ticks += `M${x} 0h1v3h-1z`;
	return svg(w, 4, `<path d="${ticks}" fill="${C.tick}"/><rect y="3" width="${r2(w)}" height="1" fill="${C.rule}"/>`);
}

/** A word turned on its side, reading upwards, as on the hide grip. */
export function sidewaysSvg(text, color, { size = 11, weight = 800, spacing = 1.3 } = {}) {
	const length = text.length * advance(size) + (text.length - 1) * spacing, w = size + 2;
	return svg(w, length, `<text transform="translate(${r2(w / 2 + size * 0.35)} ${r2(length)}) rotate(-90)" font-family="${FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${color}">${esc(text)}</text>`);
}
