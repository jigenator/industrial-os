import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { request, EVENTS } from '../src/transport.mjs';
import { runDaemon } from '../src/daemon.mjs';
import { target, lockOwner, atomicWrite, alive } from '../src/state.mjs';
import { DAY_MS } from '../src/model.mjs';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await wait(10); }
  assert.fail('condition did not become true');
}
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'spaces-sock-'));
  const dest = target({ HERDR_SOCKET_PATH: join(dir, 'herdr.sock'), HERDR_PLUGIN_STATE_DIR: dir, HERDR_PLUGIN_CONFIG_DIR: dir });
  await writeFile(join(dir, 'config.json'), '{"sort":false}');
  const cleanup = [];
  const calls = [], errors = [], readSnapshots = [], sockets = new Set(), subscriptions = new Set(), metadata = new Map(), sequences = new Map(), expiry = new Map();
  let workspaces = [{ workspace_id: 'w1', label: 'space', pane_count: 1, focused: true, agent_status: 'idle' }];
  let panes = [{ pane_id: 'w1:p1', workspace_id: 'w1', agent_status: 'idle', agent: 'pi', tokens: { g2_au: '02AU' } }];
  const control = { rejectRead: false, rejectReport: false, readDelay: 0, reportDelay: 0, ignore: false, mismatchOnce: false,
    plugins: [{ plugin_id: 'industrial-os.spaces', enabled: true }] };
  // Herdr v0.9.3 Subscription serde: dotted request kinds, required fields on special kinds.
  const lifecycle = new Set(['workspace.created', 'workspace.updated', 'workspace.metadata_updated', 'workspace.renamed', 'workspace.moved', 'workspace.reordered', 'workspace.closed', 'workspace.focused', 'worktree.created', 'worktree.opened', 'worktree.removed', 'tab.created', 'tab.closed', 'tab.focused', 'tab.renamed', 'tab.moved', 'pane.created', 'pane.closed', 'pane.updated', 'pane.focused', 'pane.moved', 'pane.exited', 'pane.agent_detected', 'layout.updated']);
  function validSubscription(s) {
    if (!s || typeof s !== 'object') return false;
    if (lifecycle.has(s.type)) return true;
    if (typeof s.pane_id !== 'string') return false;
    if (s.type === 'pane.scroll_changed') return true;
    if (s.type === 'pane.agent_status_changed') return s.agent_status == null || ['idle', 'working', 'blocked', 'done', 'unknown'].includes(s.agent_status);
    return s.type === 'pane.output_matched' && ['visible', 'recent', 'recent_unwrapped', 'detection'].includes(s.source) &&
      ['substring', 'regex'].includes(s.match?.type) && typeof s.match.value === 'string' &&
      (s.lines == null || (Number.isInteger(s.lines) && s.lines >= 0 && s.lines <= 0xffff_ffff)) &&
      (s.strip_ansi === undefined || typeof s.strip_ansi === 'boolean');
  }
  const server = createServer((socket) => {
    sockets.add(socket); socket.on('close', () => { sockets.delete(socket); subscriptions.delete(socket); }); socket.on('error', () => {});
    let buffer = ''; socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk; let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1); calls.push(msg);
        const reply = (result) => { if (!socket.destroyed) socket.write(JSON.stringify({ id: msg.id, result }) + '\n'); };
        const reject = (code = 'rejected') => { errors.push({ id: msg.id, code }); if (!socket.destroyed) socket.write(JSON.stringify({ id: msg.id, error: { code, message: 'Invalid request parameters' } }) + '\n'); };
        if (control.ignore) continue;
        if (msg.method === 'events.subscribe') {
          if (!Array.isArray(msg.params?.subscriptions) || !msg.params.subscriptions.every(validSubscription)) { reject('invalid_request'); continue; }
          subscriptions.add(socket); reply({ type: 'subscription_started' });
        } else if (msg.method === 'plugin.list') {
          const result = structuredClone({ plugins: control.plugins });
          if (control.pluginDelay) setTimeout(() => reply(result), control.pluginDelay); else reply(result);
        }
        else if (msg.method === 'workspace.list' || msg.method === 'pane.list') {
          const result = structuredClone(msg.method === 'workspace.list' ? { workspaces } : { panes });
          if (control.mismatchOnce && msg.method === 'workspace.list') { result.workspaces[0].pane_count++; control.mismatchOnce = false; }
          readSnapshots.push({ method: msg.method, result });
          if (control.rejectRead) reject(); else if (control.readDelay) setTimeout(() => reply(result), control.readDelay); else reply(result);
        } else if (msg.method === 'workspace.report_metadata') {
          if (control.rejectReport === true || control.rejectReport === msg.params.workspace_id) { reject(); continue; }
          const p = msg.params, identity = p.workspace_id + ':' + p.source;
          if (p.seq > (sequences.get(identity) ?? 0)) {
            sequences.set(identity, p.seq);
            const data = metadata.get(p.workspace_id) ?? {};
            for (const [key, value] of Object.entries(p.tokens)) {
              const identity = p.workspace_id + ':' + key;
              if (value === null) { delete data[key]; expiry.delete(identity); }
              else { data[key] = value; if (p.ttl_ms) expiry.set(identity, Date.now() + p.ttl_ms); else expiry.delete(identity); }
            }
            metadata.set(p.workspace_id, data);
          }
          if (control.reportDelay) setTimeout(() => reply({}), control.reportDelay); else reply({});
        } else if (msg.method === 'workspace.move_block') {
          if (control.moveDelay) setTimeout(() => reply({ workspaces }), control.moveDelay); else reply({ workspaces });
        } else reply({});
      }
    });
  });
  await new Promise((resolve) => server.listen(dest.socket, resolve));
  t.after(async () => { for (const fn of cleanup) await fn(); for (const s of sockets) s.destroy(); await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  return { dest, cleanup, calls, errors, readSnapshots, control, subscriptions, metadata, setWorkspace: (value) => { workspaces = value; }, setPanes: (value) => { panes = value; },
    emit(event, data) {
      assert.ok(!lifecycle.has(event), 'lifecycle wire event must use snake_case, not a dotted subscription type');
      for (const s of subscriptions) s.write(JSON.stringify({ event, data: { type: event, ...data } }) + '\n');
    },
    expire(now) { for (const [identity, deadline] of expiry) if (deadline <= now) { const [id, key] = identity.split(':'); delete metadata.get(id)?.[key]; expiry.delete(identity); } },
    disconnect() { for (const s of subscriptions) s.destroy(); } };
}
const fast = { debounceMs: 15, tickMs: 40, readRetryMs: 10, requestTimeoutMs: 100,
  subscription: { minBackoffMs: 10, maxBackoffMs: 40, failureMs: 250, timeoutMs: 100 },
  reporter: { renewMs: 35, retryMs: 50, maxRetryMs: 200 } };

test('fake socket subscribe/read/report; TTL renew, quiet clears, activity, metadata ignored and reconnect full', async (t) => {
  const f = await fixture(t); let now = 10 * DAY_MS;
  const daemon = await runDaemon(f.dest, { ...fast, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_au === '02AU');
  assert.deepEqual(f.calls[0].params.subscriptions.map((s) => s.type), EVENTS);
  assert.ok(!EVENTS.includes('workspace.metadata_updated'));
  const initial = f.calls.filter((m) => m.method === 'workspace.report_metadata'); assert.equal(initial.length, 2);
  f.emit('workspace_metadata_updated', { workspace_id: 'w1' }); await wait(20); assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, 2);
  now += 40; await until(() => f.calls.filter((m) => m.method === 'workspace.report_metadata').length >= 4);
  f.setWorkspace([{ workspace_id: 'w1', label: 'space', pane_count: 1, focused: false, agent_status: 'idle' }]);
  now += 2 * DAY_MS; f.emit('pane_updated', { pane: { workspace_id: 'w1' } });
  await until(() => f.metadata.get('w1')?.sp_quiet?.endsWith('2d'));
  assert.equal(f.metadata.get('w1').sp_agents, undefined); assert.equal(f.metadata.get('w1').sp_au, undefined);
  const saved = JSON.parse(await readFile(f.dest.history, 'utf8')); assert.equal(saved.entries.w1.last, 10 * DAY_MS + 40);
  f.emit('pane_created', { pane: { workspace_id: 'w1' } });
  await until(() => f.metadata.get('w1')?.sp_name === 'space'); assert.equal(f.metadata.get('w1').sp_quiet, undefined);
  const count = f.calls.length; f.disconnect();
  await until(() => daemon.metrics.reconnects >= 2 && f.calls.length > count + 4);
  const full = f.calls.slice(count).filter((m) => m.method === 'workspace.report_metadata');
  assert.equal(Object.keys(full[0].params.tokens).length, 3); assert.equal(Object.keys(full[1].params.tokens).length, 4);
  await daemon.stop(); assert.equal(await lockOwner(f.dest.lock), null);
  const health = JSON.parse(await readFile(f.dest.health, 'utf8'));
  assert.equal(health.state, 'stopped'); assert.ok(health.reads > 0 && health.accepted > 0);
  const logs = (await readFile(f.dest.log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(logs.some((entry) => entry.event === 'started'));
  assert.ok(logs.every((entry) => !Object.hasOwn(entry, 'tokens') && !Object.hasOwn(entry, 'workspace_id') && !Object.hasOwn(entry, 'label')));
  const stopped = f.calls.length; await wait(60); assert.equal(f.calls.length, stopped);
  f.expire(Date.now() + 120_001);
  assert.deepEqual(f.metadata.get('w1'), { sp_name: 'space' }); // Only no-TTL names freeze after stop.
});

test('periodic tick forces full TTL renewal even before a prior acceptance reaches the nominal interval', async (t) => {
  const f = await fixture(t);
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 30, reporter: { renewMs: 60_000 } }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.filter((m) => m.method === 'workspace.report_metadata').length >= 4);
  assert.equal(Object.keys(f.calls.filter((m) => m.method === 'workspace.report_metadata')[2].params.tokens).length, 3);
  assert.equal(Object.keys(f.calls.filter((m) => m.method === 'workspace.report_metadata')[3].params.tokens).length, 4);
});

test('failed reads publish nothing; report failures retry full with backoff; stale in-flight reads are fenced', async (t) => {
  const f = await fixture(t); const daemon = await runDaemon(f.dest, fast); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_name_active === 'space');
  f.control.rejectRead = true;
  const count = f.calls.filter((m) => m.method === 'workspace.report_metadata').length;
  f.setPanes([{ pane_id: 'w1:p1', workspace_id: 'w1', agent_status: 'idle', agent: 'pi', tokens: {} }]);
  f.emit('pane_updated', { pane: { workspace_id: 'w1' } }); await wait(130);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, count);
  assert.ok(daemon.metrics.readFailures > 0);
  assert.ok(JSON.parse(await readFile(f.dest.health, 'utf8')).readFailures > 0);
  f.control.rejectRead = false; f.control.rejectReport = true;
  await until(() => f.calls.filter((m) => m.method === 'workspace.report_metadata').length > count);
  const failed = f.calls.filter((m) => m.method === 'workspace.report_metadata').length;
  f.emit('pane_updated', {}); await wait(25);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, failed);
  f.control.rejectReport = false; await until(() => f.metadata.get('w1')?.sp_au === '??AU');
  const recent = f.calls.filter((m) => m.method === 'workspace.report_metadata').slice(-2);
  assert.equal(Object.keys(recent[0].params.tokens).length, 3); assert.equal(Object.keys(recent[1].params.tokens).length, 4);
  f.control.readDelay = 60;
  f.setWorkspace([{ workspace_id: 'w1', label: 'old-read', pane_count: 1, focused: true, agent_status: 'idle' }]);
  f.emit('workspace_renamed', { workspace_id: 'w1' });
  // Wait for this delayed old snapshot, not a pane.list call left over from an earlier pass.
  await until(() => f.readSnapshots.some((r) => r.result.workspaces?.[0].label === 'old-read'));
  f.setWorkspace([{ workspace_id: 'w1', label: 'latest', pane_count: 1, focused: true, agent_status: 'idle' }]);
  f.emit('workspace_renamed', { workspace_id: 'w1' });
  await until(() => f.metadata.get('w1')?.sp_name_active === 'latest');
  assert.ok(!f.calls.some((m) => m.params.tokens?.sp_name_active === 'old-read'));
});

