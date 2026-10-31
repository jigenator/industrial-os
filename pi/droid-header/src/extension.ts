// Pi glue: gathers the header's values at session start, replaces Pi's startup header in TUI mode, owns the intro
// timer and every disposal, and turns the pure core's styled cells into ANSI with Pi's color helpers.
import { homedir } from "node:os";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { DefaultPackageManager, getAgentDir, keyText, loadProjectContextFiles, loadSkills, SettingsManager, VERSION } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { backgroundAnsi, foregroundAnsi, rgbColor, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { assignment, clock, coreValue, herdrCodes, interruptAction, sessionCodes } from "./facts.ts";
import { type Frame, frameAt, type HeaderState, introEnd, type Line, type Manifest, settledFrame } from "./header.ts";
import { buildManifest, failure, readBranch } from "./sources.ts";

/** At most 20 frames a second during the intro, none after it. */
export const FRAME_MS = 50;
/** A backstop: the intro settles by now even if no frame has said it ended, such as a header Pi never draws. */
export const INTRO_LIMIT_MS = 8000;

export interface Clock {
	now(): number;
	every(ms: number, run: () => void): () => void;
}
const systemClock: Clock = {
	now: () => performance.now(),
	every(ms, run) { const id = setInterval(run, ms); id.unref?.(); return () => clearInterval(id); },
};

type ColorMode = ReturnType<Theme["getColorMode"]>;
const inks = new Map<string, ReturnType<typeof rgbColor>>();
const ink = (hex: string) => {
	let color = inks.get(hex);
	if (!color) inks.set(hex, (color = rgbColor(...([1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]))));
	return color;
};
/** One styled line as ANSI, guarded so it can never exceed the width Pi asked for. */
function paintLine(line: Line, width: number, mode: ColorMode): string {
	let out = "", last = "";
	for (const span of line) {
		const sgr = (span.bold ? "\x1b[1m" : "\x1b[22m") + foregroundAnsi(ink(span.fg), mode) + backgroundAnsi(ink(span.bg), mode);
		if (sgr !== last) { out += sgr; last = sgr; }
		out += span.text;
	}
	out += "\x1b[0m";
	return visibleWidth(out) > width ? truncateToWidth(out, width, "") : out;
}

/** One header: its state, intro clock, timer and subscriptions. Settles once and never animates again. */
export class DroidHeader {
	private startedAt: number | undefined;
	private settled: boolean;
	private disposed = false;
	private tui: Pick<TUI, "requestRender"> | undefined;
	private cleanups: Array<() => void> = [];
	private disposals: Array<() => void> = [];
	private firstRender: Array<() => void> | undefined = [];
	private cache: { width: number; mode: ColorMode; lines: string[] } | undefined;
	/** The settled frame for the last width drawn; the intro animates it and ends when it says. */
	private frame: Frame | undefined;
	private state: HeaderState;
	private readonly time: Clock;

	constructor(state: HeaderState, animate: boolean, time: Clock = systemClock) {
		this.state = state;
		this.settled = !animate;
		this.time = time;
	}

	get animating() { return !this.settled; }
	get manifest() { return this.state.manifest; }

	/** The component Pi's setHeader factory returns; the intro clock starts when Pi mounts it. */
	attach(tui: Pick<TUI, "requestRender">, theme: Pick<Theme, "getColorMode">) {
		this.tui = tui;
		if (!this.settled && this.startedAt === undefined) {
			this.startedAt = this.time.now();
			this.cleanups.push(this.time.every(FRAME_MS, () => this.tick()));
		}
		return {
			render: (width: number) => this.render(width, theme.getColorMode()),
			invalidate: () => { this.cache = undefined; this.frame = undefined; },
			dispose: () => this.dispose(),
		};
	}

	/** Runs `cleanup` when the header settles or is disposed, or at once if it already has. */
	onSettle(cleanup: () => void) {
		if (this.settled) cleanup();
		else this.cleanups.push(cleanup);
	}

	/** Runs `run` once, on the turn of the event loop after Pi first draws the header, unless it is disposed first. */
	afterFirstRender(run: () => void) {
		if (this.disposed) return;
		if (this.firstRender) return void this.firstRender.push(run);
		const id = setImmediate(run);
		this.onDispose(() => clearImmediate(id));
	}

	/** Runs `cleanup` when the header is disposed, or at once if it already is. */
	onDispose(cleanup: () => void) {
		if (this.disposed) cleanup();
		else this.disposals.push(cleanup);
	}

	/** A new manifest, and the key hints that go with it (the Escape hint's action can follow the manifest). */
	setManifest(manifest: Manifest, hints = this.state.hints) {
		if (this.disposed) return;
		const arrived = !this.settled && manifest.status === "ready" ? this.elapsed() : undefined;
		this.state = { ...this.state, manifest, manifestAt: arrived, hints };
		this.cache = undefined;
		this.frame = undefined;
		this.tui?.requestRender();
	}

	settle() {
		if (this.settled) return;
		this.settled = true;
		this.release();
		this.cache = undefined;
		this.tui?.requestRender();
	}

	dispose() {
		this.disposed = true;
		this.settled = true;
		this.release();
		for (const cleanup of this.disposals.splice(0)) cleanup();
	}

	private release() {
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	private elapsed() {
		return this.startedAt === undefined ? 0 : this.time.now() - this.startedAt;
	}

	private frameFor(width: number) {
		if (this.frame?.width !== width) this.frame = settledFrame(this.state, width, visibleWidth);
		return this.frame;
	}

	// The intro ends when the frame last drawn has finished; before any draw there is nothing to end.
	private tick() {
		const elapsed = this.elapsed();
		if (elapsed >= INTRO_LIMIT_MS || (this.frame && elapsed >= introEnd(this.frame))) this.settle();
		else this.tui?.requestRender();
	}

	render(width: number, mode: ColorMode): string[] {
		const waiting = this.firstRender;
		this.firstRender = undefined;
		for (const run of waiting ?? []) this.afterFirstRender(run);
		if (this.settled && this.cache?.width === width && this.cache.mode === mode) return this.cache.lines;
		const lines = frameAt(this.frameFor(width), this.settled ? Infinity : this.elapsed()).map((line) => paintLine(line, width, mode));
		if (this.settled) this.cache = { width, mode, lines };
		return lines;
	}
}

function keyHints(manifest: Manifest): Array<[string, string]> {
	const key = (id: Parameters<typeof keyText>[0]) => { try { return keyText(id); } catch { return ""; } };
	// Pi's own header also hints `ctrl+o more`, but that key expands only Pi's header; this one has nothing to expand.
	const hints: Array<[string, string]> = [[key("app.interrupt"), interruptAction(manifest)], [key("app.clear"), "clear"], ["/", "commands"], ["!", "bash"]];
	return hints.filter(([k]) => k);
}

// When this process first saw each session, so a reload keeps its DEPLOYED time.
const SEEN = Symbol.for("industrial-os.droid-header.deployed");
const seen: Map<string, Date> = ((globalThis as Record<symbol, unknown>)[SEEN] ??= new Map()) as Map<string, Date>;

/** Session entries that change settings rather than hold conversation. Any other type, even a new one, is content. */
const SETTING_ENTRIES = new Set(["thinking_level_change", "model_change", "session_info"]);

type ManifestSource = (options: { cwd: string; trusted: boolean; prompts: string[] }) => Promise<Manifest>;
const piManifest: ManifestSource = (options) =>
	buildManifest({ SettingsManager, DefaultPackageManager, loadSkills, loadProjectContextFiles }, { ...options, agentDir: getAgentDir(), home: homedir() });

/** The extension. Tests may pass their own clock and manifest source; Pi passes only `pi`. */
export default function droidHeader(pi: ExtensionAPI, time: Clock = systemClock, manifestOf: ManifestSource = piManifest) {
	let current: DroidHeader | undefined;
	let generation = 0;
	const drop = () => { generation++; current?.dispose(); current = undefined; };

	pi.on("session_start", async (event, ctx) => {
		drop();
		if (ctx.mode !== "tui") return;
		const mine = generation;
		const sessionId = ctx.sessionManager.getSessionId();
		const branch = await readBranch(ctx.cwd);
		if (mine !== generation) return;
		if (!seen.has(sessionId)) seen.set(sessionId, new Date());
		const codes = sessionCodes(sessionId), herdr = herdrCodes(process.env);
		const state: HeaderState = {
			...codes, ...herdr,
			core: coreValue(ctx.model, pi.getThinkingLevel()),
			version: VERSION,
			deployed: clock(seen.get(sessionId)!),
			assignment: assignment(ctx.cwd, branch),
			manifest: { status: "pending" },
			hints: keyHints({ status: "pending" }),
		};
		// Animate only when the header is on screen at start: a fresh, empty session, with motion on. Pi records the
		// starting thinking level before `session_start`, so setting entries alone still count as empty.
		const animate = !process.env.NO_MOTION && (event.reason === "startup" || event.reason === "new")
			&& ctx.sessionManager.getEntries().every((entry) => SETTING_ENTRIES.has(entry.type));
		const header = (current = new DroidHeader(state, animate, time));
		ctx.ui.setHeader((tui, theme) => header.attach(tui, theme));
		// The first keystroke settles the intro; the listener never consumes input.
		if (header.animating) header.onSettle(ctx.ui.onTerminalInput(() => { header.settle(); return undefined; }));

		// The manifest is built in Pi's process once the panel is on screen. Prompts are the ones Pi has loaded.
		header.afterFirstRender(() => {
			void Promise.resolve()
				.then(() => {
					const prompts = pi.getCommands().filter((command) => command.source === "prompt").map((command) => command.name);
					return manifestOf({ cwd: ctx.cwd, trusted: ctx.isProjectTrusted(), prompts });
				})
				.catch(failure)
				.then((manifest) => header.setManifest(manifest, keyHints(manifest)));
		});
	});

	pi.on("input", () => { current?.settle(); });
	pi.on("agent_start", () => { current?.settle(); });
	pi.on("session_shutdown", drop);
}
