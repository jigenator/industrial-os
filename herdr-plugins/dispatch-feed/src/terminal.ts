import { App } from "./app.ts";
import { FeedClient, socketPath } from "./transport.ts";
import { diffFrame, hitAt, plain, render } from "./render.ts";
import type { Frame } from "./render.ts";
import { Input } from "./input.ts";
import type { InputEvent } from "./input.ts";
import { spawn } from "node:child_process";

export const ENTER = "\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[?1003h\x1b[?1006h\x1b[?1004h\x1b[?2004h";
export const LEAVE =
  "\x1b[?2004l\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?1004l\x1b[?7h\x1b[0m\x1b[?25h\x1b[?1049l";
export async function run(args: string[]): Promise<void> {
  args = [...args];
  const sourceIndex = args.indexOf("--sources");
  const sourceList = sourceIndex < 0 ? process.env.DISPATCH_FEED_SOURCES : args[sourceIndex + 1];
  if (sourceIndex >= 0) {
    if (sourceList === undefined || sourceList.startsWith("--"))
      throw new Error("--sources requires a comma-separated list");
    args.splice(sourceIndex, 2);
  }
  const sources = (sourceList ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const allowed = new Set(["--plain", "--read-only", "--motion-off", "--help"]);
  if (args.some((arg) => !allowed.has(arg)))
    throw new Error(
      "usage: dispatch-feed [--plain] [--read-only] [--motion-off] [--sources a,b,c]",
    );
  if (args.includes("--help")) {
    console.log(
      "dispatch-feed [--plain] [--read-only] [--motion-off] [--sources a,b,c]\nKeys: ? help, q quit, m motion, b ambient. SOURCE_COLLECTOR_HOME selects the engine.\n--sources overrides DISPATCH_FEED_SOURCES; empty lists include all sources.",
    );
    return;
  }
  const readOnly =
    args.includes("--read-only") ||
    args.includes("--plain") ||
    !process.stdin.isTTY ||
    !process.stdout.isTTY;
  const client = new FeedClient(socketPath(), readOnly, 3000, sources);
  let frame: Frame | null = null,
    stopped = false,
    failed = false,
    drawPending = false;
  let animation: ReturnType<typeof setTimeout> | undefined,
    pollTimer: ReturnType<typeof setTimeout> | undefined,
    escapeTimer: ReturnType<typeof setTimeout> | undefined;
  const now = (): number => performance.now();
  const dimensions = (): [number, number] => [
    Math.min(1000, Math.max(1, process.stdout.columns || 118)),
    Math.min(1000, Math.max(1, process.stdout.rows || 54)),
  ];
  const app = new App(client, now, () => scheduleDraw(), readOnly);
  app.motion = !args.includes("--motion-off") && !process.env.NO_MOTION;
  const parser = new Input();
  function draw(): void {
    drawPending = false;
    if (stopped) return;
    try {
      const [w, h] = dimensions(),
        next = render(app, w, h, now());
      process.stdout.write(diffFrame(next, frame));
      frame = next;
    } catch {
      failed = true;
      process.stdout.write("\x1b[0m\x1b[HDispatch feed rendering failed. Press q to close.\x1b[K");
    }
    if (app.motion && !failed) {
      const t = now();
      const fast =
        t - app.bootAt < 2200 ||
        t - app.changedAt < 650 ||
        t - app.selectionAt < 200 ||
        t - app.hoverAt < 200 ||
        Array.from(app.arrivals.values()).some((at) => t - at < 2000);
      animation = setTimeout(
        () => {
          animation = undefined;
          scheduleDraw();
        },
        fast ? 25 : 67,
      );
    }
  }
  function scheduleDraw(): void {
    if (stopped || drawPending) return;
    if (animation) {
      clearTimeout(animation);
      animation = undefined;
    }
    drawPending = true;
    queueMicrotask(draw);
  }
  function cleanup(): void {
    if (stopped) return;
    stopped = true;
    app.dispose();
    for (const timer of [animation, pollTimer, escapeTimer]) if (timer) clearTimeout(timer);
    process.stdin.off("data", onData);
    process.stdin.pause();
    process.stdout.off("resize", onResize);
    for (const [signal, handler] of handlers) process.off(signal, handler);
    process.off("exit", cleanup);
    process.stdin.setRawMode?.(wasRaw);
    process.stdout.write(LEAVE);
  }
  const openers = new Set<ReturnType<typeof spawn>>();
  function quit(code = 0): void {
    cleanup();
    for (const child of openers) child.kill("SIGKILL");
    process.exitCode = code;
  }
  async function event(e: InputEvent): Promise<void> {
    if (stopped) return;
    if (e.type === "focus") {
      app.focus(e.on);
      return;
    }
    if (e.type === "paste") {
      app.focus(true);
      app.paste(e.text);
      return;
    }
    if (e.type === "mouse") {
      const target = frame ? hitAt(frame, e.x, e.y) : null;
      if (e.hover) {
        if (JSON.stringify(app.hover) !== JSON.stringify(target)) {
          app.hover = target;
          app.hoverAt = now();
          scheduleDraw();
        }
        return;
      }
      app.focus(true);
      if (target?.select) {
        app.selected = target.select;
        app.selectionAt = now();
      }
      if (target?.filter !== undefined) {
        app.filter = target.filter;
        app.selectionAt = now();
      }
      if (target?.sort) app.sort = target.sort;
      if (target?.key) await event({ type: "key", key: target.key });
      scheduleDraw();
      return;
    }
    if (e.key === "\x03") {
      quit(130);
      return;
    }
    if (failed) {
      if (e.key === "q" || e.key === "Escape") quit(1);
      return;
    }
    app.focus(true);
    const result = await app.key(e.key);
    if (stopped) return;
    if (result === "quit") {
      quit();
      return;
    }
    if (result) {
      const child = spawn("/usr/bin/open", [result], { stdio: "ignore" });
      openers.add(child);
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.once("error", () => {
        app.message = "Could not open URL";
        scheduleDraw();
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        openers.delete(child);
        if (code) {
          app.message = "Could not open URL";
          scheduleDraw();
        }
      });
    }
  }
  function onData(chunk: Buffer): void {
    if (escapeTimer) clearTimeout(escapeTimer);
    for (const e of parser.feed(chunk.toString("utf8")))
      void event(e).catch(() => {
        app.message = "Input action failed";
        scheduleDraw();
      });
    escapeTimer = setTimeout(() => {
      for (const e of parser.flushEscape()) void event(e);
    }, 40);
  }
  function onResize(): void {
    frame = null;
    scheduleDraw();
  }
  const wasRaw = process.stdin.isRaw ?? false;
  const handlers: [NodeJS.Signals, () => void][] = [
    ["SIGINT", () => quit(130)],
    ["SIGTERM", () => quit(143)],
    ["SIGHUP", () => quit(129)],
  ];
  if (readOnly && (args.includes("--plain") || !process.stdin.isTTY || !process.stdout.isTTY)) {
    await app.poll();
    app.motion = false;
    const [w, h] = dimensions();
    console.log(plain(render(app, w, h, now())));
    app.dispose();
    return;
  }
  process.on("exit", cleanup);
  for (const [signal, handler] of handlers) process.on(signal, handler);
  try {
    process.stdin.setRawMode(true);
    process.stdin.on("data", onData);
    process.stdin.resume();
    process.stdout.on("resize", onResize);
    process.stdout.write(ENTER);
    scheduleDraw();
    const poll = async (): Promise<void> => {
      await app.poll();
      if (!stopped) pollTimer = setTimeout(() => void poll(), 5000);
    };
    void poll();
  } catch {
    quit(1);
  }
}