test('silent subscription handshake bounded; exponential reconnect and continuous failure exit releases lock', async (t) => {
  const f = await fixture(t); f.control.ignore = true;
  const daemon = await runDaemon(f.dest, { ...fast, subscription: { minBackoffMs: 10, maxBackoffMs: 20, failureMs: 130, timeoutMs: 25 } });
  await daemon.done; assert.equal(await lockOwner(f.dest.lock), null);
  assert.ok(f.calls.filter((m) => m.method === 'events.subscribe').length >= 2);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, 0);
});

test('request rejects oversized complete lines, malformed replies, errors and timeout', async (t) => {
  const f = await fixture(t); f.control.ignore = true;
  const started = Date.now(); const response = await request(f.dest.socket, 'pane.list', {}, 30);
  assert.equal(response.ok, false); assert.equal(response.error, 'timeout'); assert.ok(Date.now() - started < 500);
  const path = join(f.dest.stateDir, 'bad.sock');
  for (const payload of ['x\n', JSON.stringify({ id: 'unused', x: 'x'.repeat(1024 * 1024) }) + '\n']) {
    const server = createServer((socket) => { socket.on('error', () => {}); socket.once('data', () => socket.end(payload)); });
    await new Promise((resolve) => server.listen(path, resolve));
    assert.equal((await request(path, 'pane.list', {}, 200)).error, 'invalid_reply');
    await new Promise((resolve) => server.close(resolve));
  }
});

