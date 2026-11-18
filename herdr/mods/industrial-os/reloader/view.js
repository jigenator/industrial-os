// Pi Reloader: lists the Pi agents Herdr reports as idle or done, and reloads or restarts them through each Pi's
// draft guard (pi/reloader-guard). Opened as a window by `mod.open:industrial-os`: mod.json's overlay carries
// `part: "reloader"`, and main.js runs this view as that copy's root, calling init, render and close with its own cx.
// `industrial-os.reloader-reload`, `industrial-os.reloader-reset` and `industrial-os.reloader-close` reach it as mod
// commands; every copy of the mod hears every command, so these names are this window's alone. Every rule is in
// reloader.js.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, layout, hc, theme, props, closeOverlay, nextCommand } from "herdr";
import { connect } from "net";
import { decodeUtf8, heading, parseGuard, reloadOne, resetOne, runAll, selectCandidates } from "./reloader.js";

const ACTIONS = [
	{ id: "reload", label: "Reload all Pi", verb: "Reloaded", one: reloadOne, hint: "Pi's own reload; unsent drafts are skipped, never submitted or cleared." },
	{ id: "reset", label: "Reset all Pi", verb: "Restarted", one: resetOne, hint: "Quits each Pi and resumes its session in the same shell; drafts are skipped." },
];
const GUARD_TIMEOUT_MS = 3_000;
const MAX_REPLY_BYTES = 8_192;
const TIMED_OUT = Symbol("timed out");

export class PiReloader extends View {
	init(_props, cx) {
		this.selected = 0;
		this.running = null; // { action, done, total }
		this.result = null; // { action, summary }
		this.handle = cx.focus_handle();
		this.handle.focus();
		cx.spawn(async (cx) => {
			for (;;) {
				const command = await nextCommand();
				if (command === "reloader-close") this.close();
				else if (command === "focus") this.handle.focus();
				else this.start(ACTIONS.find((a) => `reloader-${a.id}` === command), cx);
				cx.notify();
			}
		});
	}

	close() {
		if (!this.running) closeOverlay(props().overlay);
	}

	// `only` in mod.json's overlay props limits a test copy to its throwaway terminals.
	selection() {
		return selectCandidates(agents(), terminals(), layout(), props()?.only);
	}

	start(action, cx) {
		if (!action || this.running) return;
		const { candidates } = this.selection();
		this.result = null;
		this.running = { action, done: 0, total: candidates.length };
		cx.notify();
		cx.spawn(async (cx) => {
			const summary = await runAll(this.io(cx), candidates, action.one, action.verb);
			this.running = null;
			this.result = { action, summary };
			this.handle.focus();
			cx.notify();
		});
	}

	// The host side of reloader.js: herdr-core and the guard's loopback socket.
	io(cx) {
		// The losing sleep resolves harmlessly; a rejecting timer would be an unhandled rejection after every reply.
		const within = async (what, work) => {
			work.catch(() => {}); // a late failure after a timeout is already reported
			const result = await Promise.race([work, cx.sleep(GUARD_TIMEOUT_MS).then(() => TIMED_OUT)]);
			if (result === TIMED_OUT) throw new Error(`${what} timed out`);
			return result;
		};
		const run = async (args) => {
			const r = await hc(args);
			if (r.code !== 0) throw new Error(`hc ${args[0]} failed: ${r.stderr.trim() || r.code}`);
			return r.stdout;
		};
		return {
			now: () => Date.now(),
			sleep: (ms) => cx.sleep(ms),
			progress: (done, total) => { this.running = { ...this.running, done, total }; cx.notify(); },
			get: async (address) => JSON.parse(await run(["get", address, "--json"])),
			send: (address, text) => run(["send", address, text]),
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
		};
	}

	render(cx) {
		const t = theme();
		const { candidates, busy, protected: guarded } = this.selection();
		const guards = new Map(terminals().map((x) => [x.address, parseGuard(x.labels)]));
		const line = (text, color = t.foreground) => div().truncate().text_color(color).child(text);
		const section = (text) => div().pt(6).text_size(11).font_semibold().text_color(t.dim).child(text);
		const body = [];

		if (this.running) {
			const { action, done, total } = this.running;
			body.push(line(`${action.label} ${done}/${total}`, t.working));
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
			body.push(line(`${action.verb}: ${summary.completed} · Skipped: ${summary.skipped} · Failed: ${summary.failed}`, t.muted));
			for (const text of summary.outcomes) body.push(line(text, text.includes(" failed: ") ? t.blocked : t.dim));
		}

		body.push(section(`IDLE OR DONE PI (${candidates.length})`));
		if (candidates.length === 0) body.push(line("No Pi agent here is idle or done.", t.dim));
		for (const c of candidates) {
			const guard = guards.get(c.address) ? "guard" : "NO GUARD";
			body.push(line(`${c.address}  ${c.status}  ${guard}  ${c.where}  ${c.title ?? ""}`, guard === "guard" ? t.foreground : t.blocked));
		}
		const notNow = [["busy", busy], ["protected", guarded]].filter(([, n]) => n > 0).map(([what, n]) => `${n} ${what}`);
		if (notNow.length) body.push(line(`Not acted on: ${notNow.join(" · ")}`, t.dim));
		if (Array.isArray(props()?.only)) body.push(line(`Test scope: only ${props().only.join(", ")}`, t.blocked));

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
