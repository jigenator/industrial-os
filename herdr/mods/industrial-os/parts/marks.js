// Drawn marks and the colours of a state. A state is always a code and a mark; colour only adds emphasis.
import { div, svg } from "gpui-kit";
import { MARK_BOX, MARK_PAD, SIDEBAR_COLORS as C, markFrame } from "../vocabulary.js";
import { MOD } from "./drawings.js";
import { WHITE } from "./sheet.js";

/** A drawn mark: a 9 px sign in its `MARK_BOX` box, tinted, taking `width` px of the row. `draw` scales it. */
export function sign(name, color, width = 14, draw = 9, height = 17) {
	const k = draw / 9;
	return div().relative().flex_none().w(width).h(height)
		.child(svg(`${MOD}/marks/${name}.svg`).absolute().left(-MARK_PAD * k).top((height - MARK_BOX * k) / 2).size(MARK_BOX * k).text_color(color));
}
/** A state's mark at `now`: the moving ones (WRK, SUB, RUN, QNS) step with the clock. */
export const stateMark = (code, color, now, width = 14) => sign(`${code.toLowerCase()}-${markFrame(code, now)}`, color, width);

/** A unit's tone as a colour: the theme's for the states that need you, grey at rest. */
export const toneColors = (t) => ({ working: t.working, blocked: t.blocked, done: t.done ?? WHITE, idle: C.detail, unknown: C.detail });
/** The tones whose text is lit. */
export const LIT_TONES = { working: true, blocked: true };
/** A context reading's zone as a colour. */
export const zoneColors = (t) => ({ ok: t.working, warn: C.warn, crit: t.blocked, off: C.detail });