test('history survives daemon restart and sorting respects disabled config and quiet grouped atomic move', async (t) => {
  const f = await fixture(t), now = 20 * DAY_MS;
  const tree = (linked) => ({ repo_key: 'repo', is_linked_worktree: linked });
  f.setWorkspace([{ workspace_id: 'child', label: 'child', pane_count: 0, focused: false, agent_status: 'idle', worktree: tree(true) },
    { workspace_id: 'active', label: 'active', pane_count: 0, focused: true, agent_status: 'idle' },
    { workspace_id: 'parent', label: 'parent', pane_count: 0, focused: false, agent_status: 'idle', worktree: tree(false) }]); f.setPanes([]);
  await atomicWrite(f.dest.history, { version: 1, entries: { child: { last: 0, seen: now }, parent: { last: DAY_MS, seen: now } } });
  let daemon = await runDaemon(f.dest, { ...fast, now: () => now });
  await until(() => f.metadata.get('child')?.sp_quiet?.endsWith('20d')); await daemon.stop();
  assert.equal(f.calls.some((m) => m.method === 'workspace.move_block'), false);
  await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":true}');
  daemon = await runDaemon(f.dest, { ...fast, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.move_block'));
  assert.deepEqual(f.calls.find((m) => m.method === 'workspace.move_block').params, { workspace_ids: ['parent', 'child'] });
  f.emit('workspace_reordered', {}); await wait(100);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.move_block').length, 1);
  await daemon.stop();
  daemon = await runDaemon(f.dest, { ...fast, now: () => now + 120_000 });
  await until(() => daemon.metrics.reads >= 1); await wait(70);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.move_block').length, 1, 'restart does not undo a manual drag with unchanged quiet signature');
});

test('ensure exits promptly with pipe EOF; detached daemon lives; concurrent hooks own one subscription', async (t) => {
  const f = await fixture(t);
  const bin = fileURLToPath(new URL('../bin/spaces.mjs', import.meta.url));
  const env = { ...process.env, HERDR_SOCKET_PATH: f.dest.socket, HERDR_PLUGIN_STATE_DIR: f.dest.stateDir, HERDR_PLUGIN_CONFIG_DIR: f.dest.configDir };
  const hook = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, 'ensure'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('ensure held inherited pipe')); }, 2000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, output }); }); child.on('error', reject);
  });
  f.cleanup.push(async () => { const owner = await lockOwner(f.dest.lock).catch(() => null); if (owner?.pid && alive(owner.pid)) { process.kill(owner.pid, 'SIGTERM'); await until(async () => !(await lockOwner(f.dest.lock))); } });
  const start = Date.now(); const results = await Promise.all(Array.from({ length: 8 }, hook));
  assert.ok(Date.now() - start < 2000); assert.ok(results.every((r) => r.code === 0 && r.output === ''));
  await until(() => f.metadata.get('w1')?.sp_au === '02AU');
  const owner = await lockOwner(f.dest.lock); assert.ok(alive(owner.pid)); assert.notEqual(owner.pid, process.pid);
  await wait(100); assert.equal(f.subscriptions.size, 1);
  assert.equal((await readdir(f.dest.stateDir)).filter((n) => n.endsWith('.lock')).length, 1);
});

