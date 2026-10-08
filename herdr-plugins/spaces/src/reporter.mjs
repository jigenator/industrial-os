import { KEYS } from './model.mjs';
export const SOURCE = 'industrial-os:spaces';
const NAMES = new Set(['sp_name_active', 'sp_name', 'sp_name_stale']);
export class Reporter {
  constructor(request, { now = Date.now, renewMs = 30_000, retryMs = 5000, maxRetryMs = 60_000 } = {}) {
    this.request = request; this.now = now; this.renewMs = renewMs; this.retryMs = retryMs; this.maxRetryMs = maxRetryMs;
    this.states = new Map(); this.seq = 0; this.metrics = { accepted: 0, failures: 0 };
  }
  invalidate() { for (const state of this.states.values()) state.synced = false; }
  prune(ids) { for (const id of this.states.keys()) if (!ids.has(id)) this.states.delete(id); }
  nextSeq() { this.seq = Math.max(this.now() * 1000, this.seq + 1); return this.seq; }
  async report(id, desired) {
    const now = this.now();
    const state = this.states.get(id) ?? { accepted: {}, synced: false, renewed: 0, retryAt: 0, delay: this.retryMs };
    this.states.set(id, state);
    if (now < state.retryAt) return;
    const full = !state.synced || now - state.renewed >= this.renewMs;
    const patch = Object.fromEntries(KEYS.filter((key) => full || desired[key] !== state.accepted[key]).map((key) => [key, desired[key] ?? null]));
    // A TTL applies to every set in a request: names must be a separate no-TTL batch. Clear variants first.
    for (const nameBatch of [true, false]) {
      const tokens = Object.fromEntries(Object.entries(patch).filter(([key]) => NAMES.has(key) === nameBatch));
      if (!Object.keys(tokens).length) continue;
      const reply = await this.request('workspace.report_metadata', {
        workspace_id: id, source: SOURCE, tokens, seq: this.nextSeq(), ...(nameBatch ? {} : { ttl_ms: 120_000 }),
      });
      if (!reply.ok) {
        state.synced = false; state.retryAt = this.now() + state.delay;
        state.delay = Math.min(this.maxRetryMs, state.delay * 2); this.metrics.failures++;
        return;
      }
      this.metrics.accepted++;
    }
    state.accepted = { ...desired }; state.synced = true; state.retryAt = 0; state.delay = this.retryMs;
    if (full) state.renewed = this.now();
  }
  retryIn() {
    const times = [...this.states.values()].filter((s) => s.retryAt > 0).map((s) => s.retryAt - this.now());
    return times.length ? Math.max(1, Math.min(...times)) : null;
  }
}
