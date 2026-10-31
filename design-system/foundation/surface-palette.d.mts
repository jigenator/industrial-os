import type { PaletteRole } from './palette.mjs';
export type SurfaceColorName = PaletteRole | 'plateGrey' | 'rule' | 'bone' | 'wheat' | 'wheatHi' | 'tint' | 'tintHi' | 'yellow' | 'selection' | 'hover' | 'code' | 'floor' | 'orange' | 'answered' | 'criticalHover' | 'declined' | 'paperHair' | 'aluminiumLabel' | 'frostLamp' | 'frostRule' | 'dotMajor';
export const SURFACE_PALETTE: Readonly<Record<SurfaceColorName, `#${string}`> & { dots: readonly `#${string}`[] }>;
export interface AluminiumStreak { readonly amplitude: number; readonly x: number; readonly y: number }
/** The crate banner's aluminium ground: lightness terms, per-channel offsets and the hairline offset. */
export const ALUMINIUM_GROUND: Readonly<{ base: number; band: number; fall: number; streaks: readonly AluminiumStreak[]; channels: readonly [number, number, number]; hair: number }>;
/** The share of white over the host's background under the crate banner's frosted strip. */
export const FROST_ALPHA: number;
