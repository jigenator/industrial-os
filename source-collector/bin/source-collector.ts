#!/usr/bin/env bun
import packageInfo from "../package.json";
import { Effect, Logger, Option, Schema } from "effect";
import { Command, Argument, Flag, CliError } from "effect/cli";
import { BunServices } from "@effect/platform-bun";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CollectorError, fail, Act, Id } from "../src/contract.ts";
import { paths, loadCatalog, loadSource } from "../src/config.ts";
import { runCommand } from "../src/command.ts";
import { checklistIO, checklistPath, checklistOutput, readChecklist } from "../src/checklist.ts";
import { runEngine } from "../src/engine.ts";
import { request } from "../src/socket.ts";
import { service } from "../src/service.ts";

const p = paths();
const print = (value: unknown) =>
  Effect.sync(() => {
    console.log(JSON.stringify(value, null, 2));
  });
const agentFlag = () => Flag.String("agent").pipe(Flag.withOptionalValue(""), Flag.optional);
const attribution = (agent: Option.Option<string>) =>
  Option.isSome(agent)
    ? { actor: "agent" as const, ...(agent.value ? { agent: agent.value } : {}) }
    : { actor: "you" as const };
const act = (input: Act) =>
  Schema.decodeUnknownEffect(Act)(input).pipe(
    Effect.mapError(() => fail("invalid_input", "Invalid action parameters")),
    Effect.flatMap((valid) => request(p.runtime, (api) => api.act(valid))),
    Effect.flatMap(print),
  );
const run = Command.make("run", {}, () => runEngine(p));
const get = Command.make("get", {}, () =>
  request(p.runtime, (api) => api.get({})).pipe(Effect.flatMap(print)),
);
const status = Command.make("status", {}, () =>
  request(p.runtime, (api) => api.status({})).pipe(Effect.flatMap(print)),
);
const refresh = Command.make(
  "refresh",
  { id: Argument.String("id").pipe(Argument.withSchema(Id), Argument.optional) },
  ({ id }) => request(p.runtime, (api) => api.refresh({ source: Option.getOrUndefined(id) })),
);
const add = Command.make(
  "add",
  {
    text: Argument.String("text"),
    section: Flag.String("section").pipe(Flag.optional),
    agent: agentFlag(),
  },
  ({ text, section, agent }) =>
    act({ do: "todo.add", text, section: Option.getOrUndefined(section), ...attribution(agent) }),
);
const done = Command.make(
  "done",
  { key: Argument.String("key"), agent: agentFlag() },
  ({ key, agent }) => act({ do: "todo.done", key, ...attribution(agent) }),
);
const reopen = Command.make(
  "reopen",
  { key: Argument.String("key"), agent: agentFlag() },
  ({ key, agent }) => act({ do: "todo.reopen", key, ...attribution(agent) }),
);
const todo = Command.make("todo").pipe(Command.withSubcommands([add, done, reopen]));
const enabled = (name: "enable" | "disable") =>
  Command.make(name, { id: Argument.String("id").pipe(Argument.withSchema(Id)) }, ({ id }) =>
    request(p.runtime, (api) =>
      api.setEnabled({ source: id, enabled: name === "enable", actor: "you" }),
    ).pipe(Effect.flatMap(print)),
  );
const check = Command.make("check", { folder: Argument.String("source-dir") }, ({ folder }) =>
  Effect.gen(function* () {
    const entry = yield* loadSource(resolve(folder));
    const config = entry.config;
    if (config.planned) return yield* print({ state: "planned", rawSize: 0 });
    const result =
      config.type === "command"
        ? yield* runCommand(
            config,
            entry.folder,
            Bun.randomUUIDv7(),
            undefined,
            undefined,
            (rawSize, transformedOutput) =>
              console.log(JSON.stringify({ rawSize, transformedOutput })),
          )
        : {
            rawSize: 0,
            output: yield* checklistIO(() =>
              checklistOutput(readChecklist(checklistPath(config.path, entry.folder))),
            ),
          };
    yield* print(result);
  }),
);
const validate = Command.make("validate", {}, () =>
  loadCatalog(p.config).pipe(
    Effect.flatMap((catalog) => {
      const errors = catalog.entries
        .filter((e) => e.error)
        .map((e) => ({ id: e.id, error: e.error }));
      return print({ sources: catalog.entries.length, errors }).pipe(
        Effect.andThen(
          errors.length ? Effect.fail(fail("config_error", "Invalid sources")) : Effect.void,
        ),
      );
    }),
  ),
);
const serviceCommand = Command.make("service").pipe(
  Command.withSubcommands(
    ["install", "start", "stop", "uninstall", "status"].map((verb) =>
      Command.make(verb, {}, () =>
        service(verb, {
          ...p,
          bun: process.execPath,
          entry: fileURLToPath(import.meta.url),
          path: process.env.PATH ?? "/usr/bin:/bin",
          uid: process.getuid?.() ?? -1,
        }).pipe(Effect.flatMap(print)),
      ),
    ),
  ),
);
const cli = Command.make("source-collector").pipe(
  Command.withSubcommands([
    run,
    status,
    get,
    refresh,
    todo,
    enabled("enable"),
    enabled("disable"),
    check,
    validate,
    serviceCommand,
  ]),
);
// Effect CLI follows GNU optional-value syntax; also accept the documented --agent [session].
const args = process.argv.slice(2);
for (let i = 0; i < args.length - 1; i++)
  if (args[i] === "--agent" && !args[i + 1].startsWith("-"))
    args.splice(i, 2, `--agent=${args[i + 1]}`);
const program = Command.runWith(cli, { version: packageInfo.version, renderErrors: false })(
  args,
).pipe(
  Effect.provide(BunServices.layer),
  Effect.provide(Logger.layer([Logger.formatJson.pipe(Logger.map((line) => console.error(line)))])),
);
const result = await Effect.runPromiseExit(program);
if (result._tag === "Failure") {
  const failure = result.cause.reasons.find((r) => r._tag === "Fail");
  const error = failure && failure._tag === "Fail" ? failure.error : undefined;
  if (error instanceof CollectorError) {
    console.error(`${error.code}: ${error.message}`);
    process.exitCode =
      error.code === "contention"
        ? 8
        : ["invalid_input", "config_error", "invalid_output"].includes(error.code)
          ? 2
          : 1;
  } else {
    console.error("invalid input or local operation failed (use --help)");
    process.exitCode = CliError.isCliError(error) ? 2 : 1;
  }
}
