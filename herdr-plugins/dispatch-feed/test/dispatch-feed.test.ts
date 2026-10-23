import { describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { decodeSnapshot, itemId } from "../src/snapshot.ts";
import { FeedClient, RpcError } from "../src/transport.ts";
import type { Method, Rpc } from "../src/transport.ts";
import { App } from "../src/app.ts";
import { diffFrame, plain, render, hitAt } from "../src/render.ts";
import { Input } from "../src/input.ts";
import { fixture } from "./fixture.ts";
import { typeColor } from "@industrial-os/design-system/foundation/type-colors";
import { stalenessBar } from "@industrial-os/design-system/elements/type-unit";
import { paint } from "@industrial-os/design-system/foundation/cells";

class Fake implements Rpc {
  snapshot = fixture();
  calls: { method: Method; params: Record<string, unknown> }[] = [];
  error: string | null = null;
  closed = false;
  async request(method: Method, params: Record<string, unknown> = {}): Promise<unknown> {
    this.calls.push({ method, params });
    if (this.error) throw new RpcError(this.error);
    return method === "get" ? structuredClone(this.snapshot) : { rev: ++this.snapshot.rev };
  }
  close(): void {
    this.closed = true;
  }
}
async function setup(): Promise<{ app: App; rpc: Fake; clock: { t: number } }> {
  const rpc = new Fake(),
    clock = { t: 0 },
    app = new App(
      rpc,
      () => clock.t,
      () => {},
    );
  await app.poll();
  return { app, rpc, clock };
}

describe("defensive decoder", () => {
  test("unknown fields ignored, sources ordered, unknown health never zero", () => {
    const raw = fixture();
    raw.sources.reverse();
    const decoded = decodeSnapshot({ ...raw, future: true });
    expect(decoded.sources[0].id).toBe("reviews");
    const unknown = fixture() as unknown as { sources: { state: string }[] };
    unknown.sources[0].state = "new_protocol_state";
    const s = decodeSnapshot(unknown);
    expect(s.sources[0].state).toBe("unknown");
    expect(s.counts.bySource.reviews).toBeNull();
  });
  test("unknown version, bad count/remaining, missing week and duplicate identities rejected", () => {
    expect(() => decodeSnapshot({ ...fixture(), v: 2 })).toThrow();
    const s = fixture();
    s.items[0].derived.remaining = 2;
    expect(() => decodeSnapshot(s)).toThrow();
    s.items[0].derived.remaining = 0.5;
    s.counts.plan.today = -1;
    expect(() => decodeSnapshot(s)).toThrow();
    expect(() => decodeSnapshot({ ...fixture(), week: null })).toThrow();
    const dup = fixture();
    dup.items.push(dup.items[0]);
    expect(() => decodeSnapshot(dup)).toThrow();
  });
  test("all per-source states distinct; unknown counts not fabricated", async () => {
    const { app, rpc } = await setup();
    const names = new Set<string>();
    for (const state of [
      "ok",
      "stale",
      "auth",
      "error",
      "config_error",
      "disabled",
      "planned",
      "loading",
      "unknown",
    ] as const) {
      rpc.snapshot.sources[0].state = state;
      await app.poll();
      app.motion = false;
      const view = plain(render(app, 118, 54, 2000));
      if (state === "ok") expect(view).toContain("waiting");
      else if (state === "stale") expect(view).toContain("STALE DATA");
      else {
        const labels = {
          auth: "SIGN IN REQUIRED",
          error: "FETCH FAILED",
          config_error: "CONFIG ERROR",
          disabled: "DISABLED",
          planned: "WIP / NOT CONNECTED",
          loading: "LOADING",
          unknown: "UNKNOWN STATE",
        };
        expect(view).toContain(labels[state]);
        names.add(labels[state]);
        expect(app.snapshot?.counts.bySource.reviews).toBeNull();
      }
    }
    expect(names.size).toBe(7);
  });
});

describe("keys and state transitions", () => {
  test("keys map to actor you and composite item keys", async () => {
    const { app, rpc } = await setup();
    app.selected = "reviews:item-0";
    await app.key("t");
    await app.key("i");
    await app.key("l");
    await app.key("p");
    await app.key("h");
    app.snapshot!.items[0].overlay.handledAt = fixture().at;
    rpc.snapshot.items[0].overlay.handledAt = fixture().at;
    await app.key("h");
    const acts = rpc.calls.filter((c) => c.method === "act").map((c) => c.params);
    expect(acts).toEqual([
      { do: "plan", key: "reviews:item-0", plan: "today", actor: "you" },
      { do: "plan", key: "reviews:item-0", plan: "inbox", actor: "you" },
      { do: "plan", key: "reviews:item-0", plan: "later", actor: "you" },
      { do: "pin", key: "reviews:item-0", pinned: true, actor: "you" },
      { do: "handled", key: "reviews:item-0", actor: "you" },
      { do: "handled", key: "reviews:item-0", undo: true, actor: "you" },
    ]);
    expect(rpc.calls.filter((c) => c.method === "get")).toHaveLength(7);
  });
  test("done/reopen retained in place for this session only, capability gating", async () => {
    const { app, rpc } = await setup();
    app.selected = "reviews:item-0";
    await app.key("x");
    expect(app.message).toContain("does not support");
    app.selected = "scratch:item-6";
    await app.key("x");
    rpc.snapshot.items = rpc.snapshot.items.filter((it) => itemId(it) !== "scratch:item-6");
    await app.poll();
    expect(app.completed.has("scratch:item-6")).toBe(true);
    expect(app.items().some((it) => itemId(it) === "scratch:item-6")).toBe(true);
    await app.key("x");
    expect(rpc.calls.filter((c) => c.method === "act").map((c) => c.params.do)).toEqual([
      "todo.done",
      "todo.reopen",
    ]);
    expect(app.completed.size).toBe(0);
  });
  test("add input, cancel, conflict preserves text and acknowledged submit clears", async () => {
    const { app, rpc } = await setup();
    await app.key("a");
    for (const ch of "new task") await app.key(ch);
    await app.key("Backspace");
    await app.key("k");
    rpc.error = "conflict";
    await app.key("Enter");
    expect(app.input).toBe("new task");
    expect(app.message).toBe("Not saved: conflict");
    expect(plain(render(app, 118, 54, 1000))).toContain("Not saved: conflict");
    rpc.error = null;
    await app.key("Enter");
    expect(app.input).toBeNull();
    expect(rpc.calls.find((c) => c.params.do === "todo.add")?.params).toEqual({
      do: "todo.add",
      text: "new task",
      actor: "you",
    });
    await app.key("a");
    await app.key("Escape");
    expect(app.input).toBeNull();
  });
  test("engine absent and recovery keep last good snapshot, act not sent offline", async () => {
    const { app, rpc } = await setup();
    rpc.error = "engine_not_running";
    await app.poll();
    expect(app.connection).toBe("offline");
    expect(app.snapshot?.items.length).toBe(10);
    expect(plain(render(app, 118, 54, 2000))).toContain("ENGINE OFFLINE / LAST GOOD DATA");
    await app.key("t");
    expect(rpc.calls.filter((c) => c.method === "act")).toHaveLength(0);
    rpc.error = null;
    await app.poll();
    expect(app.connection).toBe("ready");
    expect(app.message).toBe("Reconnected");
    const empty = new App(
      rpc,
      () => 0,
      () => {},
    );
    rpc.error = "engine_not_running";
    await empty.poll();
    expect(plain(render(empty, 80, 24, 0))).toContain("ENGINE OFFLINE");
  });
  test("focus look holds fresh flags until blur, no read-only writes", async () => {
    const { app, rpc } = await setup();
    app.focus(true);
    await Bun.sleep(5);
    expect(rpc.calls.some((c) => c.params.do === "look")).toBe(true);
    for (const it of rpc.snapshot.items) it.derived.fresh = false;
    await app.poll();
    expect(app.isFresh(app.snapshot!.items[0])).toBe(true);
    app.focus(false);
    expect(app.isFresh(app.snapshot!.items[0])).toBe(false);
    const ro = new App(
      rpc,
      () => 0,
      () => {},
      true,
    );
    await ro.poll();
    const count = rpc.calls.length;
    ro.focus(true);
    await ro.key("r");
    await ro.key("t");
    expect(rpc.calls.length).toBe(count);
  });
  test("URL validation, filtering, sorting and navigation", async () => {
    const { app } = await setup();
    app.selected = "reviews:item-0";
    expect(await app.key("Enter")).toBe("https://example.com/items/1");
    app.snapshot!.items[0].url = "file:///tmp/private";
    expect(await app.key("Enter")).toBeUndefined();
    await app.key("2");
    expect(app.filter).toBe("scratch");
    await app.key("s");
    expect(app.sort).toBe("type");
    await app.key("j");
    expect(app.selected).toContain("scratch:");
  });
});

describe("render and terminal input", () => {
  test("type resolver, inverse stale bar, real week mapping and motion off", async () => {
    expect(typeColor("bad")).toBe(typeColor("type.todo"));
    expect(paint(stalenessBar(1), "none")).toBe("━━━━━━━━");
    expect(paint(stalenessBar(0), "none")).toBe("────────");
    const { app } = await setup();
    app.motion = false;
    const a = render(app, 118, 54, 1000),
      b = render(app, 118, 54, 5000);
    expect(plain(a)).toEqual(plain(b));
    expect(plain(a)).toContain("14 fewer than last week so far");
    expect(plain(a)).toContain("WIP / NOT CONNECTED");
    expect(diffFrame(a, a)).toBe("");
    expect(diffFrame(a, null)).toContain("38;2;");
    expect(hitAt(a, 3, 11)).toEqual({ filter: "reviews" });
  });
  test("narrow/short/resize bounded and hostile display text escaped", async () => {
    const { app } = await setup();
    app.snapshot!.items[0].title = "evil\x1b[2J好";
    app.motion = false;
    for (const [w, h] of [
      [1, 1],
      [23, 7],
      [24, 8],
      [48, 20],
      [85, 24],
      [118, 54],
      [160, 54],
    ]) {
      const frame = render(app, w, h, 2000);
      expect(frame.lines).toHaveLength(h);
      for (const line of frame.lines)
        expect(line.reduce((n, s) => n + Array.from(s.text).length, 0)).toBe(w);
      expect(plain(frame)).not.toContain("\x1b");
    }
  });
  test("fragmented/coalesced keys, focus and SGR mouse, ignored reports and escapes", () => {
    const p = new Input();
    expect(p.feed("\x1b[<0;42;")).toEqual([]);
    expect(p.feed("6Mjs")).toEqual([
      { type: "mouse", x: 41, y: 5, hover: false },
      { type: "key", key: "j" },
      { type: "key", key: "s" },
    ]);
    expect(p.feed("\x1b[A\x1b[I\x1b[O")).toEqual([
      { type: "key", key: "ArrowUp" },
      { type: "focus", on: true },
      { type: "focus", on: false },
    ]);
    expect(p.feed("\x1b[<35;3;4M\x1b[<0;3;4m\x1b[<64;3;4M")).toEqual([
      { type: "mouse", x: 2, y: 3, hover: true },
    ]);
    p.feed("\x1b");
    expect(p.flushEscape()).toEqual([{ type: "key", key: "Escape" }]);
    expect(p.feed("\x1b[" + "1".repeat(500))).toEqual([]);
    expect(p.feed("123M")).toEqual([]);
    expect(p.feed("q")).toEqual([{ type: "key", key: "q" }]);
    expect(p.feed("\x1b[<0;\x03")).toEqual([{ type: "key", key: "\x03" }]);
    expect(p.feed("\x1b[<0;\x1b[A")).toEqual([{ type: "key", key: "ArrowUp" }]);
  });
});

test("bounded fake Unix socket integration: fragmentation, absent, typed error, timeout, cancel and read-only", async () => {
  const dir = mkdtempSync("/tmp/df-test-"),
    path = join(dir, "feed.sock");
  let mode = "get";
  const seen: string[] = [];
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\n")) return;
      const req = JSON.parse(buffer) as { id: number; method: string };
      seen.push(req.method);
      if (mode === "timeout") return;
      const reply =
        mode === "error"
          ? {
              jsonrpc: "2.0",
              id: req.id,
              error: {
                _tag: "Cause",
                code: null,
                message: "conflict",
                data: [
                  {
                    _tag: "Fail",
                    error: {
                      _tag: "CollectorError",
                      code: "conflict",
                      message: "fixture conflict",
                    },
                  },
                ],
              },
            }
          : {
              jsonrpc: "2.0",
              id: req.id,
              ...(req.method === "refresh" ? {} : { result: fixture() }),
            };
      const bytes = Buffer.from(JSON.stringify(reply) + "\n");
      socket.write(bytes.subarray(0, 53));
      setTimeout(() => socket.end(bytes.subarray(53)), 3);
    });
  });
  await new Promise<void>((resolve) => server.listen(path, resolve));
  try {
    const c = new FeedClient(path, false, 30);
    expect(decodeSnapshot(await c.request("get")).items).toHaveLength(10);
    await c.request("refresh");
    mode = "error";
    await rejectsCode(c.request("act", { do: "todo.add" }), "conflict");
    mode = "timeout";
    await rejectsCode(c.request("get"), "timeout");
    await rejectsCode(c.request("act"), "outcome_unknown");
    const pending = c.request("get");
    c.close();
    await rejectsCode(pending, "disconnected");
    const ro = new FeedClient(path, true);
    await rejectsCode(ro.request("act"), "read_only");
    await rejectsCode(ro.request("refresh"), "read_only");
    ro.close();
    const missing = new FeedClient(join(dir, "absent.sock"));
    await rejectsCode(missing.request("get"), "engine_not_running");
    missing.close();
    expect(seen).toContain("get");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true });
  }
});

