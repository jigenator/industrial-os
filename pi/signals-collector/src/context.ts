import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
export type ContextSnapshot = { tokens: number | null; window: number; reserve: number | null; usedPercent: number | null };

// Mirrors Pi 1.0.4 SettingsManager.getCompactionSettings. This policy lives only here.
export function compactionReserve(settings: unknown, model: ExtensionContext["model"]): number | null {
	const raw = record(settings) ? settings.compaction ?? {} : {};
	if (!record(raw) || !(raw.enabled ?? true)) return null;
	const overrides = raw.modelOverrides, entry = model && record(overrides) ? overrides[`${model.provider}/${model.id}`] ?? {} : {};
	if (!record(entry)) return null;
	const reserve = entry.reserveTokens ?? raw.reserveTokens ?? 16_384;
	return [raw.reserveTokens, entry.reserveTokens].every((value) => value === undefined || count(value)) && count(reserve) ? reserve : null;
}

// Pure arithmetic also exists in status-bar's contextOf for live-token rendering.
// Both projects test the vectors documented in their architecture guides.
export function contextSnapshot(usage: ReturnType<ExtensionContext["getContextUsage"]>, model: ExtensionContext["model"], reserve: number | null): ContextSnapshot | null {
	const tokens = finite(usage?.tokens);
	const window = [usage?.contextWindow, model?.contextWindow].find((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
	if (window === undefined) return null;
	const budget = reserve !== null && count(reserve) && reserve < window ? window - reserve : null;
	const used = budget === null ? finite(usage?.percent) : tokens === null ? null : tokens / budget * 100;
	return { tokens, window, reserve, usedPercent: used === null ? null : Math.min(used, 100) };
}
