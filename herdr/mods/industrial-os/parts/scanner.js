// The scanner: acid glass with four corner marks that glow and pulse, on the pane the pointer reaches, and the
// readout it types at the end of that pane's row.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { HALO_PAD, scopeBars, scopeGlowSvg } from "../assets.js";
import { readoutFrame, readoutSettled } from "../format.js";
import { SIDEBAR_ALPHA as A } from "../vocabulary.js";
import { lamp } from "./light.js";
import { CH, partId, present, rgba } from "./sheet.js";
import { stageOf } from "./stage.js";
import { lit } from "./text.js";

/**
 * One frame per list that slides to the pane the pointer reaches, and stays on the last one until the pointer
 * leaves the list. `rect` is { x, y, w, h } in its parent, or null for none yet; `on` shows it. A new `id` places it
 * without a slide. Its corner marks hold to its corners while it changes height.
 */
export function scannerFrame(color, { id, rect: r, on }) {
	if (!r) return null;
	const w = r.w + 2, h = r.h + 2, slide = { duration: 170, easing: "ease-out" };
	const corners = [["left", "top"], ["left", "bottom"], ["right", "top"], ["right", "bottom"]]
		.flatMap(([x, y]) => [div().absolute()[x](1.5)[y](0).w(7).h(1.5).bg(color), div().absolute()[x](0)[y](1.5).w(1.5).h(7).bg(color)]);
	return div().id(partId(id)).absolute().left(r.x - 1).top(r.y - 1).w(w).h(h).bg(rgba(color, A.scopeGlass)).opacity(on ? 1 : 0)
		.transition("top", slide).transition("height", slide).transition("left", slide).transition("width", slide).transition("opacity", { duration: 120 })
		.children(present([lamp(`scope/${w}x${h}/${color}`, () => scopeGlowSvg(w, h, color), -HALO_PAD, -HALO_PAD, w + 2 * HALO_PAD, h + 2 * HALO_PAD), ...corners]));
}
/** A pane's own scanner, still, as a list of elements over a `w` × `h` pane. */
export const scannerStill = (w, h, color) => present([
	div().absolute().left(-1).top(-1).w(w + 2).h(h + 2).bg(rgba(color, A.scopeGlass)),
	lamp(`scope/${w + 2}x${h + 2}/${color}`, () => scopeGlowSvg(w + 2, h + 2, color), -1 - HALO_PAD, -1 - HALO_PAD, w + 2 + 2 * HALO_PAD, h + 2 + 2 * HALO_PAD),
	...scopeBars(w + 2, h + 2).map(([x, y, bw, bh]) => div().absolute().left(x - 1).top(y - 1).w(bw).h(bh).bg(color)),
]);

/** The room a readout takes at the end of its row: a space, its corner mark and its text. */
export const readoutWidth = (text) => CH + 4 + text.length * CH;

/**
 * The scanner's readout: a pane's designation and status, exactly as on the map. It types in from the right and its
 * digits re-read until they settle. Made with `cx.new(ReadoutView, { stage })`; it draws the stage's
 * `readout` { text, color } from `readAt`, and its owner redraws it only while it changes.
 */
export class ReadoutView extends View {
	init(p) {
		this.stage = p?.stage;
	}

	render() {
		const stage = stageOf(this.stage), r = stage?.readout;
		if (!r) return div();
		const elapsed = Date.now() - stage.readAt, settled = elapsed >= readoutSettled(r.text), shown = readoutFrame(r.text, elapsed);
		return h_flex().w(readoutWidth(r.text)).h(17).justify_end().items_center().whitespace_nowrap()
			// The corner mark is the readout's first sign, so it is the last to be typed.
			.when(shown.length === r.text.length, (el) => el.child(div().flex_none().w(4).h(6).border_l(1).border_t(1).border_color(r.color)))
			// Lit in its unit's state colour; the light comes once the digits hold still.
			.child(lit(shown, r.color, { glow: settled }));
	}
}
