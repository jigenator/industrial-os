// The hide grip: a knurled band in the right gutter; under the pointer it grows open to say what it does.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { HALO_PAD, barGlowSvg, sidewaysSvg } from "../assets.js";
import { picture } from "./drawings.js";
import { keyParts } from "./key-plate.js";
import { LAMP } from "./light.js";
import { BLACK, CH, partId, present } from "./sheet.js";

/**
 * A list of elements for a relative parent `width` × `height`: the grip stands in the middle of its right edge.
 * `hot`: under the pointer, which opens it to HIDE and the fold's key (`binding`, or null) and marches its chevrons
 * with `now`. `onHover(hovered, cx)`, `onClick(event, cx)`.
 */
export function hideGrip(t, { width, height, hot = false, binding = null, now, onHover, onClick }) {
	const gh = hot ? 150 : 46, gw = hot ? 17 : 9;
	const grow = { duration: 160, easing: "ease-out" }, march = Math.floor(now / 240);
	// Its light is as large as the open grip, so it comes on once the grip has grown.
	const glow = picture(`glow/17x150/2/${t.working}/0`, () => barGlowSvg(17, 150, t.working, { radius: 2 }), width - 18 - HALO_PAD, Math.max(0, height / 2 - 75) - HALO_PAD, 17 + 2 * HALO_PAD, 150 + 2 * HALO_PAD)
		?.id(partId("ios-grip-glow")).opacity(hot ? 1 : 0).transition("opacity", { duration: 120, delay: hot ? 120 : 0 });
	const grip = v_flex().id(partId("ios-grip")).absolute().left(width - (hot ? 1 : 3) - gw).top(Math.max(0, height / 2 - gh / 2)).w(gw).h(gh).items_center().justify_center().cursor_pointer().rounded(2).overflow_hidden()
		.transition("left", grow).transition("top", grow).transition("width", grow).transition("height", grow)
		.on_hover(onHover).on_click(onClick)
		.map((el) => (hot
			? el.bg(t.working).child(v_flex().flex_none().items_center().gap(9)
				// Three chevrons march left, one after another.
				.child(v_flex().items_center().text_size(12).line_height("11px").font_weight(800).text_color(BLACK)
					.children([0, 1, 2].map((i) => { const step = (((march - i) % 3) + 3) % 3; return div().relative().left(3 - 3 * step).opacity(step === 1 ? 1 : 0.35).child("‹"); })))
				.child(div().relative().flex_none().w(13).h(34).children(present([picture("side/HIDE", () => sidewaysSvg("HIDE", BLACK), 0, 0, 13, 34)])))
				.when(binding, (x) => { const text = keyParts(binding), label = `${text.command ? "⌘" : ""}${text.text}`, len = label.length * (CH + 1.3);
					return x.child(div().relative().flex_none().w(15).h(len + 8).rounded(2).bg(BLACK).children(present([picture(`side/${label}`, () => sidewaysSvg(label, t.working), 1, 4, 13, len)]))); }))
			// At rest its ridges breathe.
			: el.child(v_flex().gap(3).children(Array.from({ length: 9 }, () => div().flex_none().w(5).h(1).bg(t.dim))).loop("opacity", LAMP))));
	return present([glow, grip]);
}
