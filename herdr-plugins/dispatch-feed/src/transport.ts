import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { object } from "./snapshot.ts";

export type Method = "get" | "act" | "refresh";
export interface Rpc {
  request(method: Method, params?: Record<string, unknown>): Promise<unknown>;
  close(): void;
}
export const socketPath = (): string =>
  join(
    process.env.SOURCE_COLLECTOR_HOME ??
      join(homedir(), "Library/Application Support/source-collector"),
    "feed.sock",
  );
export class RpcError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const codes = new Set([
  "invalid_input",
  "config_error",
  "conflict",
  "not_found",
  "contention",
  "engine_not_running",
  "timeout",
  "output_limit",
  "command_failed",
  "invalid_output",
  "schema_unknown",
  "io",
  "outcome_unknown",
]);
function errorCode(value: unknown): string {
  const e = object(value);
  if (typeof e.code === "string" && codes.has(e.code)) return e.code;
  // Effect 4.0.6 ndJsonRpc encodes typed failure as error.data = Cause array.
  if (e._tag === "Cause" && Array.isArray(e.data)) {
    for (const entry of e.data.slice(0, 32)) {
      const cause = object(entry);
      if (cause._tag === "Fail" && cause.error && typeof cause.error === "object") {
        const typed = object(cause.error);
        if (typeof typed.code === "string" && codes.has(typed.code)) return typed.code;
      }
    }
  }
  if (e.data && typeof e.data === "object" && !Array.isArray(e.data)) {
    const data = object(e.data);
    if (typeof data.code === "string" && codes.has(data.code)) return data.code;
    // Effect JSON-RPC serialization carries typed failure in cause/data.
    if (Array.isArray(data.cause))
      for (const entry of data.cause) {
        const c = object(entry);
        if (c.error && typeof c.error === "object") {
          const err = object(c.error);
          if (typeof err.code === "string" && codes.has(err.code)) return err.code;
        }
      }
  }
  return "request_rejected";
}
export class FeedClient implements Rpc {
  private nextId = 0;
  private disposed = false;
  private pending = new Set<() => void>();
  constructor(
    readonly path: string,
    readonly readOnly = false,
    readonly timeoutMs = 3000,
    readonly sources: readonly string[] = [],
  ) {}
  request(method: Method, params: Record<string, unknown> = {}): Promise<unknown> {
    if (this.disposed) return Promise.reject(new RpcError("disconnected"));
    if (this.readOnly && method !== "get") return Promise.reject(new RpcError("read_only"));
    if (this.pending.size >= 2) return Promise.reject(new RpcError("busy"));
    if (method === "get" && this.sources.length) params = { ...params, sources: this.sources };
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const socket = createConnection({ path: this.path });
      let buffer = Buffer.alloc(0),
        settled = false;
      const finish = (error?: Error, result?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pending.delete(cancel);
        socket.destroy();
        if (error) reject(error);
        else resolve(result);
      };
      const cancel = () =>
        finish(new RpcError(method === "get" ? "disconnected" : "outcome_unknown"));
      this.pending.add(cancel);
      const timer = setTimeout(
        () => finish(new RpcError(method === "get" ? "timeout" : "outcome_unknown")),
        this.timeoutMs,
      );
      socket.once("connect", () =>
        socket.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"),
      );
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
        if (buffer.length > 16 * 1024 * 1024) {
          finish(new RpcError("output_limit"));
          return;
        }
        const end = buffer.indexOf(10);
        if (end < 0) return;
        try {
          const reply = object(JSON.parse(buffer.subarray(0, end).toString("utf8")));
          if (
            reply.jsonrpc !== "2.0" ||
            reply.id !== id ||
            ("error" in reply && "result" in reply) ||
            (!("error" in reply) && !("result" in reply) && method !== "refresh")
          )
            throw new RpcError("invalid_reply");
          if ("error" in reply) finish(new RpcError(errorCode(reply.error)));
          else finish(undefined, reply.result);
        } catch {
          finish(new RpcError("invalid_reply"));
        }
      });
      socket.once("error", () =>
        finish(new RpcError(method === "get" ? "engine_not_running" : "outcome_unknown")),
      );
      socket.once("close", () => {
        if (!settled) cancel();
      });
    });
  }
  close(): void {
    this.disposed = true;
    for (const cancel of this.pending) cancel();
  }
}
