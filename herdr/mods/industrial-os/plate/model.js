// What a pane's plate says: which unit is in the pane (droid, agent or terminal), its identity, and what its strip
// reads. Pure: the view passes in what Herdr reports, the parsed signals label, the foreground command it looked up
// and the remembered times; nothing here reads Herdr, a clock or a file. The rules are in ../../docs/design.md#pane-plate.

import { sessionUnit } from "../ds/elements/unit-plate/unit-plate.mjs";
import { hintSegments } from "../ds/elements/status-strip/status-strip.mjs";

/** Pi's idle hints, as its editor offers them. */
export const PI_HINTS = Object.freeze([["esc", "steer"], ["ctrl+c", "clear"], ["/", "commands"], ["!", "bash"]]);
/** How long a starting Pi shows STARTING before its plate boots without a session (DRD-????). */
export const STARTING_GRACE_MS = 3000;
/** Free text on the strip (a command, a target, a question) is cut to this many characters before it is fitted. */
const TEXT_LIMIT = 200;

/** FNV-1a over the UTF-16 code units: the barcode seed of a plate whose unit has no session (an address). */
export function fnv(text) {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h | 0;
}

const upperCode = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** TERM's code: the basename of the terminal's argv[0], a login shell's leading "-" dropped (`/bin/zsh` → `ZSH`). */
export const shellCode = (argv0) => (typeof argv0 === "string" ? upperCode(argv0.trim().split(/\s+/)[0].split("/").pop().replace(/^-/, "")) : "");
/** AGT's code: the first word of the app the agent reports (`claude-code` → `CLAUDE`), else of the program's name. */
export const agentCode = (app, name) => upperCode(String(app || name || "").split(/[-\s_]/)[0]);

