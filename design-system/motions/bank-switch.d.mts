import type { Line } from '../foundation/cells.mjs';
import type { MotionOptions } from './flash.mjs';
export interface BankSwitchOptions extends MotionOptions { banks?: number; stagger?: number; fade?: number; from?: number | readonly number[]; to?: number }
export const BANK_SWITCH_DEFAULTS: Readonly<{ banks: 4; stagger: 30; fade: 40; from: 0; to: 1 }>;
export function bankSwitchDuration(options?: BankSwitchOptions): number;
export function bankOf(col: number, width: number, banks?: number): number;
export function bankSchedule(width: number, options?: BankSwitchOptions): { bank: number; left: number; cols: number; delay: number; duration: number }[];
export function bankLevels(options?: BankSwitchOptions): number[];
export function bankSwitch(fromLines: Line[], toLines: Line[], options?: BankSwitchOptions): Line[];
