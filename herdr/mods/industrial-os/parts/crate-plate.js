// The crate plate: the paper label at the top of the sidebar, with the maker, three readings and the map under a
// crosshair. Folded to the rail, the paper carries the two counts as plates.
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { twoDigits } from "../format.js";
import { CROSSHAIR } from "../map.js";
import { SIDEBAR_COLORS as C } from "../vocabulary.js";
import { sign } from "./marks.js";
import { BLACK, CH, PLATE_H, ROW, STEP_MS, partId } from "./sheet.js";
import { tape, word } from "./text.js";

/**
 * The plate, PLATE_H tall and as wide as its parent.
 * `machine`: this computer's name in capitals ("" shows LOCAL); past 12 characters it is cut, and runs as ticker
 * tape while `hot`. `droids`, `spaces`: the counts. `map`: the plate's map window (a MapView with `plate: true`).
 * `onHover(hovered, cx)`; `onSize(size, cx)` gives the plate's width for the map.
 */
export function cratePlate({ machine, droids, spaces, hot = false, map, onHover, onSize }) {
	const label = (text) => word(text, C.paperLabel);
	const reading = (mark, children) => h_flex().h(ROW).items_center().whitespace_nowrap().text_size(11).text_color(C.ink)
		.child(sign(mark, C.ink)).children(children);
	const name = machine || "LOCAL", long = name.length > 12;
	const shown = long && hot
		? div().flex_none().w(12 * CH).overflow_hidden().font_weight(800).frames(tape(name, 12), STEP_MS)
		: word(long ? name.slice(0, 12) : name, C.ink, 800);
	return div().id(partId("ios-plate")).relative().flex_none().w_full().h(PLATE_H).bg(C.paper).overflow_hidden().on_hover(onHover).on_size_change(onSize)
		.child(div().absolute().left(114).top(0).w(1).h(PLATE_H).bg(C.paperRule))
		.child(div().absolute().left(234).top(0).w(1).h(PLATE_H).bg(C.paperRule))
		.child(div().absolute().left(150).right(0).top(ROW * 4.5).h(1).bg(C.paperRule))
		.child(map)
		// The crosshair is literal: the watched unit is under it.
		.child(div().absolute().left(CROSSHAIR[0] - 0.5).top(CROSSHAIR[1] - 7.5).w(1).h(15).bg(C.crosshair))
		.child(div().absolute().left(CROSSHAIR[0] - 7.5).top(CROSSHAIR[1] - 0.5).w(15).h(1).bg(C.crosshair))
		.child(div().absolute().left(0).right(0).bottom(0).h(1).bg(C.paperHair))
		.child(div().absolute().right(4).top(ROW * 5 + 3).text_size(11).line_height("11px").text_color(C.paperMark).child("+"))
		// The maker is the plate's heading, on its own paper over the map.
		.child(div().absolute().right(15).top(8).px(3).py(3).bg(C.paper).line_height("14px").font_weight(800).text_color(C.ink).whitespace_nowrap().child("INDUSTRIAL-OS ®"))
		.child(v_flex().absolute().left(18).top(ROW * 2 - 1)
			.child(reading("machine", [shown, div().w(CH), label("·"), div().w(CH), label(droids > 0 ? "RUNNING" : "STANDBY")]))
			.child(reading("droid", [word(twoDigits(droids), C.ink, 800), div().w(CH), label("DRD")]))
			.child(reading("spaces", [word(twoDigits(spaces), C.ink, 800), div().w(CH), label("SPACES")])));
}

/** The rail's plate: RUNNING or STANDBY, the droid count on acid and, above zero, the panes that need you on orange. */
export function cratePlateRail(t, { droids, need }) {
	const tag = (background, children) => h_flex().w(51).h(14).gap(4).rounded(2).items_center().justify_center().bg(background).text_size(11).font_weight(800).text_color(BLACK).children(children);
	return div().relative().flex_none().w_full().h(PLATE_H).bg(C.paper).overflow_hidden()
		.child(div().absolute().left(0).right(0).top(ROW * 4.5).h(1).bg(C.paperRule))
		.child(div().absolute().left(0).right(0).bottom(0).h(1).bg(C.paperHair))
		.child(div().absolute().right(12).top(ROW * 2 + 1).line_height("14px").text_color(C.paperLabel).child(droids > 0 ? "RUNNING" : "STANDBY"))
		.child(v_flex().absolute().left(12).top(ROW * 3 + 2).gap(ROW - 14)
			.child(tag(t.working, [sign("droid", BLACK, 9, 9, 14), twoDigits(droids)]))
			.when(need > 0, (el) => el.child(tag(C.orange, ["×", twoDigits(need)]))));
}
