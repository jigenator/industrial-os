import type { Line, Style } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface PingOptions extends MotionOptions {
  launch?: number; stagger?: number; ghostAt?: number; ghostFor?: number; repeatAfter?: number;
  repeats?: number; frame?: number; region?: Region; offStyle?: Style;
}
export const PING_DEFAULTS: Readonly<PingOptions>;
export function pingDuration(lines: Line[], options?: PingOptions): number;
export function ping(lines: Line[], options?: PingOptions): Line[];