test('subscription rejects the entire request when a special kind misses required fields', async (t) => {
  const f = await fixture(t);
  for (const entry of [{ type: 'pane.agent_status_changed' }, { type: 'pane.scroll_changed' }, { type: 'pane.output_matched', pane_id: 'p' }]) {
    const reply = await request(f.dest.socket, 'events.subscribe', { subscriptions: [{ type: 'workspace.created' }, entry] });
    assert.equal(reply.error, 'request_rejected'); assert.equal(f.subscriptions.size, 0);
    assert.equal(f.errors.at(-1).code, 'invalid_request');
  }
  assert.ok(!EVENTS.includes('pane.agent_status_changed'), 'global subscribe cannot include a pane-scoped special subscription');
});

test('snake_case lifecycle events update names, activity and recycled workspace history', async (t) => {
  const f = await fixture(t); let now = 10 * DAY_MS;
  const w = (label) => ({ workspace_id: 'w1', label, pane_count: 0, focused: false, agent_status: 'idle' });
  f.setWorkspace([w('old')]); f.setPanes([]);
  await atomicWrite(f.dest.history, { version: 1, entries: { w1: { last: 0, seen: now } } });
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_quiet);
  f.setWorkspace([w('renamed')]); f.emit('workspace_renamed', { workspace_id: 'w1', label: 'renamed' });
  await until(() => f.metadata.get('w1')?.sp_name_stale?.startsWith('renamed'));
  f.emit('workspace_created', { workspace: w('renamed') });
  await until(() => f.metadata.get('w1')?.sp_name === 'renamed');
  now += 3 * DAY_MS; f.emit('pane_updated', { pane: { workspace_id: 'w1' } });
  await until(() => f.metadata.get('w1')?.sp_quiet);
  f.setWorkspace([]); f.emit('workspace_closed', { workspace_id: 'w1' });
  const before = daemon.metrics.reads; await until(() => daemon.metrics.reads > before);
  f.setWorkspace([w('replacement')]); f.emit('workspace_updated', { workspace: w('replacement') });
  await until(() => f.metadata.get('w1')?.sp_name === 'replacement');
});

