import { decodeSnapshot, isDone, itemId, object } from "./snapshot.ts";
import type { Item, Snapshot, Source } from "./snapshot.ts";
import type { Rpc } from "./transport.ts";
import { dropLast, UNSAFE } from "./text.ts";
import { RpcError } from "./transport.ts";

// Controls and bidi overrides never enter a draft; joiners, accents and emoji sequences do.
const CONTROL = new RegExp(UNSAFE.source, "u");
const CONTROL_ALL = UNSAFE;

export type Sort = "type" | "prio" | "age";
export type Hit = { key?: string; filter?: string; sort?: Sort; select?: string };
export interface Mark {
  value: string;
  at: number;
}
export const DECODE_SCRAMBLE = true; // Single bounded exception switch; warning/error content stays outside it.
export const ageText = (ms: number): string =>
  ms < 60000
    ? "now"
    : ms < 3600000
      ? `${Math.floor(ms / 60000)}m`
      : ms < 86400000
        ? `${Math.floor(ms / 3600000)}h`
        : `${Math.floor(ms / 86400000)}d`;
export function priority(item: Item): number {
  return item.derived.waiting ? 1 : item.overlay.pinned ? 2 : 3;
}
export class App {
  snapshot: Snapshot | null = null;
  connection: "loading" | "ready" | "offline" = "loading";
  filter = "";
  sort: Sort = "prio";
  selected: string | null = null;
  hover: Hit | null = null;
  ambient = true;
  motion = true;
  help = false;
  input: string | null = null;
  inputSource: string | null = null;
  message = "";
  busy = false;
  focused = false;
  readonly freshHold = new Set<string>();
  readonly arrivals = new Map<string, number>();
  readonly marks = new Map<string, Mark>();
  activity: { at: number; n: number }[] = [];
  changedAt = 0;
  selectionAt = 0;
  hoverAt = 0;
  bootAt = 0;
  private disposed = false;
  private reading = false;
  private reread = false;
  private lookPending = false;
  constructor(
    readonly rpc: Rpc,
    readonly now: () => number,
    readonly changed: () => void,
    readonly readOnly = false,
  ) {
    this.bootAt = now();
  }
  async poll(): Promise<void> {
    if (this.disposed) return;
    if (this.reading) {
      this.reread = true;
      return;
    }
    this.reading = true;
    try {
      const next = decodeSnapshot(await this.rpc.request("get"));
      if (this.disposed) return;
      const old = this.snapshot,
        t = this.now();
      if (old) {
        const before = new Set(old.items.map(itemId));
        for (const item of next.items)
          if (!before.has(itemId(item)) && Date.parse(item.seenAt) > Date.parse(old.at)) {
            this.arrivals.set(itemId(item), t);
          }
        if (old.rev !== next.rev) {
          this.activity.push({ at: t, n: 1 });
          this.changedAt = t;
        }
      }
      this.activity = this.activity.filter((x) => t - x.at < 60000).slice(-120);
      for (const [key, at] of this.arrivals) if (t - at > 9000) this.arrivals.delete(key);
      if (!old) this.changedAt = t;
      const currentIds = new Set(next.items.map(itemId));
      for (const key of this.freshHold) if (!currentIds.has(key)) this.freshHold.delete(key);
      while (this.arrivals.size > 1024) this.arrivals.delete(this.arrivals.keys().next().value!);
      this.snapshot = next;
      if (this.connection === "offline" && this.message.startsWith("Engine unavailable"))
        this.message = "Reconnected";
      this.connection = "ready";
      this.observe("plan", JSON.stringify(next.counts.plan));
      this.observe("week", JSON.stringify(next.week));
      for (const source of next.sources)
        this.observe(
          `source:${source.id}`,
          JSON.stringify([source.label, source.state, next.counts.bySource[source.id]]),
        );
      for (const key of this.marks.keys())
        if (
          key.startsWith("source:") &&
          !next.sources.some((source) => `source:${source.id}` === key)
        )
          this.marks.delete(key);
      if (this.focused)
        for (const it of next.items) if (it.derived.fresh) this.freshHold.add(itemId(it));
      if (this.filter !== "" && !next.sources.some((source) => source.id === this.filter))
        this.filter = "";
      const visible = this.visible();
      if (!visible.some((it) => itemId(it) === this.selected))
        this.selected = visible[0] ? itemId(visible[0]) : null;
      if (this.lookPending) {
        this.lookPending = false;
        void this.look();
      }
    } catch (error) {
      if (!this.disposed) {
        this.connection = "offline";
        this.message = `Engine unavailable (${error instanceof RpcError ? error.code : "invalid_reply"}); retrying`;
      }
    } finally {
      this.reading = false;
      if (!this.disposed) {
        this.changed();
        if (this.reread) {
          this.reread = false;
          void this.poll();
        }
      }
    }
  }
  items(): Item[] {
    return this.snapshot?.items ?? [];
  }
  /** Sources that can take a to-do now: they declare todo.add and their data is ok or stale. */
  addable(): Source[] {
    return (
      this.snapshot?.sources.filter(
        (s) => s.writable.includes("todo.add") && ["ok", "stale"].includes(s.state),
      ) ?? []
    );
  }
  visible(): Item[] {
    const rank = new Map(this.snapshot?.sources.map((s, i) => [s.id, i]));
    return this.items()
      .filter((it) => this.filter === "" || it.source === this.filter)
      .sort((a, b) =>
        this.sort === "type"
          ? (rank.get(a.source) ?? 0) - (rank.get(b.source) ?? 0) ||
            Date.parse(b.since) - Date.parse(a.since)
          : this.sort === "age"
            ? Date.parse(b.since) - Date.parse(a.since)
            : priority(a) - priority(b) ||
              Number(b.overlay.pinned) - Number(a.overlay.pinned) ||
              Date.parse(b.since) - Date.parse(a.since),
      );
  }
  current(): Item | undefined {
    return this.items().find((it) => itemId(it) === this.selected);
  }
  isFresh(it: Item): boolean {
    return it.derived.fresh || this.freshHold.has(itemId(it));
  }
  observe(mark: string, value: string): number {
    const old = this.marks.get(mark);
    if (!old || old.value !== value) {
      this.marks.set(mark, { value, at: this.now() });
    }
    return this.marks.get(mark)!.at;
  }
  focus(on: boolean): void {
    if (!on) {
      this.focused = false;
      this.freshHold.clear();
      this.changed();
      return;
    }
    if (this.focused) return;
    this.focused = true;
    for (const it of this.snapshot?.items ?? [])
      if (it.derived.fresh) this.freshHold.add(itemId(it));
    if (this.snapshot) void this.look();
    else this.lookPending = true;
  }
  private async look(): Promise<void> {
    if (this.readOnly || this.disposed) return;
    try {
      await this.rpc.request("act", { do: "look", actor: "you" });
      await this.poll();
    } catch {
      if (!this.disposed) {
        this.message = "Last looked not updated; press a key after reconnecting";
        this.focused = false;
        this.changed();
      }
    }
  }
  private async act(params: Record<string, unknown>, done?: () => void): Promise<void> {
    if (this.busy || this.disposed) return;
    if (this.readOnly) {
      this.message = "Read-only: no changes sent";
      this.changed();
      return;
    }
    if (this.connection !== "ready") {
      this.message = "Engine unavailable; changes not sent";
      this.changed();
      return;
    }
    this.busy = true;
    this.message = "Saving...";
    this.changed();
    try {
      const reply = object(await this.rpc.request("act", { ...params, actor: "you" }));
      if (!Number.isSafeInteger(reply.rev) || Number(reply.rev) < 0)
        throw new Error("invalid_reply");
      if (this.disposed) return;
      done?.();
      this.message = "Saved";
      await this.poll();
    } catch (error) {
      if (!this.disposed) {
        this.message =
          error instanceof RpcError
            ? error.code === "outcome_unknown"
              ? "Outcome unknown; check data before retrying"
              : `Not saved: ${error.code}`
            : "Not saved: invalid reply; check data";
      }
    } finally {
      this.busy = false;
      if (!this.disposed) this.changed();
    }
  }
  async key(key: string): Promise<string | undefined> {
    if (this.input !== null) {
      if (key === "Escape") {
        if (!this.busy) {
          this.input = null;
          this.inputSource = null;
        }
      } else if (key === "Enter") {
        const text = this.input.trim(),
          source = this.inputSource;
        if (text && source) {
          if (!this.addable().some((s) => s.id === source)) {
            this.message = "Selected to-do list is unavailable";
            this.changed();
            return;
          }
          // The list chosen when the draft opened is always named, so nothing can redirect it.
          await this.act({ do: "todo.add", text, source }, () => {
            this.input = null;
            this.inputSource = null;
          });
        }
      } else if (!this.busy && key === "Backspace") this.input = dropLast(this.input);
      else if (
        !this.busy &&
        Array.from(key).length === 1 &&
        !CONTROL.test(key) &&
        this.input.length < 4096
      )
        this.input += key;
      this.changed();
      return;
    }
    if (key === "q" || key === "Escape") return "quit";
    const visible = this.visible(),
      at = visible.findIndex((it) => itemId(it) === this.selected),
      item = this.current();
    if (["j", "k", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(key)) {
      const delta =
        key === "j" || key === "ArrowDown"
          ? 1
          : key === "k" || key === "ArrowUp"
            ? -1
            : key === "PageDown"
              ? 8
              : -8;
      this.selected = visible[Math.max(0, Math.min(visible.length - 1, at + delta))]
        ? itemId(visible[Math.max(0, Math.min(visible.length - 1, at + delta))])
        : null;
      this.selectionAt = this.now();
    } else if (key === "Enter") {
      if (!item?.url) {
        this.message = "No URL for this item";
      } else {
        try {
          const url = new URL(item.url);
          if (!["https:", "http:"].includes(url.protocol)) throw new Error();
          return url.href;
        } catch {
          this.message = "Unsupported URL; only http/https can open";
        }
      }
    } else if (key === "?") this.help = !this.help;
    else if (key === "b") this.ambient = !this.ambient;
    else if (key === "m") {
      this.motion = !this.motion;
      this.bootAt = this.now() - 10000;
    } else if (key === "s")
      this.sort = (["prio", "type", "age"] as const)[
        (["prio", "type", "age"].indexOf(this.sort) + 1) % 3
      ];
    else if (key === "Tab") {
      const ids = ["", ...(this.snapshot?.sources.map((s) => s.id) ?? [])];
      this.filter = ids[(ids.indexOf(this.filter) + 1) % ids.length];
    } else if (/^[0-9]$/.test(key))
      this.filter = key === "0" ? "" : (this.snapshot?.sources[Number(key) - 1]?.id ?? this.filter);
    else if (key === "a") {
      // The selected item's list, else the only list; otherwise the target is ambiguous.
      const lists = this.addable(),
        source = lists.find((s) => s.id === item?.source) ?? (lists.length === 1 ? lists[0] : null);
      if (source) {
        this.input = "";
        this.message = "";
        this.inputSource = source.id;
      } else this.message = lists.length ? "Can't choose a to-do list" : "No writable to-do source";
    } else if (key === "r") {
      if (this.readOnly) this.message = "Read-only: refresh not sent";
      else if (!this.busy) {
        this.busy = true;
        try {
          await this.rpc.request("refresh");
          this.message = "Refresh requested";
          await this.poll();
        } catch {
          this.message = "Refresh failed";
        } finally {
          this.busy = false;
        }
      }
    } else if (item && ["t", "i", "l", "p", "h", "x"].includes(key)) {
      const id = itemId(item),
        source = this.snapshot?.sources.find((s) => s.id === item.source);
      if (isDone(item) && key !== "x") {
        this.message = "Reopen this to-do before triage";
        this.changed();
        return;
      }
      if (key === "x") {
        const action = isDone(item) ? "todo.reopen" : "todo.done";
        if (!source?.writable.includes(action))
          this.message = "This source does not support to-do edits";
        else await this.act({ do: action, key: id });
      } else if (key === "p") await this.act({ do: "pin", key: id, pinned: !item.overlay.pinned });
      else if (key === "h")
        await this.act({
          do: "handled",
          key: id,
          ...(item.overlay.handledAt ? { undo: true } : {}),
        });
      else
        await this.act({
          do: "plan",
          key: id,
          plan: ({ t: "today", i: "inbox", l: "later" } as const)[key as "t" | "i" | "l"],
        });
    }
    this.changed();
    return;
  }
  paste(text: string): void {
    if (this.input === null || this.busy) return;
    // The draft keeps the real text for the scratchpad; the pane shows it measured, never folded.
    this.input = (this.input + text.replace(/[\r\n\t]+/g, " ").replace(CONTROL_ALL, "")).slice(
      0,
      4096,
    );
    this.changed();
  }
  dispose(): void {
    this.disposed = true;
    this.rpc.close();
  }
}
