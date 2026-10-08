import type { Color } from './cells.mjs';
export const SIGNAL_COLORS: Readonly<Record<'violet' | 'pink' | 'cobalt' | 'magenta' | 'teal' | 'warningZone' | 'criticalZone' | 'ghost' | 'checkLow' | 'checkMid' | 'checkHigh' | 'checkPeak' | 'accent25' | 'accent50' | 'accent75' | 'warning25' | 'warning50' | 'warning75' | 'critical25' | 'critical50' | 'critical75' | 'decorative50' | 'gpt' | 'gptUsed' | 'gptMid' | 'cld' | 'cldUsed' | 'cldMid' | 'kmi' | 'kmiUsed' | 'kmiMid', `#${string}`>>;
export function mixOver(color: Color, proportion: number): `#${string}`;
