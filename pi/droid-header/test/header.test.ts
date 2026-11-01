import assert from "node:assert/strict";
import test from "node:test";
import { GLYPHS } from "@industrial-os/design-system/foundation/cells";
import { ACID_BLACK } from "@industrial-os/design-system/foundation/palette";
import { PI_CHROME, SIGNAL_COLORS } from "@industrial-os/design-system/foundation/signal-colors";
import { aluminiumAt, blendFill, dotAt, surfaceAt } from "@industrial-os/design-system/foundation/surface";
import { FROST_ALPHA, SURFACE_PALETTE } from "@industrial-os/design-system/foundation/surface-palette";
import { crtBoot } from "@industrial-os/design-system/motions/crt-boot";
import { frameAt, HANGING_WIDTH, type HeaderState, introEnd, type Line, PLATE_WIDTH, renderHeader, settledFrame, TITLE_BLOCK_WIDTH } from "../src/header.ts";
import { measure } from "./host.ts";

// The approved mockup's settled frames at 104 and 64 columns: `renderTextured(w, STATE, 'aluminium', { transition:
// 'fade-dots' })` from the operator's droid-header-concepts work (k-motion/texture.mjs over g-shared.mjs), run with the
// synthetic, public-safe STATE below, which is the mockup's own data.mjs. Each row is its text and a per-cell code.
// One deliberate fix is applied to the oracle: hairlines (code h) take the crate banner's treatment, the ground minus
// 28 on each channel, where the mockup left them #dadada (docs/design.md#deviations-from-the-approved-reference).
// Codes, plate: . blank on aluminium, h hairline, K bold ink, k ink, l label grey, e acid edge, P acid paint with the
// darker accent. Strip: , blank, W bold white key, f frosted grey action. Ledger: space blank, o dot, V bold white,
// p white, S bold secondary, s secondary. Backgrounds and the shaded inks are checked against their formulas.
const GOLDEN_104 = {
	text: [
		"+─────────────────────────────────────────────────────◢───◤◥───◣───────────────────────────────────────+",
		"  INDUSTRIAL-OS ®                                    ◢   ◤  ◥   ◣                     ⟁ PI AGENT DROID  ",
		"  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀                   ◢   ◤    ◥   ◣                    ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ",
		"  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀                  ◢   ◤      ◥   ◣                   ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ",
		"  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀                 ◢   ◤        ◥   ◣                  HALDENN DYNAMICS  ",
		"+ S/N 0000-BEEF ─────────────────────────────────◢───◤──────────◥───◣──────────────────────────────────+",
		"                  escape steer         ctrl+c clear         / commands           ! bash                 ",
		"  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"  SPECIFICATIONS  MODEL                OPUS-5.5 / HIGH      SECTOR               WA1.T1                 ",
		"  ·   ·   ·   ·   FRAMEWORK   ·   ·    PI 1.4.0   ·   ·   · PANE  ·   ·   ·   ·  WA1:P1   ·   ·   ·   · ",
		"                  DEPLOYED             09:30:00             ASSIGNMENT           INDUSTRIAL-OS · MAIN   ",
		"  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"                                                                                                        ",
		"  MANIFEST    31  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"                                                                                                        ",
		"  CONTEXT ·   02  ~/.pi/agent/AGENTS.md   ·   ·   ·   ·   · AGENTS.md ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"                                                                                                        ",
		"  SKILLS      12  code-review ·   ·    design-review  ·   · incident-response ·  release-notes          ",
		"                  commit-messages      docs-writing         migrations           security-review        ",
		"                  debugging            frontend-design    · perf-profiling       test-planning          ",
		"                                                                                                        ",
		"  PROMPTS     03  /explain             /plan                /review                                     ",
		"                                                                                                        ",
		"  EXTENSIONS  14  ask-user                                  industrial-os/image-preview                 ",
		"                  example-tasks                             industrial-os/session-recap                 ",
		"                  example-tasks/attribution                 industrial-os/signals-collector             ",
		"                  industrial-os/claude-interrupt            industrial-os/status-bar                    ",
		"                  industrial-os/droid-header                local-notes                                 ",
		"                  industrial-os/herdr-pane-naming           pi-goal                                     ",
		"                  industrial-os/herdr-sidebar               pi-web-access                               ",
		"                                                                                                        ",
	],
	code: [
		"KhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhePPPeePPPehhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhK",
		"..KKKKKKKKKKKKK.k....................................ePPPe..ePPPe.....................K.KK.KKKKK.KKKKK..",
		"..kkk.kkk.kkk.....kkk.kkk.kkk.kkk...................ePPPe....ePPPe....................k.k.k.kkkkk.kkkk..",
		"..k.k.kkk.k.k.kkk.k...k.k.k.k.kkk..................ePPPe......ePPPe...................k.k.k.kkkkk.kkkk..",
		"..kk..k.k.kk......kkk.kkk.kk..kkk.................ePPPe........ePPPe..................lllllll.llllllll..",
		"K.lll.kkkkkkkkk.hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhePPPehhhhhhhhhhePPPehhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhK",
		",,,,,,,,,,,,,,,,,,WWWWWW,fffff,,,,,,,,,WWWWWW,fffff,,,,,,,,,W,ffffffff,,,,,,,,,,,W,ffff,,,,,,,,,,,,,,,,,",
		"  o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o ",
		"  VVVVVVVVVVVVVV  sssss                VVVVVVVV V VVVV      ssssss               VVVVVV                 ",
		"  o   o   o   o   sssssssss   o   o    VV VVVVV   o   o   o ssss  o   o   o   o  VVVVVV   o   o   o   o ",
		"                  ssssssss             VVVVVVVV             ssssssssss           VVVVVVVVVVVVV V VVVV   ",
		"  o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o ",
		"                                                                                                        ",
		"  VVVVVVVV    pp  o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o ",
		"                                                                                                        ",
		"  SSSSSSS o   ss  ppppppppppppppppppppp   o   o   o   o   o ppppppppp o   o   o   o   o   o   o   o   o ",
		"                                                                                                        ",
		"  SSSSSS      ss  ppppppppppp o   o    ppppppppppppp  o   o ppppppppppppppppp o  ppppppppppppp          ",
		"                  ppppppppppppppp      pppppppppppp         pppppppppp           ppppppppppppppp        ",
		"                  ppppppppp            ppppppppppppppp    o pppppppppppppp       ppppppppppppp          ",
		"                                                                                                        ",
		"  SSSSSSS     ss  pppppppp             ppppp                ppppppp                                     ",
		"                                                                                                        ",
		"  SSSSSSSSSS  ss  pppppppp                                  ppppppppppppppppppppppppppp                 ",
		"                  ppppppppppppp                             ppppppppppppppppppppppppppp                 ",
		"                  ppppppppppppppppppppppppp                 ppppppppppppppppppppppppppppppp             ",
		"                  pppppppppppppppppppppppppppppp            pppppppppppppppppppppppp                    ",
		"                  pppppppppppppppppppppppppp                ppppppppppp                                 ",
		"                  ppppppppppppppppppppppppppppppp           ppppppp                                     ",
		"                  ppppppppppppppppppppppppppp               ppppppppppppp                               ",
		"                                                                                                        ",
	],
};
const GOLDEN_64 = {
	text: [
		"+──────────────────────────────────────────────────────────────+",
		"  INDUSTRIAL-OS ®                             ⟁ PI AGENT DROID  ",
		"  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀             ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ",
		"  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀             ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐  ",
		"  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀             HALDENN DYNAMICS  ",
		"+ S/N 0000-BEEF ───────────────────────────────────────────────+",
		"  escape steer        / commands                                ",
		"  ctrl+c clear        ! bash                                    ",
		"  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"  SPECIFICATIONS                                                ",
		"  MODEL   ·   ·   ·   OPUS-5.5 / HIGH ·   ·   ·   ·   ·   ·   · ",
		"  FRAMEWORK           PI 1.4.0                                  ",
		"  DEPLOYED    ·   ·   09:30:00    ·   ·   ·   ·   ·   ·   ·   · ",
		"  SECTOR              WA1.T1                                    ",
		"  PANE    ·   ·   ·   WA1:P1  ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"  ASSIGNMENT          INDUSTRIAL-OS · MAIN                      ",
		"  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"                                                                ",
		"  MANIFEST    ·   ·   31  ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"                                                                ",
		"  CONTEXT ·   ·   ·   02  ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"  ~/.pi/agent/AGENTS.md                                         ",
		"  AGENTS.md   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   · ",
		"                                                                ",
		"  SKILLS  ·   ·   ·   12  ·   ·   ·   ·   ·   ·   ·   ·   ·     ",
		"  code-review         docs-writing        perf-profiling        ",
		"  commit-messages ·   frontend-design ·   release-notes         ",
		"  debugging           incident-response   security-review       ",
		"  design-review   ·   migrations  ·   ·   test-planning         ",
		"                                                                ",
		"  PROMPTS             03                                        ",
		"  /explain            /plan               /review               ",
		"                                                                ",
		"  EXTENSIONS          14                                        ",
		"  ask-user                                                      ",
		"  example-tasks                                                 ",
		"  example-tasks/attribution                                     ",
		"  industrial-os/claude-interrupt                                ",
		"  industrial-os/droid-header                                    ",
		"  industrial-os/herdr-pane-naming                               ",
		"  industrial-os/herdr-sidebar                                   ",
		"  industrial-os/image-preview                                   ",
		"  industrial-os/session-recap                                   ",
		"  industrial-os/signals-collector                               ",
		"  industrial-os/status-bar                                      ",
		"  local-notes                                                   ",
		"  pi-goal                                                       ",
		"  pi-web-access                                                 ",
		"                                                                ",
	],
	code: [
		"KhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhK",
		"..KKKKKKKKKKKKK.k.............................K.KK.KKKKK.KKKKK..",
		"..kkk.kkk.kkk.....kkk.kkk.kkk.kkk.............k.k.k.kkkkk.kkkk..",
		"..k.k.kkk.k.k.kkk.k...k.k.k.k.kkk.............k.k.k.kkkkk.kkkk..",
		"..kk..k.k.kk......kkk.kkk.kk..kkk.............lllllll.llllllll..",
		"K.lll.kkkkkkkkk.hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhK",
		",,WWWWWW,fffff,,,,,,,,W,ffffffff,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
		",,WWWWWW,fffff,,,,,,,,W,ffff,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",
		"  o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o ",
		"  VVVVVVVVVVVVVV                                                ",
		"  sssss   o   o   o   VVVVVVVV V VVVV o   o   o   o   o   o   o ",
		"  sssssssss           VV VVVVV                                  ",
		"  ssssssss    o   o   VVVVVVVV    o   o   o   o   o   o   o   o ",
		"  ssssss              VVVVVV                                    ",
		"  ssss    o   o   o   VVVVVV  o   o   o   o   o   o   o   o   o ",
		"  ssssssssss          VVVVVVVVVVVVV V VVVV                      ",
		"  o   o   o   o   o   o   o   o   o   o   o   o   o   o   o   o ",
		"                                                                ",
		"  VVVVVVVV    o   o   pp  o   o   o   o   o   o   o   o   o   o ",
		"                                                                ",
		"  SSSSSSS o   o   o   ss  o   o   o   o   o   o   o   o   o   o ",
		"  ppppppppppppppppppppp                                         ",
		"  ppppppppp   o   o   o   o   o   o   o   o   o   o   o   o   o ",
		"                                                                ",
		"  SSSSSS  o   o   o   ss  o   o   o   o   o   o   o   o   o     ",
		"  ppppppppppp         pppppppppppp        pppppppppppppp        ",
		"  ppppppppppppppp o   ppppppppppppppp o   ppppppppppppp         ",
		"  ppppppppp           ppppppppppppppppp   ppppppppppppppp       ",
		"  ppppppppppppp   o   pppppppppp  o   o   ppppppppppppp         ",
		"                                                                ",
		"  SSSSSSS             ss                                        ",
		"  pppppppp            ppppp               ppppppp               ",
		"                                                                ",
		"  SSSSSSSSSS          ss                                        ",
		"  pppppppp                                                      ",
		"  ppppppppppppp                                                 ",
		"  ppppppppppppppppppppppppp                                     ",
		"  pppppppppppppppppppppppppppppp                                ",
		"  pppppppppppppppppppppppppp                                    ",
		"  ppppppppppppppppppppppppppppppp                               ",
		"  ppppppppppppppppppppppppppp                                   ",
		"  ppppppppppppppppppppppppppp                                   ",
		"  ppppppppppppppppppppppppppp                                   ",
		"  ppppppppppppppppppppppppppppppp                               ",
		"  pppppppppppppppppppppppp                                      ",
		"  ppppppppppp                                                   ",
		"  ppppppp                                                       ",
		"  ppppppppppppp                                                 ",
		"                                                                ",
	],
};

