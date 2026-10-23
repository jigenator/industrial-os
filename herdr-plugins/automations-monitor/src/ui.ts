// The app state and its pure transitions: poll results, keys and mouse in; the next state and at most one
// effect (quit or read now) out. The host owns time, I/O and the terminal; see app.ts.
import { Result } from 'effect';
import type { Hit, Screen } from './canvas.ts';
import type { PipelinesData, SchedulesData } from './contract.ts';
import { FILTERS, type Filter } from './model.ts';
import { POLL_INTERVAL_MS, type PollEvent, type ReadOutcome } from './poller.ts';
import type { ReadFailure } from './reader.ts';

// One command's data: the last good value, when it was read, and the failure since then, if any.
export interface Feed<A> {
  readonly value: A | null;
  readonly okAt: number | null;
  readonly failure: ReadFailure | null;
}

export interface UiState {
  readonly screen: Screen;
  readonly selected: Readonly<Record<Screen, string | null>>;
  readonly scroll: number;
  // Scroll the selection into view on the next frame.
  readonly snap: boolean;
  // Event log shown; null is the screen's default (off on pipelines, on on schedules).
  readonly log: boolean | null;
  readonly filter: Filter;
  readonly modal: boolean;
  readonly modalRun: number;
  readonly motion: boolean;
}

export interface AppState {
  readonly pipelines: Feed<PipelinesData>;
  readonly schedules: Feed<SchedulesData>;
  readonly reading: boolean;
  readonly nextAt: number | null;
  readonly intervalMs: number;
  readonly ui: UiState;
}

const EMPTY_FEED = { value: null, okAt: null, failure: null } as const;

export const initialState = (motion = true): AppState => ({
  pipelines: EMPTY_FEED,
  schedules: EMPTY_FEED,
  reading: false,
  nextAt: null,
  intervalMs: POLL_INTERVAL_MS,
  ui: { screen: 'pipelines', selected: { pipelines: null, schedules: null }, scroll: 0, snap: true, log: null, filter: 'ALL', modal: false, modalRun: 0, motion },
});

export const logShown = (ui: UiState): boolean => ui.log ?? ui.screen === 'schedules';

// A good read replaces the data and clears the failure; a failed one keeps the last data as last-known.
function feed<A>(prev: Feed<A>, outcome: ReadOutcome<A>, at: number): Feed<A> {
  return Result.isSuccess(outcome) ? { value: outcome.success, okAt: at, failure: null } : { ...prev, failure: outcome.failure };
}

export function applyPoll(state: AppState, event: PollEvent): AppState {
  if (event._tag === 'Reading') return { ...state, reading: true };
  return {
    ...state,
    reading: false,
    nextAt: event.nextAt,
    pipelines: feed(state.pipelines, event.pipelines, event.at),
    schedules: feed(state.schedules, event.schedules, event.at),
  };
}

export type Key =
  | 'q' | 'ctrl-c' | 'ctrl-d' | 'escape' | 'enter' | 'up' | 'down' | 'pageup' | 'pagedown' | 'space'
  | '1' | '2' | 'f' | 'l' | 'm' | 'r';
export type Input =
  | { readonly _tag: 'Key'; readonly key: Key }
  | { readonly _tag: 'Click'; readonly x: number; readonly y: number }
  | { readonly _tag: 'Wheel'; readonly delta: number };

// What the last frame laid out, which keys and clicks act on.
export interface FrameInfo {
  readonly items: readonly string[];
  readonly page: number;
  readonly liveRuns: number;
  readonly hitAt: (x: number, y: number) => Hit | null;
}

export type Effect = 'quit' | 'refresh' | null;

const WHEEL_ROWS = 3;

export function update(state: AppState, input: Input, frame: FrameInfo): { state: AppState; effect: Effect } {
  const ui = state.ui;
  const next = (patch: Partial<UiState>, effect: Effect = null) => ({ state: { ...state, ui: { ...ui, ...patch } }, effect });
  const same = { state, effect: null };
  // With nothing chosen yet (or the choice filtered out) the frame marks the first item, so keys start there.
  const selectedIndex = Math.max(0, frame.items.indexOf(ui.selected[ui.screen] ?? ''));
  const select = (key: string | undefined) => (key === undefined ? {} : { selected: { ...ui.selected, [ui.screen]: key }, snap: true });

  if (input._tag === 'Wheel') return ui.modal ? same : next({ scroll: Math.max(0, ui.scroll + input.delta * WHEEL_ROWS), snap: false });
  if (input._tag === 'Click') {
    const hit = frame.hitAt(input.x, input.y);
    if (ui.modal) {
      if (hit?.kind === 'modal-run') return next({ modalRun: hit.index });
      return hit?.kind === 'modal-close' ? next({ modal: false }) : same;
    }
    if (!hit) return same;
    if (hit.kind === 'screen') return switchScreen(hit.screen);
    if (hit.kind === 'select') {
      // A click on a live bar, or a second click on a selected pipeline, opens its runs.
      const open = ui.screen === 'pipelines' && (hit.run !== undefined || ui.selected.pipelines === hit.key);
      return next({ ...select(hit.key), modal: open, modalRun: hit.run ?? 0 });
    }
    return same;
  }

  const key = input.key;
  if (key === 'q' || key === 'ctrl-c' || key === 'ctrl-d') return { state, effect: 'quit' };
  if (key === 'm') return next({ motion: !ui.motion });
  if (key === 'r') return state.reading ? same : { state, effect: 'refresh' };
  if (ui.modal) {
    if (key === 'escape') return next({ modal: false });
    if (key === 'up') return next({ modalRun: Math.max(0, ui.modalRun - 1) });
    if (key === 'down') return next({ modalRun: Math.min(Math.max(0, frame.liveRuns - 1), ui.modalRun + 1) });
    return same;
  }
  switch (key) {
    case '1': return switchScreen('pipelines');
    case '2': return switchScreen('schedules');
    case 'up': return next(select(frame.items[Math.max(0, selectedIndex - 1)]));
    case 'down': return next(select(frame.items[Math.min(frame.items.length - 1, selectedIndex + 1)]));
    case 'pageup': return next({ scroll: Math.max(0, ui.scroll - frame.page), snap: false });
    case 'pagedown': case 'space': return next({ scroll: ui.scroll + frame.page, snap: false });
    case 'enter': return ui.screen === 'pipelines' && frame.items.length ? next({ ...select(frame.items[selectedIndex]), modal: true, modalRun: 0 }) : same;
    case 'f': return next({ filter: FILTERS[(FILTERS.indexOf(ui.filter) + 1) % FILTERS.length]!, scroll: 0, snap: true });
    case 'l': return next({ log: !logShown(ui) });
    default: return same;
  }

  function switchScreen(screen: Screen) {
    return screen === ui.screen ? same : next({ screen, scroll: 0, snap: true, log: null, modal: false });
  }
}
