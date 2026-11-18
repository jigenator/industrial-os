// Titles over a set of panes: a tab's in the missions view, a space's in the agents view. Labels, not controls.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { advance, fadeSvg } from "../assets.js";
import { twoDigits } from "../format.js";
import { SIDEBAR_COLORS as C } from "../vocabulary.js";
import { picture } from "./drawings.js";
import { PAD, STEP_MS, partId, present } from "./sheet.js";
import { tape, word } from "./text.js";

/** The characters of a tab title that fit a column `inner` px wide. */
export const tabTitleChars = (inner) => Math.floor((inner - 2 * PAD - 8 - 3 * 6) / advance(12));

/**
 * A tab's title: capitals, one line, its reference at the right. `tab`: { id, name, ref, quiet }. One longer than
 * `chars` fades out at the right into `ground`, and runs as ticker tape while `running` (under the pointer).
 * `onHover(hovered, cx)`; `onMenu(event, cx)` on a right press.
 */
export function tabTitle({ tab, chars, running = false, ground, onHover, onMenu }) {
	const name = tab.name.toUpperCase(), long = name.length > chars, run = long && running;
	return h_flex().id(partId(`ios-tab-${tab.id}`)).h(17).mb(1).px(PAD).gap(8).items_center().on_hover(onHover)
		.on_mouse_down("right", onMenu)
		.child(div().relative().flex_1().min_w(0).h(17).line_height("17px").overflow_hidden().whitespace_nowrap().text_size(12).text_color(tab.quiet ? C.titleQuiet : C.title)
			.map((el) => (run ? el.frames(tape(name, chars), STEP_MS) : el.child(name)))
			.when(long && !run, (el) => el.children(present([picture(`fade/26x17/${ground}/left`, () => fadeSvg(26, 17, ground, "left"), chars * advance(12) - 26 + 4, 0, 26, 17)]))))
		.child(div().flex_none().text_size(10).text_color(C.label).child(tab.ref));
}

/** A group's title in the agents view: a name in capitals, a rule and a count. */
export const groupTitle = (name, count) => h_flex().h(14).mt(14).mb(3).px(PAD).gap(8).items_center().text_size(10).text_color(C.detail)
	.child(word(name.toUpperCase(), C.detail)).child(div().flex_1().h(1).bg(C.rule)).child(word(twoDigits(count), C.detail));
