import { expect, test } from "bun:test";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { FeedClient } from "../src/transport.ts";
import { fixture } from "./fixture.ts";

test("include list reaches every get, never other RPCs; plain flag overrides env", async () => {
  const home = mkdtempSync("/tmp/df-sources-");
  const path = join(home, "feed.sock");
  const seen: { method: string; params: Record<string, unknown> }[] = [];
  const server = createServer((socket) => {
    let buffer = "";
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\n")) return;
      const request = JSON.parse(buffer.split("\n")[0]);
      seen.push(request);
      socket.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: request.method === "get" ? fixture() : { rev: 4 },
        }) + "\n",
      );
    });
  });
  await new Promise<void>((done) => server.listen(path, done));
  const run = async (args: string[], sources?: string) => {
    const child = Bun.spawn([process.execPath, resolve("bin/dispatch-feed.ts"), ...args], {
      env: {
        ...process.env,
        HOME: home,
        SOURCE_COLLECTOR_HOME: home,
        HERDR_SOCKET_PATH: join(home, "not-herdr.sock"),
        DISPATCH_FEED_SOURCES: sources,
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    return { code, out, err };
  };
  try {
    const client = new FeedClient(path, false, 3000, ["scratch", "reviews"]);
    try {
      await client.request("get");
      await client.request("get");
      await client.request("act", { do: "look", actor: "you" });
      await client.request("refresh");
      expect(seen.map(({ method, params }) => ({ method, params }))).toEqual([
        { method: "get", params: { sources: ["scratch", "reviews"] } },
        { method: "get", params: { sources: ["scratch", "reviews"] } },
        { method: "act", params: { do: "look", actor: "you" } },
        { method: "refresh", params: {} },
      ]);
    } finally {
      client.close();
    }
    const cases: [string[], string | undefined, Record<string, unknown>][] = [
      [[], undefined, {}],
      [[], " , , ", {}],
      [[], " scratch, reviews, ,scratch ", { sources: ["scratch", "reviews", "scratch"] }],
      [
        ["--sources", " reviews, scratch, ,reviews "],
        "other",
        { sources: ["reviews", "scratch", "reviews"] },
      ],
      [["--sources", " , "], "other", {}],
      [["--sources", ""], "other", {}],
    ];
    for (const [args, env, params] of cases) {
      seen.length = 0;
      const { code, out, err } = await run(["--plain", ...args], env);
      expect(code).toBe(0);
      expect(err).toBe("");
      expect(out).toContain("PULL REQUESTS");
      expect(seen.map(({ method, params }) => ({ method, params }))).toEqual([
        { method: "get", params },
      ]);
    }
    for (const args of [["--sources"], ["--sources", "--plain"]]) {
      seen.length = 0;
      const { code, out } = await run(args);
      expect(code).toBe(1);
      expect(out).toBe("");
      expect(seen).toEqual([]);
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(home, { recursive: true, force: true });
  }
});
