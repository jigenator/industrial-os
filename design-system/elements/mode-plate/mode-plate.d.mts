import type { Color, Line, Span } from '../../foundation/cells.mjs';
export type PnytlState = 'lite' | 'full' | 'ultra' | 'review' | 'off' | 'checking' | 'unknown';
export const PNYTL_MODES: Readonly<Record<PnytlState, Readonly<{ code: string; ink: Color }>>>;
export interface ModePlateInput { icon?: string; title: string; code: string; ink: Color; active?: boolean }
export interface ModePlateParts { leftGap: Line; leadingPad: Line; icon: Line; title: Line; codeCells: Span[]; trailingPad: Line; rightGap: Line }
export function modePlate(input: ModePlateInput, options?: { maxWidth?: number }): Line;
export function pnytlPlate(state: PnytlState, options?: { active?: boolean; maxWidth?: number }): Line;
export function modePlateParts(input: ModePlateInput): ModePlateParts;
export function pnytlPlateParts(state: PnytlState, options?: { active?: boolean }): ModePlateParts;
