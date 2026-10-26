export interface IndustrialColor { readonly id: string; readonly name: string; readonly hex: `#${string}`; readonly family: string; readonly role: string }
export interface Shade { readonly id: string; readonly label: string; readonly kind: 'base' | 'derived'; readonly hex: `#${string}` }
export const INDUSTRIALOS_COLORS: readonly IndustrialColor[];
export function shadeRamp(hex: `#${string}`): readonly Shade[];
