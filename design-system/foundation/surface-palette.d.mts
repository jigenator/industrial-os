import type { PaletteRole } from './palette.mjs';
export type SurfaceColorName = PaletteRole | 'plateGrey' | 'rule' | 'bone' | 'wheat' | 'wheatHi' | 'tint' | 'tintHi' | 'yellow' | 'selection' | 'hover' | 'code' | 'floor' | 'orange' | 'answered' | 'criticalHover' | 'declined' | 'paperHair' | 'aluminiumLabel' | 'frostLamp' | 'frostRule' | 'dotMajor';
export const SURFACE_PALETTE: Readonly<Record<SurfaceColorName, `#${string}`> & { dots: readonly `#${string}`[] }>;
export interface AluminiumStreak { readonly amplitude: number; readonly x: number; readonly y: number }
/** The crate banner's aluminium ground: lightness terms, per-channel offsets and the hairline offset. */
export const ALUMINIUM_GROUND: Readonly<{ base: number; band: number; fall: number; streaks: readonly AluminiumStreak[]; channels: readonly [number, number, number]; hair: number }>;
/** The share of white over the host's background under the crate banner's frosted strip. */
export const FROST_ALPHA: number;
export type PlateLevel = 'lit' | 'standby' | 'dark';
export interface GraphiteLevel { readonly base: number; readonly band: number; readonly fall: number; readonly amp: number; readonly channels: readonly [number, number, number]; readonly hair: number }
/** The unlit plate ground: ALUMINIUM_GROUND's formula re-based dark, for the `dark` and `standby` levels. */
export const GRAPHITE_GROUND: Readonly<{ dark: GraphiteLevel; standby: GraphiteLevel }>;
export type PlateRole = 'word' | 'value' | 'label' | 'bars' | 'corner' | 'peak' | 'strip' | 'key' | 'action' | 'detail' | 'ready';
/** Unlit plate inks by role; `strip` null keeps the lit frost. */
export const PLATE_LIGHTING: Readonly<{ dark: Readonly<Record<PlateRole, `#${string}`>>; standby: Readonly<Record<Exclude<PlateRole, 'strip'>, `#${string}`> & { strip: null }> }>;
/** The keycap bay's ground and inks per level, and the hover and pressed fills. */
export const BAY_INKS: Readonly<{
  lit: Readonly<{ ground: `#${string}`; bracket: `#${string}`; glyph: `#${string}` }>;
  standby: Readonly<{ ground: `#${string}`; bracket: `#${string}`; glyph: `#${string}` }>;
  dark: Readonly<{ ground: `#${string}`; bracket: `#${string}`; glyph: `#${string}` }>;
  hover: Readonly<{ ground: `#${string}`; glyph: `#${string}` }>;
  pressed: Readonly<{ ground: `#${string}`; glyph: `#${string}` }>;
}>;