async function rejectsCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
    throw new Error("expected rejection");
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

test("todo.add selects existing item only for multiple lists; empty target is unsupported", async () => {
  const { app, rpc } = await setup();
  rpc.snapshot.sources[0].writable = ["todo.add"];
  await app.poll();
  app.filter = "scratch";
  await app.key("a");
  await app.key("n");
  await app.key("Enter");
  expect(rpc.calls.find((c) => c.params.do === "todo.add")?.params.key).toBe("scratch:item-6");
  rpc.calls = [];
  rpc.snapshot.items = rpc.snapshot.items.filter((it) => it.source !== "scratch");
  await app.poll();
  await app.key("a");
  await app.key("n");
  await app.key("Enter");
  expect(app.message).toBe("Can't choose a to-do list");
  expect(app.input).toBe("n");
  expect(rpc.calls.filter((c) => c.method === "act")).toHaveLength(0);
});

test("draft source removal cannot redirect an add, and done rows must reopen before triage", async () => {
  const { app, rpc } = await setup();
  await app.key("a");
  await app.key("n");
  rpc.snapshot.sources = rpc.snapshot.sources.filter((s) => s.id !== "scratch");
  rpc.snapshot.items = rpc.snapshot.items.filter((it) => it.source !== "scratch");
  await app.poll();
  await app.key("Enter");
  expect(app.message).toBe("Selected to-do list is unavailable");
  expect(app.input).toBe("n");
  expect(rpc.calls.filter((c) => c.method === "act")).toHaveLength(0);
  const next = await setup();
  next.app.selected = "scratch:item-6";
  await next.app.key("x");
  const count = next.rpc.calls.length;
  await next.app.key("p");
  expect(next.app.message).toBe("Reopen this to-do before triage");
  expect(next.rpc.calls.length).toBe(count);
});

