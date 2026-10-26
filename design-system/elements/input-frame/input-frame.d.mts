import type { Line, TextValue, Measure } from '../../foundation/cells.mjs';
export interface InputFrameInput<T=string> { state?:'idle'|'hover'|'focused'|'form';label?:T;scroll?:T;spread?:boolean }
export interface InputFrameOptions { width:number;bodyRows?:number;measure?:Measure }
export function inputFrame(input:InputFrameInput,options:InputFrameOptions):Line[];
export function inputFrame(input:InputFrameInput<TextValue>,options:InputFrameOptions&{measure:Measure}):Line[];
