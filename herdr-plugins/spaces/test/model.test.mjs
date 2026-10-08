import test from 'node:test';
import assert from 'node:assert/strict';
import { au, tokens, fitLabel, width, PAD, QUIET_MS, DAY_MS, advanceHistory, activityWorkspace, sortPlan, units, validateLists } from '../src/model.mjs';
const workspace = (id, overrides = {}) => ({ workspace_id: id, label: id, focused: false, pane_count: 0, agent_status: 'idle', ...overrides });

test('AU sums only Pi, caps, and distinguishes missing, conflicting and unknown from zero', () => {
  assert.equal(au([]), '00AU');
  assert.equal(au([{ agent: 'other' }]), '00AU');
  assert.equal(au([{ agent: 'pi' }]), '??AU');
  assert.equal(au([{ agent: 'pi', tokens: { g2_au0: '??AU' } }]), '??AU');
  assert.equal(au([{ agent: 'pi', tokens: { g2_au: '03AU', g2_au0: '00AU' } }]), '??AU');
  assert.equal(au([{ agent: 'pi', tokens: { g2_au: '03AU' } }, { agent: 'pi', tokens: { g2_au0: '04AU' } }]), '07AU');
  assert.equal(au([{ agent: 'pi', tokens: { g2_au: '99AU' } }, { agent: 'pi', tokens: { g2_au0: '04AU' } }]), '99AU');
  assert.equal(au([{ agent: 'pi', tokens: { g2_au: '00AU', g2_au0: '00AU' } }]), '00AU');
});
test('tokens always panes; quiet clears second row/name variants; focused cannot be quiet', () => {
  const w = workspace('w1', { pane_count: 200, label: 'industrial-os' });
  assert.deepEqual(tokens(w, [], 0, QUIET_MS), { sp_panes: '99PN', sp_name_stale: 'industrial-os' + PAD.repeat(2), sp_quiet: PAD.repeat(4) + '2d' });
  assert.deepEqual(tokens({ ...w, focused: true }, [{ agent: 'pi' }, { agent: 'claude' }, {}], 0, QUIET_MS), { sp_panes: '99PN', sp_name_active: 'industrial-os', sp_agents: '02AG', sp_au: '??AU' });
  assert.equal(tokens(w, [], 0, 1000 * DAY_MS).sp_quiet, PAD.repeat(3) + '99d');
  assert.equal(tokens(w, [], 0, QUIET_MS - 1).sp_name, 'industrial-os');
});
test('text cell fitting handles controls, wide bases, graphemes, emoji and bounded combining marks', () => {
  assert.equal(fitLabel(' \x1b\u202ee\u0301\x7f ', 15, true), 'e\u0301' + PAD.repeat(14));
  assert.equal(width('界e\u0301👩‍💻🇺🇸'), 7);
  assert.equal(width(fitLabel('界'.repeat(20), 15, true)), 15);
  assert.equal(fitLabel('界'.repeat(20), 15, true), '界'.repeat(7) + '…');
  assert.equal(fitLabel('界'.repeat(20), 24), '界'.repeat(11) + '…');
  assert.equal(width(fitLabel('界'.repeat(20), 16, true)), 16);
  assert.equal(fitLabel('x'.repeat(25), 24), 'x'.repeat(23) + '…');
  assert.equal(fitLabel(' \x1b\u202e ', 24), PAD);
  assert.ok([...fitLabel('a' + '\u0301'.repeat(100), 15, true)].length < 80);
  for (let n = 0; n < 100; n++) assert.equal(width(fitLabel('界a👩‍💻'.repeat(n), 15, true)), 15);
});
test('activity excludes pane.updated/moved, includes closed and focus; persists and prunes only absent >30d', () => {
  assert.equal(activityWorkspace({ event: 'pane.updated', data: { pane: { workspace_id: 'a' } } }), null);
  assert.equal(activityWorkspace({ event: 'pane.created', data: { pane: { workspace_id: 'a' } } }), 'a');
  for (const type of ['pane.closed', 'pane.agent_detected', 'workspace.focused', 'pane.focused', 'tab.focused']) assert.equal(activityWorkspace({ event: type, data: { workspace_id: 'a' } }), 'a');
  const now = 40 * DAY_MS;
  const previous = { old: { last: 1, seen: 1 }, recent: { last: now - 1, seen: now - 1 }, a: { last: 1, seen: 1 } };
  const ws = ['a', 'b', 'c', 'd', 'e'].map((id) => workspace(id, { focused: id === 'd' }));
  const h = advanceHistory(previous, ws, [{ workspace_id: 'c', agent_status: 'working' }, { workspace_id: 'e', agent_status: 'blocked' }], new Set(['a']), now);
  assert.equal(h.old, undefined); assert.ok(h.recent);
  for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(h[id].last, now);
  assert.equal(previous.a.last, 1);
  assert.equal(advanceHistory(h, ws, [], new Set(), now + 1000).a.last, now);
});
test('worktree grouping exactly matches Herdr, parent first; all members must be quiet', () => {
  const tree = (linked) => ({ repo_key: 'repo', is_linked_worktree: linked });
  const ws = [workspace('child', { worktree: tree(true) }), workspace('single'), workspace('parent', { worktree: tree(false) })];
  const h = Object.fromEntries(ws.map((w) => [w.workspace_id, { last: 0 }]));
  assert.deepEqual(units(ws, h, QUIET_MS).map((u) => u.ids), [['parent', 'child'], ['single']]);
  assert.equal(units(ws, { ...h, child: { last: QUIET_MS } }, QUIET_MS)[0].quiet, false);
  assert.equal(units(ws.map((w) => w.worktree ? { ...w, worktree: tree(true) } : w), h, QUIET_MS).length, 3);
});
test('sort moves quiet only, least quiet first, no manual-drag fight and minute rate limit', () => {
  const now = 10 * DAY_MS;
  const ws = [workspace('old'), workspace('active', { focused: true }), workspace('young'), workspace('user')];
  const h = { old: { last: 0 }, active: { last: now }, young: { last: DAY_MS }, user: { last: now } };
  const plan = sortPlan(ws, h, now);
  assert.deepEqual(plan.moves, [{ workspace_ids: ['young'] }, { workspace_ids: ['old'] }]);
  assert.deepEqual(sortPlan(ws, h, now, plan.signature).moves, []); // Manual drag of quiet old back to top is not undone.
  assert.deepEqual(sortPlan(ws, h, now, undefined, now - 59_999).moves, []);
  assert.equal(sortPlan(ws, h, now, undefined, now - 60_000).moves.length, 2);
  assert.equal(sortPlan(ws, h, now + 1000, plan.signature).signature, plan.signature);
  const moved = [ws[1], ws[3], ws[2], ws[0]];
  assert.deepEqual(sortPlan(moved, h, now).moves, []);
});
test('untrusted lists reject malformed data and torn workspace/pane reads', () => {
  assert.equal(validateLists([workspace('a')], []), true);
  assert.equal(validateLists([workspace('a', { pane_count: 1 })], []), false);
  assert.equal(validateLists([workspace('a', { pane_count: -1 })], []), false);
  assert.equal(validateLists([workspace('a'), workspace('a')], []), false);
  assert.equal(validateLists([workspace('a', { focused: 'false' })], []), false);
  assert.equal(validateLists([workspace('a', { pane_count: 1 })], [{ pane_id: 'p', workspace_id: 'a', agent_status: 'idle', agent: 'pi', tokens: { g2_au: 0 } }]), false);
});
