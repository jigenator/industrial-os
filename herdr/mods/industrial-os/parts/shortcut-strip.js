// The strip under the crate plate: glass, like a space's band. Open, it carries text keys; folded to the rail, it
// is the strip that unfolds the sidebar.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { bar } from "./light.js";
import { BLACK, ROW, WHITE, hold, partId, rgba } from "./sheet.js";

/**
 * Text keys in a row, a rule between them. `keys`: [{ id, text, onClick, ready? }]; `ready` puts a lit dot on the
 * key (an update that is ready to install, on the key that installs it).
 */
export function shortcutStrip(t, keys) {
	const key = ({ id, text, onClick, ready }, first) => h_flex().id(partId(id)).flex_none().h_full().pl(first ? 18 : 7).pr(7).items_center().cursor_pointer()
		.text_color(C.keyText).hover((s) => s.bg(t.working).text_color(BLACK)).active((s) => s.bg(C.keyPressed))
		.on_mouse_down("left", hold).on_click(onClick).child(text)
		.when(Boolean(ready), (el) => el.gap(5).child(div().relative().flex_none().w(5).h(5).children(bar(0, 0, 5, 5, t.working, { radius: 3, glow: t.working }))));
	return h_flex().flex_none().w_full().h(ROW).bg(rgba(WHITE, A.glass)).items_center()
		.children(keys.flatMap((k, i) => [...(i ? [div().flex_none().text_size(12).text_color(t.input).child("│")] : []), key(k, i === 0)]));
}

/** The rail's strip. While `hot` the acid fills it from the left, to `width` px, and its chevrons march. */
export function unfoldStrip(t, { hot, width, onHover, onClick }) {
	return h_flex().id(partId("ios-show")).relative().flex_none().w_full().h(ROW).pl(18.75).items_center().cursor_pointer().overflow_hidden()
		.bg(rgba(WHITE, A.glass)).text_size(13).font_weight(800).text_color(hot ? BLACK : t.foreground)
		.on_hover(onHover).on_mouse_down("left", hold).on_click(onClick)
		.child(div().id(partId("ios-show-fill")).absolute().left(0).top(0).h(ROW).w(hot ? width : 0).bg(t.working).transition("width", { duration: 170, easing: "ease-out" }))
		.child(div().relative().map((el) => (hot ? el.frames(["›  ", "›› ", "›››"], 200) : el.child("»"))));
}
