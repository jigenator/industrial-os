// The ground's light. Its dots come up near the pointer, a ring of brighter shade pulses out from it, and a faint
// line sweeps down with brighter dots around it. A nested view on the map's clock, so its parent is not redrawn for it.
import { View, div } from "gpui-kit";
import { checking, theme } from "herdr";
import { GROUND_DOT, groundDots, groundLight } from "../assets.js";
import { SIDEBAR_ALPHA as A } from "../vocabulary.js";
import { FRAME_MS } from "./map-window.js";
import { rgba } from "./sheet.js";
import { stageOf } from "./stage.js";

const SWEEP_MS = 16_000; // the line that sweeps down the ground, top to bottom
const PULSE_EVERY_MS = 2400, PULSE_MS = 1600; // the ring that pulses out from the pointer over the ground

/** Made with `cx.new(GroundView, { stage })`. It reads the stage's `size` and `pointer`, which its parent only records. */
export class GroundView extends View {
	init(p, cx) {
		this.stage = p?.stage;
		this.dots = { key: "", list: [] };
		if (checking()) return;
		cx.timer.every(FRAME_MS, (cx) => cx.notify());
	}

	render() {
		const stage = stageOf(this.stage), size = stage?.size, base = div().absolute().left(0).top(0);
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
