import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
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
  const calls = [], sockets = new Set(), subscriptions = new Set(), metadata = new Map(), sequences = new Map(), expiry = new Map();
  let workspaces = [{ workspace_id: 'w1', label: 'space', pane_count: 1, focused: true, agent_status: 'idle' }];
  let panes = [{ pane_id: 'w1:p1', workspace_id: 'w1', agent_status: 'idle', agent: 'pi', tokens: { g2_au: '02AU' } }];
  const control = { rejectRead: false, rejectReport: false, readDelay: 0, ignore: false };
  const server = createServer((socket) => {
    sockets.add(socket); socket.on('close', () => { sockets.delete(socket); subscriptions.delete(socket); }); socket.on('error', () => {});
    let buffer = ''; socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk; let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1); calls.push(msg);
        const reply = (result) => { if (!socket.destroyed) socket.write(JSON.stringify({ id: msg.id, result }) + '\n'); };
        const reject = () => { if (!socket.destroyed) socket.write(JSON.stringify({ id: msg.id, error: { code: 'rejected' } }) + '\n'); };
        if (control.ignore) continue;
        if (msg.method === 'events.subscribe') { subscriptions.add(socket); reply({ type: 'subscription_started' }); }
        else if (msg.method === 'workspace.list' || msg.method === 'pane.list') {
          const result = structuredClone(msg.method === 'workspace.list' ? { workspaces } : { panes });
          if (control.rejectRead) reject(); else if (control.readDelay) setTimeout(() => reply(result), control.readDelay); else reply(result);
        } else if (msg.method === 'workspace.report_metadata') {
          if (control.rejectReport) { reject(); continue; }
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
          reply({});
        } else if (msg.method === 'workspace.move_block') reply({ workspaces }); else reply({});
      }
    });
  });
  await new Promise((resolve) => server.listen(dest.socket, resolve));
  t.after(async () => { for (const fn of cleanup) await fn(); for (const s of sockets) s.destroy(); await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  return { dest, cleanup, calls, control, subscriptions, metadata, setWorkspace: (value) => { workspaces = value; }, setPanes: (value) => { panes = value; },
    emit(event, data) { for (const s of subscriptions) s.write(JSON.stringify({ event, data }) + '\n'); },
    expire(now) { for (const [identity, deadline] of expiry) if (deadline <= now) { const [id, key] = identity.split(':'); delete metadata.get(id)?.[key]; expiry.delete(identity); } },
    disconnect() { for (const s of subscriptions) s.destroy(); } };
}
const fast = { debounceMs: 15, tickMs: 40, readRetryMs: 10, requestTimeoutMs: 100,
  subscription: { minBackoffMs: 10, maxBackoffMs: 40, failureMs: 250, timeoutMs: 100 },
  reporter: { renewMs: 35, retryMs: 50, maxRetryMs: 200 } };

test('fake socket subscribe/read/report; TTL renew, quiet clears, activity, metadata ignored and reconnect full', async (t) => {
  const f = await fixture(t); let now = 10 * DAY_MS;
  const daemon = await runDaemon(f.dest, { ...fast, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.metadata.get('w1')?.au === '02AU');
  assert.deepEqual(f.calls[0].params.subscriptions.map((s) => s.type), EVENTS);
  assert.ok(!EVENTS.includes('workspace.metadata_updated'));
  const initial = f.calls.filter((m) => m.method === 'workspace.report_metadata'); assert.equal(initial.length, 2);
  f.emit('workspace.metadata_updated', { workspace_id: 'w1' }); await wait(20); assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, 2);
  now += 40; await until(() => f.calls.filter((m) => m.method === 'workspace.report_metadata').length >= 4);
  f.setWorkspace([{ workspace_id: 'w1', label: 'space', pane_count: 1, focused: false, agent_status: 'idle' }]);
  now += 2 * DAY_MS; f.emit('pane.updated', { pane: { workspace_id: 'w1' } });
  await until(() => f.metadata.get('w1')?.quiet?.endsWith('2d'));
  assert.equal(f.metadata.get('w1').agents, undefined); assert.equal(f.metadata.get('w1').au, undefined);
  const saved = JSON.parse(await readFile(f.dest.history, 'utf8')); assert.equal(saved.entries.w1.last, 10 * DAY_MS + 40);
  f.emit('pane.agent_status_changed', { workspace_id: 'w1', pane_id: 'w1:p1', agent_status: 'idle' });
  await until(() => f.metadata.get('w1')?.name === 'space'); assert.equal(f.metadata.get('w1').quiet, undefined);
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
  assert.deepEqual(f.metadata.get('w1'), { name: 'space' }); // Only no-TTL names freeze after stop.
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
  await until(() => f.metadata.get('w1')?.name_active === 'space');
  f.control.rejectRead = true;
  const count = f.calls.filter((m) => m.method === 'workspace.report_metadata').length;
  f.setPanes([{ pane_id: 'w1:p1', workspace_id: 'w1', agent_status: 'idle', agent: 'pi', tokens: {} }]);
  f.emit('pane.updated', { pane: { workspace_id: 'w1' } }); await wait(130);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, count);
  assert.ok(daemon.metrics.readFailures > 0);
  assert.ok(JSON.parse(await readFile(f.dest.health, 'utf8')).readFailures > 0);
  f.control.rejectRead = false; f.control.rejectReport = true;
  await until(() => f.calls.filter((m) => m.method === 'workspace.report_metadata').length > count);
  const failed = f.calls.filter((m) => m.method === 'workspace.report_metadata').length;
  f.emit('pane.updated', {}); await wait(25);
  assert.equal(f.calls.filter((m) => m.method === 'workspace.report_metadata').length, failed);
  f.control.rejectReport = false; await until(() => f.metadata.get('w1')?.au === '??AU');
  const recent = f.calls.filter((m) => m.method === 'workspace.report_metadata').slice(-2);
  assert.equal(Object.keys(recent[0].params.tokens).length, 3); assert.equal(Object.keys(recent[1].params.tokens).length, 4);
  f.control.readDelay = 60;
  f.setWorkspace([{ workspace_id: 'w1', label: 'old-read', pane_count: 1, focused: true, agent_status: 'idle' }]);
  f.emit('workspace.renamed', { workspace_id: 'w1' });
  await until(() => f.calls.at(-1).method === 'pane.list');
  f.setWorkspace([{ workspace_id: 'w1', label: 'latest', pane_count: 1, focused: true, agent_status: 'idle' }]);
  f.emit('workspace.renamed', { workspace_id: 'w1' });
  await until(() => f.metadata.get('w1')?.name_active === 'latest');
  assert.ok(!f.calls.some((m) => m.params.tokens?.name_active === 'old-read'));
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
  await until(() => f.metadata.get('child')?.quiet?.endsWith('20d')); await daemon.stop();
  assert.equal(f.calls.some((m) => m.method === 'workspace.move_block'), false);
  await writeFile(join(f.dest.configDir, 'config.json'), '{"sort":true}');
  daemon = await runDaemon(f.dest, { ...fast, now: () => now }); f.cleanup.push(() => daemon.stop());
  await until(() => f.calls.some((m) => m.method === 'workspace.move_block'));
  assert.deepEqual(f.calls.find((m) => m.method === 'workspace.move_block').params, { workspace_ids: ['parent', 'child'] });
  f.emit('workspace.reordered', {}); await wait(100);
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
  await until(() => f.metadata.get('w1')?.au === '02AU');
  const owner = await lockOwner(f.dest.lock); assert.ok(alive(owner.pid)); assert.notEqual(owner.pid, process.pid);
  await wait(100); assert.equal(f.subscriptions.size, 1);
  assert.equal((await readdir(f.dest.stateDir)).filter((n) => n.endsWith('.lock')).length, 1);
});
