import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface SoundingSweepOptions extends MotionOptions { region?: Region }
export const SOUNDING_SWEEP_DEFAULTS: Readonly<SoundingSweepOptions>;
export function soundingSweep(lines: Line[], options?: SoundingSweepOptions): Line[];
