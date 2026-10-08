import type { Color, Line } from '../../foundation/cells.mjs';
export const FRAME_MINIMAL_BELOW: 40;
export const FRAME_PLATE_WIDTH: 8;
export function frameGeometry(width: number, options?: { maxWidth?: number }): Readonly<{ minimal: boolean; gutter: number; plateWidth: number; contentColumn: number; contentWidth: number }>;
export function wrapLine(line: Line, width: number): Line[];
export function instrumentFrame(input: { header?: { plate?: Line; title?: Line; aside?: Line[][] }; spacer?: Line[]; rows?: { plate?: Line; lines?: Line[]; bg?: Color }[] }, options: { width: number; centerMark?: boolean }): Line[];
export function frameStubs(input: { gutter: number; row: number; innerRows: number }): { left: Line; right: Line };
export function frameCenter(input: { width: number; titleEnd: number; asideStart: number; offset?: number }): { start: number; spans: Line } | undefined;
