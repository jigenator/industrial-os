#!/usr/bin/env bun
import packageInfo from "../package.json";
import { Effect, Logger, Option, Schema } from "effect";
import { Command, Argument, Flag, CliError } from "effect/cli";
import { BunServices } from "@effect/platform-bun";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CollectorError, fail, Act, Id, Plan } from "../src/contract.ts";
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
const get = Command.make(
  "get",
  { items: Flag.Boolean("items").pipe(Flag.withDefault(false)) },
  ({ items }) =>
    request(p.runtime, (api) => api.get({})).pipe(
      Effect.flatMap((snapshot) =>
        items
          ? Effect.sync(() => {
              for (const item of snapshot.items)
                console.log(
                  JSON.stringify({
                    v: 1,
                    key: `${item.source}:${item.key}`,
                    source: item.source,
                    state: snapshot.sources.find((s) => s.id === item.source)?.state,
                    plan: item.overlay.plan,
                    pinned: item.overlay.pinned,
                    handled: item.overlay.handledAt !== undefined,
                    title: item.title,
                  }).replace(
                    /[\u007f-\u009f]/g,
                    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
                  ),
                );
            })
          : print(snapshot),
      ),
    ),
).pipe(
  Command.withDescription(
    "Read the snapshot; --items emits compact v1 JSON lines. Example: source-collector get --items",
  ),
);
const plan = Command.make(
  "plan",
  {
    key: Argument.String("key"),
    plan: Argument.String("plan").pipe(Argument.withDescription("today | inbox | later")),
    agent: agentFlag(),
  },
  ({ key, plan, agent }) =>
    Schema.decodeUnknownEffect(Plan)(plan).pipe(
      Effect.mapError(() => fail("invalid_input", "Plan must be today, inbox or later")),
      Effect.flatMap((valid) => act({ do: "plan", key, plan: valid, ...attribution(agent) })),
    ),
).pipe(
  Command.withDescription(
    "Set an item's plan. Example: source-collector plan fake:demo today --agent session",
  ),
);
const pin = Command.make(
  "pin",
  {
    key: Argument.String("key"),
    off: Flag.Boolean("off").pipe(Flag.withDefault(false)),
    agent: agentFlag(),
  },
  ({ key, off, agent }) => act({ do: "pin", key, pinned: !off, ...attribution(agent) }),
).pipe(
  Command.withDescription(
    "Pin an item (default on; --off clears). Example: source-collector pin fake:demo",
  ),
);
const handled = Command.make(
  "handled",
  {
    key: Argument.String("key"),
    undo: Flag.Boolean("undo").pipe(Flag.withDefault(false)),
    agent: agentFlag(),
  },
  ({ key, undo, agent }) => act({ do: "handled", key, undo, ...attribution(agent) }),
).pipe(
  Command.withDescription(
    "Mark handled (default set; --undo clears). Example: source-collector handled fake:demo",
  ),
);
const look = Command.make("look", { agent: agentFlag() }, ({ agent }) =>
  act({ do: "look", ...attribution(agent) }),
).pipe(
  Command.withDescription(
    "Set the shared last-look cursor. Example: source-collector look --agent session",
  ),
);
const action = Command.make(
  "action",
  { key: Argument.String("key"), name: Argument.String("name"), agent: agentFlag() },
  ({ key, name, agent }) => act({ do: "action", key, action: name, ...attribution(agent) }),
).pipe(
  Command.withDescription(
    "Run a configured source action. Example: source-collector action fake:demo open --agent session",
  ),
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
        : yield* checklistIO(() => {
            const read = readChecklist(checklistPath(config.path, entry.folder));
            return { rawSize: Buffer.byteLength(read.text), output: checklistOutput(read) };
          });
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
    plan,
    pin,
    handled,
    look,
    action,
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