test("bounded bracketed paste is literal draft text, never commands or implicit submission", async () => {
  const input = new Input();
  expect(input.feed("\x1b[200~h\nx\x1b[20")).toEqual([]);
  expect(input.feed("1~")).toEqual([{ type: "paste", text: "h\nx" }]);
  const { app, rpc } = await setup();
  app.paste("p\nx");
  expect(rpc.calls.filter((c) => c.method === "act")).toHaveLength(0);
  await app.key("a");
  app.paste("one\ntwo\tthree");
  expect(app.input).toBe("one two three");
  expect(rpc.calls.filter((c) => c.method === "act")).toHaveLength(0);
  await app.key("Enter");
  expect(rpc.calls.find((c) => c.params.do === "todo.add")?.params.text).toBe("one two three");
});

test("legal source id all never collides with the all-sources filter", async () => {
  const { app, rpc } = await setup();
  rpc.snapshot.sources[0].id = "all";
  rpc.snapshot.items = rpc.snapshot.items.map((it) => ({
    ...it,
    source: it.source === "reviews" ? "all" : it.source,
  }));
  rpc.snapshot.counts.bySource.all = rpc.snapshot.counts.bySource.reviews;
  delete rpc.snapshot.counts.bySource.reviews;
  await app.poll();
  await app.key("1");
  expect(app.visible()).toHaveLength(6);
  await app.key("0");
  expect(app.visible()).toHaveLength(10);
  const bad = fixture();
  bad.items[0].key = "";
  expect(() => decodeSnapshot(bad)).toThrow();
});
