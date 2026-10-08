import { tokens, advanceHistory, activityWorkspace, sortPlan, validateLists } from './model.mjs';
import { request, subscribe } from './transport.mjs';
import { Reporter } from './reporter.mjs';
import { acquireLock, privateDirectory, readHistoryState, readConfig, atomicWrite, log } from './state.mjs';

export async function runDaemon(target, options = {}) {
  await privateDirectory(target.stateDir);
  const release = await acquireLock(target.lock);
  if (!release) return { owned: false, done: Promise.resolve(), stop: async () => {} };
  let history = {}, config = { sort: true }, signature, lastMove = -Infinity;
  try {
    const saved = await readHistoryState(target.history); history = saved.entries;
    signature = saved.sorting?.signature; lastMove = saved.sorting?.lastMove ?? -Infinity;
  } catch { await log(target, 'history_invalid'); }
  try { config = await readConfig(target.configDir); } catch { await log(target, 'config_defaulted'); }
  const now = options.now ?? Date.now;
  const send = (method, params) => request(target.socket, method, params, options.requestTimeoutMs ?? 1000);
  const reporter = new Reporter(send, { now, ...options.reporter });
  let closed = false, connected = false, epoch = 0, reading, dirty = false;
  let debounce, retry, subscription, periodic;
  let healthWrites = Promise.resolve();
  let readDelay = options.readRetryMs ?? 250;
  const activity = new Set();
  const metrics = { reads: 0, readFailures: 0, moves: 0, moveFailures: 0, reconnects: 0 };
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  function health(state) {
    const snapshot = { version: 1, pid: process.pid, state, updated: now(), ...metrics, ...reporter.metrics };
    healthWrites = healthWrites.catch(() => {}).then(() => atomicWrite(target.health, snapshot));
    return healthWrites;
  }
  async function persist() {
    await atomicWrite(target.history, { version: 1, entries: history, ...(signature === undefined ? {} : { sorting: { signature, lastMove: Number.isFinite(lastMove) ? lastMove : 0 } }) });
  }
  function scheduleRetry(delay) {
    if (closed || !connected) return;
    clearTimeout(retry);
    retry = setTimeout(() => { retry = undefined; refresh(); }, delay);
  }
  function refresh() {
    if (closed || !connected) return;
    dirty = true;
    if (reading) return;
    reading = reconcile().catch(async () => {
      // File failures are contained at this boundary, never raw payloads or paths in diagnostics.
      await log(target, 'reconcile_failed');
      scheduleRetry(Math.min(30_000, readDelay)); readDelay = Math.min(30_000, readDelay * 2);
    }).finally(() => { reading = undefined; if (dirty && !closed && connected) refresh(); });
  }
  async function reconcile() {
    dirty = false;
    const owner = epoch;
    const [ws, ps] = await Promise.all([send('workspace.list', {}), send('pane.list', {})]);
    if (closed || !connected || owner !== epoch) return;
    const workspaces = ws.result?.workspaces, panes = ps.result?.panes;
    if (!ws.ok || !ps.ok || !validateLists(workspaces, panes)) {
      metrics.readFailures++; await log(target, 'read_failed');
      if (!closed && connected && owner === epoch) await health('connected');
      scheduleRetry(readDelay); readDelay = Math.min(30_000, readDelay * 2); return;
    }
    metrics.reads++; readDelay = options.readRetryMs ?? 250;
    clearTimeout(retry); retry = undefined;
    const time = now();
    const nextHistory = advanceHistory(history, workspaces, panes, activity, time);
    if (Object.keys(nextHistory).length > 16_384 || Buffer.byteLength(JSON.stringify(nextHistory)) > 1024 * 1024) throw new Error('history_limit');
    history = nextHistory; activity.clear();
    await persist();
    if (closed || !connected || owner !== epoch) return;
    const byWorkspace = new Map(workspaces.map((w) => [w.workspace_id, []]));
    for (const p of panes) byWorkspace.get(p.workspace_id).push(p);
    reporter.prune(new Set(byWorkspace.keys()));
    const failuresBefore = reporter.metrics.failures;
    for (const w of workspaces) {
      if (closed || !connected || owner !== epoch) return;
      await reporter.report(w.workspace_id, tokens(w, byWorkspace.get(w.workspace_id), history[w.workspace_id].last, time));
    }
    if (closed || !connected || owner !== epoch) return;
    if (reporter.metrics.failures > failuresBefore) await log(target, 'report_failed', { failures: reporter.metrics.failures });
    const reportRetry = reporter.retryIn();
    if (reportRetry !== null) scheduleRetry(reportRetry);
    if (config.sort) {
      const plan = sortPlan(workspaces, history, time, signature, lastMove);
      // One block request moves all quiet units in their desired order, atomically. No focused id can appear.
      if (plan.moves.length) {
        // Diagnostics/persistence can yield since the earlier fence. Abort a stale plan immediately before dispatch.
        if (closed || !connected || owner !== epoch) return;
        lastMove = time;
        const reply = await send('workspace.move_block', { workspace_ids: plan.moves.flatMap((m) => m.workspace_ids) });
        if (reply.ok) { signature = plan.signature; metrics.moves++; }
        else { metrics.moveFailures++; await log(target, 'move_failed'); }
      } else signature = plan.signature;
    }
    if (!closed) { await persist(); await health('connected'); }
  }
  async function stop() {
    if (closed) return done;
    closed = true; connected = false; ++epoch;
    clearTimeout(debounce); clearTimeout(retry); clearInterval(periodic); subscription?.close();
    process.off('SIGTERM', signal); process.off('SIGINT', signal);
    try { await reading; await health('stopped').catch(() => {}); await log(target, 'stopped', metrics); }
    finally { await release(); resolveDone(); }
    return done;
  }
  const signal = () => { void stop().catch(() => {}); };
  process.on('SIGTERM', signal); process.on('SIGINT', signal);
  try {
    subscription = subscribe(target.socket, {
      started() {
        connected = true; ++epoch; metrics.reconnects++; reporter.invalidate(); refresh();
        void log(target, 'connected');
      },
      event(event) {
        ++epoch;
        const id = activityWorkspace(event); if (typeof id === 'string' && activity.size < 16_384) activity.add(id);
        // A bounded debounce: an event stream cannot postpone reconciliation forever.
        if (!debounce) debounce = setTimeout(() => { debounce = undefined; refresh(); }, options.debounceMs ?? 500);
      },
      offline() { connected = false; ++epoch; clearTimeout(retry); retry = undefined; void log(target, 'disconnected'); void health('disconnected').catch(() => {}); },
      exhausted() { void log(target, 'connection_exhausted'); signal(); },
    }, options.subscription);
    // Force renewal on the tick; comparing exactly 30 s since an asynchronous
    // acceptance could otherwise skip a tick and silently renew only every 60 s.
    periodic = setInterval(() => { reporter.invalidate(); refresh(); }, options.tickMs ?? 30_000);
    await health('connecting'); await log(target, 'started');
  } catch (error) { await stop(); throw error; }
  return { owned: true, done, stop, metrics };
}
