import { tokens, advanceHistory, activityWorkspace, sortPlan, validateLists } from './model.mjs';
import { request, subscribe } from './transport.mjs';
import { Reporter } from './reporter.mjs';
import { acquireDaemonLock, privateDirectory, readHistoryState, readConfig, atomicWrite, log } from './state.mjs';

export async function runDaemon(target, options = {}) {
  await privateDirectory(target.stateDir);
  let stopRequested = false, requestStop = () => { stopRequested = true; };
  const release = await acquireDaemonLock(target.lock, () => requestStop());
  if (!release) return { owned: false, done: Promise.resolve(), stop: async () => {} };
  let history = {}, config = { sort: true }, signature, lastMove = -Infinity;
  try {
    const saved = await readHistoryState(target.history); history = saved.entries;
    signature = saved.sorting?.signature; lastMove = saved.sorting?.lastMove ?? -Infinity;
  } catch { await log(target, 'history_invalid'); }
  const configErrors = new Set();
  async function loadConfig() {
    try { config = await readConfig(target.configDir); }
    catch (error) {
      if (error.code === 'ENOENT') { config = { sort: true }; return; }
      // Keep the last valid setting. Only bounded error categories enter diagnostics/deduplication.
      const category = error instanceof SyntaxError ? 'parse' : ['EACCES', 'EPERM', 'EIO', 'ENOTDIR'].includes(error.code) ? error.code : 'invalid';
      if (!configErrors.has(category)) { configErrors.add(category); await log(target, 'config_invalid'); }
    }
  }
  await loadConfig();
  const now = options.now ?? Date.now;
  const send = (method, params) => request(target.socket, method, params, options.requestTimeoutMs ?? 1000);
  const reporter = new Reporter(send, { now, ...options.reporter });
  let closed = false, connected = false, epoch = 0, connectionEpoch = 0, reading, dirty = false, fencedReads = 0;
  let debounce, retry, subscription, periodic, settingsRead, settingsValid = false;
  const labels = new Map(); let previousPresent = new Set();
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
  function checkSettings() {
    if (settingsRead) return settingsRead;
    settingsValid = false;
    settingsRead = (async () => {
      const plugins = await send('plugin.list', { plugin_id: 'industrial-os.spaces' });
      const entries = plugins.result?.plugins;
      if (closed) return false;
      if (!plugins.ok || !Array.isArray(entries) || entries.length > 4096 || entries.some((p) => !p || typeof p.plugin_id !== 'string' || typeof p.enabled !== 'boolean')) {
        metrics.readFailures++; await log(target, 'plugin_read_failed');
        if (!closed && connected) await health('connected');
        scheduleRetry(readDelay); readDelay = Math.min(30_000, readDelay * 2); return false;
      }
      if (!entries.some((p) => p.plugin_id === 'industrial-os.spaces' && p.enabled)) { signal(); return false; }
      await loadConfig();
      settingsValid = !closed; return settingsValid;
    })().finally(() => { settingsRead = undefined; });
    return settingsRead;
  }
  async function reconcile() {
    dirty = false;
    if (!settingsValid && !await checkSettings()) return;
    if (closed || !connected) return;
    const owner = epoch, connectionOwner = connectionEpoch;
    let [ws, ps] = await Promise.all([send('workspace.list', {}), send('pane.list', {})]);
    const valid = () => ws.ok && ps.ok && validateLists(ws.result?.workspaces, ps.result?.panes, { allowCountMismatch: true });
    const mismatches = () => {
      const counts = new Map();
      for (const p of ps.result.panes) counts.set(p.workspace_id, (counts.get(p.workspace_id) ?? 0) + 1);
      return new Set(ws.result.workspaces.filter((w) => w.pane_count !== (counts.get(w.workspace_id) ?? 0)).map((w) => w.workspace_id));
    };
    if (valid() && mismatches().size) [ws, ps] = await Promise.all([send('workspace.list', {}), send('pane.list', {})]);
    // Never accept disconnected reads. Bound event fences so continuous focus events cannot starve TTL reports.
    if (closed || !connected || connectionOwner !== connectionEpoch) return;
    if (owner !== epoch && ++fencedReads <= 3) { dirty = true; return; }
    fencedReads = 0;
    if (!valid()) {
      metrics.readFailures++; await log(target, 'read_failed');
      if (!closed && connected && owner === epoch) await health('connected');
      scheduleRetry(readDelay); readDelay = Math.min(30_000, readDelay * 2); return;
    }
    const skipped = mismatches();
    if (skipped.size) { metrics.readFailures++; await log(target, 'pane_count_mismatch'); }
    const allWorkspaces = ws.result.workspaces;
    const workspaces = allWorkspaces.filter((w) => !skipped.has(w.workspace_id));
    const panes = ps.result.panes.filter((p) => !skipped.has(p.workspace_id));
    for (const w of allWorkspaces) {
      if (!previousPresent.has(w.workspace_id) && labels.has(w.workspace_id) && labels.get(w.workspace_id) !== w.label) activity.add(w.workspace_id);
      labels.set(w.workspace_id, w.label);
    }
    previousPresent = new Set(allWorkspaces.map((w) => w.workspace_id));
    metrics.reads++; readDelay = options.readRetryMs ?? 250;
    clearTimeout(retry); retry = undefined;
    const time = now();
    const nextHistory = advanceHistory(history, allWorkspaces, ps.result.panes, activity, time);
    if (Object.keys(nextHistory).length > 16_384 || Buffer.byteLength(JSON.stringify(nextHistory)) > 1024 * 1024) throw new Error('history_limit');
    history = nextHistory;
    for (const id of activity) if (!skipped.has(id)) activity.delete(id);
    for (const id of labels.keys()) if (!history[id] && !previousPresent.has(id)) labels.delete(id);
    await persist();
    if (closed || !connected) return;
    const byWorkspace = new Map(workspaces.map((w) => [w.workspace_id, []]));
    for (const p of panes) byWorkspace.get(p.workspace_id).push(p);
    reporter.prune(previousPresent);
    const failuresBefore = reporter.metrics.failures;
    for (const w of workspaces) {
      if (closed || !connected) return;
      await reporter.report(w.workspace_id, tokens(w, byWorkspace.get(w.workspace_id), history[w.workspace_id].last, time));
    }
    if (closed || !connected) return;
    if (reporter.metrics.failures > failuresBefore) await log(target, 'report_failed', { failures: reporter.metrics.failures });
    const reportRetry = reporter.retryIn();
    if (reportRetry !== null) scheduleRetry(reportRetry);
    // A partial read cannot safely determine complete worktree families or ordering.
    if (settingsValid && config.sort && !skipped.size) {
      const plan = sortPlan(workspaces, history, time, signature, lastMove);
      // One block request moves all quiet units in their desired order, atomically. No focused id can appear.
      if (plan.moves.length) {
        // Diagnostics/persistence can yield since the earlier fence. Abort a stale plan immediately before dispatch.
        if (!closed && connected && owner === epoch) {
          lastMove = time;
          const reply = await send('workspace.move_block', { workspace_ids: plan.moves.flatMap((m) => m.workspace_ids) });
          if (reply.ok) { signature = plan.signature; metrics.moves++; }
          else { metrics.moveFailures++; await log(target, 'move_failed'); }
        }
      } else signature = plan.signature;
    }
    if (!closed) { await persist(); if (connected) await health('connected'); }
  }
  async function stop() {
    if (closed) return done;
    closed = true; connected = false; ++epoch;
    clearTimeout(debounce); clearTimeout(retry); clearInterval(periodic); subscription?.close();
    process.off('SIGTERM', signal); process.off('SIGINT', signal);
    try { await reading; await settingsRead; await health('stopped').catch(() => {}); await log(target, 'stopped', metrics); }
    finally { try { await release(); } finally { resolveDone(); } }
    return done;
  }
  const signal = () => { void stop().catch(() => {}); };
  requestStop = signal;
  process.on('SIGTERM', signal); process.on('SIGINT', signal);
  try {
    subscription = subscribe(target.socket, {
      started() {
        connected = true; settingsValid = false; ++epoch; ++connectionEpoch; fencedReads = 0; metrics.reconnects++; reporter.invalidate(); refresh();
        void log(target, 'connected');
      },
      event(event) {
        // Token/title updates request a debounced read but do not invalidate focus/order fences.
        if (event.event !== 'pane.updated') ++epoch;
        const id = activityWorkspace(event); if (typeof id === 'string' && activity.size < 16_384) activity.add(id);
        // A bounded debounce: an event stream cannot postpone reconciliation forever.
        if (!debounce) debounce = setTimeout(() => { debounce = undefined; refresh(); }, options.debounceMs ?? 500);
      },
      offline() { connected = false; ++epoch; ++connectionEpoch; fencedReads = 0; clearTimeout(retry); retry = undefined; void log(target, 'disconnected'); void health('disconnected').catch(() => {}); },
      exhausted() { void log(target, 'connection_exhausted'); signal(); },
    }, options.subscription);
    // Force renewal on the tick; comparing exactly 30 s since an asynchronous
    // acceptance could otherwise skip a tick and silently renew only every 60 s.
    periodic = setInterval(() => {
      // Independent of the report loop: disabling cannot wait behind thousands of reports.
      if (!connected || closed) return;
      void checkSettings().then((ok) => { if (ok) { reporter.invalidate(); refresh(); } }).catch(async () => {
        await log(target, 'settings_failed'); scheduleRetry(readDelay);
      });
    }, options.tickMs ?? 30_000);
    await health('connecting'); await log(target, 'started');
    if (stopRequested) signal();
  } catch (error) { await stop(); throw error; }
  return { owned: true, done, stop, metrics };
}