const MOCK: HeaderState = {
	unit: "C0DE", session: "0000BEEF", seed: 0x0000beef, core: "OPUS-5.5 / HIGH", version: "1.4.0", sector: "WA1.T1", pane: "WA1:P1",
	deployed: "09:30:00", assignment: "INDUSTRIAL-OS · MAIN",
	hints: [["escape", "steer"], ["ctrl+c", "clear"], ["/", "commands"], ["!", "bash"]],
	manifest: {
		status: "ready",
		context: ["~/.pi/agent/AGENTS.md", "AGENTS.md"],
		skills: ["code-review", "commit-messages", "debugging", "design-review", "docs-writing", "frontend-design", "incident-response", "migrations", "perf-profiling", "release-notes", "security-review", "test-planning"],
		prompts: ["/explain", "/plan", "/review"],
		extensions: ["ask-user", "example-tasks", "example-tasks/attribution", "industrial-os/claude-interrupt", "industrial-os/droid-header", "industrial-os/herdr-pane-naming", "industrial-os/herdr-sidebar", "industrial-os/image-preview", "industrial-os/session-recap", "industrial-os/signals-collector", "industrial-os/status-bar", "local-notes", "pi-goal", "pi-web-access"],
	},
};

interface Cell { s: string; fg: string; bg: string; bold: boolean }
const cells = (line: Line): Cell[] => line.flatMap((span) => [...span.text].map((s) => ({ s, fg: span.fg, bg: span.bg, bold: span.bold })));
const text = (lines: Line[]) => lines.map((line) => line.map((span) => span.text).join(""));
const cellWidth = (line: Line) => measure(line.map((span) => span.text).join(""));
const FADE = { top: 19, drop: 19, edge: 3 };

