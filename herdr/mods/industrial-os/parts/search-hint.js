// The search hint. Not a field: a line that says search exists and which key opens it.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { keyPlate } from "./key-plate.js";
import { sign } from "./marks.js";
import { BLACK, PAD, WHITE, partId, present, rgba } from "./sheet.js";

/**
 * `binding`: the key that opens search, as keys.json writes it, or null. `hot`: under the pointer. `flick`: a frame
 * of format.js's `flickerFrame` ({ opacity, fringe }): reached by the pointer the hint flickers once, in hard steps,
 * with a pixel of red and of cyan on its two ends. `folded`: the rail's form, a 51 px key.
 */
export function searchHint(t, { binding, hot = false, flick = { opacity: 1, fringe: false }, folded = false, onHover, onClick }) {
	const fringes = flick.fringe && [div().absolute().left(-1).top(0).w(1).h_full().bg(rgba(C.fringeRed, A.fringeRed)), div().absolute().right(-1).top(0).w(1).h_full().bg(rgba(C.fringeCyan, A.fringeCyan))];
	if (folded) {
		return h_flex().id(partId("ios-find")).relative().w(51).h(17).gap(5).rounded(2).items_center().justify_center().cursor_pointer().bg(hot ? t.working : t.input).opacity(flick.opacity)
			.on_hover(onHover).on_click(onClick)
			.child(sign("search", hot ? BLACK : WHITE, 10, 10)).when(binding, (el) => el.child(keyPlate(binding, rgba(BLACK, 0), hot ? BLACK : WHITE).px(0)))
			.children(present([fringes].flat()));
	}
	// Glass comes up under the pointer, as on a space's band, so the hint reads as one thing to click.
	return h_flex().id(partId("ios-search")).relative().w_full().h(28).px(PAD).gap(7).items_center().cursor_pointer().bg(rgba(WHITE, hot ? A.glass : 0)).opacity(flick.opacity)
		.on_hover(onHover).on_click(onClick).children(present([fringes].flat()))
		.child(sign("search", hot ? t.working : C.nameIdle, 12, 12))
		.child(div().flex_1().min_w(0).truncate().text_size(12).text_color(hot ? C.value : C.nameIdle).child("search spaces, agents, tabs"))
		.when(binding, (el) => el.child(keyPlate(binding, hot ? t.working : t.input, hot ? BLACK : WHITE)));
}
