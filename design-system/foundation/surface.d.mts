import type { Color, Style } from './cells.mjs';
export interface SurfaceSize { width: number; height: number }
/** Lightness of the top centre, its drop to the bottom edge and its extra drop to the sides. */
export interface SurfaceGradient { top: number; drop: number; edge: number }
export const SURFACE_GRADIENT: Readonly<SurfaceGradient>;
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
  /** Overrides any of the default gradient's numbers. */
  gradient?: Partial<SurfaceGradient>;
  /** Cells either side of ink, in the same row, that stay free of dots: 2 (default) or 1. */
  dotClearance?: 1 | 2;
  /** No dot where the gradient's lightness is below this (0–255, default 0: dots everywhere). */
  dotFloor?: number;
}
export function surfaceAt(x: number, y: number, size: SurfaceSize & { gradient?: Partial<SurfaceGradient> }): `#${string}`;
export function dotAt(x: number, y: number): `#${string}` | null;
/** A six-row plate's brushed-aluminium ground at (x, y), and the hairline drawn on it. */
export function aluminiumAt(x: number, y: number, size: { width: number }): { ground: `#${string}`; hair: `#${string}` };
export function blendFill(fill: Color, under: Color, alpha: number): `#${string}`;
/** Compose full viewport rows so same-row text clearance has its complete context. Extra cell properties pass through. */
export function composeSurface<C extends SurfaceCell>(rows: readonly (readonly C[])[], options: SurfaceOptions): C[][];
