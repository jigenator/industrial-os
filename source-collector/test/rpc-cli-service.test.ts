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
import { createConnection } from "node:net";
import { acquireInstance } from "../src/instance.ts";
import { renderPlist, inspectService, service } from "../src/service.ts";
import { Effect } from "effect";
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
    const result = await cli(root, "get");
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("engine not running");
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
    const get = await cli(root, "get");
    expect(get.code).toBe(0);
    expect(JSON.parse(get.stdout).rev).toBe(json.result.rev);
    const item = json.result.items.find((i) => i.source === "todo")!;
    const key = `todo:${item.key}`;
    expect((await cli(root, "todo", "done", key, "--agent", "test-session")).code).toBe(0);
    const after = JSON.parse((await cli(root, "get")).stdout);
    expect(after.items).toHaveLength(3);
    expect(after.week.total.you).toBe(1);
    expect((await cli(root, "todo", "reopen", key)).code).toBe(0);
    expect((await cli(root, "todo", "add", "Added by test", "--section", "Inbox")).code).toBe(0);
    const todoPath = join(root, "config/sources/todo/checklist.md");
    writeFileSync(
      todoPath,
      readFileSync(todoPath, "utf8").replace("- [ ] Added by test", "- [x] Added by test"),
    );
    await Bun.sleep(300); // directory watch survives the engine's preceding atomic rename
    const watched = JSON.parse((await cli(root, "get")).stdout);
    expect(watched.items.some((i: { title: string }) => i.title === "Added by test")).toBe(false);
    expect(watched.week.total.you).toBe(2);
    expect((await cli(root, "refresh", "fake")).code).toBe(0);
    expect((await cli(root, "disable", "fake")).code).toBe(0);
    const disabled = JSON.parse((await cli(root, "get")).stdout);
    expect(disabled.sources.find((s: { id: string }) => s.id === "fake").state).toBe("disabled");
    expect(disabled.counts.bySource.fake).toBeNull();
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
