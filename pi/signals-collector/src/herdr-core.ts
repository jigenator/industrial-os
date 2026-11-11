import { spawn, type ChildProcess } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { SignalsSnapshot } from "./snapshot.ts";

// Herdr desktop publication: the snapshot as one herdr-core label on this process's own terminal.
export const SIGNALS_LABEL = "io.signals.v1";
const MIN_INTERVAL_MS = 1_000, TIMEOUT_MS = 2_000;
// Shutdown must not hold Pi's session replacement; a late stale write self-heals at the next publish (new seq).
const CLEAR_TIMEOUT_MS = 1_000;

export type HcCall = { done: Promise<boolean>; kill(): void };
/** Runs `hc <args>` once; resolves true only on exit 0. Never rejects. */
export type RunHc = (args: string[], timeoutMs: number) => HcCall;

/** `HC_TERMINAL_ID` when it is a non-empty string; otherwise nothing is published or spawned. */
export function signalsTerminal(env: NodeJS.ProcessEnv = process.env): string | undefined {
	const id = env.HC_TERMINAL_ID;
	return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** `hc` from PATH with the inherited environment (its HC_TERMINAL_SOCKET reaches this machine's herdr-core). */
export const runHc: RunHc = (args, timeoutMs) => {
	let kill = () => {};
	const done = new Promise<boolean>((resolve) => {
		let child: ChildProcess;
		try { child = spawn("hc", args, { stdio: "ignore" }); } catch { resolve(false); return; }
		let settled = false;
		const finish = (ok: boolean) => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };
		// Signal only a started child: a pid-less ChildProcess has nothing to kill.
		kill = () => { if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); finish(false); };
		const timer = setTimeout(kill, timeoutMs);
		timer.unref();
		child.on("error", () => finish(false));
		child.on("close", (code) => finish(code === 0));
	});
	return { done, kill: () => kill() };
};

/** Latest wins; one call in flight; at most one started per second; identical values to the last success are skipped. */
export function labelPublisher(terminal: string, run: RunHc = runHc) {
	let latest: string | undefined, published: string | undefined, call: HcCall | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined, lastStart = -Infinity, closed = false, attempted = false;
	function pump() {
		if (closed || call || timer || latest === undefined) return;
		if (latest === published) { latest = undefined; return; }
		const wait = lastStart + MIN_INTERVAL_MS - performance.now();
		if (wait > 0) {
			timer = setTimeout(() => { timer = undefined; pump(); }, Math.ceil(wait));
			timer.unref();
			return;
		}
		const value = latest, current = run(["label", terminal, `${SIGNALS_LABEL}=${value}`], TIMEOUT_MS);
		latest = undefined; lastStart = performance.now(); attempted = true; call = current;
		// A failure stays silent: the next change tries again, with no retry loop.
		void current.done.then((ok) => {
			if (call !== current) return;
			call = undefined;
			if (ok) published = value;
			pump();
		});
	}
	return {
		publish(snapshot: SignalsSnapshot) {
			if (closed) return;
			const { usage: _usage, ...session } = snapshot; // usage is machine-wide, not per session
			latest = JSON.stringify(session);
			pump();
		},
		/** Best-effort clear; kills a write in flight so shutdown adds at most the clear's 1 s. */
		async close() {
			closed = true;
			if (timer) clearTimeout(timer);
			call?.kill();
			timer = call = latest = undefined;
			if (attempted) await run(["label", terminal, `${SIGNALS_LABEL}=`], CLEAR_TIMEOUT_MS).done;
		},
	};
}
