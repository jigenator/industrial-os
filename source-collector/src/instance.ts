import { Database } from "bun:sqlite";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { fail } from "./contract.ts";

export function privateDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
    throw fail("io", "Runtime directory must be owned and mode 0700");
}
export function regularFile(path: string) {
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
  if (!stat.isFile() || stat.uid !== process.getuid?.() || stat.nlink !== 1)
    throw fail("io", "Unsafe runtime file");
}
export function liveness(root: string): "absent" | "alive" | "dead" | "unknown" {
  try {
    regularFile(join(root, "runner.pid"));
    const record: unknown = JSON.parse(readFileSync(join(root, "runner.pid"), "utf8"));
    if (
      !record ||
      typeof record !== "object" ||
      !("pid" in record) ||
      typeof record.pid !== "number" ||
      !Number.isSafeInteger(record.pid) ||
      record.pid <= 0
    )
      return "unknown";
    try {
      process.kill(record.pid, 0);
      return "alive";
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === "ESRCH" ? "dead" : "unknown";
    }
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "unknown";
  }
}
export function acquireInstance(root: string) {
  privateDirectory(root);
  const lock = join(root, "exclusion.sqlite");
  regularFile(lock);
  const db = new Database(lock, { create: true });
  try {
    chmodSync(lock, 0o600);
    db.exec("PRAGMA busy_timeout=0; PRAGMA journal_mode=MEMORY; BEGIN EXCLUSIVE");
    const live = liveness(root);
    if (live === "alive" || live === "unknown")
      throw fail("contention", "Engine already running or liveness unknown");
    const pid = join(root, "runner.pid"),
      temporary = `${pid}.${Bun.randomUUIDv7()}`;
    writeFileSync(
      temporary,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
      { mode: 0o600, flag: "wx" },
    );
    renameSync(temporary, pid);
    return () => {
      try {
        const record = JSON.parse(readFileSync(pid, "utf8"));
        if (record.pid === process.pid) unlinkSync(pid);
      } finally {
        db.exec("ROLLBACK");
        db.close();
      }
    };
  } catch (e) {
    db.close();
    if (e && typeof e === "object" && "_tag" in e) throw e;
    throw fail("contention", "Another engine holds the exclusive lock");
  }
}
export const instance = (root: string) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => acquireInstance(root),
      catch: (e) => e as import("./contract.ts").CollectorError,
    }),
    (release) => Effect.sync(release),
  );
