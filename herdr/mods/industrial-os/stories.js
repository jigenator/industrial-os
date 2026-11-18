// The storybook's stories: each part alone, in its states, on invented data (sample.js).
// A story is { id, title, about, states(), moves?, uses? }: `moves` redraws it on the mark clock, `uses` names the
// nested views it places ("plateMap", "spaceMap", "ground", "readout"), each at most once.
// A state is { label, render(s), width?, full?, ground?, height? }: `render` returns an element or a list of them,
// on a sheet `width` px wide (300) with the list's side margins unless `full`; `height` makes a box for absolute
// elements. What `s` holds is written on the Storybook view (storybook.js).
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { groundSvg as fieldSvg } from "./assets.js";
import { FOLD_TIMES } from "./fold.js";
import { BLEED, VIEW_H } from "./map.js";
import { SIDEBAR_COLORS as C } from "./vocabulary.js";
import { actionRequired } from "./parts/action-required.js";
import { cratePlate, cratePlateRail } from "./parts/crate-plate.js";
import { picture } from "./parts/drawings.js";
import { foldCovers } from "./parts/fold-covers.js";
import { hideGrip } from "./parts/hide-grip.js";
import { keyParts, keyPlate } from "./parts/key-plate.js";
import { bar, hoverBar } from "./parts/light.js";
import { sign, stateMark, toneColors } from "./parts/marks.js";
import { contextBar, contextText, paneRow, paneRowHeight, unitCount, unitIcons } from "./parts/pane-row.js";
import { railLamp } from "./parts/rail-lamp.js";
import { readoutWidth, scannerFrame, scannerStill } from "./parts/scanner.js";
import { searchHint } from "./parts/search-hint.js";
import { BLACK, CH, INNER, PAD, PLATE_H, STEP_MS, WHITE, present } from "./parts/sheet.js";
import { shortcutStrip, unfoldStrip } from "./parts/shortcut-strip.js";
import { spaceBand } from "./parts/space-band.js";
import { groupTitle, tabTitle, tabTitleChars } from "./parts/titles.js";
import { cutLine, lit, tape, word } from "./parts/text.js";
import { viewRuler } from "./parts/view-ruler.js";
import { sampleSpaces } from "./sample.js";

// A story shows what a part draws; its handlers do nothing.
const no = () => {};
const SHEET = 300, COLUMN = SHEET - 2 * INNER, RAIL = 76;
const LONG = "DAVIDS-VERY-LONG-MACBOOK-PRO";

/** The sample window with a bench of panes in the states its nine do not reach. */
export const storySpaces = () => [...sampleSpaces(), { name: "bench", branch: "main", tabs: [
	{ name: "a tab whose title is far too long for one line of the sidebar", panes: [
		{ key: "x1", kind: "unlabelled", title: "A Pi before its label" },
		{ key: "x2", title: "A Pi that does not know its readings", sig: { units: null, context: null, settled: 60_000 } },
		{ key: "x3", title: "Everything a pane can carry", sig: { question: "Ship the migration tonight, or hold it for the morning window and the second reviewer?", since: 75_000, flag: true, goal: 4000, units: 15, context: 93, dirty: true, pr: 512, compactions: 3 } },
	] },
	{ name: "questions", panes: Array.from({ length: 4 }, (_, i) => ({ key: `q${i}`, title: `Question ${i + 1}`, sig: { question: `Is option ${i + 1} acceptable for the rollout?`, since: 20_000 * (i + 1), context: 20 * i + 5 } })) },
] }];

const row = (...children) => h_flex().gap(14).items_center().children(present(children));
const column = (...children) => v_flex().gap(6).children(present(children));
const named = (element, name) => h_flex().gap(6).items_center().child(element).child(word(name, C.detail));
const pane = (s, u, more = {}) => paneRow(s.t, { unit: u, where: "m", inner: COLUMN, now: s.now, onHover: no, onClick: no, onMove: no, ...more });
const paneState = (label, key, more, focus) => ({ label, render: (s) => pane(s, s.unit(key, focus), typeof more === "function" ? more(s) : more) });

