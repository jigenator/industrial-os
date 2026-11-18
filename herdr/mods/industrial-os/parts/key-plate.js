// A shortcut is the same plate everywhere: 11 px, weight 800, the drawn command sign, radius 2.
import { h_flex } from "gpui-base";
import { sign } from "./marks.js";

const KEY_SIGNS = { ctrl: "⌃", alt: "⌥", shift: "⇧" };
/** A binding as keys.json writes it ("cmd-shift-p"): whether it has the command key, and the rest as text. */
export function keyParts(binding) {
	const parts = binding.split("-"), last = parts.pop() || "-";
	return { command: parts.includes("cmd"), text: `${parts.filter((p) => p !== "cmd").map((p) => KEY_SIGNS[p] ?? "").join("")}${last.toUpperCase()}` };
}
/** The plate for a binding, in a background and an ink. */
export function keyPlate(binding, background, ink) {
	const { command, text } = keyParts(binding);
	return h_flex().flex_none().h(17).px(4).gap(1).rounded(2).items_center().bg(background).text_size(11).font_weight(800).text_color(ink)
		.when(command, (el) => el.child(sign("command", ink, 9))).child(text);
}