test('steady pane.updated during reporting does not starve any workspace or later sorting', async (t) => {
  const f = await fixture(t); const now = 20 * DAY_MS;
  const ws = ['active', 'old', 'late'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'active', agent_status: 'idle' }));
  f.setWorkspace(ws); f.setPanes([]); f.control.reportDelay = 25;
  await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":true}');
  await atomicWrite(f.dest.history, { version: 1, entries: { old: { last: 0, seen: now }, late: { last: DAY_MS, seen: now } } });
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.report_metadata'));
  let revision = 0;
  const interval = setInterval(() => {
    // Force a changed first workspace on every rerun, not just a stream of no-op invalidations.
    f.setWorkspace(ws.map((w) => w.workspace_id === 'active' ? { ...w, label: `active-${++revision}` } : w));
    f.emit('pane_updated', { pane: { workspace_id: 'active' } });
  }, 10);
  try {
    await until(() => ws.every((w) => f.metadata.get(w.workspace_id)?.sp_panes));
    await until(async () => JSON.parse(await readFile(f.dest.health, 'utf8')).reads > 0);
  } finally { clearInterval(interval); }
  // pane.updated does not fence moves; sorting must run even when report passes receive updates.
  await until(() => f.calls.some((m) => m.method === 'workspace.move_block'));
});