function checkGolden(width: number, golden: { text: string[]; code: string[] }, strip: number) {
	const lines = renderHeader(MOCK, width, Infinity, measure);
	assert.deepEqual(text(lines), golden.text);
	const height = lines.length - 6 - strip + 1;
	lines.forEach((line, y) => cells(line).forEach((cell, x) => {
		const code = golden.code[y][x], where = `${width}: row ${y} col ${x} code ${code}`;
		if (y < 6) {
			const { ground, hair } = aluminiumAt(x, y, { width });
			const expected: Record<string, [string | null, string, boolean]> = {
				".": [null, ground, false], h: [hair, ground, false], K: [ACID_BLACK.field, ground, true], k: [ACID_BLACK.field, ground, false],
				l: [SURFACE_PALETTE.aluminiumLabel, ground, false], e: [ACID_BLACK.accent, ground, false], P: [SIGNAL_COLORS.accent75, ACID_BLACK.accent, false],
			};
			const [fg, bg, bold] = expected[code];
			assert.equal(cell.bg, bg, where);
			if (fg !== null) assert.deepEqual([cell.fg, cell.bold], [fg, bold], where);
		} else if (y < 6 + strip) {
			assert.equal(cell.bg, blendFill("primary", surfaceAt(x, 0, { width, height, gradient: FADE }), FROST_ALPHA), where);
			if (code === "W") assert.deepEqual([cell.fg, cell.bold], [ACID_BLACK.primary, true], where);
			if (code === "f") assert.deepEqual([cell.fg, cell.bold], [SURFACE_PALETTE.frostLamp, false], where);
		} else {
			const ly = y - 6 - strip + 1;
			assert.equal(cell.bg, surfaceAt(x, ly, { width, height, gradient: FADE }), where);
			const ink: Record<string, [string, boolean]> = { V: [ACID_BLACK.primary, true], p: [ACID_BLACK.primary, false], S: [ACID_BLACK.secondary, true], s: [ACID_BLACK.secondary, false] };
			if (code === "o") assert.deepEqual([cell.s, cell.fg], ["·", dotAt(x, ly)], where);
			else if (code !== " ") assert.deepEqual([cell.fg, cell.bold], ink[code], where);
		}
	}));
}