export const STORIES = [
	{ id: "marks", title: "MARKS", moves: true, about: "sign and stateMark. A state is always a code and a mark; colour only adds emphasis. The moving marks step with the clock.", states: () => [
		{ label: "STATE MARKS · LIT, STEPPING", render: (s) => { const tone = toneColors(s.t); return row(...[["QNS", tone.blocked], ["BLK", tone.blocked], ["WRK", tone.working], ["SUB", tone.working], ["RUN", tone.working]].map(([code, color]) => h_flex().child(stateMark(code, color, s.now)).child(lit(code, color)))); } },
		{ label: "STATE MARKS · AT REST", render: (s) => row(...[["DNE", WHITE], ["IDL", C.detail], ["UNK", C.detail]].map(([code, color]) => h_flex().child(stateMark(code, color, s.now)).child(word(code, color, 800)))) },
		{ label: "SIGNS", render: () => h_flex().flex_wrap().gap(6).children(["machine", "droid", "spaces", "command", "search", "flag", "flag-lit", "pointer-lit"].map((name) => named(sign(name, C.name), name).w(84))) },
		{ label: "SIGNS · DRAWN LARGER, TINTED", render: (s) => row(sign("search", s.t.working, 12, 12), sign("flag-lit", s.t.blocked, 9), sign("droid", C.paper, 9, 9, 14)) },
	] },
	{ id: "text", title: "TEXT", about: "lit, word, cutLine and tape. Lit text is crisp with its own colour bleeding under it; the light is a drawing, so it comes a tick after the text.", states: () => [
		{ label: "LIT · THE STATE COLOURS", render: (s) => row(lit("WRK ON TASK", s.t.working), lit("QNS RFI", s.t.blocked), lit("DNE", WHITE)) },
		{ label: "LIT · WEIGHT 400 ON A 15 PX LINE", render: (s) => row(lit("03AU", s.t.working, { weight: 400, line: 15 }), lit("93%", s.t.blocked, { weight: 400, line: 15 }), lit("71%", C.warn, { weight: 400, line: 15 })) },
		{ label: "LIT · NO LIGHT", render: (s) => row(lit("WRK", s.t.working, { glow: false })) },
		{ label: "WORD", render: () => row(word("a name", C.name), word("a reading", C.reading), word("a detail", C.detail), word("HEAVY", C.name, 800)) },
		{ label: "CUT LINE · 150 PX", render: () => h_flex().w(150).child(cutLine("Rebuild the ingest queue and then some more", C.name)) },
		{ label: "TICKER TAPE · 12 CHARACTERS", render: () => div().w(12 * CH).overflow_hidden().font_weight(800).text_color(C.name).frames(tape(LONG, 12), STEP_MS) },
	] },
	{ id: "light", title: "LIGHT", about: "bar and hoverBar. A glow behaves like a light: soft, and pulsing slowly where it is a lamp. A bar is a list of elements for an absolute parent.", states: () => [
		{ label: "BAR · PLAIN", height: 10, render: () => bar(0, 4, 120, 2, C.detail) },
		{ label: "BAR · WITH ITS LIGHT", height: 10, render: (s) => bar(0, 4, 120, 2, s.t.working, { glow: s.t.working, strong: 0.55 }) },
		{ label: "BAR · A LAMP, THE GUTTER BAR", height: 37, render: (s) => bar(4, 1, 3, 33, s.t.working, { radius: 2, glow: s.t.working, pulse: true, strong: true }) },
		{ label: "BAR · A LIT DOT", height: 9, render: (s) => bar(4, 2, 5, 5, s.t.working, { radius: 3, glow: s.t.working }) },
		{ label: "HOVER BAR · GROWS FROM ITS MIDDLE, THEN PULSES", height: 37, render: (s) => div().absolute().left(12).top(0).w(20).h(35).children(hoverBar("story", 35, s.flip)) },
	] },
	{ id: "key-plate", title: "KEY PLATE", about: "keyPlate and keyParts. A shortcut is the same plate everywhere, from a binding as keys.json writes it.", states: () => [
		{ label: "ON THE INPUT GREY", render: (s) => row(keyPlate("cmd-p", s.t.input, WHITE), keyPlate("cmd-shift-t", s.t.input, WHITE), keyPlate("f5", s.t.input, WHITE)) },
		{ label: "ON ACID, AND ACID ON BLACK", render: (s) => row(keyPlate("cmd-\\", s.t.working, BLACK), keyPlate("ctrl-alt-x", BLACK, s.t.working)) },
		{ label: "keyParts", width: 420, render: () => column(...["cmd-p", "ctrl-alt-shift-x", "cmd--"].map((binding) => word(`${binding}  →  ${JSON.stringify(keyParts(binding))}`, C.reading))) },
	] },
	{ id: "crate-plate", uses: ["plateMap"], title: "CRATE PLATE", about: "cratePlate and cratePlateRail. The paper label at the top: the maker, three readings and the map under a crosshair.", states: () => [
		{ label: "RUNNING · THE MAP UNDER THE CROSSHAIR", full: true, ground: C.groundTop, render: (s) => cratePlate({ machine: "MAC", droids: s.rest.counts.droids, spaces: s.rest.counts.spaces, map: s.plateMap, onHover: no, onSize: no }) },
		{ label: "STANDBY · NO DROIDS, NO NAME", full: true, ground: C.groundTop, render: () => cratePlate({ machine: "", droids: 0, spaces: 1, map: div(), onHover: no, onSize: no }) },
		{ label: "A LONG NAME IS CUT AT 12", full: true, ground: C.groundTop, render: () => cratePlate({ machine: LONG, droids: 3, spaces: 2, map: div(), onHover: no, onSize: no }) },
		{ label: "A LONG NAME UNDER THE POINTER · TICKER TAPE", full: true, ground: C.groundTop, render: () => cratePlate({ machine: LONG, droids: 3, spaces: 2, hot: true, map: div(), onHover: no, onSize: no }) },
		{ label: "RAIL · PANES NEED YOU", full: true, width: RAIL, ground: C.groundTop, render: (s) => cratePlateRail(s.t, { droids: 6, need: 2 }) },
		{ label: "RAIL · STANDBY", full: true, width: RAIL, ground: C.groundTop, render: (s) => cratePlateRail(s.t, { droids: 0, need: 0 }) },
	] },
	{ id: "shortcut-strip", title: "SHORTCUT STRIP", about: "shortcutStrip and unfoldStrip. Glass under the plate: text keys when open, the strip that unfolds the sidebar on the rail.", states: () => [
		{ label: "TWO KEYS", full: true, ground: C.groundTop, render: (s) => shortcutStrip(s.t, [{ id: "a", text: "SETTINGS", onClick: no }, { id: "b", text: "ADD MACHINE", onClick: no }]) },
		{ label: "AN UPDATE IS READY · A LIT DOT ON ITS KEY", full: true, ground: C.groundTop, render: (s) => shortcutStrip(s.t, [{ id: "a", text: "SETTINGS", onClick: no, ready: true }, { id: "b", text: "ADD MACHINE", onClick: no }]) },
		{ label: "RAIL · AT REST", full: true, width: RAIL, ground: C.groundTop, render: (s) => unfoldStrip(s.t, { hot: false, width: RAIL, onHover: no, onClick: no }) },
		{ label: "RAIL · UNDER THE POINTER", full: true, width: RAIL, ground: C.groundTop, render: (s) => unfoldStrip(s.t, { hot: s.flip, width: RAIL, onHover: no, onClick: no }) },
	] },
	{ id: "search-hint", title: "SEARCH HINT", about: "searchHint. Not a field: a line that says search exists and which key opens it.", states: () => [
		{ label: "AT REST", render: (s) => searchHint(s.t, { binding: "cmd-p", onHover: no, onClick: no }) },
		{ label: "UNDER THE POINTER", render: (s) => searchHint(s.t, { binding: "cmd-p", hot: true, onHover: no, onClick: no }) },
		{ label: "ONE FRAME OF ITS FLICKER · THE FRINGES", render: (s) => searchHint(s.t, { binding: "cmd-p", hot: true, flick: { opacity: 0.45, fringe: true }, onHover: no, onClick: no }) },
		{ label: "NO KEY BOUND", render: (s) => searchHint(s.t, { binding: null, onHover: no, onClick: no }) },
		{ label: "RAIL · AT REST", width: RAIL, render: (s) => searchHint(s.t, { binding: "cmd-p", folded: true, onHover: no, onClick: no }) },
		{ label: "RAIL · UNDER THE POINTER", width: RAIL, render: (s) => searchHint(s.t, { binding: "cmd-p", folded: true, hot: true, onHover: no, onClick: no }) },
	] },
	{ id: "action-required", title: "ACTION REQUIRED", moves: true, about: "actionRequired. The panes that wait on you, pinned on red glass; rows are set like pane rows.", states: () => {
		const zone = (s, more) => actionRequired(s.t, { units: s.rest.action, inner: COLUMN, now: s.now, onRow: no, onPick: no, onMove: no, onLeave: no, onMore: no, ...more });
		return [
			{ label: "THREE WAITING", render: (s) => zone(s, { units: s.rest.action.slice(0, 3) }) },
			{ label: "A ROW UNDER THE POINTER · ITS BAR, ITS PLACE AS TAPE", render: (s) => zone(s, { units: s.rest.action.slice(0, 3), hover: s.flip ? s.rest.action[1].id : null }) },
			{ label: "MORE THAN ARE SHOWN", render: (s) => zone(s) },
			{ label: "ALL OF THEM, AND A LIT DOT NEAR THE POINTER", render: (s) => zone(s, { more: true, near: { x: 60, y: 30 } }) },
		];
	} },
	{ id: "view-ruler", title: "VIEW RULER", about: "viewRuler. The view switch: an index pointer under the active view, in acid; it follows the pointer in white.", states: () => {
		const ruler = (s, more) => viewRuler(s.t, { views: [["missions", "MISSIONS", 0], ["agents", "AGENTS", 8 * CH + 14]], active: "missions", width: COLUMN - 2 * PAD, onHover: no, onRoam: no, onPick: no, ...more });
		return [
			{ label: "MISSIONS", render: (s) => ruler(s) },
			{ label: "AGENTS", render: (s) => ruler(s, { active: "agents" }) },
			{ label: "FOLLOWING THE POINTER", render: (s) => ruler(s, { roam: s.flip ? 180 : 40 }) },
		];
	} },
	{ id: "space-band", title: "SPACE BAND", about: "spaceBand. A space is a band across the whole sidebar: its name, a caret, the add-tab key, and at the right only what needs you there.", states: () => {
		const band = (s, patch, more) => spaceBand(s.t, { space: { ...s.rest.missions[1], current: false, ...patch }, width: SHEET, tabKey: "cmd-t", onHover: no, onToggle: no, onAddHover: no, onAdd: no, ...more });
		return [
			{ label: "OPEN · ONE PANE NEEDS YOU", full: true, render: (s) => band(s) },
			{ label: "SHUT · COMMITS BEHIND", full: true, render: (s) => band(s, { open: false, need: 0, behind: 20 }) },
			{ label: "THE SPACE YOU ARE IN · ITS DOT GRID", full: true, render: (s) => band(s, { current: true, need: 0 }) },
			{ label: "UNDER THE POINTER", full: true, render: (s) => band(s, {}, { hot: true }) },
			{ label: "ITS ADD-TAB KEY UNDER THE POINTER · OPENS", full: true, render: (s) => band(s, {}, { hot: true, add: s.flip }) },
			{ label: "NO KEY BOUND TO A NEW TAB", full: true, render: (s) => band(s, {}, { hot: true, add: true, tabKey: null }) },
			{ label: "A LONG NAME IS CUT", full: true, render: (s) => band(s, { name: "a space with quite a long name indeed, longer than its band" }) },
		];
	} },
	{ id: "titles", title: "TITLES", about: "tabTitle and groupTitle. A title over a set of panes: a label, not a control.", states: () => {
		const chars = tabTitleChars(COLUMN), long = (s) => s.rest.missions.at(-1).tabs[0];
		const title = (s, tab, more) => tabTitle({ tab, chars, ground: C.groundBottom, onHover: no, onMenu: no, ...more });
		return [
			{ label: "A TAB", render: (s) => title(s, s.rest.missions[0].tabs[0]) },
			{ label: "A QUIET TAB · EVERY PANE AT REST", render: (s) => title(s, { ...s.rest.missions[0].tabs[0], quiet: true }) },
			{ label: "TOO LONG · FADES OUT AT THE RIGHT", render: (s) => title(s, long(s)) },
			{ label: "TOO LONG, UNDER THE POINTER · TICKER TAPE", render: (s) => title(s, long(s), { running: true }) },
			{ label: "A GROUP IN THE AGENTS VIEW", render: () => groupTitle("foundry", 3) },
		];
	} },
	{ id: "pane-row", uses: ["readout"], title: "PANE ROW", moves: true, about: "paneRow. A pane: two quiet rows; the focused one opens instead, so nothing is shown twice.", states: () => [
		paneState("WORKING, WITH SUBAGENTS", "a1"),
		paneState("WORKING · CONTEXT CRITICAL", "c1"),
		paneState("NEEDS YOU", "b1"),
		paneState("A BACKGROUND TASK RUNS", "b2"),
		paneState("FINISHED, NOT YET SEEN", "d1"),
		paneState("IDLE", "a2"),
		paneState("A TERMINAL", "a3"),
		paneState("A PI BEFORE ITS LABEL · HERDR'S STATUS ONLY", "x1"),
		paneState("UNKNOWN READINGS · NEVER ZERO", "x2"),
		paneState("FLAGGED, WITH MORE SUBAGENTS THAN ICONS", "x3"),
		paneState("UNDER THE POINTER · THE READOUT AND THE WHITE BAR", "c1", (s) => ({ hovered: true, readout: s.readout })),
		paneState("UNDER THE POINTER, BEFORE THE LIST IS MEASURED · ITS OWN SCANNER", "a2", { hovered: true, ownScanner: true, readout: div() }),
		paneState("ITS STATE CHANGED · THE FIRST 130 MS", "d1", (s) => ({ latchAt: s.now - 60 })),
		paneState("ITS STATE CHANGED · 130 TO 260 MS", "d1", (s) => ({ latchAt: s.now - 200 })),
		paneState("FOCUSED · OPEN", "a1", { near: null }, "a1"),
		paneState("FOCUSED · A LIT DOT NEAR THE POINTER", "a1", { near: { x: 60, y: 30 } }, "a1"),
		paneState("FOCUSED · ASKING", "b1", {}, "b1"),
		paneState("FOCUSED · EVERYTHING A PANE CAN CARRY", "x3", {}, "x3"),
		paneState("FOCUSED · UNKNOWN READINGS", "x2", {}, "x2"),
		paneState("FOCUSED · A TERMINAL STAYS TWO ROWS", "a3", {}, "a3"),
		paneState("IN THE AGENTS VIEW · ITS TAB IN THE SECOND ROW", "a1", { where: "g" }),
		paneState("IN THE AGENTS VIEW · FOCUSED", "a1", { where: "g" }, "a1"),
	] },
	{ id: "readings", title: "READINGS", about: "unitCount, unitIcons, contextText and contextBar. What a pane carries. Unknown is never zero: it is grey and says so.", states: () => {
		const bars = (s, context) => h_flex().w(200).h(15).gap(CH).items_center().child(contextBar(s.t, context, 200 - 5 * CH)).child(div().flex_none().w(4 * CH).h_flex().justify_end().child(contextText(s.t, context)));
		return [
			{ label: "SUBAGENT COUNT · ZERO, SOME, UNKNOWN", render: (s) => row(unitCount(s.t, { count: 0, text: "00AU" }), unitCount(s.t, { count: 3, text: "03AU" }), unitCount(s.t, { count: null, text: "??AU" })) },
			{ label: "ONE SPINNING ICON EACH", render: (s) => h_flex().children(present(unitIcons(s.t, { count: 3 }))) },
			{ label: "PAST TWELVE, +N", render: (s) => h_flex().children(present(unitIcons(s.t, { count: 15 }))) },
			{ label: "CONTEXT · LIT WHILE THE PANE IS", render: (s) => bars(s, { text: "42%", percent: 42, zone: "ok" }) },
			{ label: "CONTEXT · AT REST", render: (s) => bars(s, { text: "42%", percent: 42, zone: "off" }) },
			{ label: "CONTEXT · WARNING FROM 70%", render: (s) => bars(s, { text: "71%", percent: 71, zone: "warn" }) },
			{ label: "CONTEXT · CRITICAL FROM 90%", render: (s) => bars(s, { text: "93%", percent: 93, zone: "crit" }) },
			{ label: "CONTEXT · UNKNOWN", render: (s) => bars(s, { text: "--%", percent: null, zone: "off" }) },
		];
	} },
	{ id: "scanner", uses: ["readout"], title: "SCANNER", moves: true, about: "scannerFrame, scannerStill and ReadoutView. Acid glass with four corner marks on the pane the pointer reaches, and the readout it types.", states: () => [
		{ label: "STILL · ON ONE PANE", height: 39, render: (s) => div().absolute().left(0).top(2).w(COLUMN).h(35).children(scannerStill(COLUMN, 35, s.t.working)) },
		{ label: "THE LIST'S FRAME · SLIDES TO THE NEXT PANE", height: 96, render: (s) => scannerFrame(s.t.working, { id: "story-scope", rect: s.flip ? { x: 0, y: 44, w: COLUMN, h: 50 } : { x: 0, y: 2, w: COLUMN, h: 35 }, on: true }) },
		{ label: "THE READOUT · TYPES IN, ITS DIGITS RE-READ", render: (s) => h_flex().h(17).justify_end().child(div().flex_none().w(readoutWidth(s.stage.readout.text)).h(17).child(s.readout)) },
	] },
	{ id: "map-window", uses: ["plateMap", "spaceMap"], title: "MAP WINDOW", about: "MapView. A window onto the one map, on its own clock: a space's in the list, and the crate plate's, which follows the watched unit.", states: () => [
		{ label: "A SPACE'S WINDOW · NO FRAME, IT DISSOLVES INTO THE GROUND", full: true, render: (s) => div().relative().w_full().h(12 + VIEW_H + 4)
			.child(div().absolute().left(INNER + PAD - BLEED).top(12 - BLEED).w(s.stage.viewW + 2 * BLEED).h(VIEW_H + 2 * BLEED).child(s.spaceMap)) },
		{ label: "THE PLATE'S · ON PAPER", full: true, ground: C.paper, render: (s) => div().relative().w_full().h(PLATE_H).overflow_hidden().child(s.plateMap) },
	] },
	{ id: "ground-light", uses: ["ground"], title: "GROUND LIGHT", about: "GroundView. The list's dotted ground and its light: a line sweeps down, and dots come up near the pointer. Move the pointer over it.", states: () => [
		{ label: "THE GROUND · POINT AT IT", full: true, render: (s) => div().id("story-ground").relative().w(SHEET).h(s.stage.size.height).overflow_hidden()
			.on_mouse_move((e) => { const p = s.stage.pointer, at = Date.now(); s.stage.pointer = { ...(p?.in ? p : { in: true, since: at, start: at }), x: e.local_position.x, y: e.local_position.y }; })
			.on_hover((hovered) => { if (!hovered && s.stage.pointer?.in) s.stage.pointer = { ...s.stage.pointer, in: false, since: Date.now() }; })
			.children(present([picture(`field/${SHEET}x${s.stage.size.height}`, () => fieldSvg(SHEET, s.stage.size.height), 0, 0, SHEET, s.stage.size.height), s.ground])) },
	] },
	{ id: "hide-grip", title: "HIDE GRIP", moves: true, about: "hideGrip. A knurled band in the right gutter; under the pointer it grows open to say what it does.", states: () => {
		const grip = (s, more) => div().relative().w(60).h(170).children(hideGrip(s.t, { width: 60, height: 170, now: s.now, onHover: no, onClick: no, ...more }));
		return [
			{ label: "AT REST · ITS RIDGES BREATHE", render: (s) => grip(s) },
			{ label: "UNDER THE POINTER · GROWS OPEN", render: (s) => grip(s, { hot: s.flip, binding: "cmd-\\" }) },
			{ label: "OPEN, NO KEY BOUND", render: (s) => grip(s, { hot: true }) },
		];
	} },
	{ id: "rail-lamp", title: "RAIL LAMPS", about: "railLamp. Folded to the rail: one lamp per pane, grouped by space, in the list's order.", states: () => [
		{ label: "EVERY PANE OF THE SAMPLE", width: RAIL, full: true, render: (s) => v_flex().pt(4).pl(12).gap(2).children(s.open("a1").lamps.map((l) => railLamp(s.t, l, no))) },
	] },
	{ id: "fold-covers", title: "FOLD COVERS", moves: true, about: "foldCovers. A fold in motion over one block: rows are erased and typed in by covers of ground; the unfold's scan line is one cover's left edge. It plays in turn: fold, then unfold.", states: () => {
		const units = (s) => ["a1", "a2", "b1"].map((key) => s.unit(key));
		const height = (s) => 8 + units(s).reduce((n, u) => n + paneRowHeight(u, "m", COLUMN) + 5, 0);
		return [
			{ label: "THREE PANES UNDER A FOLD", full: true, render: (s) => {
				const cycle = 4000, at = Math.floor(s.now / cycle) * cycle, kind = Math.floor(s.now / cycle) % 2 ? "unfold" : "fold", elapsed = s.now - at, times = FOLD_TIMES[kind];
				// As main.js steps it: steps 1 to 3 at the first three times, over at the fourth.
				const motion = elapsed < times[3] ? { at, kind, step: times.slice(0, 3).filter((ms) => elapsed >= ms).length } : null;
				return div().id("story-fold").relative().w(SHEET).h(height(s))
					.child(v_flex().px(INNER).pt(8).gap(5).children(units(s).map((u) => pane(s, u))))
					.children(present([motion && foldCovers(s.t, { motion, part: "list", folded: false, width: SHEET, height: height(s) })]));
			} },
		];
	} },
];
