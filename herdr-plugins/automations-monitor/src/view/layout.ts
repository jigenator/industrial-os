// Where everything goes for a pane size. The approved design is a 160×51 grid; other sizes keep its order and
// degrade by rule: below 40 rows or without room for four readouts, the readouts become one line; the event
// log sits beside the list only when the list keeps 70 columns; blocks and schedule rows switch to a compact
// form when lanes would get too short. Sizes: ../../docs/design.md#layout.
export const L = 2;
export const LOG_WIDTH = 35;
export const MIN_COLS = 60;
export const MIN_ROWS = 16;
const MIN_LIST_WITH_LOG = 70;
const READOUT = 27;

export interface Layout {
  readonly cols: number;
  readonly rows: number;
  // Rows.
  readonly machineY: number;
  readonly machineRule: boolean;
  readonly readY: number;
  readonly tallReadouts: boolean;
  readonly listHeadY: number;
  readonly axisY: number;
  readonly list0: number;
  readonly list1: number;
  readonly posY: number;
  // Columns: the scrollbar sits at `scrollX`, the last column of the list region.
  readonly scrollX: number;
  readonly log: { readonly x: number; readonly y: number } | null;
  readonly readoutStep: number;
}

export const tooSmall = (cols: number, rows: number): boolean => cols < MIN_COLS || rows < MIN_ROWS;

export function layout(cols: number, rows: number, logWanted: boolean): Layout {
  const logFits = logWanted && cols - (LOG_WIDTH + 3) >= MIN_LIST_WITH_LOG;
  const logX = cols - LOG_WIDTH - 2;
  const scrollX = logFits ? logX - 4 : cols - 4;
  const span = scrollX - L - 2;
  const readoutStep = Math.min(31, Math.floor((span - (READOUT - 1)) / 3));
  const tallReadouts = rows >= 40 && readoutStep >= READOUT;
  const base = tallReadouts
    ? { machineY: 3, machineRule: true, readY: 6, listHeadY: 15 }
    : { machineY: 2, machineRule: false, readY: 3, listHeadY: 5 };
  return {
    cols,
    rows,
    ...base,
    tallReadouts,
    axisY: base.listHeadY + 1,
    list0: base.listHeadY + 2,
    list1: rows - 4,
    posY: rows - 3,
    scrollX,
    log: logFits ? { x: logX, y: tallReadouts ? base.readY : base.listHeadY } : null,
    readoutStep,
  };
}
