import type { Color, Ellipsis, Line, Measure } from '../../foundation/cells.mjs';
export interface ReadoutPart { text: string; ink: Color }
export interface ReadoutInput { number: number; label: string; value: string; ink: Color; unit?: readonly ReadoutPart[]; sub?: ReadoutPart | null; strip?: Line | null }
export function readoutBlock(input: ReadoutInput, options: { width: number; measure?: Measure; ellipsis?: Ellipsis }): Line[];
export function readoutLine(readouts: readonly (readonly ReadoutPart[])[], options: { width: number; measure?: Measure; ellipsis?: Ellipsis }): Line;
export function slotStrip(input: { busy: readonly Color[]; slots?: number | null; reporting?: boolean }, options?: { maxWidth?: number }): Line;
export function splitBar(input: { ok: number; warn: number; fail: number }, options: { width: number }): Line;
export interface PhaseStep { label: string; detail: string }
export function phaseSteps(input: { steps: readonly PhaseStep[]; current: number; ink: Color; lit?: boolean }, options: { width: number; measure?: Measure }): Line[];