test("the settled frame at 104 columns matches the approved mockup cell for cell", () => checkGolden(104, GOLDEN_104, 1));
test("the settled frame at 64 columns matches the approved mockup cell for cell", () => checkGolden(64, GOLDEN_64, 2));

test("from 40 to 55 columns the plate keeps the maker, wordmark and serial only, over the stacked ledger", () => {
	const at = (width: number) => text(renderHeader(MOCK, width, Infinity, measure));
	const rows = at(48);
	assert.deepEqual(rows.slice(0, 6), [
		"+──────────────────────────────────────────────+",
		"  INDUSTRIAL-OS ®                               ",
		"  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀               ",
		"  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀               ",
		"  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀               ",
		"+ S/N 0000-BEEF ───────────────────────────────+",
	]);
	// Two columns of 22 cells: hints, values and counts start on column 2 or 24.
	assert.deepEqual(rows.slice(6, 8), ["  escape steer          / commands              ", "  ctrl+c clear          ! bash                  "]);
	assert.match(rows.join("\n"), /\n  MODEL[ ·]{17}OPUS-5\.5 \/ HIGH/);
	assert.match(rows.join("\n"), /\n  SKILLS[ ·]{16}12/);
	for (const width of [40, 48, 55]) assert.doesNotMatch(at(width).slice(0, 6).join("\n"), /[⟁◢◣◤◥]|HALDENN/, `no title block or peak at ${width}`);
	assert.match(at(56).slice(0, 6).join("\n"), /⟁ PI AGENT DROID[\s\S]*HALDENN DYNAMICS/);
	// Below 44 columns the table keeps two columns, 18 or 19 cells each.
	assert.deepEqual(at(40).slice(6, 8), ["  escape steer      / commands          ", "  ctrl+c clear      ! bash              "]);
	assert.deepEqual(at(43)[6], "  escape steer       / commands".padEnd(43));
});

