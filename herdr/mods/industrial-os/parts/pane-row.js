// A pane: two quiet rows; the focused one opens instead, so nothing is shown twice. With it, the readings a pane
// carries: the subagent count and the context bar.
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { dotGridSvg, dotPitch, litDotsSize, litDotsSvg } from "../assets.js";
import { wrapText } from "../format.js";
import { UNIT_ICONS } from "../missions.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { picture } from "./drawings.js";
import { bar, hoverBar } from "./light.js";
import { LIT_TONES, sign, stateMark, toneColors, zoneColors } from "./marks.js";
import { BLACK, CH, CODE_W, NAME_X, PAD, WHITE, partId, present, rgba } from "./sheet.js";
import { readoutWidth, scannerStill } from "./scanner.js";
import { cutLine, lit, word } from "./text.js";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
// A pane at rest: its two rows. The focused pane's bar is never taller, however far the pane opens.
const TWO_ROWS = 2 + 17 + 16;

/** One line of a pane's second row or detail lines, on the name's column. */
export const detailLine = (h, children) => h_flex().h(h).pl(14).items_center().whitespace_nowrap().children(present(children));
/** The label at the start of a detail line, as wide as a state code. */
export const labelCell = (text, color = C.label) => div().flex_none().w(CODE_W + CH).text_color(color).child(text);

/** The subagent count. Lit only above zero: `00AU` and `??AU` are grey. `units`: { count, text }. */
export const unitCount = (t, units) => (units.count ? lit(units.text, t.working, { weight: 400, line: 15 }) : word(units.text, C.detail));
/** One spinning icon per subagent (a count is all Pi reports), then +N past UNIT_ICONS. */
export function unitIcons(t, units) {
	const n = units.count ?? 0;
	return [
		...Array.from({ length: Math.min(n, UNIT_ICONS) }, (_, i) => div().flex_none().w(CH).text_color(t.working).frames([...SPIN.slice(i % SPIN.length), ...SPIN.slice(0, i % SPIN.length)], 80)),
		n > UNIT_ICONS && word(`+${n - UNIT_ICONS}`, C.detail),
	];
}
/** The context reading as text, lit in its zone's colour; grey when it is off or unknown. `context`: { text, zone }. */
export function contextText(t, context) {
	const zone = zoneColors(t);
	return context.zone === "off" ? word(context.text, zone.off) : lit(context.text, zone[context.zone], { weight: 400, line: 15 });
}
/** The context bar: a 2 px track with a lit bar to `percent` of `width`; an unknown percent leaves the track empty. */
export function contextBar(t, context, width) {
	const zone = zoneColors(t);
	return div().relative().flex_1().h(2).bg(C.track).children(context.percent === null ? [] : bar(0, 0, Math.round(width * context.percent / 100), 2, zone[context.zone], { glow: context.zone === "off" ? null : zone[context.zone], strong: 0.55 }));
}

/** A focused droid's pane opens. */
const opens = (u) => u.focused && u.kind === "drd";
const askLines = (u, inner) => (u.detail?.ask ? wrapText(u.detail.ask.text, Math.floor((inner - 2 * PAD - NAME_X) / CH), 3) : []);
/** A pane's height, known before it is laid out, so its dot grid, bars and scanner fit it exactly. */
export function paneRowHeight(u, where, inner) {
	if (!opens(u)) return TWO_ROWS;
	const d = u.detail, lines = (where === "g" ? 1 : 0) + (d.act ? 1 : 0) + (d.model ? 1 : 0) + (d.goal ? 1 : 0) + (u.units.count !== 0 ? 1 : 0) + 1 + askLines(u, inner).length;
	return 1 + 17 + lines * 15 + 6;
}
/** A state change latches a pane for 260 ms: black on acid, then on its new colour. `at`: when it changed, or undefined. */
export const latchOf = (at, now) => ({ first: at !== undefined && now - at < 130, latched: at !== undefined && now - at < 260 });
/** What the scanner reads off a pane: its designation and status, in its state's colour. */
export const readoutOf = (t, u) => ({
	text: `${u.designation} · ${u.status}`,
	color: { working: t.working, blocked: t.blocked, done: WHITE, idle: C.name, unknown: C.name }[u.tone],
});

/**
 * `unit`: a unit from missions.js. `where`: "m" in the missions view, "g" in the agents view, where the pane's tab
 * is shown in its second row. `inner`: the column's width. `now` steps the state mark; `latchAt`: when its state
 * last changed, or undefined. `hovered`: under the pointer, which shows `readout` (a ReadoutView) at the end of its
 * first row and the white gutter bar; `ownScanner` also draws a still scanner on the pane. `near`: { x, y }, the
 * dot of the focused pane's grid that is lit, or null. `scanned`: the list's scanner has settled on the pane, so its
 * white bar grows only then.
 * `onHover(hovered, cx)`, `onClick`, `onMove(event, cx, pitch)`: `pitch` is the dot grid's [x, y] pitch while the
 * pane is focused, else null.
 */
