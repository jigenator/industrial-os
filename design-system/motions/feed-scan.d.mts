import type { Line, Measure } from '../foundation/cells.mjs';
import type { MotionOptions } from './flash.mjs';
export interface FeedScanOptions extends MotionOptions { top?:number;rows?:number;rails?:number[];measure?:Measure }
export const FEED_SCAN_DEFAULTS:Readonly<FeedScanOptions>;
export function feedScanDuration(options?:FeedScanOptions):number;
export function feedScan(lines:Line[],options?:FeedScanOptions):Line[];
