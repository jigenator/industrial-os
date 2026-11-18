export type Hex = `#${string}`;
export type StateCode = 'QNS' | 'BLK' | 'DNE' | 'WRK' | 'SUB' | 'RUN' | 'IDL' | 'UNK';
export type ZoneStatus = 'halted' | 'active' | 'pending' | 'secure';
export type UnitKind = 'drd' | 'agt' | 'trm' | 'mod';
export type SidebarIcon = 'droid' | 'machine' | 'spaces' | 'command' | 'search' | 'flag' | 'pointer';
export interface StateMark { readonly lit: boolean; readonly stepMs: number; readonly frames: readonly string[] }

export const SIDEBAR_COLORS: Readonly<Record<string, Hex>>;
export const SIDEBAR_ALPHA: Readonly<Record<string, number>>;
export const UNIT_STATUS: Readonly<Record<StateCode, string>>;
export const ZONE_STATUS: Readonly<Record<ZoneStatus, string>>;
export function zoneStatus(codes: readonly string[]): ZoneStatus;
export const UNIT_KINDS: Readonly<Record<UnitKind, string>>;
export function spaceLetter(index: number): string;
export function gridReference(spaceIndex: number, tabIndex: number): string;
export function designation(kind: UnitKind, spaceIndex: number, tabIndex: number, unitIndex: number): string;
export const STATE_MARKS: Readonly<Record<StateCode, StateMark>>;
export function markFrame(code: StateCode, ms: number): number;
export const MARK_PAD: number;
export const MARK_BOX: number;
export function markSvg(code: StateCode, frame?: number): string;
export const SIDEBAR_ICONS: Readonly<Record<SidebarIcon, string>>;
export function iconSvg(name: SidebarIcon, lit?: boolean): string;
export function markFiles(): [name: string, svg: string][];