export function paneRow(t, { unit: u, where, inner, now, latchAt, hovered = false, readout = null, ownScanner = false, near = null, scanned = true, onHover, onClick, onMove }) {
	const tone = toneColors(t), open = opens(u), h = paneRowHeight(u, where, inner), w = inner;
	const { first, latched } = latchOf(latchAt, now), hov = hovered;
	// A state change latches: black on acid, then on its new colour, then settled.
	const paint = (color) => (latched ? BLACK : color), color = tone[u.tone], glow = !latched && LIT_TONES[u.tone] === true;
	const name = paint(u.focused ? t.foreground : u.tone === "idle" || u.tone === "unknown" ? C.nameIdle : C.name);
	const row1 = h_flex().h(17).items_center().whitespace_nowrap()
		.child(stateMark(u.mark, paint(color), now))
		.child(div().flex_none().w(CODE_W + CH).child(lit(u.code, paint(color), { glow })))
		.child(cutLine(u.name, name))
		.children(present(hov && !latched ? [
			// The scanner's readout, typed in at the end of the row.
			div().flex_none().w(readoutWidth(readoutOf(t, u).text)).h(17).child(readout),
		] : [
			u.flag && div().flex_none().w(CH), u.flag && sign(glow ? "flag-lit" : "flag", paint(t.blocked), 9),
			u.age && div().flex_none().w(CH), u.age && word(u.age, paint(C.reading)),
		]));
	const d = u.detail, place = where === "g" ? cutLine(u.tab, paint(C.detail)) : null;
	const rows = open ? [
		place && detailLine(15, [labelCell(""), place]),
		d.act && detailLine(15, [labelCell("ACT"), div().flex_shrink_1().min_w(0).truncate().text_color(C.value).child(d.act.dirty ? d.act.text.slice(0, -1) : d.act.text),
			d.act.dirty && lit("*", C.warn, { weight: 400, line: 15 }), div().flex_1(), d.pr && word(d.pr.text, C.reading)]),
		d.model && detailLine(15, [labelCell("MDL"), cutLine(d.model.replace("/", " "), C.value), word(d.compactions, C.reading)]),
		d.goal && detailLine(15, [labelCell("GOAL"), cutLine(d.goal, C.value)]),
		// The count is the line's title.
		u.units.count !== 0 && detailLine(15, [div().flex_none().w(CODE_W + CH).child(unitCount(t, u.units)), ...unitIcons(t, u.units)]),
		detailLine(15, [labelCell("CTX"), contextBar(t, u.context, w - 2 * PAD - NAME_X - 4 * CH), div().flex_none().w(4 * CH).h_flex().justify_end().child(contextText(t, u.context))]),
		...askLines(u, inner).map((text, i) => detailLine(15, [labelCell(i ? "" : d.ask.label, t.blocked), i || !LIT_TONES.blocked ? word(text, t.blocked) : lit(text, t.blocked, { weight: 400, line: 15 })])),
	] : [detailLine(16, [
		labelCell(""),
		...(where === "g" ? [place, u.note && div().flex_none().w(CH), u.note && word(u.note, paint(C.reading)), u.units && unitCount(t, u.units) && div().flex_none().w(CH), u.units && unitCount(t, u.units)]
			: [u.note && word(u.note, paint(C.reading)), u.units && unitCount(t, u.units), ...(u.units && u.units.count ? [div().flex_none().w(3), ...unitIcons(t, u.units)] : []), div().flex_1()]),
		u.context && div().flex_none().w(CH), u.context && (latched ? word(u.context.text, BLACK) : contextText(t, u.context)),
	])];
	const [px, py] = dotPitch(w, h), [lw, lh] = litDotsSize(w, h);
	return v_flex().id(partId(`ios-u-${where}-${u.id}`)).relative().flex_none().w(w).h(h).px(PAD).pt(1).cursor_pointer()
		.on_hover(onHover)
		.on_click(onClick)
		.when(latched, (el) => el.bg(rgba(first ? t.working : color, A.latch)))
		.on_mouse_move((e, cx) => onMove(e, cx, u.focused && !latched ? [px, py] : null))
		.when(u.focused && !latched, (el) => el.bg(rgba(WHITE, A.focusGlass))
			.children(present([
				// The focused pane's block: a square grid of whole dots that thins out to the right.
				picture(`dots/${w}x${h}/w`, () => dotGridSvg(w, h, WHITE, A.focusDot), 0, 0, w, h),
				near && div().absolute().left(0).top(0).w(w).h(h).overflow_hidden().children(present([picture(`lit/${w}x${h}/w`, () => litDotsSvg(w, h, WHITE, A.focusDotLit), near.x - lw / 2, near.y - lh / 2, lw, lh)])),
			])))
		// The gutter bar: acid beside the focused pane, white and pulsing beside the pane under the pointer.
		.children(u.focused ? bar(-8, 1, 3, Math.min(h, TWO_ROWS) - 2, t.working, { radius: 2, glow: t.working, pulse: true, strong: true }) : hoverBar(`${where}-${u.id}`, h, hov && scanned))
		// Until the list has been measured there is no sliding scanner, so the pane shows its own.
		.when(hov && !latched && ownScanner, (el) => el.children(scannerStill(w, h, t.working)))
		.child(row1).children(present(rows));
}
