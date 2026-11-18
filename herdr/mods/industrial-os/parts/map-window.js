// A window onto the one map. A nested view with its own clock, so the map moves without redrawing its parent.
// Two forms: a space's window in the list, and the crate plate's, which follows the watched unit.
import { View, div } from "gpui-kit";
import { checking } from "herdr";
import { BLEED, CROSSHAIR, DARK, PLATE, SHIMMER, SHIMMER_MS, VEIL_BLEED, VIEW_H, beltAt, beltOf, cameraTarget, edgeSvg, groundSvg, lightSvg, mapFrame, plateCamera, veilSvg } from "../map.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { flush, picture } from "./drawings.js";
import { PLATE_H, present, rgba } from "./sheet.js";
import { stageOf } from "./stage.js";

/** The map and the ground's light: 30 frames a second, as the mockup's map. */
export const FRAME_MS = 33;

/** Made with `cx.new(MapView, { stage, space })` for a space's window, or `{ stage, plate: true }` for the plate's. */
export class MapView extends View {
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
		const stage = stageOf(this.stage), world = stage?.world, now = Date.now(), t = now / 1000;
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
