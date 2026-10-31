import { expect, test } from "bun:test";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createConnection, createServer } from "node:net";
import { acquireInstance } from "../src/instance.ts";
import { decode, Snapshot } from "../src/contract.ts";
import { renderPlist, inspectService, service } from "../src/service.ts";
import { Effect, Schema } from "effect";
import { BunServices } from "@effect/platform-bun";
const entry = resolve("bin/source-collector.ts");
const testPath = `${dirname(process.execPath)}:/usr/bin:/bin`;
async function cli(root: string, ...args: string[]) {
  const p = Bun.spawn([process.execPath, entry, ...args], {
    env: {
      ...process.env,
      HOME: root,
      PATH: testPath,
      SOURCE_COLLECTOR_HOME: join(root, "runtime"),
      SOURCE_COLLECTOR_CONFIG: join(root, "config"),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    p.exited,
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ]);
  return { code, stdout, stderr };
}
function raw(path: string, method: string, params: unknown = {}) {
  return new Promise<unknown>((resolve, reject) => {
    const socket = createConnection(path);
    let text = "";
    socket.setTimeout(3000, () => socket.destroy(new Error("RPC timed out")));
    socket.on("error", reject);
    socket.on("connect", () =>
      socket.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) + "\n"),
    );
    socket.on("data", (chunk) => {
      text += chunk.toString();
      if (text.includes("\n")) {
        socket.end();
        resolve(JSON.parse(text.split("\n")[0]));
      }
    });
  });
}
test("CLI engine-not-running is exit 1, never success-shaped empty data", async () => {
  const root = mkdtempSync("/tmp/sc-cli-");
  try {
    for (const args of [
      ["get"],
      ["get", "--items"],
      ["plan", "fake:one", "today"],
      ["pin", "fake:one"],
      ["handled", "fake:one"],
      ["look"],
      ["action", "fake:one", "open"],
    ]) {
      const result = await cli(root, ...args);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("engine not running");
    }
    const invalid = await cli(root, "plan", "fake:one", "tomorrow");
    expect(invalid.code).toBe(2);
    expect(invalid.stdout).toBe("");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("offline checklist check reports its real raw size without engine or store", async () => {
  const root = mkdtempSync("/tmp/sc-check-");
  try {
    cpSync(resolve("examples"), join(root, "config"), { recursive: true });
    const result = await cli(root, "check", join(root, "config/sources/todo"));
    expect(result.code).toBe(0);
    const diagnostic = JSON.parse(result.stdout);
    expect(diagnostic.rawSize).toBe(
      Buffer.byteLength(readFileSync(join(root, "config/sources/todo/checklist.md"), "utf8")),
    );
    expect(diagnostic.output.items).toHaveLength(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("single-instance exclusive SQLite lock refuses second runner, releases cleanly", () => {
  const root = mkdtempSync("/tmp/sc-instance-");
  try {
    const release = acquireInstance(root);
    try {
      expect(() => acquireInstance(root)).toThrow();
    } finally {
      release();
    }
    const again = acquireInstance(root);
    again();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("launchd plist exact bytes, clean env, installation ownership and no activation", () => {
  const root = mkdtempSync("/tmp/sc-service-");
  const c = {
    home: root,
    runtime: join(root, "runtime"),
    config: join(root, "config"),
    bun: "/opt/bin/bun",
    entry: "/opt/collector/bin/source-collector.ts",
    path: "/opt/bin:/usr/bin:/bin",
    uid: process.getuid!(),
  };
  try {
    const bytes = renderPlist(c);
    expect(bytes).toBe(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>works.industrial-os.source-collector</string>\n<key>ProgramArguments</key><array><string>/usr/bin/env</string><string>-i</string><string>HOME=${root}</string><string>PATH=/opt/bin:/usr/bin:/bin</string><string>SOURCE_COLLECTOR_HOME=${root}/runtime</string><string>SOURCE_COLLECTOR_CONFIG=${root}/config</string><string>/opt/bin/bun</string><string>/opt/collector/bin/source-collector.ts</string><string>run</string></array>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><false/>\n<key>EnableGlobbing</key><false/>\n<key>Umask</key><integer>63</integer>\n</dict></plist>\n`,
    );
    expect(inspectService(c).installed).toBe(false);
    const folder = join(root, "Library/LaunchAgents");
    mkdirSync(folder, { recursive: true });
    const path = join(folder, "works.industrial-os.source-collector.plist");
    writeFileSync(path, bytes, { mode: 0o600 });
    expect(inspectService({ ...c, path: "/different/bin" }).installed).toBe(true);
    expect(inspectService({ ...c, path: "/different/bin" }).drift).toBe(true);
    writeFileSync(path, "foreign");
    expect(() => inspectService(c)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("mocked launchd install never starts, uninstall preserves runtime data", async () => {
  const root = mkdtempSync("/tmp/sc-native-");
  const c = {
    home: root,
    runtime: join(root, "runtime"),
    config: join(root, "config"),
    bun: "/opt/bin/bun",
    entry: "/opt/collector/bin/source-collector.ts",
    path: "/usr/bin:/bin",
    uid: process.getuid!(),
  };
  const calls: string[][] = [];
  const native = (argv: string[]) =>
    Effect.sync(() => {
      calls.push(argv);
      return 113;
    });
  try {
    mkdirSync(c.runtime);
    writeFileSync(join(c.runtime, "keep"), "local data");
    await Effect.runPromise(service("install", c, native).pipe(Effect.provide(BunServices.layer)));
    expect(calls.map((a) => a[0])).toEqual(["print"]);
    expect(inspectService(c).installed).toBe(true);
    await Effect.runPromise(
      service("uninstall", c, native).pipe(Effect.provide(BunServices.layer)),
    );
    expect(calls.map((a) => a[0])).toEqual(["print", "print"]);
    expect(inspectService(c).installed).toBe(false);
    expect(readFileSync(join(c.runtime, "keep"), "utf8")).toBe("local data");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("real Unix RPC: raw JSON-RPC, typed CLI, acts, refresh, reload, auth, disable and drain", async () => {
  const root = mkdtempSync("/tmp/sc-rpc-");
  cpSync(resolve("examples"), join(root, "config"), { recursive: true });
  const displayTitle = "Fake title\nwith tab\tand escape\u001b[31m and C1\u009b";
  const fetchFile = join(root, "config/sources/fake/fetch.ts");
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  lastWeek.setMinutes(lastWeek.getMinutes() - 1);
  writeFileSync(
    fetchFile,
    readFileSync(fetchFile, "utf8")
      .replace(JSON.stringify("Try the collector"), JSON.stringify(displayTitle))
      .replace(
        "v: 1,",
        `v: 1, shipped: [{key: 'previous', at: '${lastWeek.toISOString()}', actor: 'agent'}],`,
      ),
  );
  mkdirSync(join(root, "runtime"), { mode: 0o700 });
  let engine = Bun.spawn([process.execPath, entry, "run"], {
    env: {
      ...process.env,
      HOME: root,
      PATH: testPath,
      SOURCE_COLLECTOR_HOME: join(root, "runtime"),
      SOURCE_COLLECTOR_CONFIG: join(root, "config"),
    },
    stdout: "ignore",
    stderr: "pipe",
  });
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try {
        const s = (await raw(join(root, "runtime/feed.sock"), "status")) as {
          result: { active: number };
        };
        if (s.result.active === 0) {
          ready = true;
          break;
        }
      } catch {}
      await Bun.sleep(30);
    }
    if (!ready) throw new Error("Engine did not become ready");
    const lifecycle = readFileSync(join(root, "runtime/log/collector.log"), "utf8");
    expect(lifecycle).toContain("engine ready");
    expect(lifecycle).toContain("run complete");
    expect(statSync(join(root, "runtime/log/collector.log")).mode & 0o777).toBe(0o600);
    expect(statSync(join(root, "runtime/feed.sock")).mode & 0o777).toBe(0o600);
    expect(statSync(join(root, "runtime")).mode & 0o777).toBe(0o700);
    const json = (await raw(join(root, "runtime/feed.sock"), "get")) as {
      jsonrpc: string;
      id: number;
      result: { v: number; rev: number; items: { source: string; key: string }[] };
    };
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(1);
    expect(json.result.v).toBe(1);
    expect(json.result.items).toHaveLength(4);
    const scopedGet = async (sources?: unknown) => {
      const reply = (await raw(
        join(root, "runtime/feed.sock"),
        "get",
        sources === undefined ? {} : { sources },
      )) as { result: unknown };
      return decode(Schema.toCodecJson(Snapshot), reply.result);
    };
    const all = await scopedGet();
    const scoped = await scopedGet(["todo", "fake", "todo", "unknown id"]);
    expect(scoped.sources.map((s) => s.id)).toEqual(
      all.sources.filter((s) => ["todo", "fake"].includes(s.id)).map((s) => s.id),
    );
    expect(scoped.items.map((i) => ({ source: i.source, key: i.key, overlay: i.overlay }))).toEqual(
      all.items
        .filter((i) => ["todo", "fake"].includes(i.source))
        .map((i) => ({ source: i.source, key: i.key, overlay: i.overlay })),
    );
    expect(Object.keys(scoped.counts.bySource)).toEqual(scoped.sources.map((s) => s.id));
    expect(scoped.counts.plan).toEqual({ today: 0, inbox: 3, later: 0 });
    expect(scoped.rev).toBe(all.rev);
    expect(scoped.staleLimitMs).toBe(all.staleLimitMs);
    expect(scoped.alerts).toEqual(all.alerts);
    expect(all.week.lastWeekSoFar).toEqual({ you: 0, agents: 1 });
    expect(scoped.week.lastWeekSoFar).toEqual(all.week.lastWeekSoFar);
    const empty = await scopedGet(["unknown id"]);
    expect(empty.sources).toEqual([]);
    expect(empty.items).toEqual([]);
    expect(empty.counts).toEqual({ plan: { today: 0, inbox: 0, later: 0 }, bySource: {} });
    expect(empty.week.total).toEqual({ you: 0, agents: 0 });
    expect(empty.week.lastWeekSoFar).toEqual({ you: 0, agents: 0 });
    expect((await scopedGet(Array(256).fill("todo"))).sources.map((s) => s.id)).toEqual(["todo"]);
    for (const invalid of [[], "todo", null, [1], Array(257).fill("todo")]) {
      const reply = (await raw(join(root, "runtime/feed.sock"), "get", { sources: invalid })) as {
        error: unknown;
      };
      expect(reply.error).toBeDefined();
    }
    const get = await cli(root, "get");
    expect(get.code).toBe(0);
    expect(JSON.parse(get.stdout).rev).toBe(json.result.rev);
    const lines = await cli(root, "get", "--items");
    expect(lines.code).toBe(0);
    const rows = lines.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(rows).toHaveLength(4);
    expect(rows[0].title).toBe(displayTitle);
    expect(
      Array.from(lines.stdout).every((char) => {
        const code = char.charCodeAt(0);
        return code === 10 || (code >= 32 && (code < 127 || code > 159));
      }),
    ).toBe(true);
    expect(rows[0]).toMatchObject({
      v: 1,
      plan: "inbox",
      pinned: false,
      handled: false,
      state: "ok",
    });
    expect(rows[0].key).toBe(`${json.result.items[0].source}:${json.result.items[0].key}`);
    const item = json.result.items.find((i) => i.source === "todo")!;
    const key = `todo:${item.key}`;
    expect((await cli(root, "plan", key, "today", "--agent", "test-session")).code).toBe(0);
    expect((await cli(root, "pin", key, "--agent")).code).toBe(0);
    expect((await cli(root, "handled", key)).code).toBe(0);
    expect((await cli(root, "look", "--agent=test-session")).code).toBe(0);
    const overlaySnapshot = JSON.parse((await cli(root, "get")).stdout);
    expect(overlaySnapshot.lastLookAt).toBeString();
    expect(
      overlaySnapshot.items.find(
        (i: { source: string; key: string }) => `${i.source}:${i.key}` === key,
      ).overlay,
    ).toMatchObject({ plan: "today", pinned: true, handledAt: expect.any(String) });
    expect((await cli(root, "handled", key, "--undo")).code).toBe(0);
    expect((await cli(root, "pin", key, "--off")).code).toBe(0);
    expect((await cli(root, "todo", "done", key, "--agent", "test-session")).code).toBe(0);
    type Row = {
      source: string;
      key: string;
      title: string;
      doneAt?: string;
      derived: { done: boolean; stale: boolean };
    };
    const find = (snapshot: { items: Row[] }, id: string) =>
      snapshot.items.find((i) => `${i.source}:${i.key}` === id);
    const after = JSON.parse((await cli(root, "get")).stdout);
    // A done to-do stays until local midnight, flagged and excluded from every count.
    expect(after.items).toHaveLength(4);
    expect(find(after, key)?.derived.done).toBe(true);
    expect(find(after, key)?.doneAt).toBeString();
    expect(after.counts.bySource.todo.total).toBe(1);
    expect(after.week.total.you).toBe(1);
    const todoOnly = await scopedGet(["todo"]);
    const fakeOnly = await scopedGet(["fake"]);
    expect(todoOnly.lastLookAt).toBe(after.lastLookAt);
    expect(fakeOnly.lastLookAt).toBe(after.lastLookAt);
    expect(todoOnly.week.total).toEqual(after.week.total);
    expect(todoOnly.week.lastWeekSoFar).toEqual({ you: 0, agents: 0 });
    expect(fakeOnly.week.lastWeekSoFar).toEqual({ you: 0, agents: 1 });
    expect(todoOnly.week.blocks).toEqual(after.week.blocks);
    expect(fakeOnly.week.total).toEqual({ you: 0, agents: 0 });
    expect(fakeOnly.week.blocks.every((b) => b.you === 0 && b.agents === 0)).toBe(true);
    expect(todoOnly.counts).toEqual({
      plan: { today: 0, inbox: 1, later: 0 },
      bySource: { todo: after.counts.bySource.todo },
    });
    const doneLines = (await cli(root, "get", "--items")).stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(doneLines.find((row) => row.key === key)?.done).toBe(true);
    expect(doneLines.filter((row) => row.done)).toHaveLength(1);
    expect((await cli(root, "todo", "reopen", key)).code).toBe(0);
    const reopened = JSON.parse((await cli(root, "get")).stdout);
    expect(find(reopened, key)?.derived.done).toBe(false);
    expect(find(reopened, key)?.doneAt).toBeUndefined();
    expect(reopened.counts.bySource.todo.total).toBe(2);
    // Reopened the same day while still open: that shipment leaves the week strip.
    expect(reopened.week.total.you).toBe(0);
    expect((await cli(root, "todo", "add", "Added by test", "--section", "Inbox")).code).toBe(0);
    const todoPath = join(root, "config/sources/todo/checklist.md");
    writeFileSync(
      todoPath,
      readFileSync(todoPath, "utf8").replace("- [ ] Added by test", "- [x] Added by test"),
    );
    await Bun.sleep(300); // directory watch survives the engine's preceding atomic rename
    const watched = JSON.parse((await cli(root, "get")).stdout);
    const handDone = watched.items.find((i: Row) => i.title === "Added by test") as Row;
    expect(handDone.derived.done).toBe(true);
    expect(watched.items.some((i: Row) => i.title === "Already finished")).toBe(false);
    expect(watched.week.total.you).toBe(1);
    // todo.add names its checklist; anything but an available checklist is invalid input.
    expect((await cli(root, "todo", "add", "Sourced add", "--source", "todo")).code).toBe(0);
    for (const bad of ["nope", "fake", "jq"]) {
      const result = await cli(root, "todo", "add", "Rejected", "--source", bad);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain("invalid_input");
    }
    expect((await cli(root, "disable", "todo")).code).toBe(0);
    const disabledAdd = await cli(root, "todo", "add", "Rejected", "--source", "todo");
    expect(disabledAdd.code).toBe(2);
    expect(disabledAdd.stderr).toContain("invalid_input");
    expect((await cli(root, "enable", "todo")).code).toBe(0);
    const sourced = JSON.parse((await cli(root, "get")).stdout);
    expect(sourced.items.some((i: Row) => i.title === "Sourced add")).toBe(true);
    expect(sourced.items.some((i: Row) => i.title === "Rejected")).toBe(false);
    const misplaced = (await raw(join(root, "runtime/feed.sock"), "act", {
      do: "todo.done",
      key,
      source: "todo",
      actor: "you",
    })) as { error: unknown };
    expect(misplaced.error).toBeDefined();
    expect((await cli(root, "refresh", "fake")).code).toBe(0);
    expect((await cli(root, "disable", "fake")).code).toBe(0);
    const disabled = JSON.parse((await cli(root, "get")).stdout);
    expect(disabled.sources.find((s: { id: string }) => s.id === "fake").state).toBe("disabled");
    expect(disabled.counts.bySource.fake).toBeNull();
    const disabledScope = await scopedGet(["fake"]);
    expect(disabledScope.sources.map((s) => s.state)).toEqual(["disabled"]);
    expect(disabledScope.counts.bySource).toEqual({ fake: null });
    expect(disabledScope.counts.plan).toEqual({ today: 0, inbox: 0, later: 0 });
    expect((await cli(root, "enable", "fake")).code).toBe(0);
    const duplicate = await cli(root, "run");
    expect(duplicate.code).toBe(8);
    const invalid = (await raw(join(root, "runtime/feed.sock"), "act", {
      do: "pin",
      actor: "you",
    })) as { error: unknown };
    expect(invalid.error).toBeDefined();
    const sourcePath = join(root, "config/sources/fake/source.json");
    const cfg = JSON.parse(readFileSync(sourcePath, "utf8"));
    cfg.planned = true;
    writeFileSync(sourcePath, JSON.stringify(cfg));
    await Bun.sleep(1200);
    const planned = JSON.parse((await cli(root, "get")).stdout);
    expect(planned.sources.find((s: { id: string }) => s.id === "fake").state).toBe("planned");
    cfg.planned = false;
    cfg.fetch = [
      process.execPath,
      "-e",
      `console.log(JSON.stringify({v:1,status:'auth',message:'Sign in locally',items:[]}))`,
    ];
    writeFileSync(sourcePath, JSON.stringify(cfg));
    await Bun.sleep(1200);
    expect((await cli(root, "refresh", "fake")).code).toBe(0);
    await Bun.sleep(100);
    const auth = JSON.parse((await cli(root, "get")).stdout);
    expect(auth.sources.find((s: { id: string }) => s.id === "fake").state).toBe("auth");
    expect(auth.counts.bySource.fake).toBeNull();
    expect(auth.items.some((i: { source: string }) => i.source === "fake")).toBe(false);
    expect((await cli(root, "service", "stop")).code).toBe(0);
    expect(await engine.exited).toBe(0);
    // Stored items are served stale while the first post-restart read is still running.
    const jqPath = join(root, "config/sources/jq/source.json");
    const jqConfig = JSON.parse(readFileSync(jqPath, "utf8"));
    delete jqConfig.transform;
    jqConfig.fetch = [
      process.execPath,
      "-e",
      `await Bun.sleep(1200);console.log(JSON.stringify({v:1,items:[{key:'one',title:'After restart',since:'2026-10-20T12:00:00Z'}]}))`,
    ];
    writeFileSync(jqPath, JSON.stringify(jqConfig));
    engine = Bun.spawn([process.execPath, entry, "run"], {
      env: {
        ...process.env,
        HOME: root,
        PATH: testPath,
        SOURCE_COLLECTOR_HOME: join(root, "runtime"),
        SOURCE_COLLECTOR_CONFIG: join(root, "config"),
      },
      stdout: "ignore",
      stderr: "pipe",
    });
    let restarted:
      | { result: { sources: { id: string; state: string }[]; items: { source: string }[] } }
      | undefined;
    for (let n = 0; n < 50; n++) {
      try {
        restarted = (await raw(join(root, "runtime/feed.sock"), "get")) as typeof restarted;
        if (restarted) break;
      } catch {}
      await Bun.sleep(20);
    }
    expect(restarted?.result.sources.find((s) => s.id === "jq")?.state).toBe("stale");
    expect(restarted?.result.items.some((i) => i.source === "jq")).toBe(true);
    // The done to-do survives a restart, and the first reread does not refake its completion.
    let reread: { sources: { id: string; state: string }[]; items: Row[] } | undefined;
    for (let n = 0; n < 100; n++) {
      reread = JSON.parse((await cli(root, "get")).stdout);
      if (reread?.sources.find((s) => s.id === "todo")?.state === "ok") break;
      await Bun.sleep(30);
    }
    expect(reread?.sources.find((s) => s.id === "todo")?.state).toBe("ok");
    const survived = reread?.items.find((i) => i.title === "Added by test");
    expect(survived?.derived.done).toBe(true);
    expect(survived?.doneAt).toBe(handDone.doneAt);
    expect((await cli(root, "service", "stop")).code).toBe(0);
    expect(await engine.exited).toBe(0);
  } finally {
    if (engine.exitCode === null) {
      engine.kill("SIGTERM");
      await engine.exited;
    }
    await new Response(engine.stderr).text();
    rmSync(root, { recursive: true, force: true });
  }
}, 20000);

test("overlay and action CLI commands map exactly to act with caller attribution", async () => {
  const root = mkdtempSync("/tmp/sc-map-");
  mkdirSync(join(root, "runtime"));
  const calls: unknown[] = [];
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes("\n")) {
        const end = buffer.indexOf("\n");
        const message = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        calls.push({ method: message.method, params: message.params });
        socket.write(
          JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { rev: 42 } }) + "\n",
        );
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(join(root, "runtime/feed.sock"), resolve));
  try {
    const cases: { args: string[]; input: Record<string, unknown> }[] = [
      {
        args: ["plan", "fake:one", "today"],
        input: { do: "plan", key: "fake:one", plan: "today" },
      },
      {
        args: ["plan", "fake:one", "inbox"],
        input: { do: "plan", key: "fake:one", plan: "inbox" },
      },
      {
        args: ["plan", "fake:one", "later"],
        input: { do: "plan", key: "fake:one", plan: "later" },
      },
      { args: ["pin", "fake:one"], input: { do: "pin", key: "fake:one", pinned: true } },
      { args: ["pin", "fake:one", "--off"], input: { do: "pin", key: "fake:one", pinned: false } },
      { args: ["handled", "fake:one"], input: { do: "handled", key: "fake:one", undo: false } },
      {
        args: ["handled", "fake:one", "--undo"],
        input: { do: "handled", key: "fake:one", undo: true },
      },
      { args: ["look"], input: { do: "look" } },
      {
        args: ["action", "fake:one", "open"],
        input: { do: "action", key: "fake:one", action: "open" },
      },
    ];
    for (const { args, input } of cases) {
      for (const attribution of [[], ["--agent"], ["--agent", "test-session"]]) {
        const result = await cli(root, ...args, ...attribution);
        expect(result.code).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual({ rev: 42 });
        expect(result.stderr).toBe("");
        expect(calls.pop()).toEqual({
          method: "act",
          params: {
            ...input,
            actor: attribution.length ? "agent" : "you",
            ...(attribution.length === 2 ? { agent: "test-session" } : {}),
          },
        });
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
