import type { Line, Style } from '../../foundation/cells.mjs';
export interface CountPlateSpec { label: string; side: 'before' | 'after'; joiner: string; cap: number | null; unknown: '?' | '??'; unknownStyle: Style; tiers: readonly { upTo: number; style: Style }[] }
export const COUNT_PLATES: Readonly<Record<'compactions' | 'units', Readonly<CountPlateSpec>>>;
export function countPlate(count: number | null | undefined, spec?: CountPlateSpec, options?: { maxWidth?: number }): Line;
