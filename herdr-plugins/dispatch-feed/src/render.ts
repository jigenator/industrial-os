import { blinkOn } from "@industrial-os/design-system/motions/blink";
import { labelPlate } from "@industrial-os/design-system/elements/label-plate";
import { flash } from "@industrial-os/design-system/motions/flash";
import { DASHBOARD_INKS as D } from "@industrial-os/design-system/foundation/dashboard-colors";
import { CellGrid } from "@industrial-os/design-system/foundation/cell-grid";
import { safeText, fit, span, resolveColor } from "@industrial-os/design-system/foundation/cells";
import type { Line, Style } from "@industrial-os/design-system/foundation/cells";
import { PI_CHROME } from "@industrial-os/design-system/foundation/signal-colors";
import { typeColor } from "@industrial-os/design-system/foundation/type-colors";
import { typeUnit, unitCorners } from "@industrial-os/design-system/elements/type-unit";
import { activityStrip } from "@industrial-os/design-system/elements/activity-strip";
import { activityTrace } from "@industrial-os/design-system/elements/activity-trace";
import { planCounter } from "@industrial-os/design-system/elements/plan-counter";
import { alertTicker } from "@industrial-os/design-system/elements/alert-ticker";
import { ambientField } from "@industrial-os/design-system/elements/ambient-field";
import { decode } from "@industrial-os/design-system/motions/decode";
import { breathe } from "@industrial-os/design-system/motions/breathe";
import { arrivalPing } from "@industrial-os/design-system/motions/arrival-ping";
import { ambientSweep } from "@industrial-os/design-system/motions/ambient-sweep";
import {
  ambientLoad,
  ambientLoadDuration,
} from "@industrial-os/design-system/motions/ambient-load";
import { fillIn } from "@industrial-os/design-system/motions/fill-in";
import { wipe } from "@industrial-os/design-system/motions/wipe";
import { itemId } from "./snapshot.ts";
import type { Item, Source } from "./snapshot.ts";
import { ageText, DECODE_SCRAMBLE, priority } from "./app.ts";
import type { App, Hit, Sort } from "./app.ts";

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  action: Hit;
}
export interface Frame {
  lines: Line[];
  hits: Region[];
}
const bone = PI_CHROME.bone;
const pad = (value: string, n: number): string => {
  const text = fit(safeText(value), Math.max(0, n));
  return text.padEnd(Math.max(0, n));
};
export function hitAt(frame: Frame, x: number, y: number): Hit | null {
  return (
    frame.hits.findLast((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
      ?.action ?? null
  );
}
export function render(app: App, width: number, height: number, time: number): Frame {
  const grid = new CellGrid(width, height),
    hits: Region[] = [];
  const text = (x: number, y: number, value: string, style: Style = {}, max = width - x): void =>
    grid.text(x, y, value, style, Math.max(0, max));
  const structural = (x: number, y: number, value: string, style: Style = {}): void => {
    Array.from(value).forEach((ch, i) => grid.put(x + i, y, ch, style));
  };
  const target = (x: number, y: number, w: number, h: number, action: Hit): void => {
    if (x < width && y < height && w > 0 && h > 0)
      hits.push({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.max(0, Math.min(w, width - x)),
        height: Math.max(0, Math.min(h, height - y)),
        action,
      });
  };
  const m = app.motion,
    boot = Math.max(0, time - app.bootAt),
    s = app.snapshot;
  if (width < 24 || height < 8) {
    text(0, 0, "DISPATCH FEED", { fg: bone, bold: true });
    text(0, 1, app.connection === "offline" ? "ENGINE OFFLINE" : "Needs 24 columns / 8 rows");
    text(0, 2, "q quit / resize");
    return { lines: grid.lines(), hits };
  }
  grid.place(0, 0, alertTicker([], { width }));
  const wide = width >= 85 && height >= 24,
    col = wide ? 40 : 0,
    lx = wide ? 41 : 1,
    lw = width - lx - 1;
  const end = height - 3;
  if (wide && s) {
    let plan = planCounter(s.counts.plan, { width: 36 });
    plan = decode(plan, {
      time: Math.max(0, time - (app.marks.get("plan")?.at ?? app.bootAt)),
      animate: m,
      seed: 7,
      scramble: DECODE_SCRAMBLE,
    });
    grid.place(3, 2, plan);
    let week = activityStrip(
      { blocks: s.week.blocks, total: s.week.total, previous: s.week.lastWeekSoFar },
      { width: 34 },
    );
    week = fillIn(week, {
      time: Math.max(0, boot - 300),
      animate: m,
      region: { left: 7, top: 2, rows: 2, cols: 27 },
      window: 27,
      tick: 25,
    });
    const current = s.week.blocks.findLastIndex((b) => !b.future);
    if (current >= 0)
      week = breathe(week, {
        time: boot,
        animate: m,
        region: { left: 7 + Math.floor(current / 3) * 4 + (current % 3), top: 2, rows: 2, cols: 1 },
      });
    for (const top of [0, 4])
      week = decode(week, {
        time: Math.max(0, time - (app.marks.get("week")?.at ?? app.bootAt)),
        animate: m,
        seed: top + 47,
        scramble: DECODE_SCRAMBLE,
        region: { top, left: 0, rows: 1, cols: 34 },
      });
    grid.place(3, 5, week);
    const available = Math.max(0, height - 14),
      n = s.sources.length,
      unitH = available >= n * 8 ? 7 : available >= n * 7 ? 6 : 3,
      gap = unitH > 3 ? 1 : 0;
    s.sources.forEach((source, i) => {
      const y = 11 + i * (unitH + gap);
      if (y + unitH > end) return;
      const count = s.counts.bySource[source.id] ?? null;
      const oldest = s.items
        .filter(
          (it) =>
            it.source === source.id && !it.overlay.handledAt && !app.completed.has(itemId(it)),
        )
        .sort((a, b) => b.derived.ageMs - a.derived.ageMs)[0];
      let unit = typeUnit(
        {
          label: source.label.toUpperCase(),
          color: source.color,
          state: source.state,
          total: count?.total ?? null,
          waiting: count?.waiting ?? null,
          fresh: count
            ? s.items.filter(
                (it) => it.source === source.id && !it.overlay.handledAt && app.isFresh(it),
              ).length
            : null,
          remaining: oldest?.derived.remaining ?? null,
          age: oldest ? ageText(oldest.derived.ageMs) : "unknown",
          limit: ageText(s.staleLimitMs),
          key: String(i + 1),
          active: app.filter === source.id,
          hover: app.hover?.filter === source.id,
          arriving:
            m &&
            s.items.some(
              (it) =>
                it.source === source.id &&
                app.arrivals.has(itemId(it)) &&
                time - app.arrivals.get(itemId(it))! < 1600,
            ),
        },
        { width: 37, height: unitH },
      );
      // Decode headings/count status only; complete health messages remain untouched.
      const t = Math.max(0, time - (app.marks.get(`source:${source.id}`)?.at ?? app.bootAt));
      unit = decode(unit, {
        time: t,
        duration: 600,
        seed: i + 17,
        animate: m,
        scramble: DECODE_SCRAMBLE,
        region: { top: 0, left: 3, rows: 1, cols: Math.min(28, source.label.length) },
      });
      if (["ok", "stale"].includes(source.state) && !count?.waiting)
        unit = decode(unit, {
          time: t,
          seed: i + 2,
          animate: m,
          scramble: DECODE_SCRAMBLE,
          region: { top: 2, left: 3, rows: 1, cols: 24 },
        });
      if (unitH >= 6)
        unit = fillIn(unit, {
          time: Math.max(0, boot - 300 - (i + 1) * 90),
          animate: m,
          region: { left: 3, top: unitH - 3, rows: 1, cols: 8 },
        });
      if (
        count &&
        String(count.total).length * 4 - 1 < 22 &&
        ["ok", "stale"].includes(source.state)
      )
        unit = flash(unit, {
          time: t,
          animate: m,
          step: 70,
          pattern: ["invert", "invert", "invert", "invert", "invert", "invert"],
          invertStyle: { fg: blinkOn(t, { on: 70, off: 70 }) ? "primary" : D.edge, bg: "field" },
          region: {
            top: 2,
            left: 37 - 3 - (String(count.total).length * 4 - 1),
            rows: 3,
            cols: String(count.total).length * 4 - 1,
          },
        });
      grid.place(1, y, unit);
      const snap =
        m &&
        ((app.filter === source.id && time - app.selectionAt < 180) ||
          (app.hover?.filter === source.id && time - app.hoverAt < 180));
      if (snap) {
        for (const corner of unitCorners(37, unitH, 0))
          for (let k = 0; k < 2; k++) grid.put(1 + corner.x + k, y + corner.y, " ");
        for (const corner of unitCorners(37, unitH, 1))
          Array.from(corner.text).forEach((ch, k) =>
            grid.put(1 + corner.x + k, y + corner.y, ch, { fg: bone }),
          );
      }
      target(1, y, 37, unitH, { filter: app.filter === source.id ? "" : source.id });
    });
    const samples = Array.from({ length: 38 }, (_, i) =>
      app.activity
        .filter((e) => e.at > time - (38 - i) * 1000 && e.at <= time - (37 - i) * 1000)
        .reduce((a, e) => a + e.n, 0),
    );
    grid.place(
      3,
      height - 3,
      activityTrace(samples, { width: 34, connected: app.connection === "ready" }),
    );
  }
  if (wide) for (let y = 2; y < height; y++) grid.put(col - 1, y, "│", { fg: D.edge });
  let cx = lx;
  text(cx, 2, "SORT ", { fg: D.muted });
  cx += 5;
  for (const sort of ["type", "prio", "age"] as Sort[]) {
    const label = ` ${sort.toUpperCase()} `,
      active = app.sort === sort;
    text(cx, 2, label, {
      fg: active ? "field" : "decorative",
      ...(active ? { bg: bone } : {}),
      bold: active,
    });
    target(cx, 2, label.length, 1, { sort });
    cx += label.length + 1;
  }
  // Planned and disabled sources hold no items by design; only a source that should report and can't makes ALL unknown.
  const reporting =
    s?.sources.filter((src) => src.state !== "planned" && src.state !== "disabled") ?? [];
  const allCount =
    s && reporting.every((src) => s.counts.bySource[src.id] != null)
      ? String(reporting.reduce((n, src) => n + (s.counts.bySource[src.id]?.total ?? 0), 0))
      : "?";
  const all = ` ALL ${allCount} `;
  if (lw > cx - lx + all.length + 4) {
    text(width - all.length - 2, 2, all, {
      fg: app.filter === "" ? "field" : "decorative",
      ...(app.filter === "" ? { bg: bone } : {}),
      bold: true,
    });
    target(width - all.length - 2, 2, all.length, 1, { filter: "" });
  }
  const listTop = 4,
    listH = Math.max(1, end - listTop);
  if (!s) {
    text(
      lx + 2,
      listTop + 1,
      app.connection === "loading" ? "Connecting to source collector..." : "ENGINE OFFLINE",
      { fg: bone, bold: true },
    );
    text(lx + 2, listTop + 3, "No snapshot available; retrying every 5s", { fg: D.dim });
  } else drawList(app, grid, hits, lx, listTop, lw, listH, time);
  const footer = " ENGINE TRIAGE ";
  structural(lx, end, "─".repeat(Math.max(0, lw - footer.length)) + footer, { fg: D.edge });
  const status =
    app.input !== null
      ? `ADD TO ${s?.sources.find((src) => src.id === app.inputSource)?.label ?? "TO-DO"}: ${app.input}_`
      : app.connection === "offline"
        ? app.message
        : app.busy
          ? app.message
          : app.message || "Ready. Tab or 0-5 filters, s sorts, ? keys.";
  text(lx, end + 1, status, {
    fg:
      app.connection === "offline"
        ? "secondary"
        : app.message || app.input !== null
          ? bone
          : D.muted,
  });
  if (app.input !== null)
    text(lx, end + 2, app.message || "Enter submit / Esc cancel; draft stays on failure", {
      fg: D.muted,
    });
  else {
    let x = lx + 1;
    for (const [key, label] of [
      ["Enter", "open"],
      ["t", "today"],
      ["i", "inbox"],
      ["l", "later"],
      ["p", "pin"],
      ["h", "handled"],
      ["x", "done"],
      ["a", "add"],
    ]) {
      if (x + key.length + label.length + 3 > width) break;
      grid.place(x, end + 2, [
        labelPlate(key, { form: "slab", pad: false, style: { fg: bone, bg: D.edge } }),
      ]);
      target(x, end + 2, key.length, 1, { key });
      x += key.length + 1;
      text(x, end + 2, label + "  ", { fg: D.dim });
      x += label.length + 2;
    }
  }
  if (app.connection === "offline" && s)
    text(lx, 1, "ENGINE OFFLINE / LAST GOOD DATA / RETRYING", { fg: D.dim, bold: true });
  else if (app.readOnly) text(lx, 1, "READ ONLY", { fg: D.muted });
  if (app.help) {
    const rows = [
      "DISPATCH FEED / KEYS",
      "j k / arrows: move; click selects",
      "Enter: open http/https URL",
      "t / i / l: today / inbox / later",
      "p: pin; h: handled / undo",
      "x: to-do done / reopen (session-only)",
      "a: add to-do; Enter submit; Esc cancel",
      "Tab / 0-5: source; s: type/prio/age",
      "b: ambient; m: motion; r: refresh",
      "? close help; q / Esc: quit",
    ];
    const y0 = Math.max(1, Math.floor((height - rows.length) / 2));
    rows.forEach((row, i) => {
      const w = Math.min(width - 2, 58);
      grid.place(1, y0 + i, [[span(pad(row, w), { fg: bone, bg: "surface" })]]);
    });
    hits.length = 0;
  }
  let base = grid.lines();
  // Decoration-only layer: semantic cells are composed later and cannot be swept or veiled.
  let ambient = ambientField(base, {
    enabled: app.ambient,
    regions: hits.map(({ x, y, width, height }) => ({ x, y, width, height })),
  });
  const decoration = ambient.map((line, y) =>
    line.map((cell, x) =>
      base[y][x].text === " " && ambient[y][x].text !== " " ? cell : span(" ", cell.style),
    ),
  );
  let decorated = ambientLoad(decoration, { time: boot, animate: m });
  if (app.ambient && boot >= ambientLoadDuration(decoration))
    decorated = ambientSweep(decorated, { time: boot, animate: m });
  for (const [key, at] of app.arrivals) {
    const item = s?.items.find((it) => itemId(it) === key),
      index = s?.sources.findIndex((src) => src.id === item?.source) ?? -1;
    if (index >= 0)
      decorated = arrivalPing(decorated, {
        time: Math.max(0, time - at),
        animate: m,
        x: 33,
        y: 14 + index * 8,
        region: { top: 1, left: 0, rows: height - 1, cols: width },
      });
  }
  decorated = decorated.map((line) =>
    line.flatMap((s) => Array.from(s.text).map((text) => span(text, s.style))),
  );
  const composed = ambient.map((line, y) =>
    line.map((cell, x) =>
      base[y][x].text !== " " ||
      hits.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
        ? span(base[y][x].text, {
            ...base[y][x].style,
            bg:
              resolveColor(base[y][x].style.bg ?? "field") === resolveColor("field")
                ? cell.style.bg
                : base[y][x].style.bg,
          })
        : span(decorated[y]?.[x]?.text ?? " ", {
            ...cell.style,
            fg: decorated[y]?.[x]?.style.fg ?? cell.style.fg,
          }),
    ),
  );
  // Offline dims every retained data cell, not the explicit offline diagnostic.
  if (app.connection === "offline" && s)
    for (let y = 2; y < end; y++)
      for (const cell of composed[y]) cell.style = { ...cell.style, fg: D.muted };
  base = composed;
  return { lines: base, hits };
}
function drawList(
  app: App,
  grid: CellGrid,
  hits: Region[],
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const items = app.visible(),
    s = app.snapshot!;
  const put = (xx: number, yy: number, ch: string, style: Style = {}): void =>
    grid.put(xx, yy, ch, style);
  const text = (xx: number, yy: number, t: string, style: Style = {}, max = w): void =>
    grid.text(xx, yy, t, style, Math.max(0, max));
  const sourceOf = (item: Item): Source => s.sources.find((source) => source.id === item.source)!;
  const rows: (
    | { kind: "rule"; label: string; color: Style["fg"]; count: number }
    | { kind: "row"; item: Item; index: number }
    | { kind: "gap" }
  )[] = [];
  const groups =
    app.sort === "type"
      ? s.sources.map((src) => ({
          label: src.label,
          color: typeColor(src.color),
          items: items.filter((it) => it.source === src.id),
        }))
      : app.sort === "age"
        ? [
            {
              label: "NEW SINCE LAST LOOK",
              color: "accent" as const,
              items: items.filter((it) => app.isFresh(it)),
            },
            {
              label: "EARLIER",
              color: "decorative" as const,
              items: items.filter((it) => !app.isFresh(it)),
            },
          ]
        : [1, 2, 3].map((rank) => ({
            label: rank === 1 ? "▲ WAITING" : rank === 2 ? "■ PINNED" : "□ NORMAL",
            color: rank === 1 ? ("primary" as const) : rank === 2 ? bone : ("secondary" as const),
            items: items.filter((it) => priority(it) === rank),
          }));
  let index = 0;
  for (const group of groups) {
    if (!group.items.length) continue;
    if (rows.length) rows.push({ kind: "gap" });
    rows.push({ kind: "rule", label: group.label, color: group.color, count: group.items.length });
    for (const item of group.items) rows.push({ kind: "row", item, index: index++ });
  }
  if (!items.length) {
    text(x + 2, y + 1, "Your plate is clear.", { fg: bone, bold: true }, w - 2);
    if (s.sources.some((src) => !["ok", "planned", "disabled"].includes(src.state)))
      text(x + 2, y + 3, "Some sources unavailable; counts unknown", { fg: D.dim }, w - 2);
    return;
  }
  const compact = w < 60;
  if (!compact) {
    text(x, y, "  #  TDY BOX LTR   TYPE ITEM", { fg: D.muted });
    text(x + w - 26, y, "FROM   STATUS         AGE", { fg: D.muted }, 26);
    y++;
    h--;
  }
  const selectedRow = rows.findIndex((r) => r.kind === "row" && itemId(r.item) === app.selected),
    start = Math.max(0, selectedRow - h + 2);
  let yy = y;
  for (const row of rows.slice(start, start + h)) {
    if (row.kind === "gap") {
      yy++;
      continue;
    }
    if (row.kind === "rule") {
      const label = row.label,
        chars = Array.from(label);
      let xx = x;
      for (const ch of "┄┄ ") put(xx++, yy, ch, { fg: D.edge });
      for (const ch of chars.slice(0, Math.max(0, w - 10)))
        put(xx++, yy, ch, { fg: row.color, bold: true });
      put(xx++, yy, " ");
      const tail = ` ${row.count} ┄┄`;
      while (xx < x + w - tail.length) put(xx++, yy, "┄", { fg: D.edge });
      for (const ch of tail) put(xx++, yy, ch, { fg: D.muted });
      yy++;
      continue;
    }
    const it = row.item,
      key = itemId(it),
      selected = key === app.selected,
      done = app.completed.has(key),
      handled = !!it.overlay.handledAt,
      source = sourceOf(it),
      fresh = app.isFresh(it) && !done && !handled;
    const bg = selected ? "surface" : "field",
      style: Style = {
        fg: done || handled ? "decorative" : selected || fresh ? "primary" : bone,
        bg,
        bold: selected || fresh,
      };
    if (selected) {
      let line = [span(" ".repeat(w), { bg: "surface" })];
      line = wipe([line], {
        time: Math.max(0, time - app.selectionAt),
        animate: app.motion,
        direction: "ltr",
        times: [40, 80, 120, 160],
        fractions: [0.25, 0.5, 0.75, 1],
        fromStyle: { bg: "field" },
      })[0];
      grid.place(x, yy, [line]);
    }
    const cell = (xx: number, ch: string, st: Style): void =>
      put(xx, yy, ch, { ...st, bg: grid.rows[yy]?.[xx]?.style.bg ?? bg });
    let xx = x;
    const run = (value: string, n: number, st: Style): void => {
      for (const ch of pad(value, n)) {
        cell(xx++, ch, st);
      }
    };
    run(
      compact
        ? String(row.index + 1).padStart(2, "0")
        : ` ${String(row.index + 1).padStart(2, "0")}  `,
      compact ? 3 : 5,
      {
        fg: selected ? bone : "decorative",
        bold: selected,
      },
    );
    if (!compact) {
      for (const plan of ["today", "inbox", "later"]) {
        cell(xx++, " ", { fg: bone });
        cell(xx++, it.overlay.plan === plan ? "●" : "·", {
          fg: it.overlay.plan === plan ? bone : "surface",
        });
        cell(xx++, " ", { fg: bone });
        if (plan !== "later") cell(xx++, " ", { fg: bone });
      }
      cell(xx++, " ", { fg: bone });
    }
    cell(xx++, done ? "×" : it.derived.waiting ? "!" : it.overlay.pinned ? "◆" : " ", {
      fg: it.derived.waiting && !done ? "critical" : bone,
      bold: true,
    });
    cell(xx++, " ", { fg: bone });
    run(source.tag, 4, { fg: typeColor(source.color), bold: true });
    cell(xx++, " ", { fg: bone });
    const age = ageText(it.derived.ageMs),
      titleW = Math.max(1, x + w - xx - (compact ? 6 : 27));
    run(done ? `[done] ${it.title}` : handled ? `[handled] ${it.title}` : it.title, titleW, style);
    if (!compact) {
      cell(xx++, " ", { fg: bone });
      // A to-do's who is the writing session id; its section heading says more.
      run(it.kind === "todo" ? it.where : it.who, 6, { fg: D.muted });
      cell(xx++, " ", { fg: bone });
      run(
        done
          ? "DONE HERE"
          : handled
            ? "HANDLED"
            : source.state === "stale"
              ? "STALE DATA"
              : it.status,
        12,
        { fg: D.dim },
      );
      cell(xx++, " ", { fg: bone });
    }
    while (xx < x + w - 5) cell(xx++, " ", { fg: bone });
    run(age.padStart(5), 5, { fg: fresh ? "accent" : "decorative" });
    if (app.arrivals.has(key) && app.motion && time - app.arrivals.get(key)! < 9000)
      put(x, yy, time - app.arrivals.get(key)! < 2400 ? "▐" : "◇", { fg: "accent", bg });
    hits.push({ x, y: yy, width: w, height: 1, action: { select: key } });
    yy++;
  }
}
export function plain(frame: Frame): string {
  return frame.lines.map((line) => line.map((s) => s.text).join("")).join("\n");
}
export function diffFrame(frame: Frame, previous: Frame | null): string {
  let output = "",
    last = "";
  for (let y = 0; y < frame.lines.length; y++) {
    const cells = frame.lines[y].flatMap((s) =>
      Array.from(s.text).map((text) => ({ text, style: s.style })),
    );
    const before = previous?.lines[y]?.flatMap((s) =>
      Array.from(s.text).map((text) => ({ text, style: s.style })),
    );
    let positioned = false;
    for (let x = 0; x < cells.length; x++) {
      const cell = cells[x],
        style = cell.style,
        fg = resolveColor(style.fg ?? "secondary"),
        bg = resolveColor(style.bg ?? "field");
      const prev = before?.[x];
      if (
        prev &&
        prev.text === cell.text &&
        resolveColor(prev.style.fg ?? "secondary") === fg &&
        resolveColor(prev.style.bg ?? "field") === bg &&
        !!prev.style.bold === !!style.bold
      ) {
        positioned = false;
        continue;
      }
      if (!positioned) output += `\x1b[${y + 1};${x + 1}H`;
      positioned = true;
      const rgb = (hex: string): string =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(";");
      const sgr = `\x1b[0;${style.bold ? "1;" : ""}38;2;${rgb(fg)};48;2;${rgb(bg)}m`;
      if (sgr !== last) {
        output += sgr;
        last = sgr;
      }
      output += cell.text;
    }
  }
  return output ? output + "\x1b[0m" : "";
}
