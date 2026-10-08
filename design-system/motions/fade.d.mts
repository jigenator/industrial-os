import type { Color, Line } from '../foundation/cells.mjs';
import type { PaletteRole as Role } from '../foundation/palette.mjs';
import type { MotionOptions, Region } from './flash.mjs';
export interface FadeOptions extends MotionOptions { levels?: readonly Color[]; period?: number; roles?: readonly Role[]; region?: Region; }
export const FADE_DEFAULTS: Readonly<FadeOptions>;
export function fade(lines: Line[], options?: FadeOptions): Line[];
