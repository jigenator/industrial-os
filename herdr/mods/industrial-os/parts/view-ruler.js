// The view switch: a ruler with an index pointer under the active view, in acid; it follows the pointer in white.
import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { rulerSvg } from "../assets.js";
import { MARK_BOX, MARK_PAD, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { MOD, picture } from "./drawings.js";
import { PAD, partId, present } from "./sheet.js";

/**
 * `views`: [[key, text, x]], x being where the pointer rests under that view. `active`: the shown view's key.
 * `roam`: the x the index pointer has followed the pointer to, or null at rest. `width`: the ruler's.
 * `onHover(hovered, cx)`; `onRoam(x, cx)` with the pointer's place snapped to the ruler's 4 px ticks; `onPick(key, cx)`.
 */
export function viewRuler(t, { views, active, roam = null, width, onHover, onRoam, onPick }) {
	const rest = views.find(([key]) => key === active)[2], roaming = roam !== null;
	return div().id(partId("ios-views")).relative().flex_none().h(24).mt(10).mx(PAD)
		.on_hover(onHover).on_mouse_move((e, cx) => onRoam(Math.max(0, Math.min(width - 8, Math.round((e.local_position?.x ?? 0) / 4) * 4 - 4)), cx))
		.child(h_flex().h(22).gap(14).items_center().children(views.map(([key, text]) => div().id(partId(`ios-view-${key}`)).flex_none().line_height("22px").cursor_pointer()
			.text_color(active === key ? t.foreground : t.dim).hover((s) => s.text_color(t.foreground))
			.on_click((_e, cx) => onPick(key, cx)).child(text))))
		.children(present([picture(`ruler/${width}`, () => rulerSvg(width), 0, 20, width, 4)]))
		.child(svg(`${MOD}/marks/pointer-lit.svg`).absolute().left((roaming ? roam : rest) - MARK_PAD - 0.5).top(24 - 7 - MARK_PAD).size(MARK_BOX).text_color(roaming ? C.paper : t.working).transition("left", { duration: 150, easing: "ease-out" }));
}
