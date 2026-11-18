// Text: the font, plain words, one-line cuts, lit text and ticker tape.
import { div } from "gpui-kit";
import { fonts, settings } from "herdr";
import { HALO_PAD, monoAdvance, haloSvg } from "../assets.js";
import { picture } from "./drawings.js";

let fontName = null;
/** The font every part is set in. The installed JetBrains Mono Nerd Font has the heavy weights; without it the layout's font is used. */
export const font = () => (fontName ??= fonts().includes("JetBrainsMono NFM") ? "JetBrainsMono NFM" : (settings().font_family ?? "JetBrains Mono"));

/** Text that is lit: crisp, with its own colour bleeding under it. The light is a drawing, so it comes a tick late. */
export function lit(text, color, { size = 11, weight = 800, line = 17, glow = true } = {}) {
	const halo = glow ? picture(`halo/${size}/${weight}/${line}/${color}/${text}`, () => haloSvg(text, color, { size, weight, line }), -HALO_PAD, -HALO_PAD, text.length * monoAdvance(size) + 2 * HALO_PAD, line + 2 * HALO_PAD) : null;
	return div().relative().flex_none().h(line).line_height(`${line}px`).whitespace_nowrap().text_size(size).font_weight(weight).text_color(color)
		.when(halo, (el) => el.child(halo)).child(text);
}
/** A word that keeps its width. */
export const word = (text, color, weight = 400) => div().flex_none().whitespace_nowrap().font_weight(weight).text_color(color).child(text);
/** One line that is cut with an ellipsis when it does not fit. */
export const cutLine = (text, color, weight = 400) => div().flex_1().min_w(0).truncate().font_weight(weight).text_color(color).child(text);

/** Ticker tape: the text, a separator, the text again, stepping left one character at a time, `chars` wide. Frames for `.frames`. */
export function tape(text, chars) {
	const loop = `${text}  ·  `, twice = loop + loop + loop;
	return Array.from({ length: loop.length }, (_, i) => twice.slice(i, i + chars));
}
