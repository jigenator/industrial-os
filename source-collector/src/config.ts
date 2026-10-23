import { Effect, FileSystem } from "effect";
import { resolve, join, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { Config, SourceConfig, decode, durationMs, fail } from "./contract.ts";

export function expandPath(
  path: string,
  base: string,
  home = process.env.HOME ?? homedir(),
): string {
  return path.startsWith("~/")
    ? resolve(home, path.slice(2))
    : isAbsolute(path)
      ? path
      : resolve(base, path);
}
export function paths(env = process.env) {
  const home = env.HOME ?? homedir();
  return {
    home,
    config: expandPath(env.SOURCE_COLLECTOR_CONFIG ?? "~/.config/source-collector", home, home),
    runtime: expandPath(
      env.SOURCE_COLLECTOR_HOME ?? "~/Library/Application Support/source-collector",
      home,
      home,
    ),
  };
}
export type Entry = {
  id: string;
  folder: string;
  digest: string;
  config?: SourceConfig;
  error?: string;
};
export type Catalog = { entries: Entry[]; concurrency: number; staleLimitMs: number };
export const loadSource = (folder: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const raw = yield* fs.readFileString(join(folder, "source.json"));
    const config = yield* Effect.try({
      try: () => decode(SourceConfig, JSON.parse(raw)),
      catch: () => fail("config_error", "Invalid source config"),
    });
    return { id: config.id, folder, config, digest: Bun.hash(raw).toString(16) } satisfies Entry;
  });
export const loadCatalog = (
  directory: string,
): Effect.Effect<Catalog, import("./contract.ts").CollectorError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const raw = yield* fs.readFileString(join(directory, "config.json"));
    const config = yield* Effect.try({
      try: () => decode(Config, JSON.parse(raw)),
      catch: () => fail("config_error", "Invalid config.json"),
    });
    const entries: Entry[] = [];
    for (const root of config.roots) {
      const parent = join(expandPath(root, directory), "sources");
      const children = yield* fs.readDirectory(parent);
      for (const child of children.sort()) {
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(child)) continue;
        const folder = join(parent, child);
        if (!(yield* fs.exists(join(folder, "source.json")))) continue;
        const entry: Entry = yield* loadSource(folder).pipe(
          Effect.catch(() =>
            Effect.succeed({
              id: child,
              folder,
              digest: "invalid",
              error: "Invalid source config",
            } as Entry),
          ),
        );
        if (entry.config && entry.id !== child) {
          entry.config = undefined;
          entry.id = child;
          entry.error = "Source id must match folder";
        }
        entries.push(entry);
      }
    }
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
    for (const e of entries)
      if (counts.get(e.id)! > 1) {
        e.config = undefined;
        e.error = "Duplicate source id";
      }
    return {
      entries: entries.filter((e, i) => entries.findIndex((a) => a.id === e.id) === i),
      concurrency: config.concurrency ?? 20,
      staleLimitMs: durationMs(config.staleLimit ?? "3d"),
    };
  }).pipe(
    Effect.mapError((e) =>
      e instanceof Error && "code" in e && e.code === "config_error"
        ? (e as import("./contract.ts").CollectorError)
        : fail("config_error", "Cannot read configured roots"),
    ),
  );
