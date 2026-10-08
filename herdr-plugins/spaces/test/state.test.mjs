import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, readFile, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, atomicWrite, readHistory, readConfig, socketKey, log, target } from '../src/state.mjs';
async function fixture(t) { const dir = await mkdtemp(join(tmpdir(), 'spaces-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }

test('lock excludes concurrent runners and recovers stale owner without deleting a winner', async (t) => {
  const dir = await fixture(t), path = join(dir, 'lock');
  const release = await acquireLock(path); assert.ok(release);
  assert.equal(await acquireLock(path), null);
  await release();
  await mkdir(path); await writeFile(join(path, '2147483647-dead.json'), '{}');
  const contenders = await Promise.all(Array.from({ length: 12 }, () => acquireLock(path)));
  assert.equal(contenders.filter(Boolean).length, 1);
  await contenders.find(Boolean)();
  await mkdir(path); // Interrupted stale recovery can leave an empty directory.
  const emptyRecovered = await acquireLock(path); assert.ok(emptyRecovered); await emptyRecovered();
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
  const path = join(dir, 'unsafe.lock'); await symlink(dir, path); await assert.rejects(acquireLock(path));
});
