import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile, rename, unlink, rmdir, lstat, appendFile, chmod } from 'node:fs/promises';
import { join, isAbsolute, dirname } from 'node:path';
import { createServer, createConnection } from 'node:net';
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
export async function acquireLock(path, { name = `${process.pid}-${randomUUID()}.json`, isLive = (owner) => alive(owner.pid) } = {}) {
  const stage = `${path}.${randomUUID()}.claim`;
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
        if (owner?.unknown || (owner?.name && await isLive(owner) !== false)) return null;
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

// Unique owner endpoint, live before its marker becomes visible. Never signal a PID from disk.
export function controlPath(lock, name) {
  const hash = socketKey(lock + '\0' + name).slice(0, 24);
  const local = join(dirname(lock), `s-${hash}.sock`);
  // Darwin sun_path is 104 bytes including NUL; keep a margin for both supported hosts.
  return Buffer.byteLength(local) <= 100 ? local : join('/tmp', `ios-sp-${process.getuid()}`, `${hash}.sock`);
}
export async function daemonCommand(lock, owner, command = 'probe') {
  if (!owner?.name || owner.unknown) return { running: false, stale: !owner?.unknown };
  return new Promise((resolve) => {
    const socket = createConnection(controlPath(lock, owner.name)); let buffer = '', settled = false;
    const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); resolve(result); };
    const timer = setTimeout(() => finish({ running: false, stale: false }), 500);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(JSON.stringify({ owner: owner.name, command }) + '\n'));
    socket.on('data', (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 1024) return finish({ running: false, stale: false });
      if (!buffer.includes('\n')) return;
      try {
        const reply = JSON.parse(buffer.split('\n')[0]);
        finish({ running: reply.owner === owner.name && reply.pid === owner.pid && reply.ok === true, stale: false });
      } catch { finish({ running: false, stale: false }); }
    });
    socket.on('error', (e) => finish({ running: false, stale: ['ENOENT', 'ECONNREFUSED'].includes(e.code) }));
    socket.on('close', () => finish({ running: false, stale: false }));
  });
}
export async function acquireDaemonLock(path, stop) {
  const name = `${process.pid}-${randomUUID()}.json`, endpoint = controlPath(path, name);
  await privateDirectory(dirname(endpoint));
  const directory = await lstat(dirname(endpoint));
  const fallback = dirname(endpoint) !== dirname(path);
  if ((directory.mode & (fallback ? 0o077 : 0o022)) !== 0 || directory.uid !== process.getuid()) throw new Error('unsafe_control_directory');
  const sockets = new Set(); let bound = false;
  const server = createServer((socket) => {
    // Bound both connections and untrusted local command traffic.
    if (sockets.size >= 16) { socket.destroy(); return; }
    sockets.add(socket); socket.setTimeout(500, () => socket.destroy()); socket.setEncoding('utf8');
    socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    let buffer = '', handled = false;
    socket.on('data', (chunk) => {
      if (handled) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 1024) { socket.destroy(); return; }
      if (!buffer.includes('\n')) return;
      handled = true;
      try {
        const request = JSON.parse(buffer.split('\n')[0]);
        if (request.owner !== name || !['probe', 'stop'].includes(request.command)) { socket.destroy(); return; }
        socket.end(JSON.stringify({ owner: name, pid: process.pid, ok: true }) + '\n');
        if (request.command === 'stop') stop();
      } catch { socket.destroy(); }
    });
  });
  async function close() {
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    if (bound) await unlink(endpoint).catch((e) => { if (e.code !== 'ENOENT') throw e; });
  }
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(endpoint, () => { bound = true; resolve(); }); });
    await chmod(endpoint, 0o600);
    const release = await acquireLock(path, { name, isLive: async (owner) => {
      const result = await daemonCommand(path, owner);
      return result.running ? true : result.stale ? false : null; // uncertain/hung endpoint fails closed
    } });
    if (!release) { await close(); return null; }
    return async () => { try { await close(); } finally { await release(); } };
  } catch (error) { await close(); throw error; }
}
