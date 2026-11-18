// A stand-in for gpui-kit: an element is a chain that records its style as CSS, its handlers, motions and children.
// It knows only the methods the mods use and throws on any other, so a misspelt or new call shows at once; add a
// method here only after finding it in the app's gpui-kit.d.ts.
export const current = { entity: null }; // the view being rendered: its elements' handlers get its cx

const px = (v) => v;
const set = (prop) => (s, v) => { s[prop] = v; };
const sides = (a, b) => (s, v) => { s[a] = v; s[b] = v; };
const STYLE = {
	w: set("width"), h: set("height"), min_w: set("min-width"), min_h: set("min-height"), max_w: set("max-width"), max_h: set("max-height"),
	size: (s, v) => { s.width = v; s.height = v; }, size_full: (s) => { s.width = "100%"; s.height = "100%"; }, w_full: (s) => { s.width = "100%"; }, h_full: (s) => { s.height = "100%"; },
	flex_none: (s) => { s.flex = "none"; }, flex_1: (s) => { s.flex = "1 1 0%"; }, flex_shrink_1: (s) => { s["flex-shrink"] = 1; },
	absolute: (s) => { s.position = "absolute"; }, relative: (s) => { s.position = "relative"; },
	left: set("left"), top: set("top"), right: set("right"), bottom: set("bottom"),
	bg: set("background-color"), text_color: set("color"), text_size: set("font-size"), font_weight: set("font-weight"),
	font_family: (s, v) => { s["font-family"] = `"${v}"`; }, line_height: set("line-height"),
	items_center: (s) => { s["align-items"] = "center"; }, items_start: (s) => { s["align-items"] = "flex-start"; }, flex_wrap: (s) => { s["flex-wrap"] = "wrap"; }, justify_center: (s) => { s["justify-content"] = "center"; }, justify_end: (s) => { s["justify-content"] = "flex-end"; },
	gap: set("gap"), px: sides("padding-left", "padding-right"), py: sides("padding-top", "padding-bottom"),
	pt: set("padding-top"), pb: set("padding-bottom"), pl: set("padding-left"), pr: set("padding-right"),
	mt: set("margin-top"), mb: set("margin-bottom"), ml: set("margin-left"), mx: sides("margin-left", "margin-right"),
	opacity: set("opacity"), rounded: set("border-radius"),
	overflow_hidden: (s) => { s.overflow = "hidden"; }, overflow_y_scroll: (s) => { s["overflow-y"] = "scroll"; }, overflow_y_scrollbar: (s) => { s["overflow-y"] = "scroll"; },
	whitespace_nowrap: (s) => { s["white-space"] = "pre"; },
	truncate: (s) => { s.overflow = "hidden"; s["text-overflow"] = "ellipsis"; s["white-space"] = "pre"; },
	cursor_pointer: () => {},
	h_flex: (s) => { s.display = "flex"; s["flex-direction"] = "row"; s["align-items"] = "center"; }, v_flex: (s) => { s.display = "flex"; s["flex-direction"] = "column"; },
	border_t: (s, v = 1) => { s["border-top-width"] = v; s["border-top-style"] = "solid"; }, border_l: (s, v = 1) => { s["border-left-width"] = v; s["border-left-style"] = "solid"; },
	border_color: set("border-color"),
};
const EVENTS = ["on_click", "on_hover", "on_mouse_move", "on_size_change"]; // and on_mouse_down, which names its button
function styler(style, owner) {
	const proxy = new Proxy({}, { get: (_t, name) => (...args) => { if (!STYLE[name]) throw new Error(`style ${name} in ${owner}`); STYLE[name](style, ...args); return proxy; } });
	return proxy;
}
export function el(kind, arg) {
	const node = { kind, arg, id: null, handlers: {}, kids: [], style: {}, transitions: [], loop: null, frames: null, hover: null, active: null, owner: current.entity };
	if (kind === "h_flex") Object.assign(node.style, { display: "flex", "flex-direction": "row", "align-items": "center" });
	if (kind === "v_flex") Object.assign(node.style, { display: "flex", "flex-direction": "column" });
	const proxy = new Proxy(node, {
		get(target, name) {
			if (name === "__node") return target;
			if (typeof name !== "string" || name === "then") return undefined;
			return (...args) => {
				if (name === "id") target.id = args[0];
				else if (name === "when") { if (args[0]) args[1](proxy); }
				else if (name === "map") return args[0](proxy);
				else if (name === "child") target.kids.push(args[0]);
				else if (name === "children") target.kids.push(...args[0]);
				else if (name === "on_mouse_down") target.handlers[`on_mouse_down:${args[0]}`] = args[1];
				else if (EVENTS.includes(name)) target.handlers[name] = args[0];
				else if (name === "hover") { target.hover ??= {}; args[0](styler(target.hover, name)); }
				else if (name === "active") { target.active ??= {}; args[0](styler(target.active, name)); } // recorded; a press is not played
				else if (name === "transition") target.transitions.push({ prop: args[0], ...(typeof args[1] === "number" ? { duration: args[1] } : args[1]) });
				else if (name === "loop") target.loop = { prop: args[0], ...args[1] };
				else if (name === "frames") target.frames = { list: args[0], ms: args[1] };
				else if (STYLE[name]) STYLE[name](target.style, ...args);
				else throw new Error(`gpui-kit stand-in has no ${name}()`);
				return proxy;
			};
		},
	});
	return proxy;
}
export const div = () => el("div"), image = (path) => el("image", path), svg = (path) => el("svg", path);
export class View {}
