// Loads the pane header (the industrial-os mod's `part: "plate"`, plate/view.js) in herdr-app's own runtime with
// sample panes, one state at a time: `herdr-app check` on a temporary copy of the mod whose main.js is the plate's
// view alone, whose `herdr` import in that view is a stand-in returning that state, and whose first frame is composed
// in init (render prints the element description only once). The header's width and the font's advance, which the mod
// measures from layout, are given as 2x-display samples (8.40625 px, a 0.5 px remainder). Read-only for the running
// app: `herdr-app check` uses a hidden window and in-memory state. Prints each state's result, the plate's cells as
// placed (text as itself, `#` a full-height bar or block, `=` a part block, `-` a line, `/` `\` the peak's
// triangles), the grid checks, and the compose and draw times in the runtime.
//
// With no state named it also loads the Pi Reloader's window the same way (a copy whose main.js is reloader/view.js,
// unpatched: the check's empty app has no Pi, and nothing runs), since `herdr-app check` passes no props and so draws
// only the sidebar's list from the mod's real main.js.
//
//   node herdr/scripts/check-droid-plate.mjs [state …]
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MOD = join(dirname(fileURLToPath(import.meta.url)), "..", "mods", "industrial-os");
const VIEW = join("plate", "view.js");
const SESSION = "01a1e81c-27f3-70f3-b278-150c4f01fa03";
const now = Date.now();
const signals = (over = {}) => JSON.stringify({ version: 1, sessionId: SESSION, root: { working: false, lastSettledAt: now - 60_000 }, ...over });
const PI = { app: "pi", status: "idle", program: { key: "pi", name: "Pi", agent: true, shell: false } };
const SHELL = { app: null, status: null, program: { key: "shell", name: "zsh", agent: false, shell: true } };
const STATES = {
	"pi-idle": { pane: PI, labels: { "io.signals.v1": signals() } },
	"pi-tool": { pane: { ...PI, status: "working" }, labels: { "io.signals.v1": signals({ root: { working: true }, phase: { kind: "tool", tool: "bash", target: "npm test -- --watch=false", since: now - 42_000 } }) } },
	"pi-blocked": { pane: { ...PI, status: "blocked" }, labels: { "io.signals.v1": signals({ question: { text: "Which trade-off?", more: 0, since: now } }) } },
	"pi-done": { pane: { ...PI, status: "done" }, labels: { "io.signals.v1": signals() } },
	// A Pi already running at the first look, before its label: DRD-???? (STARTING shows only for a Pi that starts later).
	"pi-unlabelled": { pane: PI, labels: {} },
	agent: { pane: { app: "claude-code", status: "working", program: { key: "claude", name: "Claude Code", agent: true, shell: false } }, labels: {} },
	shell: { pane: SHELL, labels: {} },
	running: { pane: { app: null, status: null, program: { key: "npm", name: "npm", agent: false, shell: false } }, labels: {} },
	unfocused: { pane: { ...SHELL, focused: false }, labels: {} },
	inactive: { pane: PI, labels: { "io.signals.v1": signals() }, active: false },
	zoomed: { pane: { ...SHELL, zoomed: true }, labels: {}, cols: 64 },
	narrow: { pane: PI, labels: { "io.signals.v1": signals() }, cols: 40 },
	wide: { pane: PI, labels: { "io.signals.v1": signals() }, cols: 198 },
	// Wider than the composed plate: 256 columns drawn, the middle widened so the block and bay end on W − 3.
	huge: { pane: SHELL, labels: {}, cols: 1200 },
	"huge-pi": { pane: PI, labels: { "io.signals.v1": signals() }, cols: 1200 },
	// A Pi whose label is malformed while Herdr says it works: WORKING from Herdr, no phase or clock.
	"pi-malformed": { pane: { ...PI, status: "working" }, labels: { "io.signals.v1": JSON.stringify({ version: 1, sessionId: SESSION, root: { working: "yes" } }) } },
	// Mid lighting switch (dark to lit): a second layer in four banks, drawn at opacity 0 with its transitions.
	switching: { pane: PI, labels: { "io.signals.v1": signals() }, mode: "switch" },
	"switching-wide": { pane: PI, labels: { "io.signals.v1": signals() }, mode: "switch", cols: 256 },
	// Mid hand-back: the outgoing plate's rows over the terminal plate, drawn at full width with their transitions.
	reveal: { pane: SHELL, labels: {}, mode: "reveal" },
	// A wide Pi 300 ms into its CRT boot: the warm frame is a character-level motion frame, composed on the timer.
	booting: { pane: PI, labels: { "io.signals.v1": signals() }, cols: 198, mode: "boot" },
};

