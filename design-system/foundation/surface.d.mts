import type { Color, Style } from './cells.mjs';
export interface SurfaceSize { width: number; height: number }
export interface SurfaceOrigin { x: number; y: number }
/** One parsed viewport cell; a two-cell grapheme is followed by one empty continuation. */
export interface SurfaceCell { text: string; style?: Style; continuation?: boolean }
export interface SurfaceExclusion extends SurfaceOrigin, SurfaceSize { mode?: 'floor' | 'all' }
export interface SurfaceFill { alpha: number; solid?: boolean }
export interface SurfaceOptions extends SurfaceSize {
  origin?: SurfaceOrigin;
  fills?: Readonly<Record<string, SurfaceFill>>;
  exclude?: readonly SurfaceExclusion[];
  /** The host sets false for plain output or NO_COLOR; no environment is read here. */
  color?: boolean;
}
export function surfaceAt(x: number, y: number, size: SurfaceSize): `#${string}`;
export function dotAt(x: number, y: number): `#${string}` | null;
export function blendFill(fill: Color, under: Color, alpha: number): `#${string}`;
export function composeSurface(rows: readonly (readonly SurfaceCell[])[], options: SurfaceOptions): SurfaceCell[][];
