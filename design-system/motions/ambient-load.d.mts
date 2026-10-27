import type { Line } from '../foundation/cells.mjs';
export interface AmbientLoadOptions {time?:number;animate?:boolean;region?:{top?:number;left?:number;rows?:number;cols?:number}}
export const AMBIENT_LOAD_DEFAULTS:Readonly<AmbientLoadOptions>;
export function ambientLoad(lines:Line[],options?:AmbientLoadOptions):Line[];
export function ambientLoadDuration(lines:Line[],options?:AmbientLoadOptions):number;
