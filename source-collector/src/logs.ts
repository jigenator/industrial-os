import { readdirSync, lstatSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Capture } from "./command.ts";
import { privateDirectory } from "./instance.ts";

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
  const capture = new Capture(256 * 1024);
  return {
    append(text: string) {
      capture.accept(Buffer.from(text));
    },
    close() {
      writeFileSync(join(folder, `${run}.log`), capture.log(), { flag: "wx", mode: 0o600 });
    },
  };
}
