// Keys, clicks, the wheel, the modal and scrolling, driven the way the live pane drives them: render a
// frame, apply the input against it, and let the next frame settle the scroll position.
import { describe, expect, test } from 'bun:test';
import { animating, frameDelay } from '../src/app.ts';
import { parseInput } from '../src/terminal.ts';
import { update, type AppState, type Input, type Key } from '../src/ui.ts';
import { renderFrame, type Frame } from '../src/view/frame.ts';
import { stateAt } from './support.ts';

const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

class Pane {
  state: AppState;
  frame!: Frame;
  effects: string[] = [];
  constructor(state: AppState, readonly cols = 80, readonly rows = 24) {
    this.state = state;
    this.draw();
  }
  draw() {
    this.frame = renderFrame(this.state, { cols: this.cols, rows: this.rows, now: NOW, t: 0 });
    this.state = { ...this.state, ui: { ...this.state.ui, scroll: this.frame.scroll, snap: false } };
  }
  send(...inputs: Array<Key | Input>) {
    for (const i of inputs) {
      const input: Input = typeof i === 'string' ? { _tag: 'Key', key: i } : i;
      const r = update(this.state, input, this.frame);
      this.state = r.state;
      if (r.effect) this.effects.push(r.effect);
      this.draw();
    }
    return this;
  }
  get text() {
    return this.frame.lines.map((l) => l.map((s) => s.text).join(''));
  }
  // The first cell whose hit region matches.
  find(test: (h: NonNullable<ReturnType<Frame['hitAt']>>) => boolean): Input {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const h = this.frame.hitAt(x, y);
        if (h && test(h)) return { _tag: 'Click', x, y };
      }
    }
    throw new Error('no such hit region');
  }
}

describe('keys', () => {
  test('1 and 2 switch screens; f cycles ALL, ATTENTION, LIVE; m toggles motion; l toggles the log', () => {
    const p = new Pane(stateAt(NOW), 160, 51);
    expect(p.send('2').state.ui.screen).toBe('schedules');
    expect(p.send('1').state.ui.screen).toBe('pipelines');
    expect(['f', 'f', 'f'].map((k) => p.send(k as Key).state.ui.filter)).toEqual(['ATTENTION', 'LIVE', 'ALL']);
    expect(p.send('m').state.ui.motion).toBe(false);
    expect(p.send('m').state.ui.motion).toBe(true);
    expect(p.send('l').text.join('\n')).toContain('EVENT LOG  PIPELINES');
    expect(p.send('l').text.join('\n')).not.toContain('EVENT LOG  PIPELINES');
  });

  test('the ATTENTION filter shows definition problems only', () => {
    const p = new Pane(stateAt(NOW), 160, 51).send('f');
    expect(p.frame.items).toEqual(['docs-sweep']);
    expect(p.send('f').frame.items).toEqual(['implement', 'dep-bump', 'impl-plan', 'spec-review']);
  });

  test('r reads now, but not while a read is in flight; q, ctrl-c and ctrl-d quit; Esc never quits', () => {
    const p = new Pane(stateAt(NOW));
    p.send('r', 'escape', 'q', 'ctrl-c', 'ctrl-d');
    expect(p.effects).toEqual(['refresh', 'quit', 'quit', 'quit']);
    const busy = new Pane({ ...stateAt(NOW), reading: true }).send('r');
    expect(busy.effects).toEqual([]);
  });

  test('↑ ↓ select and the selection stays in view while the list scrolls', () => {
    const p = new Pane(stateAt(NOW));
    expect(p.frame.items.length).toBe(9);
    for (let i = 0; i < 8; i++) p.send('down');
    expect(p.state.ui.selected.pipelines).toBe('sandbox');
    expect(p.text.some((l) => l.startsWith('▶') && l.includes('SANDBOX'))).toBe(true);
    expect(p.text.join('\n')).toMatch(/\d–9 OF 9/);
    for (let i = 0; i < 8; i++) p.send('up');
    expect(p.state.ui.selected.pipelines).toBe('implement');
    expect(p.text.some((l) => l.startsWith('▶') && l.includes('IMPLEMENT'))).toBe(true);
    expect(p.text.join('\n')).toContain('1–3 OF 9');
  });

  test('PgDn, Space, PgUp and the wheel scroll, clamped to the list, with the position row', () => {
    const p = new Pane(stateAt(NOW));
    const position = () => p.text.find((l) => / OF 9/.test(l))!.match(/(\d+)–(\d+) OF 9/)!.slice(1).map(Number);
    p.send('pagedown');
    expect(position()[0]).toBeGreaterThan(1);
    p.send('space', 'space', 'space', 'space');
    expect(position()[1]).toBe(9);
    const bottom = p.state.ui.scroll;
    p.send('pagedown');
    expect(p.state.ui.scroll).toBe(bottom);
    p.send('pageup', 'pageup', 'pageup', 'pageup', 'pageup');
    expect(position()).toEqual([1, 3]);
    p.send({ _tag: 'Wheel', delta: 1 });
    expect(p.state.ui.scroll).toBe(3);
    p.send({ _tag: 'Wheel', delta: -1 }, { _tag: 'Wheel', delta: -1 });
    expect(p.state.ui.scroll).toBe(0);
  });
});