test("below 40 columns the header is one settled line; the layouts switch at 100, 56 and 40 columns", () => {
	assert.equal(HANGING_WIDTH, 100);
	assert.equal(TITLE_BLOCK_WIDTH, 56);
	assert.equal(PLATE_WIDTH, 40);
	const at = (width: number) => text(renderHeader(MOCK, width, Infinity, measure));
	assert.ok(at(100).some((row) => /^ {2}SPECIFICATIONS {2}MODEL/.test(row)), "the hanging gutter from 100 columns");
	assert.ok(at(99).some((row) => /^ {2}SPECIFICATIONS +$/.test(row)), "stacked section heads below 100");
	assert.deepEqual(at(39), ["DRD-C0DE ● PI-1.4.0 · 014 MOD · 012 SKL"]);
	assert.deepEqual(at(20), ["DRD-C0DE ● PI-1.4.0…"]);
	assert.deepEqual(at(1), ["…"]);
	assert.deepEqual(renderHeader(MOCK, 0, Infinity, measure), []);
	const minimal = cells(renderHeader(MOCK, 39, Infinity, measure)[0]);
	assert.equal(minimal[0].fg, ACID_BLACK.accent);
	assert.equal(minimal[9].fg, PI_CHROME.lamp);
	assert.equal(introEnd(settledFrame(MOCK, 39, measure)), 0, "no intro below 40 columns");
	assert.deepEqual(text(renderHeader(MOCK, 39, 0, measure)), at(39));
});

