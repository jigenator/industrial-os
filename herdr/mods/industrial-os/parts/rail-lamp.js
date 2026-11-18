// The rail: one lamp per pane, grouped by mission, in the list's order.
import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { WHITE, partId } from "./sheet.js";
import { lit, word } from "./text.js";

/**
 * `lamp`: a lamp from missions.js ({ id, lamp, code, tone, focused, gap }); `gap` starts a new mission's group.
 * A working or blocked pane's lamp is lit. `onClick`.
 */
export function railLamp(t, l, onClick) {
	const tone = { working: t.working, blocked: t.blocked, done: t.done ?? WHITE, idle: t.dim, unknown: t.dim };
	return h_flex().id(partId(`ios-lamp-${l.id}`)).flex_none().w(51).h(20).px(6).gap(5).rounded(4).items_center().cursor_pointer()
		.when(l.gap, (el) => el.mt(5)).when(l.focused, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
		.on_click(onClick)
		.child(div().flex_none().w(9).h_flex().justify_center().child(l.tone === "working" || l.tone === "blocked" ? lit(l.lamp, tone[l.tone], { weight: 400, line: 20 }) : word(l.lamp, tone[l.tone])))
		.child(word(l.code, l.tone === "idle" || l.tone === "unknown" ? t.dim : t.muted));
}
