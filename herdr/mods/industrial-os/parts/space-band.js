// A space is a band across the whole sidebar: its name, a caret, the add-tab key, and at the right only what needs
// you there.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { monoAdvance, dotGridSvg } from "../assets.js";
import { twoDigits } from "../format.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { picture } from "./drawings.js";
import { keyParts, keyPlate } from "./key-plate.js";
import { BAND_H, BLACK, CH, WHITE, hold, partId, present, rgba } from "./sheet.js";
import { lit, word } from "./text.js";

/**
 * `space`: a mission from model.js ({ id, name, open, current, need, behind }). `width`: the sidebar's, for the
 * current space's dot grid. `hot`: the band is under the pointer; `add`: its add-tab key is, which then opens to the
 * right over the counts. `tabKey`: the key bound to a new tab, or null.
 * `onHover`, `onToggle(event, cx)`, `onAddHover`, `onAdd(event, cx)`: a click on the key does not toggle the band.
 */
export function spaceBand(t, { space: m, width, hot = false, add = false, tabKey = null, onHover, onToggle, onAddHover, onAdd }) {
	const parts = tabKey ? keyParts(tabKey) : null;
	// The add-tab key's label and shortcut plate, as wide as they are set: it opens to this width.
	const newTabW = 7 * CH + 4 + (parts ? 8 + 8 + (parts.command ? 10 : 0) + parts.text.length * CH : 0);
	return h_flex().id(partId(`ios-band-${m.id}`)).relative().flex_none().w_full().h(BAND_H).pl(18).pr(18).items_center().cursor_pointer().whitespace_nowrap()
		.border_t(1).border_color(rgba(WHITE, m.open ? A.glassEdge : A.glassShutEdge)).bg(rgba(WHITE, m.open ? A.glass : A.glassShut))
		.on_hover(onHover).on_click(onToggle)
		// The space you are in has a quiet acid dot grid on its band, from the left.
		.when(m.current, (el) => el.children(present([picture(`dots/${width}x${BAND_H - 1}/a`, () => dotGridSvg(width, BAND_H - 1, t.working, A.currentDot, [[0, 1], [0.26, 0.4], [0.52, 0]]), 0, 0, width, BAND_H - 1)])))
		.child(div().flex_shrink_1().min_w(0).truncate().text_size(12).font_weight(800).text_color(hot && !add ? t.working : m.open ? t.foreground : C.titleQuiet).child(m.name.toUpperCase()))
		.child(div().flex_none().ml(5).text_size(11).text_color(hot && !add ? t.working : C.caret).child(m.open ? "▾" : "▸"))
		.child(h_flex().id(partId(`ios-add-${m.id}`)).flex_none().h(BAND_H - 1).ml(5).items_center()
			.when(add, (el) => el.bg(t.working)).on_hover(onAddHover).on_mouse_down("left", hold)
			.on_click((e, cx) => { cx.stop_propagation(); onAdd(e, cx); })
			.child(div().flex_none().w(24).h_flex().justify_center().text_size(14).font_weight(add ? 800 : 400).text_color(add ? BLACK : C.keyRest).child("+"))
			.child(h_flex().id(partId(`ios-add-label-${m.id}`)).flex_none().w(add ? newTabW : 0).overflow_hidden().transition("width", { duration: 150, easing: "ease-out" })
				.child(h_flex().flex_none().gap(8).pr(4).items_center().whitespace_nowrap().font_weight(800).text_color(BLACK).child("NEW TAB").when(tabKey, (x) => x.child(keyPlate(tabKey, BLACK, t.working))))))
		.child(div().flex_1())
		.when(!add, (el) => el.child(h_flex().flex_none().gap(10).items_center().text_size(10)
			.when(m.need > 0, (x) => x.child(h_flex().gap(monoAdvance(10)).items_center().child(lit(twoDigits(m.need), t.blocked, { size: 10, line: 14 })).child(word("NEED YOU", C.reading))))
			.when(m.behind > 0, (x) => x.child(word(`↓${m.behind}`, C.keyRest)))));
}