const states: Array<[string, HeaderState]> = [
	["ready", MOCK],
	["pending", { ...MOCK, manifest: { status: "pending" } }],
	["unavailable", { ...MOCK, manifest: { status: "unavailable", reason: "settings.json: Unexpected token } in JSON at position 12" } }],
	["empty holds", { ...MOCK, manifest: { status: "ready", context: [], skills: [], prompts: [], extensions: [] } }],
	["unknown session, outside Herdr, no model, not a repository", { ...MOCK, unit: "????", session: "????????", seed: 0, core: "-- / --", sector: "--", pane: "--", assignment: "SCRATCH" }],
	["long and wide values", {
		...MOCK, core: "CLAUDE-SONNET-4-5-THINKING-PREVIEW-EXPERIMENTAL / XHIGH", sector: "WA1.T1".repeat(8),
		assignment: "プロジェクト-日本語 · FEATURE/A-VERY-LONG-BRANCH-NAME-THAT-KEEPS-GOING", hints: [["escape", "x".repeat(400)], ["ctrl+c", "clear"], ["/", "commands"], ["!", "bash"]],
		manifest: { status: "ready", context: ["/very/long/".repeat(20) + "AGENTS.md"], skills: ["技能-名前", "emoji-👩‍💻-skill", "x".repeat(300)], prompts: ["/a\u0007b\u001b[31m"], extensions: ["ext-\u202ename", "e\u0301clair", "\u0301lead"] },
	}],
];
const times = [0, 60, 200, 349, 400, 800, 1200, 1500, 2000, 2400, 3000, Infinity];

test("every line is exactly the width at every width 1–300, and no layout throws", () => {
	for (const [name, state] of states) {
		for (let width = 1; width <= 300; width++) {
			const sampled = width % 23 === 0 || [39, 40, 43, 44, 55, 56, 99, 100].includes(width);
			if (name !== "ready" && name !== "long and wide values" && !sampled && width % 5) continue;
			const frame = settledFrame(state, width, measure);
			for (const t of sampled ? times : [Infinity]) {
				const lines = frameAt(frame, t);
				for (const line of lines) assert.equal(cellWidth(line), width, `${name} at ${width} cells, ${t} ms`);
				assert.equal(lines.length, width < PLATE_WIDTH ? 1 : lines.length);
			}
		}
	}
	// A terminal wider than the design system's 1000 cells gets the 1000-cell header padded with the field.
	for (const line of renderHeader(MOCK, 1200, Infinity, measure)) assert.equal(cellWidth(line), 1200);
});

test("only design-system glyphs, ASCII and the measured caller text are drawn", () => {
	const allowed = new Set([...GLYPHS, ...JSON.stringify(MOCK)]);
	for (const width of [40, 56, 72, 104, 140]) for (const t of times) {
		for (const row of text(frameAt(settledFrame(MOCK, width, measure), t))) {
			for (const ch of row) assert.ok(/[\x20-\x7e]/.test(ch) || allowed.has(ch), `${JSON.stringify(ch)} at ${width}, ${t} ms`);
		}
	}
});