const FAKE_HERDR = `import { STATE } from "./sample-state.js";
export const panes = () => STATE.panes;
export const terminals = () => STATE.terminals;
export const props = () => ({ pane: STATE.panes[0].pane, terminal: STATE.panes[0].terminal });
export const run = () => null;
export const hc = async () => ({ code: 0, stdout: JSON.stringify({ cols: STATE.terminals[0].cols, foreground: { argv: ["npm", "run", "dev"] } }) });
export const home = () => "/Users/sample";
export const settings = () => ({ font_family: "JetBrains Mono", font_size: 14 });
export const window = () => ({ active: STATE.active });
export const MODE = STATE.mode ?? null;
`;

function patch(source) {
	const swap = (from, to) => {
		if (!source.includes(from)) throw new Error(`check-droid-plate: plate/view.js no longer contains ${JSON.stringify(from.slice(0, 60))}`);
		source = source.replace(from, to);
	};
	swap('from "herdr";', 'from "../sample-herdr.js"; import { MODE as __MODE__ } from "../sample-herdr.js";');
	// In init: measure, compose the first frame (and for the motion states, the change), time a warm frame.
	swap("		this.startPoll(cx);\n	}", `		{ const now = Date.now(); this.advance = 8.40625; this.width = terminals()[0].cols * 8.5 + 0.5; this.want = this.read(cx, panes()[0], now); this.wantKey = JSON.stringify({ ...this.want, model: { ...this.want.model, nextAt: null } });
		if (__MODE__ === "switch") { const lit = this.want; this.want = { ...lit, lighting: "dark" }; this.compose(now - 5, true); this.want = lit; }
		const t0 = Date.now(); this.compose(now, true); globalThis.__COMPOSE_MS__ = Date.now() - t0;
		if (__MODE__ === "reveal") { this.timeline = { ...this.timeline, reveal: { id: 99, start: now, primedAt: null, outgoing: this.shown.layers[0].lines } }; this.compose(now, false); }
		if (__MODE__ === "boot") { this.compose(now, false); this.timeline = { ...this.timeline, boot: { start: now - 300, seed: 7 } }; }
		const t1 = Date.now(); this.compose(now + 30, false); globalThis.__FRAME_MS__ = Date.now() - t1; }
		this.startPoll(cx);
	}`);
	swap("	render(cx) {", "	render(cx) { const t0 = Date.now(); const out = this.render2(cx); globalThis.__DRAW_MS__ = Date.now() - t0; return out.child(`COMPOSE_MS ${globalThis.__COMPOSE_MS__} DRAW_MS ${globalThis.__DRAW_MS__} FRAME_MS ${globalThis.__FRAME_MS__}`).child(`PLAN ${planText(this.shown?.layers.at(-1)?.plan, this.shown)}`); }\n	render2(cx) {");
	source += PLAN_TEXT;
	return source;
}

