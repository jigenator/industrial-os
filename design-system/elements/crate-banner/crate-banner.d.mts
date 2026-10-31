import type { Line, Measure } from '../../foundation/cells.mjs';
export type CrateToolState = 'ready' | 'open' | 'disabled';
export interface CrateTool { id: string; label: string; icon?: string | null; state: CrateToolState; hover?: boolean }
export interface CrateBannerInput {
  maker?: string; registered?: boolean; division?: string; unit?: string; serial: string;
  hold?: number | null; clock?: string | null; mark?: string | null; tools?: readonly CrateTool[];
}
/** The cells one rendered tool occupies on `lines[row]`, `end` exclusive, for the host's hit-testing. */
export interface CrateToolSpan { id: string; row: number; start: number; end: number }
export type CrateBannerForm = 'full' | 'compact';
export function crateBanner(input: CrateBannerInput, options: { width: number; form?: CrateBannerForm; measure?: Measure }): { lines: Line[]; tools: CrateToolSpan[] };
