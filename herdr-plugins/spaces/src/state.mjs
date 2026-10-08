import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rename, unlink, rmdir, lstat, appendFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
export const socketKey = (socket) => createHash('sha256').update(socket).digest('hex').slice(0, 32);
export function target(env = process.env) {
  if (!isAbsolute(env.HERDR_SOCKET_PATH ?? '') || !isAbsolute(env.HERDR_PLUGIN_STATE_DIR ?? '') || !isAbsolute(env.HERDR_PLUGIN_CONFIG_DIR ?? '')) throw new Error('invalid_environment');
  const key = socketKey(env.HERDR_SOCKET_PATH);
  return { socket: env.HERDR_SOCKET_PATH, stateDir: env.HERDR_PLUGIN_STATE_DIR, configDir: env.HERDR_PLUGIN_CONFIG_DIR,
    lock: join(env.HERDR_PLUGIN_STATE_DIR, `${key}.lock`), history: join(env.HERDR_PLUGIN_STATE_DIR, `${key}.history.json`), log: join(env.HERDR_PLUGIN_STATE_DIR, `${key}.log`), health: join(env.HERDR_PLUGIN_STATE_DIR, `${key}.health.json`) };
}
export async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_state_directory');
}
export async function atomicWrite(path, value) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(tmp, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 }); await rename(tmp, path); }
  finally { await unlink(tmp).catch(() => {}); }
}
export const alive = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
};
export async function lockOwner(path) {
  try {
    if (!(await lstat(path)).isDirectory() || (await lstat(path)).isSymbolicLink()) throw new Error('unsafe_lock');
    const names = await readdir(path);
    if (!names.length) return { empty: true };
    if (names.length !== 1 || !/^\d+-[a-f0-9-]+\.json$/.test(names[0])) return { unknown: true };
    const pid = Number(names[0].split('-')[0]);
    return { pid, name: names[0] };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function acquireLock(path) {
  const name = `${process.pid}-${randomUUID()}.json`, stage = `${path}.${randomUUID()}.claim`;
  // Rename a populated directory atomically. Unlike mkdir + pid write, a contender never sees an empty new lock.
  await mkdir(stage, { mode: 0o700 });
  try {
    await atomicWrite(join(stage, name), { pid: process.pid });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await rename(stage, path);
        return async () => { await unlink(join(path, name)).catch(() => {}); await rmdir(path).catch(() => {}); };
      } catch (error) {
        if (!['ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
        const owner = await lockOwner(path);
        if (owner?.unknown || (owner && alive(owner.pid))) return null;
        // Remove only the stale unique filename, then rmdir (never recursive). Competing recovery cannot delete a new owner's marker.
        if (owner?.name) await unlink(join(path, owner.name)).catch((e) => { if (e.code !== 'ENOENT') throw e; });
        await rmdir(path).catch((e) => { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e; });
      }
    }
    return null;
  } finally { await unlink(join(stage, name)).catch(() => {}); await rmdir(stage).catch(() => {}); }
}
export async function readHistoryState(path) {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error('unsafe_history');
    if ((await lstat(path)).size > 2 * 1024 * 1024) throw new Error('invalid_history');
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (value.version !== 1 || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries) || Object.keys(value.entries).length > 16_384) throw new Error('invalid_history');
    for (const entry of Object.values(value.entries)) if (!entry || !Number.isSafeInteger(entry.last) || entry.last < 0 || !Number.isSafeInteger(entry.seen) || entry.seen < 0) throw new Error('invalid_history');
    if (value.sorting !== undefined && (!value.sorting || typeof value.sorting.signature !== 'string' || value.sorting.signature.length > 1024 * 1024 || !Number.isSafeInteger(value.sorting.lastMove))) throw new Error('invalid_history');
    return value;
  } catch (error) { if (error.code === 'ENOENT') return { version: 1, entries: {} }; throw new Error('invalid_history'); }
}
export async function readHistory(path) { return (await readHistoryState(path)).entries; }
export async function readConfig(dir) {
  const path = join(dir, 'config.json');
  if ((await lstat(path)).isSymbolicLink() || (await lstat(path)).size > 4096) throw new Error('invalid_config');
  const value = JSON.parse(await readFile(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => key !== 'sort') || (value.sort !== undefined && typeof value.sort !== 'boolean')) throw new Error('invalid_config');
  return { sort: value.sort ?? true };
}
export async function log(target, code, metrics = {}) {
  // No labels, paths, payloads, inherited environment or internal exceptions enter diagnostics.
  try {
    const stat = await lstat(target.log).catch((e) => { if (e.code !== 'ENOENT') throw e; return null; });
    if (stat?.isSymbolicLink() || (stat && !stat.isFile())) return;
    if (stat?.size > 256 * 1024) await atomicWrite(target.log, { event: 'log_rotated' });
    await appendFile(target.log, JSON.stringify({ time: Date.now(), pid: process.pid, event: code, ...metrics }) + '\n', { mode: 0o600 });
  } catch { /* Diagnostics must not strand the process or its lock. */ }
}
