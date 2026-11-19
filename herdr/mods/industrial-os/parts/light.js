// Light: a lamp's slow pulse, a bar with its glow, and the white gutter bar that grows beside a pane.
// A glow behaves like a light: soft, and pulsing slowly where it is a lamp.
import { div } from "gpui-kit";
import { HALO_PAD, barGlowSvg } from "../assets.js";
import { SIDEBAR_COLORS as C } from "../vocabulary.js";
import { picture } from "./drawings.js";
import { WHITE, partId, present } from "./sheet.js";

/** A lamp's slow pulse, for `.loop("opacity", LAMP_PULSE)`. */
export const LAMP_PULSE = { from: 0.3, to: 1, period: 2800 };

/** A drawing that pulses slowly, as a lamp does. The pulse is on a box of its own around the image. */
export function lamp(key, make, x, y, w, h) {
	const light = picture(key, make, 0, 0, w, h);
	return light ? div().absolute().left(x).top(y).w(w).h(h).loop("opacity", LAMP_PULSE).child(light) : null;
}
/**
 * A bar with its light, as a list of elements for an absolute parent: the light first, the bar over it.
 * `glow` is the light's colour, absent for none; `pulse` makes it a lamp; `strong` is the gutter bar's, or a share of it.
 */
export function bar(x, y, w, h, color, { radius = 0, glow = null, pulse = false, strong = false } = {}) {
	const light = glow ? (pulse ? lamp : picture)(`glow/${w}x${h}/${radius}/${glow}/${Number(strong)}`, () => barGlowSvg(w, h, glow, { radius, strong }), x - HALO_PAD, y - HALO_PAD, w + 2 * HALO_PAD, h + 2 * HALO_PAD) : null;
	return present([light, div().absolute().left(x).top(y).w(w).h(h).rounded(radius).bg(color)]);
}
/**
 * The white gutter bar beside the pane the scanner has reached: it grows from its middle and its light fades in with
 * it, then its lamp pulses. `id` keeps its motion.
 */
export const hoverBar = (id, h, on) => {
	const grow = { duration: 130, easing: "ease-out" };
	return [
		// The light stays drawn, so it can fade in rather than appear at full height before the bar has grown.
		div().id(partId(`ios-bar-glow-${id}`)).absolute().left(0).top(0).opacity(on ? 1 : 0).transition("opacity", grow)
			.children(bar(-8, 1, 3, h - 2, C.paper, { radius: 2, glow: WHITE, pulse: true, strong: true }).slice(0, -1)),
		div().id(partId(`ios-bar-${id}`)).absolute().left(-8).top(on ? 1 : 1 + (h - 2) * 0.325).w(3).h(on ? h - 2 : (h - 2) * 0.35).rounded(2).bg(C.paper).opacity(on ? 1 : 0)
			.transition("top", grow).transition("height", grow).transition("opacity", { duration: 90 }),
	];
};
