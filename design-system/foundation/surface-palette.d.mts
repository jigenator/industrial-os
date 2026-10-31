import type { PaletteRole } from './palette.mjs';
export type SurfaceColorName = PaletteRole | 'plateGrey' | 'rule' | 'bone' | 'wheat' | 'wheatHi' | 'tint' | 'tintHi' | 'yellow' | 'selection' | 'hover' | 'code' | 'floor' | 'orange' | 'answered' | 'criticalHover' | 'declined' | 'paperHair' | 'dotMajor';
export const SURFACE_PALETTE: Readonly<Record<SurfaceColorName, `#${string}`> & { dots: readonly `#${string}`[] }>;
