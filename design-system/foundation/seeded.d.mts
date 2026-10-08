export type Random = { (): number; cursor: number };
export function random(seed: number): Random;
export function hash(a: number, b: number, c: number): number;
export function between(random: Random, bounds: readonly [number, number]): number;
export function pick<T>(random: Random, values: readonly T[]): T;
export function shuffle<T>(random: Random, values: readonly T[]): T[];
export function seedFrom(random: Random): number;
