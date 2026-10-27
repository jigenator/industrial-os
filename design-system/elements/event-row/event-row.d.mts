import type { Ellipsis, Line, Measure } from '../../foundation/cells.mjs';
import type { BoardToneName } from '../../foundation/board-tones.mjs';
export interface EventRowInput { time: string; tone: BoardToneName; verb: string; ref?: string; text?: string }
export function eventRow(event: EventRowInput, options: { width: number; measure?: Measure; form?: 'log' | 'detail'; ellipsis?: Ellipsis }): Line;
