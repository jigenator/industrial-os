import { Effect, Schedule } from "effect";
import {
  constants,
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { execute } from "./command.ts";
import { fail } from "./contract.ts";
import { liveness } from "./instance.ts";
import { request } from "./socket.ts";

export const LABEL = "works.industrial-os.source-collector";
export type ServiceContext = {
  home: string;
  runtime: string;
  config: string;
  bun: string;
  entry: string;
  path: string;
  uid: number;
};
const xml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const controlText = (value: string) => {
  for (let i = 0; i < value.length; i++)
    if (value.charCodeAt(i) < 32 || value.charCodeAt(i) === 127) return true;
  return false;
};
export function renderPlist(c: ServiceContext): string {
  for (const path of [c.home, c.runtime, c.config, c.bun, c.entry])
    if (!isAbsolute(path) || controlText(path) || resolve(path) !== path)
      throw fail("invalid_input", "Service paths must be absolute");
  if (c.path.split(":").some((p) => !isAbsolute(p) || controlText(p)))
    throw fail("invalid_input", "Service PATH must contain absolute entries");
  const argv = [
    "/usr/bin/env",
    "-i",
    `HOME=${c.home}`,
    `PATH=${c.path}`,
    `SOURCE_COLLECTOR_HOME=${c.runtime}`,
    `SOURCE_COLLECTOR_CONFIG=${c.config}`,
    c.bun,
    c.entry,
    "run",
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${LABEL}</string>\n<key>ProgramArguments</key><array>${argv.map((a) => `<string>${xml(a)}</string>`).join("")}</array>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><false/>\n<key>EnableGlobbing</key><false/>\n<key>Umask</key><integer>63</integer>\n</dict></plist>\n`;
}
function parents(c: ServiceContext, create: boolean) {
  let at = c.home;
  for (const part of ["", "Library", "LaunchAgents"]) {
    if (part) at = join(at, part);
    try {
      const st = lstatSync(at);
      if (!st.isDirectory() || st.uid !== c.uid || st.mode & 0o022)
        throw fail("io", "Unsafe service directory");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      if (!create) return false;
      mkdirSync(at, { mode: 0o700 });
    }
  }
  return true;
}
export function inspectService(c: ServiceContext) {
  const path = join(c.home, "Library", "LaunchAgents", `${LABEL}.plist`);
  if (!parents(c, false)) return { path, installed: false };
  try {
    const st = lstatSync(path);
    if (
      !st.isFile() ||
      st.nlink !== 1 ||
      st.uid !== c.uid ||
      (st.mode & 0o777) !== 0o600 ||
      st.size > 65536
    )
      throw fail("io", "Unsafe service file");
    const bytes = readFileSync(path, "utf8");
    // Installed PATH binds ownership; invocation PATH drift is not foreign ownership.
    const installedPath = /<string>PATH=([^<]*)<\/string>/
      .exec(bytes)?.[1]
      ?.replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">");
    if (!installedPath || renderPlist({ ...c, path: installedPath }) !== bytes)
      throw fail("contention", "Service file is not owned by this installation");
    return { path, installed: true, drift: installedPath !== c.path };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { path, installed: false };
    throw e;
  }
}
export type Native = (
  argv: string[],
) => Effect.Effect<
  number,
  import("./contract.ts").CollectorError,
  import("effect/process/ChildProcessSpawner").ChildProcessSpawner
>;
export const service = (verb: string, c: ServiceContext, native?: Native) =>
  Effect.gen(function* () {
    if (process.platform !== "darwin" && !native)
      return yield* Effect.fail(fail("invalid_input", "launchd requires macOS"));
    const target = `gui/${c.uid}/${LABEL}`;
    const invoke: Native =
      native ??
      ((argv) =>
        execute(
          ["/bin/launchctl", ...argv],
          c.home,
          { HOME: c.home, PATH: "/usr/bin:/bin" },
          undefined,
          65536,
        ).pipe(
          Effect.timeout("30 seconds"),
          Effect.flatMap((r) =>
            r.exceeded
              ? Effect.fail(fail("outcome_unknown", "Service command output exceeded limit"))
              : Effect.succeed(r.code),
          ),
          Effect.mapError(() => fail("outcome_unknown", "Service manager outcome unknown")),
        ));
    const installed = yield* Effect.try({
      try: () => inspectService(c),
      catch: (e) => e as import("./contract.ts").CollectorError,
    });
    if (verb === "status") return { ...installed, engine: liveness(c.runtime) };
    if (verb === "stop") {
      const live = liveness(c.runtime);
      if (live === "unknown")
        return yield* Effect.fail(fail("contention", "Runner liveness unknown"));
      if (live !== "alive") return { stopped: true };
      yield* request(c.runtime, (api) => api.stop({}));
      while (liveness(c.runtime) === "alive") yield* Effect.sleep("25 millis");
      if (liveness(c.runtime) === "unknown")
        return yield* Effect.fail(fail("contention", "Runner liveness unknown"));
      return { stopped: true };
    }
    const live = liveness(c.runtime);
    if (live === "alive" || live === "unknown")
      return yield* Effect.fail(fail("contention", "Stop engine before changing service"));
    const loaded = yield* invoke(["print", target]); // Never print the whole GUI domain (real-host capture overflow).
    if (loaded !== 0 && loaded !== 113)
      return yield* Effect.fail(fail("io", "Service manager unavailable"));
    const mutate = (args: string[]) =>
      invoke(args).pipe(
        Effect.flatMap((code) =>
          code === 0
            ? Effect.void
            : Effect.fail(fail("outcome_unknown", "Service manager command failed")),
        ),
      );
    if (verb === "install") {
      if (installed.installed && !installed.drift) return { installed: true };
      if (installed.installed && loaded === 0) yield* mutate(["bootout", target]);
      yield* Effect.try({
        try: () => {
          parents(c, true);
          if (installed.installed) {
            inspectService(c);
            unlinkSync(installed.path);
          }
          const tmp = join(dirname(installed.path), `.source-collector-${Bun.randomUUIDv7()}.tmp`);
          const fd = openSync(
            tmp,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
          try {
            writeFileSync(fd, renderPlist(c));
            fsyncSync(fd);
          } finally {
            closeSync(fd);
          }
          try {
            linkSync(tmp, installed.path);
          } finally {
            unlinkSync(tmp);
          }
        },
        catch: () => fail("io", "Could not install service"),
      });
      return { installed: true }; // install NEVER starts
    }
    if (!installed.installed)
      return yield* Effect.fail(fail("invalid_input", "Install service first"));
    if (verb === "uninstall") {
      if (loaded === 0) yield* mutate(["bootout", target]);
      yield* Effect.try({
        try: () => {
          inspectService(c);
          unlinkSync(installed.path);
        },
        catch: () => fail("io", "Could not remove owned service"),
      });
      return { installed: false, dataPreserved: true };
    }
    if (verb !== "start")
      return yield* Effect.fail(fail("invalid_input", "Unknown service command"));
    yield* mutate(
      loaded === 0 ? ["kickstart", target] : ["bootstrap", `gui/${c.uid}`, installed.path],
    );
    yield* request(c.runtime, (api) => api.status({})).pipe(
      Effect.retry({ times: 60, schedule: Schedule.spaced("250 millis") }),
      Effect.timeout("30 seconds"),
    );
    return { started: true };
  });
