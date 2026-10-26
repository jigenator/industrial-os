import type { Color, Line, Measure, Style, TextValue } from '../../foundation/cells.mjs';
export interface Options { width: number; measure?: Measure }
export interface MeasuredOptions extends Options { measure: Measure }
export const DESK_COLUMNS: Readonly<{ stripe: 1; content: 3; body: 5 }>;
export interface StripInput<T = string> { state?: 'clear' | 'waiting' | 'open'; count?: T; hint?: T }
export interface HeadingInput<T = string> { count?: T; hint?: T }
export interface TitleInput<T = string> { label?: T; title?: T; open?: boolean; meta?: T }
export interface QuestionOption<T = string> { label?: T; body: T; selected?: boolean; pick?: boolean; hint?: T }
export interface BodyInput<T = string> { prompt?: readonly T[]; options?: readonly QuestionOption<T>[] }
export interface FooterInput<T = string> { state?: 'hint' | 'saving' | 'error' | 'decline' | 'readonly'; text?: T; detail?: T }
export function deskStrip(input: StripInput<string>, options: Options): Line;
export function deskStrip(input: StripInput<TextValue>, options: MeasuredOptions): Line;
export function deskHeading(input: HeadingInput<string>, options: Options): Line;
export function deskHeading(input: HeadingInput<TextValue>, options: MeasuredOptions): Line;
export function questionTitle(input: TitleInput<string>, options: Options): Line;
export function questionTitle(input: TitleInput<TextValue>, options: MeasuredOptions): Line;
export function questionBody(input: BodyInput<string>, options: Options): Line[];
export function questionBody(input: BodyInput<TextValue>, options: MeasuredOptions): Line[];
export function deskFooter(input: FooterInput<string>, options: Options): Line;
export function deskFooter(input: FooterInput<TextValue>, options: MeasuredOptions): Line;