test('ticks reload sort config and stop on disabled or absent plugin', async (t) => {
  for (const plugins of [[{ plugin_id: 'industrial-os.spaces', enabled: false }], []]) {
    const f = await fixture(t); const now = 10 * DAY_MS;
    f.setWorkspace(['old', 'active'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'active', agent_status: 'idle' }))); f.setPanes([]);
    await atomicWrite(f.dest.history, { version: 1, entries: { old: { last: 0, seen: now } } });
    const daemon = await runDaemon(f.dest, { ...fast, now: () => now }); f.cleanup.push(() => daemon.stop());
    await until(() => f.metadata.get('old')?.sp_quiet);
    await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":true}');
    await until(() => f.calls.some((m) => m.method === 'workspace.move_block'));
    f.control.plugins = plugins;
    await until(async () => !(await lockOwner(f.dest.lock)));
    await daemon.done;
    assert.equal(JSON.parse(await readFile(f.dest.health, 'utf8')).state, 'stopped');
  }
});

test('pane count mismatch retries once and isolates only inconsistent workspaces', async (t) => {
  const f = await fixture(t);
  const ws = ['w1', 'w2'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'w1', agent_status: 'idle' }));
  f.setWorkspace(ws); f.setPanes([]);
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000 }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w2')?.sp_panes);
  const before = f.calls.length;
  f.setWorkspace([{ ...ws[0], label: 'consistent' }, { ...ws[1], label: 'torn', pane_count: 1 }]);
  f.emit('workspace_updated', {});
  await until(() => f.metadata.get('w1')?.sp_name_active === 'consistent');
  assert.equal(f.metadata.get('w2').sp_name, 'w2', 'old accepted tokens left alone');
  assert.ok(f.calls.slice(before).filter((m) => m.method === 'workspace.list').length >= 2);
  assert.ok(!f.calls.slice(before).some((m) => m.method === 'workspace.report_metadata' && m.params.workspace_id === 'w2'));
  assert.match(await readFile(f.dest.log, 'utf8'), /pane_count_mismatch/);
  f.expire(Date.now() + 120_001);
  assert.equal(f.metadata.get('w2').sp_panes, undefined); assert.equal(f.metadata.get('w2').sp_name, 'w2');
});

test('CLI status and ensure reject a reused PID and stop addresses only the owned control endpoint', async (t) => {
  const f = await fixture(t);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(f.dest.lock); await writeFile(join(f.dest.lock, `${process.pid}-dead.json`), '{}');
  const bin = fileURLToPath(new URL('../bin/spaces.mjs', import.meta.url));
  const env = { ...process.env, HERDR_SOCKET_PATH: f.dest.socket, HERDR_PLUGIN_STATE_DIR: f.dest.stateDir, HERDR_PLUGIN_CONFIG_DIR: f.dest.configDir };
  const invoke = (command) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, command], { env }); let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; }); child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('CLI timeout')); }, 2000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, output }); }); child.on('error', reject);
  });
  f.cleanup.push(async () => { await invoke('stop'); await until(async () => !(await lockOwner(f.dest.lock))); });
  assert.deepEqual(await invoke('status'), { code: 0, output: '{"running":false}\n' });
  assert.deepEqual(await invoke('ensure'), { code: 0, output: '' });
  await until(() => f.metadata.get('w1')?.sp_panes);
  assert.deepEqual(await invoke('status'), { code: 0, output: '{"running":true}\n' });
  assert.equal((await invoke('stop')).code, 0);
  await until(async () => !(await lockOwner(f.dest.lock)));
  assert.deepEqual(await invoke('status'), { code: 0, output: '{"running":false}\n' });
});

test('a transient pane count mismatch succeeds on exactly one immediate retry', async (t) => {
  const f = await fixture(t); f.control.mismatchOnce = true;
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000 }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_panes);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.list').length, 2);
  assert.equal(f.calls.filter((m) => m.method === 'pane.list').length, 2);
  assert.equal(daemon.metrics.readFailures, 0);
});

