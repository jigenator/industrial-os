import type { Color, Line } from '../../foundation/cells.mjs';
export type UsageProvider = 'codex' | 'claude' | 'kimi';
export type UsageWindowKey = '5h' | 'wk';
export interface ProviderLook { tag: string; ink: Color; declared: readonly UsageWindowKey[] }
export const USAGE_PROVIDERS: Readonly<Record<UsageProvider, Readonly<ProviderLook>>>;
export interface ProviderData { windows: Partial<Record<UsageWindowKey, { usedPercent: number | null; resetsAt?: number | null }>>; updatedAt?: number | null; fetchedAt?: number | null }
export type ProviderInput = ({ provider: UsageProvider } | (ProviderLook & { provider?: undefined })) & { data?: ProviderData; failure?: 'timeout' | 'failed' };
export interface ProviderOptions { segments?: number; now?: number | null }
export interface ProviderPart { top: Line; bottom: Line; width: number; bottomWidth: number; kind: 'tag' | 'slot'; window?: UsageWindowKey }
export function litSegments(remaining: number, segments?: number): number;
export function segmentMeter(input: { remaining?: number | null; state?: 'known' | 'pending' | 'failure' | 'none' | 'unknown' | 'absent'; ink?: Color }, options?: { segments?: number; maxWidth?: number }): Line;
export function countdown(resetsAt?: number | null, now?: number | null, options?: { overflow?: 'throw' | 'text' }): string;
export function staleAge(ms: number): string;
export function providerColumnWidth(input: ProviderInput, options?: ProviderOptions): number;
export function providerColumn(input: ProviderInput, options: ProviderOptions & { width: number }): Line[];
export function providerColumnParts(input: ProviderInput, options?: ProviderOptions & { age?: string | null; countdownOverflow?: 'throw' | 'text' }): ProviderPart[];
