// Pi Reloader: lists the Pi agents Herdr reports as idle or done, and reloads or restarts them through each Pi's
// draft guard (pi/reloader-guard). Opened as a window (mod.json) by `mod.open:pi-reloader`; `pi-reloader.reload`,
// `pi-reloader.reset` and `pi-reloader.close` reach it as mod commands. Every rule is in reloader.js.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, layout, focused, hc, run, theme, props, closeOverlay, nextCommand } from "herdr";
import { connect } from "net";
import { ONLY } from "./scope.js";
import { decodeUtf8, heading, parseGuard, reloadAll, resetAll, selectCandidates, summaryLines } from "./reloader.js";

const ACTIONS = [
	{ id: "reload", label: "Reload all Pi", verb: "Reloaded", hint: "Pi's own reload; unsent drafts are skipped, never submitted or cleared." },
	{ id: "reset", label: "Reset all Pi", verb: "Restarted", hint: "Reset moves focus. Don't type, click or switch until the summary." },
];
const GUARD_TIMEOUT_MS = 3_000;
const MAX_REPLY_BYTES = 8_192;
const MAX_ERRORS = 5;
const TIMED_OUT = Symbol("timed out");

export default class PiReloader extends View {
	init(_props, cx) {
		this.selected = 0;
		this.running = null; // { action, done, total, note }
		this.result = null; // { action, summary }
		this.handle = cx.focus_handle();
		this.handle.focus();
		cx.spawn(async (cx) => {
			for (;;) {
				const command = await nextCommand();
				if (command === "close") this.close();
				else if (command === "focus") this.handle.focus();
				else this.start(ACTIONS.find((a) => a.id === command), cx);
				cx.notify();
			}
		});
	}

	close() {
		if (!this.running) closeOverlay(props().overlay);
	}

	selection() {
		return selectCandidates(agents(), terminals(), layout(), ONLY);
	}

	start(action, cx) {
		if (!action || this.running) return;
		const origin = focused();
		const { candidates, skipped } = this.selection();
		this.result = null;
		this.running = { action, done: 0, total: candidates.length, note: "starting" };
		cx.notify();
		cx.spawn(async (cx) => {
			const io = this.io(cx, origin);
			const summary = skipped; // a fresh summary already holding the selection's skips
			try {
				await (action.id === "reload" ? reloadAll : resetAll)(io, candidates, summary);
			} catch (error) {
				summary.failed++;
				summary.errors.push(String(error?.message ?? error));
			}
			this.running = null;
			this.result = { action, summary };
			this.handle.focus();
			cx.notify();
		});
	}

	// The host side of reloader.js: herdr-core, the guard's loopback socket and focus commands.
	io(cx, origin) {
		// The losing sleep resolves harmlessly; a rejecting timer would be an unhandled rejection after every reply.
		const within = async (what, work) => {
			work.catch(() => {}); // a late failure after a timeout is already reported
			const result = await Promise.race([work, cx.sleep(GUARD_TIMEOUT_MS).then(() => TIMED_OUT)]);
			if (result === TIMED_OUT) throw new Error(`${what} timed out`);
			return result;
		};
		return {
			now: () => Date.now(),
			sleep: (ms) => cx.sleep(ms),
			progress: (done, total, note) => { this.running = { ...this.running, done, total, note }; cx.notify(); },
			async get(address) {
				const r = await hc(["get", address, "--json"]);
				if (r.code !== 0) throw new Error(`hc get failed: ${r.stderr.trim() || r.code}`);
				return JSON.parse(r.stdout);
			},
			async send(address, text) {
				const r = await hc(["send", address, text]);
				if (r.code !== 0) throw new Error(`hc send failed: ${r.stderr.trim() || r.code}`);
			},
			async call(guard, line) {
				const socket = await within("guard connect", connect("127.0.0.1", guard.port));
				try {
					await socket.write(line);
					const bytes = [];
					const read = async () => {
						while (!bytes.includes(10) && bytes.length <= MAX_REPLY_BYTES) {
							const chunk = await socket.read(MAX_REPLY_BYTES);
							if (chunk === null) break;
							bytes.push(...chunk);
						}
					};
					await within("guard reply", read());
					return decodeUtf8(bytes.slice(0, Math.max(0, bytes.indexOf(10))));
				} finally {
					socket.close();
				}
			},
			focus: (address) => run("agent.focus", { terminal: address }),
			restore() {
				if (!origin) throw new Error("no original focus recorded");
				run("space.select", { id: origin.space });
				run("tab.select", { id: origin.tab });
				run("pane.focus", origin.pane ? { pane: origin.pane } : { terminal: origin.terminal });
			},
		};
	}

