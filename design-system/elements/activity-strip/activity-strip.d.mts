import type { Line } from '../../foundation/cells.mjs';
export interface ActivityStripInput { blocks: {start: string; you: number; agents: number; future: boolean}[]; total: {you: number; agents: number}; previous: {you: number; agents: number} }
export function activityStrip(input: ActivityStripInput, options: {width: number; height?: number}): Line[];
