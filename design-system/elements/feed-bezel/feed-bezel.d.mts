import type { Line, TextValue, Measure } from '../../foundation/cells.mjs';
export interface ImageRect { x: number; y: number; width: number; height: number }
export interface FeedOptions { width: number; height: number; measure?: Measure }
export interface FeedInput<T=string> { imageRect: ImageRect; callsign?: T; channel?: T; pose?: T; meter?: Line; lamp?: Line }
export function feedBezel(input: FeedInput, options: FeedOptions): Line[];
export function feedBezel(input: FeedInput<TextValue>, options: FeedOptions & {measure:Measure}): Line[];
export interface ImageLabelInput<T=string> { label:T; missing?:boolean; unsupported?:boolean; hover?:boolean }
export function imageLabel(input:ImageLabelInput,options?:{maxWidth?:number;measure?:Measure}):Line;
export function imageLabel(input:ImageLabelInput<TextValue>,options:{maxWidth?:number;measure:Measure}):Line;
export function imageInset(rect:ImageRect,options:{width:number;height:number}):Line[];
