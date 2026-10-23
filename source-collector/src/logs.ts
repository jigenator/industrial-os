import {
  readdirSync,
  lstatSync,
  unlinkSync,
  writeFileSync,
  renameSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { Capture } from "./command.ts";
import { privateDirectory, regularFile } from "./instance.ts";

export const LOG_CAP = 256 * 1024;
export const COLLECTOR_ROTATIONS = 3;

/** One lock-owning engine writes structured lifecycle lines, never source payloads. */
export function collectorLog(root: string) {
  const folder = join(root, "log");
  privateDirectory(folder);
  const file = (index: number) => join(folder, index ? `collector.log.${index}` : "collector.log");
  const inspect = () => {
    for (let i = 0; i <= COLLECTOR_ROTATIONS; i++) regularFile(file(i));
  };
  inspect();
  writeFileSync(file(0), "", { flag: "a", mode: 0o600 });
  chmodSync(file(0), 0o600);
  return {
    append(line: string) {
      inspect();
      const capture = new Capture(LOG_CAP - 1);
      capture.accept(Buffer.from(line));
      const bytes = Buffer.concat([
        Buffer.from(capture.log()).subarray(0, LOG_CAP - 1),
        Buffer.from("\n"),
      ]);
      if (lstatSync(file(0)).size + bytes.length > LOG_CAP) {
        if (existsSync(file(COLLECTOR_ROTATIONS))) unlinkSync(file(COLLECTOR_ROTATIONS));
        for (let i = COLLECTOR_ROTATIONS - 1; i >= 0; i--)
          if (existsSync(file(i))) renameSync(file(i), file(i + 1));
      }
      writeFileSync(file(0), bytes, { flag: "a", mode: 0o600 });
    },
  };
}

/** Stderr only. Never log stdout, env, argv, configs, or full source payloads. */
export function runLog(root: string, source: string, run: string) {
  const parent = join(root, "runs");
  privateDirectory(parent);
  const folder = join(parent, source);
  privateDirectory(folder);
  const files = readdirSync(folder)
    .filter((name) => /^[0-9a-f-]+\.log$/.test(name))
    .sort()
    .reverse();
  for (const name of files.slice(49)) {
    const path = join(folder, name);
    if (lstatSync(path).isFile()) unlinkSync(path);
  }
  const capture = new Capture(LOG_CAP);
  return {
    append(text: string) {
      capture.accept(Buffer.from(text));
    },
    close() {
      writeFileSync(join(folder, `${run}.log`), capture.log(), { flag: "wx", mode: 0o600 });
    },
  };
}
