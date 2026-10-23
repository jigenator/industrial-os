import type { Line } from '../../foundation/cells.mjs';
export interface PlanCounts { today: number | null; inbox: number | null; later: number | null }
export function planCounter(input: PlanCounts, options: {width: number; height?: number}): Line[];