	render(cx) {
		const t = theme();
		const { candidates, skipped } = this.selection();
		const guards = new Map(terminals().map((x) => [x.address, parseGuard(x.labels)]));
		const line = (text, color = t.foreground) => div().truncate().text_color(color).child(text);
		const section = (text) => div().pt(6).text_size(11).font_semibold().text_color(t.dim).child(text);
		const body = [];

		if (this.running) {
			const { action, done, total, note } = this.running;
			body.push(line(`DON'T TYPE · ${action.label} ${done}/${total} · ${note}`, t.working));
			body.push(line(action.hint, t.muted));
		} else {
			ACTIONS.forEach((action, i) => body.push(
				h_flex().id(`action-${action.id}`).h(26).px(8).items_center().rounded(5).cursor_pointer()
					.when(i === this.selected, (el) => el.bg(t.selected))
					.hover((s) => s.bg(t.hover))
					.on_mouse_down("left", (_e, cx) => cx.stop_propagation()) // a press elsewhere drags the window
					.on_click((_e, cx) => { this.selected = i; this.start(action, cx); })
					.child(div().text_color(i === this.selected ? t.foreground : t.muted).child(`${i === this.selected ? ">" : " "} ${action.label}`))));
			body.push(line(ACTIONS[this.selected].hint, t.muted));
		}

		if (this.result) {
			const { action, summary } = this.result;
			const head = heading(summary);
			body.push(section("LAST RUN"));
			body.push(line(`${action.label}: ${head}`, head === "Completed with errors" ? t.blocked : t.foreground));
			for (const text of summaryLines(summary, action.verb)) body.push(line(text, t.muted));
			for (const text of summary.errors.slice(0, MAX_ERRORS)) body.push(line(`Error: ${text}`, t.blocked));
			if (summary.errors.length > MAX_ERRORS) body.push(line(`…and ${summary.errors.length - MAX_ERRORS} more errors`, t.blocked));
			for (const text of summary.outcomes) body.push(line(text, t.dim));
		}

		body.push(section(`IDLE OR DONE PI (${candidates.length})`));
		if (candidates.length === 0) body.push(line("No Pi agent here is idle or done.", t.dim));
		for (const c of candidates) {
			const guard = guards.get(c.address) ? "guard" : "NO GUARD";
			body.push(line(`${c.address}  ${c.wasIdle ? "idle" : "done"}  ${guard}  ${c.where}  ${c.title ?? ""}`, guard === "guard" ? t.foreground : t.blocked));
		}
		const notNow = [["busy", skipped.busy], ["not Pi", skipped.notPi], ["protected", skipped.protected], ["another machine", skipped.remote]]
			.filter(([, n]) => n > 0).map(([what, n]) => `${n} ${what}`);
		if (notNow.length) body.push(line(`Not acted on: ${notNow.join(" · ")}`, t.dim));
		if (Array.isArray(ONLY)) body.push(line(`Test scope: only ${ONLY.join(", ")}`, t.blocked));

		return v_flex()
			.id("pi-reloader")
			.track_focus(this.handle)
			.on_key_down((e, cx) => {
				const k = e.key;
				if (this.running) { cx.stop_propagation(); return; } // keys wait for the summary
				if (k === "escape" || k === "q") this.close();
				else if (k === "down" || k === "j") this.selected = (this.selected + 1) % ACTIONS.length;
				else if (k === "up" || k === "k") this.selected = (this.selected + ACTIONS.length - 1) % ACTIONS.length;
				else if (k === "enter") this.start(ACTIONS[this.selected], cx);
				else return;
				cx.stop_propagation();
				cx.notify();
			})
			.size_full()
			.min_h(0)
			.p(16)
			.gap(4)
			.bg(t.popover)
			.text_size(13)
			.child(h_flex().items_center().pb(4)
				.child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Pi Reloader"))
				.child(div().text_size(11).text_color(t.dim).child(this.running ? "running" : "↑↓ Enter · Esc")))
			.child(v_flex().id("pi-reloader-body").flex_1().min_h(0).gap(2).overflow_y_scrollbar().children(body));
	}
}