test("unknown values are shown as unknown, never as zero or invented", () => {
	const frame = (state: HeaderState, width = 104) => text(renderHeader(state, width, Infinity, measure)).join("\n");
	const pending = frame(states[1][1]);
	assert.match(pending, /MANIFEST {4}--/);
	assert.doesNotMatch(pending, /CONTEXT|SKILLS|PROMPTS|EXTENSIONS|LOADING|MANIFEST +00/);
	const failed = frame(states[2][1]);
	assert.match(failed, /MANIFEST {4}--/);
	assert.match(failed, /\n {18}MANIFEST UNAVAILABLE · settings\.json: Unexpected token/);
	const failRow = renderHeader(states[2][1], 104, Infinity, measure).find((line) => text([line])[0].includes("UNAVAILABLE"))!;
	assert.ok(cells(failRow).some((c) => c.s === "M" && c.fg === ACID_BLACK.critical));
	const unknown = frame(states[4][1]);
	assert.match(unknown, /S\/N \?\?\?\?-\?\?\?\? /);
	assert.match(unknown, /MODEL {16}-- \/ --/);
	assert.match(unknown, /SECTOR {15}--/);
	assert.match(unknown, /PANE[ ·]{17}--/);
	assert.match(unknown, /ASSIGNMENT {11}SCRATCH/);
	// The unknown unit's digits are pixel question marks in label grey; DRD- stays in ink.
	const mark = cells(renderHeader(states[4][1], 104, Infinity, measure)[2]);
	assert.ok(mark.slice(18, 33).filter((c) => c.s !== " ").every((c) => c.fg === SURFACE_PALETTE.aluminiumLabel));
	assert.ok(mark.slice(2, 17).filter((c) => c.s !== " ").every((c) => c.fg === ACID_BLACK.field));
	const empty = frame(states[3][1]);
	assert.match(empty, /MANIFEST {4}00/);
	assert.match(empty, /CONTEXT {5}00/);
	assert.match(empty, /EXTENSIONS {2}00/);
	assert.match(frame(states[3][1], 64), /\n {2}EXTENSIONS {10}00/);
});

