import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, symlink, stat, rename, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, atomicWrite, readHistory, readConfig, socketKey, log, target } from '../src/state.mjs';
async function fixture(t) { const dir = await mkdtemp(join(tmpdir(), 'spaces-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
async function fallbackFixture(t, dir) {
  const created = await mkdir(dir, { mode: 0o700 }).then(() => true, (e) => { if (e.code !== 'EEXIST') throw e; return false; });
  t.after(async () => { if (created) await rmdir(dir); }); // Never remove a pre-existing shared directory.
}

test('lock excludes concurrent runners and recovers stale owner without deleting a winner', async (t) => {
  const dir = await fixture(t), path = join(dir, 'lock');
  const isLive = (owner) => !owner.name.endsWith('-dead.json');
  const release = await acquireLock(path, { isLive }); assert.ok(release);
  assert.equal(await acquireLock(path, { isLive }), null);
  await release();
  await mkdir(path); await writeFile(join(path, '2147483647-dead.json'), '{}');
  const contenders = await Promise.all(Array.from({ length: 12 }, () => acquireLock(path, { isLive })));
  assert.equal(contenders.filter(Boolean).length, 1);
  await contenders.find(Boolean)();
  await mkdir(path); // Interrupted stale recovery can leave an empty directory.
  const emptyRecovered = await acquireLock(path, { isLive }); assert.ok(emptyRecovered); await emptyRecovered();
});
test('history atomic round trip and malformed rejection; config defaults and validation', async (t) => {
  const dir = await fixture(t), path = join(dir, 'history.json');
  assert.deepEqual(await readHistory(path), {});
  const entries = { w1: { last: 100, seen: 200 } };
  await atomicWrite(path, { version: 1, entries });
  assert.deepEqual(await readHistory(path), entries);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await atomicWrite(path, { version: 1, entries: { w1: { last: '100', seen: 200 } } });
  await assert.rejects(readHistory(path), /invalid_history/);
  await assert.rejects(readConfig(dir));
  await writeFile(join(dir, 'config.json'), '{"sort":false}'); assert.deepEqual(await readConfig(dir), { sort: false });
  for (const value of ['{"sort":"false"}', '{"extra":true}', 'null', '[]', 'not json']) {
    await writeFile(join(dir, 'config.json'), value); await assert.rejects(readConfig(dir));
  }
});
test('socket isolation and bounded sanitized diagnostics; symlinks fail closed', async (t) => {
  const dir = await fixture(t);
  assert.notEqual(socketKey('/tmp/a.sock'), socketKey('/tmp/b.sock'));
  const dest = target({ HERDR_SOCKET_PATH: '/tmp/a.sock', HERDR_PLUGIN_STATE_DIR: dir, HERDR_PLUGIN_CONFIG_DIR: dir });
  assert.throws(() => target({}), /invalid_environment/);
  await writeFile(dest.log, 'x'.repeat(270_000)); await log(dest, 'started', { reads: 1 });
  assert.ok((await stat(dest.log)).size < 1024);
  const victim = join(dir, 'victim'); await writeFile(victim, 'untouched');
  await rm(dest.log); await symlink(victim, dest.log); await log(dest, 'started');
  assert.equal(await readFile(victim, 'utf8'), 'untouched');
  const path = join(dir, 'unsafe.lock'); await symlink(dir, path); await assert.rejects(acquireLock(path, { isLive: () => false }));
});

test('daemon liveness cannot be fooled by a recycled live PID; concurrent recovery and long paths stay safe', async (t) => {
  const { acquireDaemonLock, daemonCommand, lockOwner, controlPath } = await import('../src/state.mjs');
  const dir = await fixture(t), path = join(dir, 'daemon.lock');
  const { chmod } = await import('node:fs/promises');
  await chmod(dir, 0o755); // Herdr may pre-create owner-writable state parents with ordinary umask.
  await mkdir(path); await writeFile(join(path, `${process.pid}-dead.json`), '{}');
  assert.equal((await daemonCommand(path, await lockOwner(path))).running, false);
  const contenders = await Promise.all(Array.from({ length: 8 }, () => acquireDaemonLock(path, () => {})));
  assert.equal(contenders.filter(Boolean).length, 1);
  const owner = await lockOwner(path);
  assert.equal((await daemonCommand(path, owner)).running, true);
  await contenders.find(Boolean)();
  assert.equal((await daemonCommand(path, owner)).running, false);
  assert.ok(Buffer.byteLength(controlPath('/tmp/' + 'x'.repeat(200) + '/l', owner.name)) <= 100);
  const fallbackDir = join('/tmp', `ios-sp-${process.getuid()}`);
  await fallbackFixture(t, fallbackDir);
  const longDir = join(dir, 'x'.repeat(120)); await mkdir(longDir);
  const longLock = join(longDir, 'daemon.lock'); let stopped = false;
  const release = await acquireDaemonLock(longLock, () => { stopped = true; });
  assert.equal((await daemonCommand(longLock, await lockOwner(longLock), 'stop')).running, true);
  assert.equal(stopped, true); await release();
});

test('generic lock requires an explicit liveness rule, never a disk PID fallback', async (t) => {
  const dir = await fixture(t);
  await assert.rejects(acquireLock(join(dir, 'lock')), /liveness_required/);
  assert.deepEqual(await (await import('node:fs/promises')).readdir(dir), []);
});

test('refused stale owner recovery unlinks only its exact control socket', async (t) => {
  const { acquireDaemonLock, controlPath } = await import('../src/state.mjs');
  const { createServer } = await import('node:net');
  const dir = await fixture(t), path = join(dir, 'daemon.lock'), name = `${process.pid}-dead.json`;
  await mkdir(path); await writeFile(join(path, name), '{}');
  const endpoint = controlPath(path, name), parked = `${endpoint}.parked`, sibling = join(dir, 'unrelated.sock');
  const server = createServer();
  await new Promise((resolve) => server.listen(endpoint, resolve));
  // Keep a real, unbound socket inode after closing Node's automatically-unlinked listen path.
  await rename(endpoint, parked); await new Promise((resolve) => server.close(resolve)); await rename(parked, endpoint);
  await writeFile(sibling, 'untouched');
  const release = await acquireDaemonLock(path, () => {}); assert.ok(release); t.after(release);
  await assert.rejects(stat(endpoint), { code: 'ENOENT' });
  assert.equal(await readFile(sibling, 'utf8'), 'untouched');
});

test('fallback fixture cleanup removes only the directory this test created', async (t) => {
  const dir = await fixture(t);
  for (const preExisting of [false, true]) {
    const fallback = join(dir, String(preExisting)), hooks = [];
    if (preExisting) { await mkdir(fallback); await writeFile(join(fallback, 'sentinel'), 'untouched'); }
    await fallbackFixture({ after: (fn) => hooks.push(fn) }, fallback);
    for (const cleanup of hooks) await cleanup();
    if (preExisting) assert.equal(await readFile(join(fallback, 'sentinel'), 'utf8'), 'untouched');
    else await assert.rejects(stat(fallback), { code: 'ENOENT' });
  }
});
