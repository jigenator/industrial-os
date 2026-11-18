// The sheet every part is set on: the sidebar's column and row measures, in px, and two small conversions.
// Everything starts 18 in from the left (INNER + PAD) and ends 18 from the right.
import { monoAdvance } from "../assets.js";
import { SIDEBAR_COLORS as C } from "../vocabulary.js";

export const INNER = 14, PAD = 4;
/** One character of the 11 px text; a state code's column; where a pane's name starts. */
export const CH = monoAdvance(11), CODE_W = 4 * CH, NAME_X = 14 + CODE_W + CH;
/** A terminal row; the crate plate's six rows; a space's band. */
export const ROW = 18.5, PLATE_H = ROW * 6, BAND_H = 25;
/** One step of a state mark and of ticker tape, in ms. */
export const STEP_MS = 110;
export const BLACK = C.black, WHITE = C.white;

/** A hex colour at an opacity, as `#rrggbbaa`. */
export const rgba = (hex, alpha) => `${hex}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0")}`;
/** A list without its empty places: parts leave out what they do not draw. */
export const present = (list) => list.filter(Boolean);
/** A press on a control in the window-drag header must not start a drag. */
export const hold = (_event, cx) => cx.stop_propagation();

// An element's id is its identity in the whole view (its motion and hover state are kept by it), so a view that
// draws one part twice gives each drawing its own names.
let scope = "";
/** A part's element id. Parts name every element that moves, hovers or scrolls through this. */
export const partId = (name) => name + scope;
/** Draws with every part id ending in `suffix`: `scoped("#2", () => paneRow(…))`. The sidebar draws each part once and never needs it. */
export function scoped(suffix, draw) {
	const before = scope;
	scope = before + suffix;
	try { return draw(); } finally { scope = before; }
}
