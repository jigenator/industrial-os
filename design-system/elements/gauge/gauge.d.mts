import type { Line, Style } from '../../foundation/cells.mjs';
export type GaugeTone = 'ok' | 'warn' | 'high' | 'unknown';
export interface Zones { warn: number; high: number }
export interface GaugeInput { value?: number | null; max?: number; unit?: string; decimals?: number; label?: string }
export interface GaugeOptions { width: number; labelWidth?: number; readoutWidth?: number; zones?: Zones }
export const READOUT_CHIP: Readonly<Record<GaugeTone, Readonly<Style>>>;
export function gaugeReading(input: GaugeInput): { known: boolean; value: number | null; max: number; unit: string; decimals: number };
export function gauge(input: GaugeInput, options: GaugeOptions): Line[];
export function gaugeScale(input: GaugeInput, options: GaugeOptions & { tickFree?: boolean }): Line;
export function gaugeTick(percent: number, cells: number): number;
export function gaugeExtent(percent: number, cells: number): number;
export function gaugeZone(column: number, cells: number, zones?: Zones): GaugeTone;
export function gaugeTrack(input: { percent?: number | null; readout?: string }, options: { cells: number; fill?: 'eighth-floor' | 'cell-ceil'; fillInk?: 'reading' | 'zone'; trackGlyph?: '░' | ' '; marks?: boolean; filledBackground?: 'track' | 'ink'; zones?: Zones }): Line;
export function gaugeParts(readout: string, tone: GaugeTone, options?: { pad?: boolean }): { readout: Line; tag: Line };
export function gaugeScaleParts(input: { cells: number; max?: number; zones?: Zones }, options: { width: number; decilesMinCells?: number }): { percent: number; start: number; spans: Line }[];