test("untrusted text is sanitized, and over-long names clip with … to their span", () => {
	const rows = text(renderHeader(states[5][1], 104, Infinity, measure)), frame = rows.join("\n");
	for (const row of rows) assert.doesNotMatch(row, /[\u0000-\u001f\u007f-\u009f\u202e]/u);
	assert.match(frame, /\/a\?b\?\[31m/);
	assert.match(frame, /ext-\?name/);
	assert.match(frame, /技能-名前/);
	// A spec value stops two cells before the next group's label column; the last group's runs to the margin.
	assert.match(frame, /MODEL {16}CLAUDE-SONNET-4-5-… {2}SECTOR {15}WA1\.T1WA1\.T1WA1\.T1WA… {2}\n/);
	// A name wider than the whole table is clipped to it, ending on the right margin's column.
	const long = rows.find((row) => /^ {18}xxxx/.test(row))!;
	assert.match(long, /^ {18}x{83}… {2}$/);
	assert.match(rows[6], /^ {18}escape x{76}… {2}$/);
	assert.match(text(renderHeader(states[5][1], 64, Infinity, measure)).join("\n"), /\n {2}x{59}… {2}\n/);
	// The intro animates hostile text too, through the same measurer, rather than falling back to the settled frame.
	for (const width of [64, 104]) {
		const frame = settledFrame(states[5][1], width, measure);
		for (const time of [400, 900, 1500, 2200]) assert.doesNotThrow(() => crtBoot(frame.lines, { seed: frame.seed, paint: frame.paint, ground: frame.ground, measure, time }));
	}
});

test("the intro is a pure function of state, width, time and the session seed, and ends on the settled frame", () => {
	const frame = settledFrame(MOCK, 104, measure), end = introEnd(frame);
	assert.ok(end > 2000 && end < 3500, `${end} ms`);
	const settled = renderHeader(MOCK, 104, Infinity, measure);
	assert.deepEqual(frameAt(frame, end), settled);
	assert.deepEqual(frameAt(frame, end + 1000), settled);
	assert.notDeepEqual(frameAt(frame, end - 200), settled);
	for (const t of [0, 100, 300, 900, 1400, 2100]) assert.deepEqual(renderHeader(MOCK, 104, t, measure), frameAt(frame, t), `${t} ms`);
	// Another session boots another way: the same layout, other glitches, starts and garble.
	const other = { ...MOCK, seed: 0x1234abcd };
	assert.ok([400, 800, 1200, 1600].some((t) => JSON.stringify(renderHeader(other, 104, t, measure)) !== JSON.stringify(frameAt(frame, t))));
	// Power-on: one bright line across the middle row, everything else black, no text.
	const power = renderHeader(MOCK, 104, 50, measure);
	assert.ok(text(power).every((row) => row.trim() === ""));
	assert.equal(cells(power[Math.floor(power.length / 2)])[0].bg, blendFill("primary", "field", 0.85));
	assert.equal(cells(power[0])[0].bg, ACID_BLACK.field);
	// Grounds, then each row typing behind an acid cursor; values appear only as typed, never invented.
	assert.ok(text(renderHeader(MOCK, 104, 300, measure)).every((row) => row.trim() === "" || /^[ ·]*$/.test(row)));
	const typing = renderHeader(MOCK, 104, 1200, measure);
	assert.ok(typing.some((line) => cells(line).some((c) => c.s === "█" && c.fg === ACID_BLACK.accent)), "an acid cursor");
	for (const t of times) assert.doesNotMatch(text(renderHeader(MOCK, 104, t, measure)).join("\n"), /LOADING|PROGRESS/);
});

test("rows start within 2.1 s of each other, however tall the header", () => {
	const tall: HeaderState = { ...MOCK, manifest: { ...MOCK.manifest, status: "ready", context: [], prompts: [], skills: Array.from({ length: 200 }, (_, i) => `skill-name-${i}`), extensions: [] } as HeaderState["manifest"] };
	for (const width of [40, 64, 104]) {
		const frame = settledFrame(tall, width, measure), end = introEnd(frame);
		assert.ok(frame.lines.length > 60, `${frame.lines.length} rows at ${width}`);
		assert.ok(end < 3600, `${end} ms at ${width}`);
		// By 2.7 s (the last start, 350 + 2100 + its seeded wait of up to 250 ms) every row has begun: none is still ground.
		const rows = text(frameAt(frame, 2700));
		const last = text(frame.lines).findLastIndex((row) => /[a-z]/.test(row));
		assert.notEqual(rows[last].replace(/[ ·]/g, ""), "", `the last text row is typing at ${width}`);
	}
});

test("a failure is never animated: its row shows settled in every intro frame", () => {
	const failed = states[2][1], settled = text(renderHeader(failed, 104, Infinity, measure));
	const row = settled.findIndex((r) => r.includes("UNAVAILABLE"));
	for (const t of times) assert.equal(text(renderHeader(failed, 104, t, measure))[row], settled[row], `${t} ms`);
});

test("a manifest that arrives mid-intro types its rows from its arrival; after the intro it appears settled", () => {
	const late: HeaderState = { ...MOCK, manifestAt: 2000 };
	const frame = settledFrame(late, 104, measure), early = settledFrame(MOCK, 104, measure);
	assert.ok(introEnd(frame) > introEnd(early));
	assert.ok(introEnd(frame) < 2000 + 2100 + 250 + 3000 + 150);
	const rows = text(frameAt(frame, 2000)), head = rows.findIndex((r) => r.includes("MANIFEST"));
	// At arrival the hold rows are still ground; the rows above the manifest are typed as without it.
	for (const r of rows.slice(head + 1)) assert.match(r, /^[ ·]*$/);
	assert.deepEqual(rows.slice(0, head - 1), text(frameAt(early, 2000)).slice(0, head - 1));
	assert.ok(text(frameAt(frame, 2600)).slice(head + 1).some((r) => /[a-z]/.test(r)));
	assert.deepEqual(frameAt(frame, introEnd(frame)), renderHeader(MOCK, 104, Infinity, measure));
});