test('pane.updated is not activity but working or blocked pane.list status refreshes activity', async (t) => {
  const f = await fixture(t), now = 10 * DAY_MS;
  f.setWorkspace([{ workspace_id: 'w1', label: 'space', pane_count: 1, focused: false, agent_status: 'idle' }]);
  await atomicWrite(f.dest.history, { version: 1, entries: { w1: { last: 0, seen: now } } });
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_quiet);
  for (const agent_status of ['working', 'blocked']) {
    f.setPanes([{ pane_id: 'w1:p1', workspace_id: 'w1', agent: 'pi', agent_status, tokens: { g2_au: '02AU' } }]);
    const reads = daemon.metrics.reads;
    f.emit('pane_updated', { pane: { workspace_id: 'w1' } });
    await until(() => daemon.metrics.reads > reads && f.metadata.get('w1')?.sp_name === 'space');
    assert.equal(JSON.parse(await readFile(f.dest.history, 'utf8')).entries.w1.last, now);
  }
});

test('disable tick interrupts a long report pass rather than waiting behind every workspace', async (t) => {
  const f = await fixture(t);
  f.setWorkspace(Array.from({ length: 12 }, (_, n) => ({ workspace_id: `w${n}`, label: `space${n}`, pane_count: 0, focused: n === 0, agent_status: 'idle' }))); f.setPanes([]);
  f.control.reportDelay = 60;
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 20 }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.report_metadata'));
  f.control.plugins = [];
  await until(async () => !(await lockOwner(f.dest.lock)), 500); await daemon.done;
  assert.ok(f.metadata.size < 12);
});

test('past-due report retries for skipped workspaces do not spin reconciliation', async (t) => {
  const f = await fixture(t);
  const ws = ['w1', 'w2'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'w1', agent_status: 'idle' }));
  f.setWorkspace(ws); f.setPanes([]); f.control.rejectReport = 'w2';
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, reporter: { retryMs: 80 } }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.report_metadata' && m.params.workspace_id === 'w2'));
  f.setWorkspace([ws[0], { ...ws[1], pane_count: 1 }]); f.emit('workspace_updated', {});
  await wait(300);
  assert.ok(f.calls.filter((m) => m.method === 'workspace.list').length <= 8, 'skipped past-due state must wait for an event/tick');
});

for (const event of ['pane_updated', 'workspace_focused']) test(`delayed reads still report under a continuous ${event} stream`, async (t) => {
  const f = await fixture(t), now = 10 * DAY_MS;
  f.setWorkspace(['old', 'active'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'active', agent_status: 'idle' }))); f.setPanes([]);
  await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":true}');
  await atomicWrite(f.dest.history, { version: 1, entries: { old: { last: 0, seen: now } } });
  f.control.readDelay = 50;
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.list'));
  const interval = setInterval(() => f.emit(event, { workspace_id: 'active', pane: { workspace_id: 'active' } }), 5);
  try {
    await until(() => f.metadata.get('old')?.sp_panes, 1000);
    if (event === 'pane_updated') await until(() => f.calls.some((m) => m.method === 'workspace.move_block'), 1000);
    else assert.equal(f.calls.some((m) => m.method === 'workspace.move_block'), false, 'focus-invalidated snapshots report but must not move');
  } finally { clearInterval(interval); }
});

test('late registry failure cannot overwrite disconnected health', async (t) => {
  const f = await fixture(t);
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 40, requestTimeoutMs: 200, subscription: { minBackoffMs: 1000, failureMs: 3000 } }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_panes);
  f.control.plugins = null; f.control.pluginDelay = 80;
  const before = f.calls.filter((m) => m.method === 'plugin.list').length;
  await until(() => f.calls.filter((m) => m.method === 'plugin.list').length > before);
  f.disconnect(); await wait(150);
  assert.equal(JSON.parse(await readFile(f.dest.health, 'utf8')).state, 'disconnected');
  assert.match(await readFile(f.dest.log, 'utf8'), /plugin_read_failed/);
});

