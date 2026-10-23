import { createHash } from "node:crypto";
import {
  constants,
  openSync,
  closeSync,
  fsyncSync,
  fstatSync,
  readFileSync,
  lstatSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { expandPath } from "./config.ts";
import { fail, type SourceOutput } from "./contract.ts";

export type Todo = {
  key: string;
  title: string;
  since: string;
  who?: string;
  where?: string;
  done: boolean;
  line: number;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function parseChecklist(text: string, fallback: string): Todo[] {
  let heading: string | undefined;
  const lines = text.split(/\r?\n/),
    result: Todo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const section = /^## (.+)$/.exec(line);
    if (section) heading = section[1];
    const item = /^- \[([ xX])\] (.*)$/.exec(line);
    if (!item) continue;
    const comment = /^<!-- (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) \[([^\]]+)\] -->$/.exec(
      lines[i - 1] ?? "",
    );
    const date = comment ? new Date(comment[1].replace(" ", "T")) : new Date(fallback);
    if (!Number.isFinite(date.getTime()))
      throw fail("invalid_output", "Invalid checklist timestamp");
    result.push({
      key: comment ? `${comment[1]}#${comment[2]}` : hash(`${heading ?? ""}\n${item[2]}`),
      title: item[2],
      since: date.toISOString(),
      ...(comment ? { who: comment[2] } : {}),
      ...(heading ? { where: heading } : {}),
      done: item[1] !== " ",
      line: i,
    });
  }
  if (new Set(result.map((i) => i.key)).size !== result.length)
    throw fail("invalid_output", "Duplicate checklist key");
  return result;
}
export type ChecklistRead = { text: string; stamp: string; todos: Todo[] };
export function readChecklist(path: string): ChecklistRead {
  if (!lstatSync(path).isFile()) throw fail("io", "Checklist must be a regular file");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd),
      text = readFileSync(fd, "utf8");
    return {
      text,
      stamp: `${stat.mtimeMs}:${stat.size}:${hash(text)}`,
      todos: parseChecklist(text, stat.mtime.toISOString()),
    };
  } finally {
    closeSync(fd);
  }
}
export function checklistOutput(read: ChecklistRead, previous?: ChecklistRead): SourceOutput {
  return {
    v: 1,
    items: read.todos
      .filter((t) => !t.done)
      .map(({ key, title, since, who, where }) => ({
        key,
        title,
        since,
        kind: "todo",
        who,
        where,
      })),
    shipped: read.todos
      .filter((t) => t.done && previous?.todos.some((p) => p.key === t.key && !p.done))
      .map((t) => ({ key: t.key, at: new Date().toISOString() })),
  };
}
export function checklistPath(path: string, folder: string, home?: string) {
  return expandPath(path, folder, home);
}
export function editChecklist(
  path: string,
  last: ChecklistRead,
  input: {
    do: "todo.add" | "todo.done" | "todo.reopen";
    key?: string;
    text?: string;
    section?: string;
    agent?: string;
  },
  beforeCheck: (attempt: number) => void = () => {},
): ChecklistRead {
  let base = last;
  for (let attempt = 0; attempt < 2; attempt++) {
    const lines = base.text.split(/\r?\n/),
      newline = base.text.includes("\r\n") ? "\r\n" : "\n";
    if (input.do === "todo.add") {
      if (!input.text || /[\r\n]/.test(input.text) || /[\r\n]/.test(input.section ?? ""))
        throw fail("invalid_input", "Invalid todo text or section");
      let at = lines.length;
      if (lines.at(-1) === "") at--;
      if (input.section) {
        const section = lines.indexOf(`## ${input.section}`);
        if (section < 0) throw fail("not_found", "Section not found");
        at = section + 1;
        while (at < lines.length && !lines[at].startsWith("## ")) at++;
      }
      const now = new Date();
      const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      // A unique comment keeps identical added titles independently addressable.
      const session = input.agent ?? Bun.randomUUIDv7();
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(session))
        throw fail("invalid_input", "Invalid agent session");
      if (base.todos.some((t) => t.key === `${local}#${session}`))
        throw fail("conflict", "Todo timestamp/session already exists; retry next second");
      lines.splice(at, 0, `<!-- ${local} [${session}] -->`, `- [ ] ${input.text}`);
    } else {
      const todo = base.todos.find((t) => t.key === input.key);
      if (!todo) throw fail("not_found", "Todo not found");
      lines[todo.line] = lines[todo.line].replace(
        /^- \[[ xX]\]/,
        input.do === "todo.done" ? "- [x]" : "- [ ]",
      );
    }
    beforeCheck(attempt);
    const current = readChecklist(path);
    if (current.stamp !== base.stamp) {
      base = current;
      continue;
    }
    const tmp = join(dirname(path), `.source-collector-${Bun.randomUUIDv7()}.tmp`);
    const fd = openSync(
      tmp,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      lstatSync(path).mode & 0o777,
    );
    try {
      try {
        writeFileSync(fd, lines.join(newline));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      if (readChecklist(path).stamp !== base.stamp) {
        base = readChecklist(path);
        continue;
      }
      renameSync(tmp, path);
      const directory = openSync(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY);
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
      return readChecklist(path);
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* renamed or absent */
      }
    }
  }
  throw fail("conflict", "Checklist changed concurrently");
}
export const checklistIO = <A>(operation: () => A) =>
  Effect.try({
    try: operation,
    catch: (e) =>
      e && typeof e === "object" && "_tag" in e && e._tag === "CollectorError"
        ? (e as import("./contract.ts").CollectorError)
        : fail("io", "Checklist read or write failed"),
  });