describe('run modal', () => {
  test('Enter opens the selected pipeline; ↑ ↓ pick a live run; Esc closes it and nothing else', () => {
    const p = new Pane(stateAt(NOW), 160, 51).send('down', 'down');
    expect(p.state.ui.selected.pipelines).toBe('impl-plan');
    p.send('enter');
    expect(p.state.ui.modal).toBe(true);
    expect(p.text.join('\n')).toContain('IMPL-PLAN  RUNNING');
    expect(p.text.join('\n')).toContain('SELECTED RUN  01/02');
    p.send('down');
    expect(p.text.join('\n')).toContain('SELECTED RUN  02/02');
    p.send('down');
    expect(p.state.ui.modalRun).toBe(1);
    // Screen, filter and list keys do nothing behind the modal.
    p.send('2', 'f', 'pagedown', { _tag: 'Wheel', delta: 1 });
    expect([p.state.ui.screen, p.state.ui.filter, p.state.ui.modal]).toEqual(['pipelines', 'ALL', true]);
    p.send('escape');
    expect(p.state.ui.modal).toBe(false);
    expect(p.effects).toEqual([]);
  });

  test('a click selects a block, a second click opens it; a click on a live bar opens that run', () => {
    const p = new Pane(stateAt(NOW), 160, 51);
    p.send(p.find((h) => h.kind === 'select' && h.key === 'dep-bump' && h.run === undefined));
    expect([p.state.ui.selected.pipelines, p.state.ui.modal]).toEqual(['dep-bump', false]);
    p.send(p.find((h) => h.kind === 'select' && h.key === 'dep-bump' && h.run === undefined));
    expect(p.state.ui.modal).toBe(true);
    p.send(p.find((h) => h.kind === 'modal-close'));
    expect(p.state.ui.modal).toBe(false);
    p.send(p.find((h) => h.kind === 'select' && h.key === 'impl-plan' && h.run === 1));
    expect([p.state.ui.selected.pipelines, p.state.ui.modal, p.state.ui.modalRun]).toEqual(['impl-plan', true, 1]);
    expect(p.text.join('\n')).toContain('DEMO-3310');
  });

  test('a click on a tab switches screens', () => {
    const p = new Pane(stateAt(NOW), 160, 51);
    p.send(p.find((h) => h.kind === 'screen' && h.screen === 'schedules'));
    expect(p.state.ui.screen).toBe('schedules');
  });
});

const keys = (...k: Key[]): Input[] => k.map((key) => ({ _tag: 'Key', key }));

describe('terminal input', () => {
  test('parses keys, arrows, page keys, a lone Esc, and SGR mouse wheel and clicks', () => {
    expect(parseInput('q12fFlmr \r\x03')).toEqual(keys('q', '1', '2', 'f', 'f', 'l', 'm', 'r', 'space', 'enter', 'ctrl-c'));
    expect(parseInput('\x1b[A\x1b[B\x1bOA\x1b[5~\x1b[6~\x1b')).toEqual(keys('up', 'down', 'up', 'pageup', 'pagedown', 'escape'));
    expect(parseInput('\x1b[<64;10;5M\x1b[<65;10;5M\x1b[<0;12;7M\x1b[<0;12;7m\x1b[<2;1;1M')).toEqual([
      { _tag: 'Wheel', delta: -1 }, { _tag: 'Wheel', delta: 1 }, { _tag: 'Click', x: 11, y: 6 },
    ]);
    expect(parseInput('\x1b[1;5C\x1b[3~x')).toEqual([]);
  });
});

describe('frame timing', () => {
  test('with motion off nothing animates and frames come once a second', () => {
    const still = stateAt(NOW, { motion: false });
    expect(animating(still)).toBe(false);
    expect(frameDelay(still, NOW + 250, 250)).toBe(750);
  });

  test('with motion on frames land on the lamp edges', () => {
    const moving = stateAt(NOW);
    expect(animating(moving)).toBe(true);
    expect(frameDelay(moving, NOW + 100, 100)).toBe(400);
    expect(frameDelay(moving, NOW + 600, 600)).toBe(200);
  });
});
