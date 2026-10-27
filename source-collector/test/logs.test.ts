import { expect, test } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { collectorLog, LOG_CAP, COLLECTOR_ROTATIONS } from "../src/logs.ts";

test("collector lifecycle log is private, capped, rotated and persists across opens", () => {
  const root = mkdtempSync("/tmp/sc-log-");
  try {
    const log = collectorLog(root);
    const folder = join(root, "log");
    const file = join(folder, "collector.log");
    expect(statSync(file).size).toBe(0);
    expect(statSync(folder).mode & 0o777).toBe(0o700);
    for (let i = 0; i < 7; i++) log.append(String(i).repeat(LOG_CAP - 1));
    expect(readdirSync(folder).sort()).toEqual([
      "collector.log",
      "collector.log.1",
      "collector.log.2",
      "collector.log.3",
    ]);
    for (let i = 0; i <= COLLECTOR_ROTATIONS; i++) {
      const path = join(folder, i ? `collector.log.${i}` : "collector.log");
      expect(statSync(path).size).toBe(LOG_CAP);
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(readFileSync(path, "utf8")).toBe(String(6 - i).repeat(LOG_CAP - 1) + "\n");
    }
    collectorLog(root).append("after restart");
    expect(readFileSync(file, "utf8")).toBe("after restart\n");
    log.append("x".repeat(LOG_CAP * 2));
    expect(statSync(file).size).toBeLessThanOrEqual(LOG_CAP);
    expect(readFileSync(file, "utf8")).toContain("[output truncated]");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collector refuses symlink log destinations without changing their target", () => {
  const root = mkdtempSync("/tmp/sc-log-");
  try {
    collectorLog(root);
    const target = join(root, "keep");
    writeFileSync(target, "untouched");
    symlinkSync(target, join(root, "log/collector.log.1"));
    expect(() => collectorLog(root)).toThrow();
    expect(readFileSync(target, "utf8")).toBe("untouched");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