test('pass ending after a disconnected move cannot overwrite disconnected health', async (t) => {
  const f = await fixture(t), now = 10 * DAY_MS;
  f.setWorkspace(['old', 'active'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'active', agent_status: 'idle' }))); f.setPanes([]);
  await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":true}');
  await atomicWrite(f.dest.history, { version: 1, entries: { old: { last: 0, seen: now } } }); f.control.moveDelay = 80;
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, requestTimeoutMs: 200, now: () => now, subscription: { minBackoffMs: 1000, failureMs: 3000 } }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.move_block'));
  f.disconnect(); await wait(150);
  assert.equal(JSON.parse(await readFile(f.dest.health, 'utf8')).state, 'disconnected');
});

test('invalid config preserves sort false, deduplicates diagnostics and deletion restores defaults', async (t) => {
  const f = await fixture(t), now = 10 * DAY_MS;
  f.setWorkspace(['old', 'active'].map((id) => ({ workspace_id: id, label: id, pane_count: 0, focused: id === 'active', agent_status: 'idle' }))); f.setPanes([]);
  await atomicWrite(f.dest.history, { version: 1, entries: { old: { last: 0, seen: now } } });
  const daemon = await runDaemon(f.dest, { ...fast, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('old')?.sp_quiet);
  await writeFile(join(f.dest.configDir, 'config.json'), 'not json');
  await wait(180);
  assert.equal(f.calls.some((m) => m.method === 'workspace.move_block'), false);
  const configLogs = () => readFile(f.dest.log, 'utf8').then((s) => s.trim().split('\n').map(JSON.parse).filter((e) => e.event === 'config_invalid'));
  assert.equal((await configLogs()).length, 1);
  await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":"no"}');
  await until(async () => (await configLogs()).length === 2);
  await rm(join(f.dest.configDir, 'config.json')); await mkdir(join(f.dest.configDir, 'config.json'));
  await wait(120); // readFile fails on a directory: retain sort:false on read errors too.
  assert.equal(f.calls.some((m) => m.method === 'workspace.move_block'), false);
  assert.equal((await configLogs()).length, 2);
  await rm(join(f.dest.configDir, 'config.json'), { recursive: true });
  await until(() => f.calls.some((m) => m.method === 'workspace.move_block'));
  assert.equal((await configLogs()).length, 2, 'normal absence is not an error');
  assert.doesNotMatch(await readFile(f.dest.log, 'utf8'), /config_defaulted/);
});

test('absent activity IDs are pruned so the cap cannot suppress new workspace activity', async (t) => {
  const f = await fixture(t), now = 10 * DAY_MS;
  f.setWorkspace([{ workspace_id: 'w1', label: 'space', pane_count: 0, focused: false, agent_status: 'idle' }]); f.setPanes([]);
  await atomicWrite(f.dest.history, { version: 1, entries: { w1: { last: 0, seen: now } } });
  const daemon = await runDaemon(f.dest, { ...fast, tickMs: 60_000, debounceMs: 100, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_quiet);
  const reads = daemon.metrics.reads;
  for (let i = 0; i < 16_384; i++) f.emit('workspace_created', { workspace_id: `absent-${i}` });
  await until(() => daemon.metrics.reads > reads);
  f.emit('workspace_created', { workspace_id: 'w1' });
  await until(() => f.metadata.get('w1')?.sp_name === 'space', 1000);
});

test('tick health write failure logs and continues rather than stopping the daemon', async (t) => {
  const f = await fixture(t);
  const daemon = await runDaemon(f.dest, fast); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.sp_panes);
  await rm(f.dest.health); await mkdir(f.dest.health); // Rename onto a directory fails even when the test user is privileged.
  f.control.plugins = null;
  await until(async () => /settings_failed/.test(await readFile(f.dest.log, 'utf8')));
  assert.ok(await lockOwner(f.dest.lock));
  await rm(f.dest.health, { recursive: true }); f.control.plugins = [{ plugin_id: 'industrial-os.spaces', enabled: true }];
  await until(async () => JSON.parse(await readFile(f.dest.health, 'utf8').catch(() => '{}')).state === 'connected');
  assert.ok(await lockOwner(f.dest.lock));
});
