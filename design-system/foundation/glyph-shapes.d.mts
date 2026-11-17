/** One part of a glyph's shape in a unit cell (x right, y down, 0–1). */
export type GlyphPart =
  | { readonly rect: readonly [number, number, number, number] }
  | { readonly line: 'h' | 'v' }
  | { readonly polygon: readonly (readonly [number, number])[] };
/** The glyphs a terminal draws as built-in shapes (block elements, light lines, Powerline and geometric triangles). */
export const GLYPH_SHAPES: Readonly<Record<string, readonly GlyphPart[]>>;
/** The shape of one glyph, or null when it is text drawn from the font. */
export function glyphShape(ch: string): readonly GlyphPart[] | null;
