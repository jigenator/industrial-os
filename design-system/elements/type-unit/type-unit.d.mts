import type { Line } from '../../foundation/cells.mjs';
export interface TypeUnitInput { label: string; color?: string; state?: keyof typeof SOURCE_STATES; total?: number | null; waiting?: number | null; fresh?: number | null; remaining?: number | null; age?: string; limit?: string; key?: string; active?: boolean; hover?: boolean }
export const SOURCE_STATES: Readonly<Record<'ok'|'stale'|'auth'|'error'|'config_error'|'disabled'|'planned'|'loading'|'unknown', string>>;
export function stalenessBar(remaining: number | null, options?: {cells?: number}): Line;
export function typeUnit(input: TypeUnitInput, options: {width: number; height?: number}): Line[];
