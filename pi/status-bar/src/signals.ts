import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// Wire types from signals-collector/docs/contract.md; no extension imports.
export type CheckoutInfo = {
  path: string;
  branch: string | null; // null only for confirmed detached HEAD
  revision: string | null;
  dirty: boolean | null;
  error?: string;
};
export type GithubRepository = { kind: 'repository'; name: string; url: string };
export type WorkspaceInfo = {
  path: string;
  git:
    | { kind: 'none' }
    | { kind: 'unknown'; reason: string }
    | { kind: 'repository'; active: CheckoutInfo; main: CheckoutInfo | null; isWorktree: boolean; mainUnavailableReason?: string };
  github:
    | GithubRepository
    | { kind: 'none'; reason: string }
    | { kind: 'unknown'; reason: string };
};
export type PullRequestInfo =
  | { kind: 'open'; number: number; url: string }
  | { kind: 'none' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'not-applicable' };

export type UsageProviderId = "codex" | "claude" | "kimi";
/** A window's used share; null when CodexBar reported the window without a finite percentage. */
export type UsageWindow = { usedPercent: number | null; resetsAt: number | null };
/** Only 300-minute (5H) and 10080-minute (WK) windows are kept; an absent key is a window the provider does not report. */
export type UsageWindows = { '5h'?: UsageWindow; wk?: UsageWindow };
/** Last good sample; receipt timestamp identifies the sample for display motion. */
export type UsageSample = { windows: UsageWindows; updatedAt: number | null; fetchedAt: number };
export type UsageProviderState = { provider: UsageProviderId; data?: UsageSample; failure?: "timeout" | "failed" };
export type UsageSnapshot = { installed: boolean | null; providers: UsageProviderState[] };
export type Phase =
	| { kind: "waiting" | "thinking" | "writing"; since: number }
	| { kind: "tool"; tool: string; target: string | null; since: number };
export type SignalsSnapshot = {
	version: 1; sessionId: string; seq: number; launch: string; active: string;
	workspace: WorkspaceInfo | null; pr: PullRequestInfo | null;
	root: { working: boolean; lastSettledAt: number | null };
	phase: Phase | null;
	question: { text: string; more: number; since: number } | null;
	model: { provider: string; id: string } | null;
	thinking: string | null;
	context: { tokens: number | null; window: number; reserve: number | null; usedPercent: number | null } | null;
	compactions: number | null; units: number | null;
	goal: { status: string; usedSeconds: number; activeSince: number | null } | null;
	usage: UsageSnapshot;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** Subscribe before synchronous request; ready repairs either lifecycle/load order. */
export function observeSignals(pi: ExtensionAPI, sessionId: () => string | undefined, publish: (snapshot: SignalsSnapshot | undefined) => void): { dispose(): void } {
	let live = true, seq = -1;
	const accept = (raw: unknown) => {
		const id = sessionId();
		if (!live || !id) return false;
		if (!record(raw) || raw.version !== 1 || raw.sessionId !== id) return false;
		if (typeof raw.seq === "number" && raw.seq < seq) return false;
		if (!Number.isSafeInteger(raw.seq) || (raw.seq as number) < 0 || typeof raw.launch !== "string" || typeof raw.active !== "string"
			|| !record(raw.usage) || !Array.isArray(raw.usage.providers)) { publish(undefined); return false; }
		seq = raw.seq as number; publish(structuredClone(raw) as SignalsSnapshot); return true;
	};
	const request = () => {
		if (!live || !sessionId()) return;
		let requesting = true, received = false;
		try { pi.events.emit("signals-collector:v1:request", { reply(raw: unknown) { if (requesting) received = accept(raw); } }); }
		finally { requesting = false; }
		if (!received) publish(undefined);
	};
	const offSnapshot = pi.events.on("signals-collector:v1:snapshot", accept);
	const offReady = pi.events.on("signals-collector:v1:ready", (raw) => {
		if (live && record(raw) && raw.version === 1 && raw.sessionId === sessionId()) { seq = -1; request(); }
	});
	request();
	return { dispose() { live = false; offSnapshot(); offReady(); } };
}
