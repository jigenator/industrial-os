// ACTION REQUIRED: the panes that wait on you, pinned above the lists on red glass. Its rows are set like pane rows.
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { dotGridSvg, dotPitch, litDotsSize, litDotsSvg } from "../assets.js";
import { twoDigits, wrapText } from "../format.js";
import { ACTION_SHOWN } from "../missions.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { picture } from "./drawings.js";
import { hoverBar } from "./light.js";
import { LIT_TONES, sign, stateMark, toneColors } from "./marks.js";
import { detailLine, labelCell } from "./pane-row.js";
import { CH, CODE_W, NAME_X, PAD, STEP_MS, partId, present, rgba } from "./sheet.js";
import { lit, tape, word } from "./text.js";

/**
 * `units`: every unit that waits (model.js's `action`); ACTION_SHOWN are shown until `more`. `inner`: the column's
 * width. `now` steps the state marks. `hover`: the id of the unit under the pointer, or null: its place runs as
 * ticker tape when it is too long, and its gutter bar grows. `near`: { x, y }, the lit dot of the grid, or null.
 * `scanner`: this list's scanner frame, or null.
 * `onRow(unit, rect, hovered, cx)`: `rect` is the row's place in the zone, since these rows do not scroll;
 * `onPick(unit)`; `onMove(event, cx, pitch)` with the dot grid's pitch; `onLeave(cx)`; `onMore(cx)`.
 */
export function actionRequired(t, { units, more = false, inner, now, hover = null, near = null, scanner = null, onRow, onPick, onMove, onLeave, onMore }) {
	const tone = toneColors(t);
	const whereChars = Math.floor((inner - 2 * PAD - NAME_X - 2 * CH - 4 * CH) / CH);
	const waitChars = Math.floor((inner - 2 * PAD - NAME_X) / CH);
	const shown = more ? units : units.slice(0, ACTION_SHOWN), hidden = units.length - shown.length;
	const rows = shown.map((u) => ({ u, lines: wrapText(u.waits ?? "", waitChars, 2) }));
	const height = 2 + 3 + rows.reduce((n, r) => n + 2 + 17 + r.lines.length * 15, 0) + Math.max(0, rows.length - 1) * 5 + (hidden > 0 ? 5 + 15 : 0);
	const item = ({ u, lines }, i) => {
		const where = `${u.space} › ${u.tab}`.toUpperCase(), long = where.length > whereChars, hov = hover === u.id, running = long && hov, color = tone[u.tone];
		const h = 2 + 17 + lines.length * 15;
		return v_flex().id(partId(`ios-act-${u.id}`)).relative().flex_none().w(inner).h(h).px(PAD).pt(1).cursor_pointer()
			// The row's place is worked out when the pointer reaches it, not on every draw.
			.on_hover((hovered, cx) => onRow(u, { x: 0, y: 2 + rows.slice(0, i).reduce((n, row) => n + 2 + 17 + row.lines.length * 15 + 5, 0), w: inner, h }, hovered, cx))
			.on_click(() => onPick(u))
			.children(hoverBar(`a-${u.id}`, h, hov))
			.child(h_flex().h(17).items_center().whitespace_nowrap()
				.child(stateMark(u.mark, color, now))
				.child(div().flex_none().w(CODE_W + CH).child(lit(u.code, color, { glow: LIT_TONES[u.tone] === true })))
				.child(div().flex_1().min_w(0).h(17).line_height("17px").overflow_hidden().text_color(C.name)
					.map((el) => (running ? el.frames(tape(where, whereChars), STEP_MS) : el.child(long ? `${where.slice(0, whereChars - 1)}…` : where))))
				.children(present([u.flag && div().flex_none().w(CH), u.flag && sign("flag-lit", t.blocked, 9), u.age && div().flex_none().w(CH), u.age && word(u.age, C.reading)])))
			// What it is waiting on, set as a pane's second row is.
			.children(lines.map((text) => detailLine(15, [labelCell(""), word(text, u.code === "DNE" ? C.detail : C.value)])));
	};
	const [px, py] = dotPitch(inner, height), [lw, lh] = litDotsSize(inner, height);
	return v_flex().flex_none().mt(10)
		.child(h_flex().h(18).px(PAD).gap(8).items_center()
			.child(word("ACTION REQUIRED", t.foreground, 800)).child(div().flex_1().h(1).bg(C.ruleStrong)).child(lit(twoDigits(units.length), t.blocked)))
		.child(v_flex().id(partId("ios-act")).relative().flex_none().w(inner).h(height).mt(6).pt(2).gap(5).bg(rgba(t.blocked, A.alertGlass))
			.on_mouse_move((e, cx) => onMove(e, cx, [px, py])).on_hover((hovered, cx) => { if (!hovered) onLeave(cx); })
			.children(present([
				picture(`dots/${inner}x${height}/r`, () => dotGridSvg(inner, height, t.blocked, A.alertDot, [[0, 0.55], [0.45, 0.36], [0.94, 0]]), 0, 0, inner, height),
				near && div().absolute().left(0).top(0).w(inner).h(height).overflow_hidden().children(present([picture(`lit/${inner}x${height}/r`, () => litDotsSvg(inner, height, t.blocked, A.alertDotLit), near.x - lw / 2, near.y - lh / 2, lw, lh)])),
			]))
			.children(rows.map(item)).children(present([scanner]))
			.when(hidden > 0, (el) => el.child(div().id(partId("ios-more")).h(15).pl(PAD + 14).text_size(10).text_color(C.nameIdle).cursor_pointer().hover((s) => s.text_color(t.working))
				.on_click((_e, cx) => onMore(cx)).child(`+ ${twoDigits(hidden)} MORE`))));
}
