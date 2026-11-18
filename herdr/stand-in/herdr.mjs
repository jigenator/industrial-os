// A stand-in for the app's `herdr` module. A test sets `state` to the window it wants (lists in herdr.d.ts's
// shapes), and reads back what the mod asked for: `state.runs`, `state.overlays`, `state.shared`, `state.hc`.
export const state = {
	spaces: [], agents: [], terminals: [], panes: [], focused: null, props: {}, width: 300, shared: {}, runs: [], overlays: [], waiting: [], git: {}, hc: [],
	keys: [{ keys: "cmd-p", action: "mod.open:picker" }, { keys: "cmd-t", action: "tab.new" }, { keys: "cmd-\\", action: "industrial-os.fold" }],
	machine: "mac", update: false, checking: false,
	changed() {}, // set by the simulation: live data or a shared value changed
};
export const agents = () => state.agents, spaces = () => state.spaces, panes = () => state.panes, terminals = () => state.terminals;
export const appHome = () => "/app", home = () => "/Users/operator", checking = () => state.checking, focused = () => state.focused;
export const fonts = () => ["JetBrainsMono NFM"], keys = () => state.keys, props = () => state.props, settings = () => ({ font_family: "JetBrainsMono NFM" });
export const layout = () => ({ id: "root", children: [{ id: "sidebar", size: { px: state.width } }] });
export const nextCommand = () => new Promise((resolve) => state.waiting.push(resolve));
/** Delivers a key command to every copy waiting for one. */
export const command = (name) => { for (const resolve of state.waiting.splice(0)) resolve(name); };
export function run(name, args) {
	state.runs.push([name, args]);
	if (name === "layout.resize" && args?.id === "sidebar") { state.width = args.px; state.changed(); }
}
export const exec = async (cmd, _args, options) => {
	if (cmd === "hostname") return { code: 0, stdout: `${state.machine}\n` };
	const g = state.git[options?.cwd];
	return g ? { code: 0, stdout: `${g[0]}\t${g[1]}\n` } : { code: 1, stdout: "" };
};
// There is no core behind the stand-in: every `hc` call is recorded and fails.
export const hc = async (args) => { state.hc.push(args); return { code: 1, stdout: "", stderr: "no core in the stand-in" }; };
export const setAgentOrder = () => {}, shared = (k) => state.shared[k];
export const setShared = (k, v) => { state.shared[k] = v; state.changed(); };
// The acid-black theme's values.
export const theme = () => ({ working: "#c0fe04", blocked: "#f24723", done: "#ffffff", foreground: "#ffffff", dim: "#717171", muted: "#cfcfcf", input: "#555555", selected: "#1c1c1c", hover: "#333333", surface: "#111111", raised: "#1c1c1c", popover: "#111111" });
export const updates = () => ({ app: { ready: state.update } }), window = () => ({ active: true, platform: "macos" });
export const openOverlay = (spec) => { state.overlays.push(spec); return `o${state.overlays.length}`; };
export const closeOverlay = (id) => { state.runs.push(["closeOverlay", id]); return null; };
