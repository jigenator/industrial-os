import { expect, test } from "bun:test";
import { Effect } from "effect";
import { BunServices } from "@effect/platform-bun";
import { resolve } from "node:path";
import { runCommand, actionArgv, execute, Capture } from "../src/command.ts";
import { type SourceConfig } from "../src/contract.ts";
const run = <A, E>(
  e: Effect.Effect<A, E, import("effect/process/ChildProcessSpawner").ChildProcessSpawner>,
) => Effect.runPromise(e.pipe(Effect.provide(BunServices.layer)));
const config = (
  script: string,
  extra: Partial<Extract<SourceConfig, { type: "command" }>> = {},
): SourceConfig => ({
  id: "test",
  label: "Test",
  tag: "T",
  type: "command",
  fetch: [process.execPath, "-e", script],
  ...extra,
});
const folder = resolve(".");
test("command success: closed stdin, minimal env and source/run markers", async () => {
  const script = `if (Object.keys(process.env).some(k => k === 'SC_TEST_SECRET')) process.exit(1); const t = await Bun.stdin.text(); console.log(JSON.stringify({v:1,items:[{key:process.env.SOURCE_COLLECTOR_SOURCE_ID,title:process.env.SOURCE_COLLECTOR_RUN_ID+':'+t.length,since:'2026-01-01T00:00:00Z'}]}))`;
  process.env.SC_TEST_SECRET = "not forwarded";
  try {
    const result = await run(runCommand(config(script), folder, "run"));
    expect(result.output.items[0].key).toBe("test");
    expect(result.output.items[0].title).toBe("run:0");
  } finally {
    delete process.env.SC_TEST_SECRET;
  }
});
test("command nonzero keeps only first trimmed stderr line; malformed SourceOutput fails", async () => {
  expect(
    await run(
      runCommand(
        config(`console.error('  first line  ');console.error('second line');process.exit(3)`),
        folder,
        "run",
      ).pipe(Effect.result),
    ),
  ).toMatchObject({ _tag: "Failure", failure: { code: "command_failed", message: "first line" } });
  expect(
    await run(runCommand(config(`console.log('{}')`), folder, "run").pipe(Effect.result)),
  ).toMatchObject({ _tag: "Failure", failure: { code: "invalid_output" } });
});
test("stdout over cap fails; capped stderr drains with truncation marker", async () => {
  expect(
    await run(
      runCommand(config(`process.stdout.write('x'.repeat(5*1024*1024+1))`), folder, "run").pipe(
        Effect.result,
      ),
    ),
  ).toMatchObject({ _tag: "Failure", failure: { code: "output_limit" } });
  const capture = new Capture(100);
  capture.accept(Buffer.alloc(200, 120));
  expect(capture.log()).toContain("[output truncated]");
  expect(Buffer.byteLength(capture.log())).toBeLessThanOrEqual(100);
  const result = await run(
    execute(
      [process.execPath, "-e", `process.stderr.write('x'.repeat(100000));console.log('ok')`],
      folder,
      { PATH: process.env.PATH },
      undefined,
      100,
    ),
  );
  expect(result.code).toBe(0);
  expect(result.log).toContain("[output truncated]");
});
test("argv transform receives fetch stdout", async () => {
  const c = config(`console.log('raw')`, {
    transform: [
      process.execPath,
      "-e",
      `const raw=await Bun.stdin.text();console.log(JSON.stringify({v:1,items:[{key:'x',title:raw.trim(),since:'2026-01-01T00:00:00Z'}]}))`,
    ],
  });
  expect((await run(runCommand(c, folder, "run"))).output.items[0].title).toBe("raw");
});
test("jq -f transform works with real jq", async () => {
  const c: SourceConfig = {
    id: "jq",
    label: "Jq",
    tag: "JQ",
    type: "command",
    fetch: [process.execPath, "raw.ts"],
    transform: "transform.jq",
  };
  expect(
    (await run(runCommand(c, resolve("examples/sources/jq"), "run"))).output.items[0].key,
  ).toBe("one");
});
test("action {key} is replaced only as one whole argv element, never shell text", async () => {
  const key = "; touch /never; $(echo x)";
  expect(actionArgv(["echo", "{key}", "prefix{key}"], key)).toEqual(["echo", key, "prefix{key}"]);
  const c = config("", {
    actions: {
      done: [
        process.execPath,
        "-e",
        `if(process.argv[1]!==${JSON.stringify(key)})process.exit(2)`,
        "{key}",
      ],
    },
  });
  expect((await run(runCommand(c, folder, "run", { name: "done", key }))).rawSize).toBe(0);
});
test("unknown inherited action names are rejected without execution", async () => {
  const result = await run(
    runCommand(config("", { actions: {} }), folder, "run", {
      name: "constructor",
      key: "one",
    }).pipe(Effect.result),
  );
  expect(result).toMatchObject({ _tag: "Failure", failure: { code: "invalid_input" } });
});
test("timeout sends SIGTERM then SIGKILL after 10 seconds to ignoring process group", async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const d = mkdtempSync("/tmp/sc-timeout-");
  const marker = `${d}/signals`;
  const c = config(
    `import {appendFileSync} from 'node:fs'; process.on('SIGTERM',()=>appendFileSync(${JSON.stringify(marker)},'TERM\\n'));setInterval(()=>{},100);`,
    { timeout: "200ms" },
  );
  const start = Date.now();
  try {
    expect(await run(runCommand(c, folder, "run").pipe(Effect.result))).toMatchObject({
      _tag: "Failure",
      failure: { code: "timeout" },
    });
    expect(Date.now() - start).toBeGreaterThanOrEqual(10000);
    expect(Date.now() - start).toBeLessThan(14000);
    expect(readFileSync(marker, "utf8")).toContain("TERM");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}, 15000);
