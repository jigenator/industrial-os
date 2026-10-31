export interface UsageColors { readonly lit: `#${string}`; readonly used: `#${string}`; readonly mid: `#${string}` }
export const USAGE_NEUTRAL: UsageColors;
export const USAGE_COLORS: Readonly<Record<'usage.gpt' | 'usage.cld' | 'usage.kmi', UsageColors>>;
export function usageColors(token?: unknown): UsageColors;
