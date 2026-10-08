import { createConnection } from 'node:net';
export const EVENTS = ['pane.created', 'pane.closed', 'pane.agent_detected', 'pane.agent_status_changed', 'pane.updated', 'pane.moved', 'pane.focused', 'tab.focused', 'workspace.created', 'workspace.closed', 'workspace.focused', 'workspace.moved', 'workspace.reordered', 'workspace.renamed', 'workspace.updated'];
let serial = 0;
const requestId = () => `industrial-os:spaces:${process.pid}:${++serial}`;
const MAX_BYTES = 1024 * 1024;
function lines(socket, receive, invalid) {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      if (Buffer.byteLength(line) > MAX_BYTES) return invalid();
      try { receive(JSON.parse(line)); } catch { return invalid(); }
      if (socket.destroyed) return;
    }
    if (Buffer.byteLength(buffer) > MAX_BYTES) invalid();
  });
}
export function request(socketPath, method, params = {}, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const id = requestId(), socket = createConnection(socketPath);
    let settled = false;
    const finish = (reply) => {
      if (settled) return;
      settled = true; clearTimeout(timer); socket.destroy(); resolve(reply);
    };
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), timeoutMs);
    socket.on('error', () => finish({ ok: false, error: 'connection_failed' }));
    socket.on('close', () => finish({ ok: false, error: 'connection_closed' }));
    socket.on('connect', () => socket.write(JSON.stringify({ id, method, params }) + '\n'));
    lines(socket, (line) => {
      if (line?.id !== id) return;
      if (line.error || !Object.hasOwn(line, 'result')) finish({ ok: false, error: 'request_rejected' });
      else finish({ ok: true, result: line.result });
    }, () => finish({ ok: false, error: 'invalid_reply' }));
  });
}
export function subscribe(socketPath, { started, event, offline, exhausted }, options = {}) {
  const min = options.minBackoffMs ?? 250, max = options.maxBackoffMs ?? 30_000;
  const failureMs = options.failureMs ?? 120_000, timeoutMs = options.timeoutMs ?? 1000;
  let closed = false, current, retry, handshake, watchdog, backoff = min;
  function beginFailure() {
    if (!watchdog) watchdog = setTimeout(() => { close(); exhausted(); }, failureMs);
  }
  function close() {
    closed = true; clearTimeout(retry); clearTimeout(handshake); clearTimeout(watchdog);
    current?.destroy(); current = undefined;
  }
  function connect() {
    if (closed) return;
    const socket = createConnection(socketPath), id = requestId();
    current = socket;
    let live = false;
    const drop = () => {
      if (closed || current !== socket) return;
      current = undefined; clearTimeout(handshake); socket.destroy(); offline(); beginFailure();
      retry = setTimeout(connect, backoff); backoff = Math.min(max, backoff * 2);
    };
    handshake = setTimeout(drop, timeoutMs);
    socket.on('error', drop); socket.on('close', drop);
    socket.on('connect', () => socket.write(JSON.stringify({ id, method: 'events.subscribe', params: { subscriptions: EVENTS.map((type) => ({ type })) } }) + '\n'));
    lines(socket, (line) => {
      if (closed || current !== socket) return;
      if (!live) {
        if (line?.id !== id) return;
        if (line.result?.type !== 'subscription_started') return drop();
        clearTimeout(handshake); clearTimeout(watchdog); watchdog = undefined;
        live = true; backoff = min; started();
      } else if (line?.error) drop();
      else if (EVENTS.includes(line?.event)) event(line);
    }, drop);
  }
  beginFailure(); connect();
  return { close };
}
