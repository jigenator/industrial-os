export const BARCODE_BARS: readonly string[];
/** n cells (1–1000): guard bars around n − 2 bars, each `BARCODE_BARS[pick(BARCODE_BARS.length)]`. */
export function barcode(n: number, pick: (count: number) => number): string;
