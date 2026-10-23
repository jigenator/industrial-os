import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { BunServices } from "@effect/platform-bun";
import { loadCatalog, expandPath } from "../src/config.ts";
import { SourceOutput, Act, decode } from "../src/contract.ts";
import {
  readChecklist,
  parseChecklist,
  editChecklist,
  checklistPath,
  checklistOutput,
} from "../src/checklist.ts";

const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), "sc-test-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const run = <A, E>(e: Effect.Effect<A, E, import("effect/FileSystem").FileSystem>) =>
  Effect.runPromise(e.pipe(Effect.provide(BunServices.layer)));
function source(root: string, id: string, content: unknown) {
  const folder = join(root, "sources", id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "source.json"), JSON.stringify(content));
}
const config = (id: string) => ({ id, label: id, tag: "T", type: "command", fetch: ["true"] });
test("config: isolate invalid source and refuse duplicates across roots", async () => {
  const d = temp();
  source(join(d, "one"), "valid", config("valid"));
  source(join(d, "one"), "bad", {});
  source(join(d, "one"), "duplicate", config("duplicate"));
  source(join(d, "two"), "duplicate", config("duplicate"));
  writeFileSync(join(d, "config.json"), JSON.stringify({ roots: ["one", join(d, "two")] }));
  const c = await run(loadCatalog(d));
  expect(c.concurrency).toBe(20);
  expect(c.staleLimitMs).toBe(259200000);
  expect(c.entries.find((e) => e.id === "valid")?.config).toBeDefined();
  expect(c.entries.find((e) => e.id === "bad")?.error).toBeDefined();
  expect(c.entries.filter((e) => e.id === "duplicate")).toHaveLength(1);
  expect(c.entries.find((e) => e.id === "duplicate")?.config).toBeUndefined();
});
test("roots and checklist paths: ~/ expands using temp HOME, relative paths use config/source directory", async () => {
  const d = temp(),
    old = process.env.HOME;
  try {
    process.env.HOME = d;
    source(join(d, "personal"), "fake", config("fake"));
    writeFileSync(join(d, "config.json"), JSON.stringify({ roots: ["~/personal"] }));
    expect((await run(loadCatalog(d))).entries[0].folder).toBe(join(d, "personal/sources/fake"));
    expect(checklistPath("~/memory/list.md", "/not-home")).toBe(join(d, "memory/list.md"));
    expect(checklistPath("list.md", d)).toBe(join(d, "list.md"));
    expect(checklistPath("/tmp/list.md", d)).toBe("/tmp/list.md");
    expect(expandPath("root", d)).toBe(join(d, "root"));
  } finally {
    if (old === undefined) delete process.env.HOME;
    else process.env.HOME = old;
  }
});
test("boundary validation rejects malformed output, duplicate keys, invalid dates and action parameters", () => {
  for (const invalid of [
    { v: 2, items: [] },
    { v: 1, items: [{ key: "x", title: "x", since: "yesterday" }] },
    { v: 1, items: [], extra: true },
    {
      v: 1,
      items: [
        { key: "x", title: "x", since: "2026-01-01T00:00:00Z" },
        { key: "x", title: "x", since: "2026-01-01T00:00:00Z" },
      ],
    },
  ])
    expect(() => decode(SourceOutput, invalid)).toThrow();
  expect(() => decode(Act, { do: "pin", actor: "you" })).toThrow();
  expect(() => decode(Act, { do: "todo.add", actor: "you", text: "one\n- [ ] two" })).toThrow();
});
test("checklist output crosses the same SourceOutput schema boundary as commands", () => {
  const read = {
    text: "",
    stamp: "",
    todos: [
      { key: "one", title: "x".repeat(4097), since: "2026-01-01T00:00:00Z", done: false, line: 0 },
    ],
  };
  expect(() => checklistOutput(read)).toThrow("Checklist does not match SourceOutput v1");
});
test("checklist scratchpad fixture parses heading, local timestamp, session and stable key", () => {
  const text = readFileSync(resolve("examples/sources/todo/checklist.md"), "utf8");
  const todos = parseChecklist(text, "2026-01-01T00:00:00Z");
  expect(todos).toHaveLength(3);
  expect(todos[0].where).toBe("Inbox");
  expect(todos[0].who).toBe("demo-session");
  expect(todos[0].key).toBe("2026-10-20 12:00:00#demo-session");
  expect(todos[1].done).toBe(true);
  expect(new Date(todos[0].since).getHours()).toBe(12);
});
test("checklist edits preserve all other bytes; done/reopen/add and external shipped transition", () => {
  const d = temp(),
    path = join(d, "list.md");
  const original =
    "# Notes\r\n\r\n## Work\r\n<!-- 2026-01-01 12:00:00 [session] -->\r\n- [ ] One\r\n\r\nkeep **this**\r\n";
  writeFileSync(path, original);
  const before = readChecklist(path),
    key = before.todos[0].key;
  const done = editChecklist(path, before, { do: "todo.done", key });
  expect(done.text).toBe(original.replace("- [ ] One", "- [x] One"));
  expect(checklistOutput(done, before).shipped).toHaveLength(1);
  const reopened = editChecklist(path, done, { do: "todo.reopen", key });
  expect(reopened.text).toBe(original);
  const added = editChecklist(path, reopened, { do: "todo.add", text: "Two", section: "Work" });
  expect(added.todos.map((t) => t.title)).toEqual(["One", "Two"]);
  expect(added.text).toContain("keep **this**\r\n");
});
test("checklist concurrent edit retries once, then conflict without clobbering writer", () => {
  const path = join(temp(), "list.md");
  writeFileSync(path, "- [ ] One\n");
  const before = readChecklist(path),
    key = before.todos[0].key;
  expect(() =>
    editChecklist(path, before, { do: "todo.done", key }, (attempt) =>
      writeFileSync(path, `- [ ] One\nexternal ${attempt}\n`),
    ),
  ).toThrow("Checklist changed concurrently");
  expect(readFileSync(path, "utf8")).toBe("- [ ] One\nexternal 1\n");
  const stale = readChecklist(path);
  writeFileSync(path, stale.text + "another line\n");
  const updated = editChecklist(path, stale, { do: "todo.done", key });
  expect(updated.text).toContain("another line\n");
  expect(updated.todos[0].done).toBe(true);
});
test("checklist repeated stamps get distinct, stable keys instead of failing", () => {
  const stamp = "<!-- 2026-10-06 21:07:21 [s1] -->";
  const text = [
    "## A",
    stamp,
    "- [x] one",
    stamp,
    "- [ ] two",
    stamp,
    "- [ ] two",
    "- [ ] free",
    "- [ ] free",
  ].join("\n");
  const keys = parseChecklist(text, "2026-01-01T00:00:00Z").map((t) => t.key);
  expect(new Set(keys).size).toBe(5);
  expect(keys[0]).toBe("2026-10-06 21:07:21#s1");
  expect(keys[1]).toMatch(/^2026-10-06 21:07:21#s1#[0-9a-f]{12}$/);
  expect(keys[2]).toBe(`${keys[1]}#2`);
  expect(keys[4]).toBe(`${keys[3]}#2`);
  const done = parseChecklist(text.replace("- [ ] two", "- [x] two"), "2026-01-01T00:00:00Z");
  expect(done.map((t) => t.key)).toEqual(keys);
});