// Appended to the copy's plate/view.js: the plan as placed cells, rows joined by `@@`, then the grid checks: the cell, the
// columns, whether every piece starts on a cell boundary, and the right edge of the last bay key.
const PLAN_TEXT = `
function planText(plan, shown) {
	if (!plan) return "none";
	const { cell, cols } = plan, rows = Array.from({ length: 7 }, () => Array(cols).fill(" "));
	const tops = [0, 18.5, 37, 55.5, 74, 92.5, 111], rowOf = (y) => tops.findIndex((t, i) => y >= t && y < (tops[i + 1] ?? 130));
	let off = 0;
	const put = (piece, ch, span = false, inside = false) => {
		const c0 = piece.x / cell, n = span ? Math.max(1, Math.round(piece.w / cell)) : 1;
		if (!inside && Math.abs(c0 - Math.round(c0)) > 1e-6) off++;
		const r = rowOf(piece.y);
		for (let i = 0; i < n; i++) if (rows[r] && Math.floor(c0) + i < cols) rows[r][Math.floor(c0) + i] = ch;
	};
	for (const t of plan.texts) put(t, t.ch);
	for (const r of plan.rects) {
		if (r.kind === "band") { put(r, "/", false, true); continue; }
		const whole = Math.abs(r.w - cell * Math.round(r.w / cell)) < 1e-6;
		put(r, r.kind === "line" ? "-" : whole ? "#" : "=", r.kind === "line" || whole, r.kind === "block" && !whole);
	}
	for (const b of plan.bgs) if (Math.abs(b.x / cell - Math.round(b.x / cell)) > 1e-6) off++;
	const bay = plan.hits.at(-1), bayEnd = bay ? (bay.x + bay.w) / cell : null;
	const banked = shown.layers.filter((l) => l.schedule).map((l) => l.schedule.map((b) => b.delay + "+" + b.duration).join(",")).join(" ");
	return rows.map((r) => r.join("")).join("@@") + "@@CELL " + cell + " COLS " + cols + " OFFGRID " + off + " BAYEND " + bayEnd + " LAYERS " + shown.layers.length + (banked ? " BANKS " + banked : "") + " REVEAL " + (shown.reveal ? "rows" : "none");
}
`;

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STATES);
let failed = 0;
for (const name of names) {
	const state = STATES[name];
	if (!state) throw new Error(`unknown state ${name}; one of ${Object.keys(STATES).join(", ")}`);
	const dir = mkdtempSync(join(tmpdir(), "droid-plate-check-"));
	try {
		cpSync(MOD, dir, { recursive: true, filter: (path) => !path.endsWith(".gen") });
		writeFileSync(join(dir, VIEW), patch(readFileSync(join(MOD, VIEW), "utf8")));
		// The copy is the pane header alone: the real main.js would ask the app, not the sample, which piece it is.
		writeFileSync(join(dir, "main.js"), 'export { DroidPlate as default } from "./plate/view.js";\n');
		writeFileSync(join(dir, "sample-herdr.js"), FAKE_HERDR);
		const pane = { pane: "p1", terminal: "t3h", tab: "tb", title: "zsh", cwd: "/Users/sample/projects/lunalee", branch: "main", focused: true, zoomed: false, movable: true, ...state.pane };
		const terminal = { address: "t3h", argv: ["/bin/zsh", "-l"], cols: state.cols ?? 99, state: "live", labels: state.labels };
		writeFileSync(join(dir, "sample-state.js"), `export const STATE = ${JSON.stringify({ panes: [pane], terminals: [terminal], active: state.active ?? true, mode: state.mode ?? null })};\n`);
		let out, ok = true;
		try {
			out = execFileSync("herdr-app", ["check", dir, "--print-spec"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
		} catch (error) {
			ok = false;
			out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
		}
		const [, ms, drawMs, frameMs] = /COMPOSE_MS (\d+) DRAW_MS (\d+) FRAME_MS (\d+)/.exec(out) ?? [];
		const planLine = /text "PLAN (.*)"\s*$/m.exec(out)?.[1]?.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
		const parts = planLine ? planLine.split("@@") : [];
		const rows = parts.slice(0, 7), checks = parts.slice(7).join("@@");
		const cols = Number(/COLS (\d+)/.exec(checks)?.[1]), off = Number(/OFFGRID (\d+)/.exec(checks)?.[1]), bayEnd = Number(/BAYEND (\S+)/.exec(checks)?.[1]);
		const expectLayers = state.mode === "switch" ? 2 : 1, layers = Number(/LAYERS (\d+)/.exec(checks)?.[1]);
		const revealOk = (state.mode === "reveal") === /REVEAL rows/.test(checks);
		const grid = rows.length === 7 && off === 0 && (cols < 24 || bayEnd === cols - 2) && layers === expectLayers && revealOk;
		if (!ok || !grid) { failed++; console.log(`${name}: FAILED ${checks}\n${out.split("\n").filter((l) => /interrupted|error|at |check/i.test(l)).slice(0, 12).join("\n")}`); if (process.env.DP_DEBUG) console.log(out.slice(0, 3000)); continue; }
		console.log(`${name}: passed, first compose ${ms} ms, a warm frame ${frameMs} ms, draw ${drawMs} ms in the runtime; ${checks}\n${rows.map((r) => `  |${r}|`).join("\n")}`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
if (!process.argv.slice(2).length) {
	const dir = mkdtempSync(join(tmpdir(), "pi-reloader-check-"));
	try {
		cpSync(MOD, dir, { recursive: true, filter: (path) => !path.endsWith(".gen") });
		writeFileSync(join(dir, "main.js"), 'export { PiReloader as default } from "./reloader/view.js";\n');
		let out;
		try { out = execFileSync("herdr-app", ["check", dir, "--print-spec"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 }); } catch (error) { out = `FAILED ${error.stdout ?? ""}${error.stderr ?? ""}`; }
		const drawn = !out.startsWith("FAILED") && ["Pi Reloader", "Reload all Pi", "Reset all Pi", "IDLE OR DONE PI (0)"].every((text) => out.includes(text));
		if (!drawn) { failed++; console.log(`pi-reloader: FAILED\n${out.slice(0, 1500)}`); } else console.log("pi-reloader: passed, the empty window drew in the runtime");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
console.log(failed ? `${failed} of ${names.length} states failed` : `all ${names.length} states passed`);
process.exitCode = failed ? 1 : 0;
