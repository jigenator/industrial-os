import type { Line, Color } from './cells.mjs';
export interface AmbientMark { readonly x:number; readonly y:number; readonly label:string; readonly start:number; readonly seed:number }
export const AMBIENT_GRID: Readonly<Record<string, number>>;
export const AMBIENT_MARKS: readonly AmbientMark[];
export function ambientPosition(x:number,y:number):{gx:boolean;gy:boolean;column:number;row:number;dot:boolean};
export function ambientInk(background:Color,proportion:number):`#${string}`;
export function ambientSweepLift(row:number,height:number,time:number,period?:number,run?:number):number;
export function ambientRegistrations(lines:Line[]):readonly AmbientMark[];
