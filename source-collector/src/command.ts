import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/process";
import { SourceOutput, decode, durationMs, fail, type SourceConfig } from "./contract.ts";

export const OUTPUT_CAP = 5 * 1024 * 1024;
export class Capture {
  size = 0;
  chunks: Uint8Array[] = [];
  constructor(readonly cap = OUTPUT_CAP) {}
  accept(chunk: Uint8Array) {
    const remaining = Math.max(0, this.cap - this.size);
    if (remaining) this.chunks.push(chunk.slice(0, remaining));
    this.size += chunk.length;
  }
  get exceeded() {
    return this.size > this.cap;
  }
  text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
  log() {
    const text = this.text();
    return this.exceeded ? text.slice(0, -24) + "\n[output truncated]\n" : text;
  }
}
export const actionArgv = (argv: ReadonlyArray<string>, key: string) =>
  argv.map((arg) => (arg === "{key}" ? key : arg));
export const execute = (
  argv: ReadonlyArray<string>,
  cwd: string,
  env: Record<string, string | undefined>,
  input?: string,
  cap = OUTPUT_CAP,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const stdout = new Capture(cap),
        stderr = new Capture(cap);
      const handle = yield* ChildProcess.make(argv[0], argv.slice(1), {
        cwd,
        env,
        extendEnv: false,
        shell: false,
        detached: true,
        stdin: input === undefined ? "ignore" : Stream.make(new TextEncoder().encode(input)),
        stdout: "pipe",
        stderr: "pipe",
        killSignal: "SIGTERM",
        forceKillAfter: "10 seconds",
      });
      const drain = (stream: typeof handle.stdout, capture: Capture) =>
        Stream.runForEach(stream, (chunk) => Effect.sync(() => capture.accept(chunk)));
      const [code] = yield* Effect.all(
        [handle.exitCode, drain(handle.stdout, stdout), drain(handle.stderr, stderr)],
        { concurrency: "unbounded" },
      );
      return {
        code: Number(code),
        stdout: stdout.text(),
        stderr: stderr.text(),
        rawSize: stdout.size,
        exceeded: stdout.exceeded,
        log: stderr.log(),
      };
    }),
  );
export const runCommand = (
  config: SourceConfig,
  folder: string,
  runId: string,
  action?: { name: string; key: string },
  onLog: (text: string) => void = () => {},
  inspect?: (rawSize: number, transformed: string) => void,
) =>
  Effect.gen(function* () {
    const env = {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
      ...config.env,
      SOURCE_COLLECTOR_SOURCE_ID: config.id,
      SOURCE_COLLECTOR_RUN_ID: runId,
    };
    if (config.type !== "command" || (!action && !config.fetch))
      return yield* Effect.fail(fail("config_error", "Command has no fetch"));
    const configuredAction =
      action && config.actions && Object.hasOwn(config.actions, action.name)
        ? config.actions[action.name]
        : undefined;
    const argv = action ? actionArgv(configuredAction ?? [], action.key) : config.fetch!;
    if (!argv.length) return yield* Effect.fail(fail("invalid_input", "Unknown action"));
    const fetch = yield* execute(argv, folder, env);
    onLog(fetch.log);
    const check = (result: typeof fetch) =>
      result.exceeded
        ? fail("output_limit", "Command stdout exceeded 5 MB")
        : result.code !== 0
          ? fail(
              "command_failed",
              result.stderr.split(/\r?\n/)[0].trim().slice(0, 200) || "Command failed",
            )
          : undefined;
    const error = check(fetch);
    if (error) return yield* Effect.fail(error);
    if (action) return { rawSize: fetch.rawSize, output: { v: 1 as const, items: [] } };
    let transformed = fetch;
    if (config.transform) {
      const transform =
        typeof config.transform === "string" ? ["jq", "-f", config.transform] : config.transform;
      transformed = yield* execute(transform, folder, env, fetch.stdout);
      onLog(transformed.log);
      const error = check(transformed);
      if (error) return yield* Effect.fail(error);
    }
    inspect?.(fetch.rawSize, transformed.stdout);
    const output = yield* Effect.try({
      try: () => decode(SourceOutput, JSON.parse(transformed.stdout)),
      catch: () => fail("invalid_output", "Output does not match SourceOutput v1"),
    });
    return { rawSize: fetch.rawSize, output };
  }).pipe(
    Effect.timeout(durationMs(config.timeout ?? "30s")),
    Effect.mapError((e) =>
      "code" in e
        ? e
        : "_tag" in e && e._tag === "TimeoutError"
          ? fail("timeout", "Source timed out")
          : fail("command_failed", "Command could not run"),
    ),
  );
