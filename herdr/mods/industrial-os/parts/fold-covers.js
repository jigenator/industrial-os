// A fold in motion, over one block. Nothing is clipped or scaled: rows are erased and typed in by covers of ground
// that grow or shrink from the right, and the unfold's scan line is the left edge of one such cover.
import { div, image } from "gpui-kit";
import { SCAN_BACK_MS, SCAN_OUT_MS, eraseRows, scanSegments } from "../fold.js";
import { SIDEBAR_ALPHA as A, SIDEBAR_COLORS as C } from "../vocabulary.js";
import { ROW, partId, rgba } from "./sheet.js";

/**
 * A layer for a relative block `width` × `height`.
 * `motion`: { at, kind: "fold" | "unfold", step: 0–3 }, stepped at the times in fold.js's FOLD_TIMES.
 * `part`: the block's name, which seeds its rows and picks its ground ("top" is the plate's). `folded`: the block is
 * the rail now. `field`: the block's own dotted ground as { path, width, height }, or null for the plain colour.
 */
export function foldCovers(t, { motion: m, part, folded, width: W, height: H, field = null }) {
	const rows = Math.ceil(H / ROW), key = `${part}-${m.at}-${folded ? "r" : "w"}`, seed = `${m.at}/${part}`;
	// A flickering cover lets its row show through in bursts until it goes.
	const cover = (id, y, h, w, flicker = false) => div().id(partId(id)).absolute().right(0).top(y).h(h).w(w).overflow_hidden()
		.child(div().absolute().right(0).top(0).w(W).h(h).bg(part === "top" ? C.groundTop : C.groundBottom)
			.when(field, (el) => el.child(image(field.path).absolute().right(0).top(-y).w(field.width).h(field.height)))
			.when(flicker, (el) => el.loop("opacity", { from: 0.25, to: 1, period: 100 })));
	const els = [];
	if (m.kind === "fold" && m.step < 2) {
		eraseRows(seed, rows).forEach((row, i) => {
			if (row.flicker && m.step === 1) els.push(cover(`ios-flick-${key}-${i}`, i * ROW, ROW, W).loop("opacity", { from: 0, to: 0.75, period: 100 }));
			els.push(cover(`ios-erase-${key}-${i}`, i * ROW, ROW, m.step ? W : 0).transition("width", { duration: row.duration, delay: row.delay, easing: row.easing }));
		});
	}
	if (m.step >= 2) {
		// The new rows come in as the old ones went: in no order, some at once, some after a flicker, some slowly.
		eraseRows(`${seed}/in`, rows).forEach((row, i) => els.push(cover(`ios-type-${key}-${i}`, i * ROW, ROW, m.step < 3 ? W : 0, row.flicker && m.step === 3)
			.transition("width", { duration: row.duration, delay: row.delay, easing: row.easing })));
	}
	if (m.kind === "unfold") {
		// Power-on: the line runs to the left edge and the rail goes dark behind it; the sidebar opens; the line runs back.
		const out = m.step < 2, moved = out ? m.step >= 1 : m.step >= 3, policy = out ? { duration: SCAN_OUT_MS, easing: "ease-in" } : { duration: SCAN_BACK_MS, easing: "ease-out" };
		els.push(cover(`ios-wipe-${key}-${out ? "a" : "b"}`, 0, H, out === moved ? W : 0).transition("width", policy));
		els.push(div().id(partId(`ios-scan-${key}-${out ? "a" : "b"}`)).absolute().top(0).left(out === moved ? 2 : W - 2).w(2).h(H).opacity(!out && moved ? 0 : 1)
			.transition("left", policy).transition("opacity", { duration: 120, delay: SCAN_BACK_MS - 20 })
			.child(div().absolute().left(-3).top(0).w(8).h(H).bg(rgba(t.working, A.sweep)))
			.children(scanSegments(seed, H).map((sg) => {
				const piece = div().absolute().left(sg.dx).top(sg.y).w(sg.w).h(sg.h).bg(t.working);
				return sg.broken ? piece.loop("opacity", { from: sg.opacity * 0.3, to: sg.opacity, period: 100 + (sg.y % 7) * 12 }) : piece;
			})));
	}
	return div().absolute().left(0).top(0).size_full().overflow_hidden().children(els);
}