/** A path under the home folder as `~/…`. */
export function homePath(path, home) {
	if (typeof path !== "string" || !path) return null;
	if (home && path === home) return "~";
	return home && path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

// Printable text only: control characters become spaces, runs of spaces one space.
const clean = (text) => String(text).slice(0, TEXT_LIMIT).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();

const pad2 = (n) => String(n).padStart(2, "0");
/** An elapsed time: `mm:ss`, or `hh:mm:ss` with `long`. Negative or unknown times are not shown (null). */
export function clockText(ms, long = false) {
	if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
	const s = Math.floor(ms / 1000);
	return long ? `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}` : `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}
/** A local time of day, `hh:mm`, from epoch milliseconds. */
export function timeOfDay(epochMs, offsetMinutes = new Date(epochMs).getTimezoneOffset()) {
	if (typeof epochMs !== "number" || !Number.isFinite(epochMs)) return null;
	const local = new Date(epochMs - offsetMinutes * 60_000);
	return `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`;
}

/** The plate's lighting: lit when its pane has focus in the active window; standby while the pointer is over an
 *  unfocused plate; dark otherwise, and every plate is dark while the window is not active. */
export const lightingOf = ({ focused, hovered, active }) => (!active ? "dark" : focused ? "lit" : hovered ? "standby" : "dark");

/** Pi runs in the pane: it reports the app `pi`, or Herdr's program table names it. */
export const isPi = (pane) => pane?.app === "pi" || pane?.program?.key === "pi";
/** Another agent: Herdr's table marks the program as one, or it reports an app of its own. */
export const isAgent = (pane) => !isPi(pane) && (pane?.program?.agent === true || (typeof pane?.app === "string" && pane.app !== ""));
const isShell = (pane) => pane?.program?.shell === true;
// A foreground program other than the shell: its identity, so a new command restarts the clock.
const runKey = (pane) => (!isPi(pane) && !isAgent(pane) && !isShell(pane) && pane?.program ? `${pane.program.key}\u0000${pane.program.name}` : null);

/** What a copy remembers about its pane between renders. */
export const emptyMemory = () => ({ seen: false, pi: false, piSince: null, piExitedAt: null, runKey: null, runSince: null, agentWorking: false, agentSince: null });

/**
 * The pane's remembered times, after what Herdr reports now: when Pi was first seen (for STARTING), when it handed
 * back to the shell (PI EXITED, until the next command), when the foreground command started and when the agent
 * started working. What was already under way when the copy first looked has no known start: its time is null, not
 * the first look. Returns a new memory; the input is not changed.
 */
export function observe(memory, pane, now) {
	const m = { ...emptyMemory(), ...memory };
	const first = !m.seen;
	m.seen = true;
	const pi = isPi(pane);
	// A Pi already running at the first look is not starting: no STARTING, straight to its plate.
	if (pi && !m.pi) m.piSince = first ? now - STARTING_GRACE_MS : now;
	if (!pi) m.piSince = null;
	if (m.pi && !pi && isShell(pane)) m.piExitedAt = now;
	const key = runKey(pane);
	if (key !== m.runKey) {
		m.runKey = key;
		m.runSince = key && !first ? now : null;
		if (key) m.piExitedAt = null; // PI EXITED stays until the next command runs
	}
	if (pi) m.piExitedAt = null;
	const working = isAgent(pane) && pane.status === "working";
	if (working && !m.agentWorking) m.agentSince = first ? null : now;
	if (!working) m.agentSince = null;
	m.agentWorking = working;
	m.pi = pi;
	return m;
}

/** The command a RUNNING strip shows: argv[0]'s basename and its arguments, from `hc get`'s foreground. */
export function commandText(argv) {
	if (!Array.isArray(argv) || !argv.length || argv.some((a) => typeof a !== "string")) return null;
	const text = clean([argv[0].split("/").pop(), ...argv.slice(1)].join(" "));
	return text || null;
}

const status = (glyph, word, tone) => ({ kind: "status", glyph, word, tone });
const READY = status("○", "READY", "ready");
const clockSeg = (text) => (text ? [{ kind: "clock", text }] : []);
const STEER = { kind: "hint", key: "esc", action: "steer", drop: 1 };
const phaseWord = (phase) => (phase.kind === "tool" ? phase.tool.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 16) || "TOOL" : phase.kind.toUpperCase());

/**
 * The pane's plate and strip. `pane` is its PaneInfo, `terminal` its terminals() record (argv, address), `signals`
 * the parsed io.signals.v1 label (or null), `foreground` the argv `hc get` last reported for it (or null), `memory`
 * what observe() returned. `nextAt` is when the strip next changes by itself (a clock's second, STARTING's end).
 */
export function paneModel({ pane, terminal, signals, foreground = null, memory = emptyMemory(), now, home = null }) {
	const address = typeof terminal?.address === "string" ? terminal.address : (pane?.terminal ?? "");
	const dir = homePath(pane?.cwd, home) ?? "--";
	let nextAt = null;
	const tick = (since) => {
		const at = now + 1000 - ((now - since) % 1000);
		nextAt = nextAt === null ? at : Math.min(nextAt, at);
	};
	const elapsed = (since, long) => {
		if (typeof since !== "number" || since > now) return null;
		tick(since);
		return clockText(now - since, long);
	};

	if (isPi(pane)) {
		const unit = signals ? sessionUnit(signals.sessionId) : null;
		// Herdr's own status, from Pi's reports: what the strip falls back to when the label does not know.
		const herdrBusy = pane.status === "working" || pane.status === "blocked";
		const starting = !signals && !herdrBusy && typeof memory.piSince === "number" && now - memory.piSince < STARTING_GRACE_MS;
		if (starting) {
			nextAt = memory.piSince + STARTING_GRACE_MS;
			return { kind: "terminal", pi: true, ...terminalPlate(terminal, pane, dir), strip: [status("▶", "STARTING", "accent"), { kind: "text", text: "pi" }], state: "pi:starting", idle: false, nextAt };
		}
		const identity = unit ?? { unit: "DRD-????", serial: "????-????", seed: fnv(address) };
		let strip, state, idle = false;
		// The label's detail wins where it knows; where it is missing or malformed, Herdr's status stands, with no
		// phase, question or clock made up. Herdr's blocked always shows: a question is actionable.
		const known = typeof signals?.working === "boolean";
		if (signals?.question) {
			strip = [{ kind: "chip", glyph: "▲", word: "NEEDS YOU" }, { kind: "text", text: clean(signals.question.text), clip: true }];
			state = "pi:blocked";
		} else if (pane.status === "blocked") {
			strip = [{ kind: "chip", glyph: "▲", word: "NEEDS YOU" }];
			state = "pi:blocked";
		} else if (!known && pane.status === "working") {
			strip = [status("■", "WORKING", "accent"), STEER];
			state = "pi:working:WORKING";
		} else if (signals?.working === true) {
			const phase = signals.phase;
			const word = phase ? phaseWord(phase) : "WORKING";
			const target = phase?.kind === "tool" && phase.target ? [{ kind: "text", text: clean(phase.target), clip: true }] : [];
			strip = [status("■", word, "accent"), ...target, ...clockSeg(phase ? elapsed(phase.since) : null), STEER];
			state = `pi:working:${word}`;
		} else if (pane.status === "done") {
			const settled = timeOfDay(signals?.lastSettledAt);
			strip = [status("●", "DONE", "primary"), ...(settled ? [{ kind: "field", label: "SETTLED", value: settled, drop: 5 }] : []), ...hintSegments(PI_HINTS.slice(1))];
			state = "pi:done";
		} else {
			strip = hintSegments(PI_HINTS);
			state = "pi:idle";
			idle = true;
		}
		return {
			kind: "droid", pi: true, known: !!unit, presessionSeed: fnv(address),
			plate: { unit: identity.unit, serial: identity.serial, seed: identity.seed },
			options: { barcode: true, peak: true },
			strip, state, idle, nextAt,
		};
	}

	if (isAgent(pane)) {
		const code = agentCode(pane.app, pane.program?.name);
		let strip, state, idle = false;
		if (pane.status === "blocked") { strip = [{ kind: "chip", glyph: "▲", word: "NEEDS YOU" }]; state = "agent:blocked"; }
		else if (pane.status === "working") { strip = [status("■", "WORKING", "accent"), ...clockSeg(elapsed(statusSince(terminal, now) ?? memory.agentSince))]; state = "agent:working"; }
		else if (pane.status === "done") { strip = [status("●", "DONE", "primary")]; state = "agent:done"; }
		else { strip = [READY]; state = "agent:ready"; idle = true; }
		return {
			kind: "agent", pi: false, prefix: "AGT", code,
			plate: { serial: dir, serialLabel: "DIR", title: "", mark: null, division: ["EXTERNAL", "AGENT"], seed: fnv(address) },
			options: { barcode: true, peak: false },
			strip, state, idle, nextAt,
		};
	}

	const base = terminalPlate(terminal, pane, dir);
	if (runKey(pane)) {
		const command = commandText(foreground) ?? clean(pane.program?.name ?? "") ?? "";
		const strip = [status("▶", "RUNNING", "accent"), ...(command ? [{ kind: "text", text: command, clip: true }] : []), ...clockSeg(elapsed(memory.runSince, true))];
		return { kind: "terminal", pi: false, ...base, strip, state: "terminal:running", idle: false, nextAt };
	}
	const exited = timeOfDay(memory.piExitedAt);
	const strip = exited ? [READY, { kind: "field", label: "PI EXITED", value: exited, drop: 1 }] : [READY];
	return { kind: "terminal", pi: false, ...base, strip, state: exited ? "terminal:exited" : "terminal:ready", idle: true, nextAt };
}

// When herdr-core last changed the terminal's agent status (`status_ms`, as `hc get` reports it), when the record has it.
const statusSince = (terminal, now) => (typeof terminal?.status_ms === "number" && Number.isFinite(terminal.status_ms) && terminal.status_ms <= now ? terminal.status_ms : null);

function terminalPlate(terminal, pane, dir) {
	const argv0 = Array.isArray(terminal?.argv) ? terminal.argv[0] : null;
	const branch = typeof pane?.branch === "string" && pane.branch ? clean(pane.branch).toUpperCase() : "--";
	return {
		prefix: "TERM", code: shellCode(argv0),
		plate: { serial: dir, serialLabel: "DIR", title: "", mark: null, division: ["BRANCH", branch] },
		options: { barcode: false, peak: false },
	};
}

/** The droid's plate before its session is known (DRD-????, its barcode seeded from the terminal address): what the
 *  boot draws and the serial roll starts from. */
export const presession = (model) => ({ ...model, known: false, plate: { unit: "DRD-????", serial: "????-????", seed: model.presessionSeed } });
