import test from 'node:test';
import assert from 'node:assert/strict';
import { Reporter, SOURCE } from '../src/reporter.mjs';
import { KEYS } from '../src/model.mjs';
test('full/diff/null clears, per-key TTL, renewal, monotonic sequences and idempotent replay', async () => {
  let now = 100_000; const requests = [], host = {}; let lastSeq = 0;
  const send = async (method, params) => {
    requests.push({ method, params });
    if (params.seq > lastSeq) {
      lastSeq = params.seq;
      for (const [key, value] of Object.entries(params.tokens)) if (value === null) delete host[key]; else host[key] = value;
    }
    return { ok: true };
  };
  const r = new Reporter(send, { now: () => now });
  const active = { sp_panes: '01PN', sp_agents: '01AG', sp_au: '02AU', sp_name_active: 'space' };
  await r.report('w1', active);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.flatMap((r) => Object.keys(r.params.tokens)).sort(), [...KEYS].sort());
  assert.equal(requests[0].params.ttl_ms, undefined); assert.equal(requests[1].params.ttl_ms, 120_000);
  assert.equal(requests[0].params.source, SOURCE);
  const copy = structuredClone(host); await send('workspace.report_metadata', requests[0].params); assert.deepEqual(host, copy);
  const before = requests.length; await r.report('w1', active); assert.equal(requests.length, before);
  now += 30_000; await r.report('w1', active); assert.equal(requests.length, before + 2);
  now--; const quiet = { sp_panes: '01PN', sp_name_stale: 'space', sp_quiet: '    2d' };
  await r.report('w1', quiet); assert.deepEqual(host, quiet);
  assert.equal(requests.at(-1).params.tokens.sp_agents, null);
  const seqs = requests.slice(3).map((r) => r.params.seq); assert.ok(seqs.every((v, i) => !i || v > seqs[i - 1]));
});
test('partial failure never accepted; full retry after 5s->60s backoff; updates cannot bypass it', async () => {
  let now = 0, fail = true; const calls = [];
  const r = new Reporter(async (_, params) => { calls.push(params); return { ok: !(fail && params.ttl_ms) }; }, { now: () => now });
  await r.report('w1', { sp_panes: '01PN', sp_name: 'a' });
  assert.equal(r.states.get('w1').synced, false); assert.deepEqual(r.states.get('w1').accepted, {});
  await r.report('w1', { sp_panes: '02PN' }); assert.equal(calls.length, 2);
  for (const delay of [5000, 10000, 20000, 40000, 60000, 60000]) {
    assert.equal(r.retryIn(), delay); now += delay;
    await r.report('w1', { sp_panes: '02PN' });
  }
  now += 60000; fail = false; await r.report('w1', { sp_panes: '02PN' });
  assert.equal(r.states.get('w1').synced, true);
  assert.deepEqual(calls.at(-2).tokens, { sp_name_active: null, sp_name: null, sp_name_stale: null });
  assert.deepEqual(calls.at(-1).tokens, { sp_panes: '02PN', sp_agents: null, sp_au: null, sp_quiet: null });
  r.invalidate(); await r.report('w1', { sp_panes: '02PN' });
  assert.equal(Object.keys(calls.at(-1).tokens).length, 4);
});
