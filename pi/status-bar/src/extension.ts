import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { advanceMotion, motionFrame, nextMotionDelay, renderFooter, startMotion, usageRepaintDelay } from "./footer.ts";
import type { FooterSnapshot, MotionState, PonytailMode, PonytailState, TatsuSnapshot, TatsuComponent } from "./footer.ts";
import { observeSignals } from "./signals.ts";
import type { SignalsSnapshot } from "./signals.ts";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const motionSeed = () => randomBytes(4).readInt32LE();
// Ponytail 4.13.0's exact status output; bounded before stripping SGR. Other
// controls/warnings/format changes are not a mode and remain visible in EXT.
// The leading ●/○ is Ponytail's own activity dot: ● while the agent runs a turn.
function ponytailStatus(raw: unknown): { mode: PonytailMode; active: boolean } | undefined {
	if (typeof raw !== "string" || raw.length > 512) return undefined;
	const text = raw.replace(/\x1b\[[0-9;:]*m/g, "");
	const match = /^([○●]) 🐴 ponytail: (🌿 LITE|⚡ FULL|🔥 ULTRA| REVIEW)$/.exec(text);
	if (!match) return undefined;
	const mode = ({ "🌿 LITE": "lite", "⚡ FULL": "full", "🔥 ULTRA": "ultra", " REVIEW": "review" } as const)[match[2] as "🌿 LITE" | "⚡ FULL" | "🔥 ULTRA" | " REVIEW"];
	return { mode, active: match[1] === "●" };
}
// Whitelist only classifications and optional counts/flags. Provider text, detail, reason and SHAs never enter state.
function tatsuSnapshot(raw: unknown): TatsuSnapshot | undefined {
	if (!record(raw) || raw.version !== 1 || !["inactive", "checking", "completed"].includes(raw.phase as string) || !Array.isArray(raw.components) || raw.components.length !== 2) return undefined;
	const components: TatsuComponent[] = [];
	for (const component of ["tatsu-cli", "agent-workspace"] as const) {
		const matches = raw.components.filter((c) => record(c) && c.component === component);
		if (matches.length !== 1) return undefined;
		const c = matches[0];
		if (!["inactive", "checking", "current", "behind", "repair", "local_changes", "missing", "not_runnable", "unavailable"].includes(c.state)) return undefined;
		components.push({ component, state: c.state, ...(count(c.commitsBehind) ? { commitsBehind: c.commitsBehind } : {}), ...(typeof c.localChanges === "boolean" ? { localChanges: c.localChanges } : {}) });
	}
	return { phase: raw.phase as TatsuSnapshot["phase"], components };
}
type TatsuObserver = { read(): TatsuSnapshot | undefined; dispose(): void };
type PonytailObserver = { read(): { mode: PonytailState; active: boolean; statuses: ReadonlyMap<string, string> }; dispose(): void };
// Decoration only: owned by one installed TUI footer and never triggers inspection.
type Animation = { state: MotionState; timer?: ReturnType<typeof setTimeout>; due?: number; schedule(now: number): void; resume(): void };
type SessionState = {
	ctx: ExtensionContext; id: string; disposed: boolean;
	signals?: SignalsSnapshot; signalObserver?: { dispose(): void };
	usageTimer?: ReturnType<typeof setTimeout>; usageDue?: number;
	tatsuObserver?: TatsuObserver; ponytail: PonytailState; ponytailObserver?: PonytailObserver;
	ponytailClearUI?: ExtensionContext["ui"];
	requestRender?: () => void; motion: boolean; animation?: Animation;
};

export default function (pi: ExtensionAPI) {
	const homePath = homedir();
	let session: SessionState | undefined;
	// Decoration safety budget outlives tree/footer replacements and motion toggles.
	let ponytailGuardUntil = 0;
	const current = (s: SessionState) => session === s && !s.disposed;
	const stopWork = (s: SessionState) => {
		s.disposed = true;
		s.signalObserver?.dispose(); s.signalObserver = undefined;
		if (s.usageTimer) clearTimeout(s.usageTimer);
		s.usageTimer = s.usageDue = undefined;
		s.tatsuObserver?.dispose();
		s.tatsuObserver = undefined;
		s.ponytailObserver?.dispose();
		s.ponytailObserver = undefined;
		s.requestRender = undefined;
		stopAnimation(s);
		s.animation = undefined;
	};
	const stopAnimation = (s: SessionState) => {
		if (s.animation) ponytailGuardUntil = Math.max(ponytailGuardUntil, s.animation.state.ponytailGuardUntil, s.animation.state.ponytailBurst ? performance.now() + 1100 : 0);
		if (s.animation?.timer) clearTimeout(s.animation.timer);
		if (s.animation) s.animation.timer = s.animation.due = undefined;
	};

	// Countdowns are live values: repaint when one can change, with or without motion.
	const scheduleUsageRepaint = (s: SessionState, delay: number | undefined) => {
		if (delay === undefined || !current(s)) return;
		const now = performance.now(), due = now + delay + 20;
		if (s.usageTimer && s.usageDue! <= due) return;
		if (s.usageTimer) clearTimeout(s.usageTimer);
		s.usageDue = due;
		s.usageTimer = setTimeout(() => {
			s.usageTimer = s.usageDue = undefined;
			if (current(s)) s.requestRender?.();
		}, due - now);
		s.usageTimer.unref();
	};

	// Pi 1.0.4 shares ctx.ui across extension handlers. There is no public status
	// subscription; observe ONLY the named status while forwarding every call.
	// Reuse a tap under a later foreign wrapper rather than stacking wrappers.
	type StatusTap = { original: ExtensionContext["ui"]["setStatus"]; wrapped: ExtensionContext["ui"]["setStatus"]; receive?: (text: string | undefined) => void };
	const statusTaps = new WeakMap<ExtensionContext["ui"], StatusTap>();
	function observePonytail(s: SessionState, getStatuses: () => ReadonlyMap<string, string>): PonytailObserver {
		let live = true, initializing = true, active = false, detach = () => {};
		let ui: ExtensionContext["ui"] | undefined;
		const owned = () => live && current(s) && s.ctx.mode === "tui" && s.ctx.sessionManager.getSessionId() === s.id;
		const publish = (mode: PonytailState, nowActive: boolean) => {
			if (owned() && (s.ponytail !== mode || active !== nowActive)) { s.ponytail = mode; active = nowActive; s.requestRender?.(); }
		};
		const attach = () => {
			const next = s.ctx.ui;
			if (ui === next) return;
			detach(); ui = next;
			if (s.ponytailClearUI !== ui) s.ponytailClearUI = undefined;
			if (typeof ui.setStatus !== "function") return;
			let tap = statusTaps.get(ui);
			if (!tap) {
				const original = ui.setStatus;
				tap = { original, wrapped: function (key, text) {
					const result = original.call(this, key, text);
					if (key === "ponytail") tap!.receive?.(text);
					return result;
				} };
				statusTaps.set(ui, tap);
			}
			const receive = (text: string | undefined) => {
				if (!owned() || s.ctx.ui !== next) return;
				initializing = false;
				s.ponytailClearUI = text === undefined ? next : undefined;
				const known = text === undefined ? undefined : ponytailStatus(text);
				publish(text === undefined ? "off" : known?.mode ?? "unknown", known?.active === true);
			};
			tap.receive = receive;
			// A foreign wrapper above our tap is left intact; it must delegate to
			// keep clear observation working. Never overwrite it during cleanup.
			if (ui.setStatus === tap.original) ui.setStatus = tap.wrapped;
			detach = () => {
				if (tap.receive !== receive) return;
				tap.receive = undefined;
				if (next.setStatus === tap.wrapped) next.setStatus = tap.original;
			};
		};
		const read = () => {
			if (!owned()) return { mode: "unknown" as const, active: false, statuses: getStatuses() };
			attach(); // public UI can be replaced on reload; never patch runner internals
			const statuses = getStatuses(), raw = statuses.get("ponytail"), known = ponytailStatus(raw);
			if (raw !== undefined) { initializing = false; s.ponytailClearUI = undefined; }
			const mode: PonytailState = known?.mode ?? (raw !== undefined ? "unknown" : s.ponytailClearUI === ui ? "off" : initializing ? "checking" : "unknown");
			if (!known) return { mode, active: false, statuses };
			const rest = new Map(statuses); rest.delete("ponytail");
			return { mode, active: known.active, statuses: rest }; // presentation only; host map stays intact
		};
		attach();
		// One bounded initialization turn, not polling. Missing never means OFF.
		const timer = setTimeout(() => { initializing = false; if (owned()) { const now = read(); publish(now.mode, now.active); } }, 0); timer.unref();
		return { read, dispose() { live = false; clearTimeout(timer); detach(); } };
	}

	// Public synchronous discovery plus pushes, with no provider imports, formatter or polling.
	function observeTatsu(s: SessionState): TatsuObserver {
		// `completed` is the last completed result; a later refresh (phase checking) keeps showing it, so only a changed
		// result changes the text. Checking shows only before the first result; inactive, invalid or absent data clear it.
		let live = true, latest: TatsuSnapshot | undefined, completed: TatsuSnapshot | undefined;
		const ui = s.ctx.ui;
		const owned = () => live && current(s) && s.tatsuObserver === observer && s.ctx.mode === "tui" && s.ctx.ui === ui && s.ctx.sessionManager.getSessionId() === s.id;
		const accept = (raw: unknown) => {
			if (!owned()) return;
			try { latest = tatsuSnapshot(raw); } catch { latest = undefined; }
			if (latest?.phase === "completed") completed = latest;
			else if (latest?.phase !== "checking") completed = undefined;
			s.requestRender?.();
		};
		const request = () => {
			if (!owned()) return;
			latest = undefined;
			let requesting = true;
			try {
				pi.events.emit("tatsu-status:request", { version: 1, reply(api: unknown) {
					if (!requesting || !owned()) return;
					try { accept(record(api) && api.version === 1 && typeof api.getSnapshot === "function" ? api.getSnapshot() : undefined); }
					catch { accept(undefined); }
				} });
			} finally { requesting = false; }
			if (!latest) completed = undefined;
			s.requestRender?.(); // no synchronous reply means absent; never wait
		};
		const observer: TatsuObserver = { read: () => !owned() ? undefined : latest?.phase === "checking" && completed ? completed : latest,
			dispose() { live = false; offChanged(); offReady(); latest = completed = undefined; } };
		s.tatsuObserver = observer;
		// Subscribe before request so either provider load order and restart is recoverable.
		const offChanged = pi.events.on("tatsu-status:changed", accept);
		const offReady = pi.events.on("tatsu-status:ready", () => { if (owned()) request(); });
		request();
		return observer;
	}

	function restore(ctx: ExtensionContext) {
		const id = ctx.sessionManager.getSessionId();
		const motion = session?.id === id ? session.motion : true;
		if (session) stopWork(session);
		const s: SessionState = { ctx, id, disposed: false, ponytail: "checking", motion };
		session = s;
		if (ctx.mode === "tui") {
			ctx.ui.setFooter((tui, theme, footerData) => {
				if (session !== s) return { render: () => [], invalidate() {} };
				stopWork(s); s.disposed = false;
				const render = () => tui.requestRender();
				s.requestRender = render;
				const ponytailObserver = observePonytail(s, () => footerData.getExtensionStatuses());
				s.ponytailObserver = ponytailObserver;
				const tatsuObserver = observeTatsu(s);
				s.signalObserver = observeSignals(pi, () => current(s) && s.ctx.sessionManager.getSessionId() === s.id ? s.id : undefined, (signals) => { s.signals = signals; s.requestRender?.(); });
				const snapshot = (): FooterSnapshot => {
					const ponytail = ponytailObserver.read(), tatsu = tatsuObserver.read();
					const statuses = new Map(ponytail.statuses);
					if (tatsu && tatsu.phase !== "inactive") statuses.delete("tatsu-status");
					const signals = s.ctx.sessionManager.getSessionId() === s.id ? s.signals : undefined;
					const launch = s.ctx.sessionManager.getHeader()?.cwd ?? s.ctx.sessionManager.getCwd();
					const absent = { kind: "unknown" as const, reason: "no collector" };
					return {
						homePath, launchPath: signals?.launch ?? launch, activePath: signals?.active ?? "unknown",
						workspace: signals ? signals.workspace ?? undefined : { path: "unknown", git: absent, github: absent },
						pullRequest: signals?.pr ?? { kind: "unavailable", reason: signals ? "lookup pending" : "no collector" },
						contextUsage: s.ctx.getContextUsage(), model: s.ctx.model, thinking: pi.getThinkingLevel(),
						statuses, tatsu, activity: { working: !s.ctx.isIdle(), units: signals?.units ?? null }, compactions: signals?.compactions ?? null, ponytail: ponytail.mode, ponytailActive: ponytail.active,
						compactionReserve: signals?.context?.reserve ?? undefined,
						usage: signals?.usage.installed ? { now: Date.now(), providers: signals.usage.providers } : undefined,
					};
				};
				let latest = snapshot();
				const animation: Animation = {
					state: startMotion(latest, performance.now(), motionSeed(), true, ponytailGuardUntil),
					resume() {
						stopAnimation(s);
						latest = snapshot();
						const now = performance.now();
						animation.state = startMotion(latest, now, motionSeed(), false, ponytailGuardUntil);
						animation.schedule(now);
					},
					// One unref'd decoration timeout; no telemetry collection in this path.
					schedule(now) {
						if (!s.motion || !current(s) || s.animation !== animation) return;
						const due = now + nextMotionDelay(animation.state, now);
						if (animation.timer && animation.due! <= due) return;
						if (animation.timer) clearTimeout(animation.timer);
						animation.due = due;
						animation.timer = setTimeout(() => {
							animation.timer = animation.due = undefined;
							if (!s.motion || !current(s) || s.animation !== animation) return;
							const time = performance.now();
							animation.state = advanceMotion(animation.state, latest, time);
							render();
							animation.schedule(time);
						}, due - now);
						animation.timer.unref();
					},
				};
				s.animation = animation;
				animation.schedule(performance.now());
				return {
					invalidate() {},
					render(width) {
						if (!current(s) || s.animation !== animation) return [];
						latest = snapshot();
						scheduleUsageRepaint(s, usageRepaintDelay(latest.usage));
						const now = performance.now();
						if (s.motion) {
							animation.state = advanceMotion(animation.state, latest, now);
							animation.schedule(now);
						}
						return renderFooter(latest, width, theme, s.motion ? motionFrame(animation.state, now) : undefined);
					},
					dispose() { if (s.animation === animation) stopWork(s); },
				};
			});
		}
	}

	pi.on("session_start", (_event, ctx) => restore(ctx));
	pi.on("session_tree", (_event, ctx) => restore(ctx));
	pi.on("session_shutdown", (_event, ctx) => {
		if (session) stopWork(session);
		session = undefined;
		if (ctx.mode === "tui") ctx.ui.setFooter(undefined);
	});
	// ROOT/context/model/thinking stay live at render; no data collection here.
	for (const event of ["agent_start", "agent_end", "agent_settled", "model_select", "thinking_level_select", "session_compact"] as const) {
		pi.on(event, (_e, ctx) => { if (session && current(session) && ctx.sessionManager.getSessionId() === session.id) { session.ctx = ctx; session.requestRender?.(); } });
	}

	pi.registerCommand("footer-motion", {
		description: "Footer decoration motion for this session: on, off, or toggle when empty. Live values keep updating.",
		getArgumentCompletions: (prefix) => ["on", "off"].filter((value) => value.startsWith(prefix.trim())).map((value) => ({ value, label: value })),
		async handler(args, ctx) {
			const s = session, choice = args.trim().toLowerCase();
			if (choice && choice !== "on" && choice !== "off") {
				if (ctx.hasUI) ctx.ui.notify("Usage: /footer-motion [on|off]", "warning");
				return;
			}
			if (!s) return;
			s.motion = choice ? choice === "on" : !s.motion;
			if (s.motion) s.animation?.resume();
			else stopAnimation(s);
			s.requestRender?.();
			if (ctx.hasUI) ctx.ui.notify(`Footer motion ${s.motion ? "on" : "off"} for this session`, "info");
		},
	});

}
