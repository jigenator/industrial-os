import type { PaletteRole } from './palette.mjs';
export type SurfaceColorName = PaletteRole | 'plateGrey' | 'rule' | 'bone' | 'wheat' | 'wheatHi' | 'tint' | 'tintHi' | 'yellow' | 'selection' | 'hover' | 'orange' | 'answered' | 'criticalHover' | 'declined' | 'dotMajor';
export const SURFACE_PALETTE: Readonly<Record<SurfaceColorName, `#${string}`> & { dots: readonly `#${string}`[] }>;
