import type { Color, Ellipsis, Line, Measure, TextValue } from '../../foundation/cells.mjs';
export interface SectionHeadInput { title: string; count?: string; mark?: Color }
export function sectionHead(input: SectionHeadInput, options: { width: number; measure?: Measure; ellipsis?: Ellipsis }): Line;
export function sectionHead(input: { title: TextValue; count?: string; mark?: Color }, options: { width: number; measure: Measure; ellipsis?: Ellipsis }): Line;
