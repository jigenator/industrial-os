// Industrial OS sidebar for the Herdr app: a spaces section and an agents section in one block. Plain text first;
// the visual design is deferred (herdr/docs/design.md). The rules live in the pure modules beside this file; this
// view reads Herdr, keeps the remembered state, looks up ahead/behind with git and draws.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, spaces, run, theme, settings, setAgentOrder, exec, home, window } from "herdr";
import { buildSidebar, emptyMemory } from "./model.js";
import { parseAheadBehind, spacePlace } from "./spaces.js";

const MEMORY_KEY = "memory";
// Ahead/behind is looked up for a new place at once, then this often while the window is in front.
const GIT_EVERY_MS = 30_000;
const GIT_TIMEOUT_MS = 5_000;
const SEP = " · ";

function loadMemory() {
	try {
		const memory = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "null");
		return memory && typeof memory === "object" && memory.agents && memory.spaces ? memory : emptyMemory();
	} catch {
		return emptyMemory();
	}
}

// A space's git place: its machine and where its first terminal is now.
const placeKey = (space, ps) => {
	const place = spacePlace(space, ps);
	return place ? JSON.stringify([space.machine ?? null, place]) : null;
};

export default class IndustrialOs extends View {
	init(_props, cx) {
		this.memory = loadMemory();
		this.git = {}; // place key → { ahead, behind } | null
		this.checked = {}; // place key → when it was last looked up
		this.refreshing = false;
		this.nextAt = Infinity;
		// Data timer: redraws only when a shown clock, age or decay stage changes, and looks up ahead/behind.
		cx.timer.every(1000, (cx) => this.tick(cx));
	}

	tick(cx) {
		const now = Date.now();
		this.refreshGit(cx, now);
		if (now >= this.nextAt) {
			this.nextAt = Infinity;
			cx.notify();
		}
	}

	refreshGit(cx, now) {
		if (this.refreshing) return;
		const ps = panes();
		const active = window()?.active ?? true;
		const due = [...new Set(spaces().map((s) => placeKey(s, ps)).filter(Boolean))]
			.filter((key) => !(key in this.checked) || (active && now - this.checked[key] >= GIT_EVERY_MS));
		if (!due.length) return;
		this.refreshing = true;
		cx.spawn(async (cx) => {
			let changed = false;
			for (const key of due) {
				const [on, cwd] = JSON.parse(key);
				this.checked[key] = Date.now();
				try {
					const r = await exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on, timeout: GIT_TIMEOUT_MS });
					// Not a repository, no upstream or a detached HEAD: nothing to show.
					const next = r.code === 0 ? parseAheadBehind(r.stdout) : null;
					if (JSON.stringify(next) !== JSON.stringify(this.git[key] ?? null)) changed = true;
					this.git[key] = next;
				} catch {
					// Could not ask (the machine is away): keep what it showed; look again later.
				}
			}
			this.refreshing = false;
			if (changed) cx.notify();
		});
	}

	render() {
		const t = theme();
		const now = Date.now();
		const ps = panes();
		const sp = spaces();
		const git = Object.fromEntries(sp.map((s) => [s.id, this.git[placeKey(s, ps)] ?? null]));
		const list = agents();
		const result = buildSidebar({ spaces: sp, agents: list, terminals: terminals(), panes: ps, git, home: home(), now, memory: this.memory });
		this.memory = result.memory;
		if (result.dirty) localStorage.setItem(MEMORY_KEY, JSON.stringify(result.memory));
		this.nextAt = result.nextChangeAt ?? Infinity;
		setAgentOrder(result.order);
		const focusedAgent = new Set(list.filter((a) => a.focused).map((a) => a.address));

		const tone = { working: t.working, blocked: t.blocked, done: t.done, idle: t.idle ?? t.dim, unknown: t.unknown ?? t.dim };
		const zone = { ok: t.working, warn: t.ansi3, crit: t.blocked, idle: t.dim, unknown: t.dim };
		// ACT and MDL fade with time since last access: labels and values one step apart.
		const labelDecay = [t.dim, t.input, t.border, t.border];
		const valueDecay = [t.muted, t.dim, t.input, t.border];

		const word = (text, color) => div().flex_none().whitespace_nowrap().text_color(color).child(text);
		const sep = () => word(SEP, t.dim);
		const fill = (text, color) => div().flex_1().min_w(0).truncate().text_color(color).child(text);
		const line = (...parts) => h_flex().min_w(0).items_center().children(parts.filter(Boolean));
		const heading = (text) => div().px(4).pt(10).pb(4).text_size(11).text_color(t.dim).child(text);
		const note = (text) => div().px(4).py(2).text_color(t.dim).child(text);

		const spaceRow = (r) => v_flex()
			.id(`ios-space-${r.id}`)
			.px(4)
			.py(3)
			.rounded(4)
			.cursor_pointer()
			.when(r.active, (el) => el.bg(t.selected))
			.hover((s) => s.bg(t.hover))
			.on_click(() => run("space.select", { id: r.id }))
			.child(line(
				word(`${r.icon} ${r.panes}`, tone[r.state]),
				sep(),
				fill(r.name, r.quiet ? t.dim : r.active ? t.foreground : t.muted),
				r.quiet && sep(),
				r.quiet && word(r.quiet, t.dim),
				r.ahead > 0 && word(` ↑${r.ahead}`, t.muted),
				r.behind > 0 && word(` ↓${r.behind}`, t.muted),
			))
			.when(!r.quiet, (el) => el.child(line(
				word(`  ${r.agents.text}`, r.agents.active ? t.muted : t.dim),
				sep(),
				word(r.units.text, r.units.active ? t.working : t.dim),
			)));

		const piBlock = (b) => {
			const label = labelDecay[b.decay], value = valueDecay[b.decay];
			return v_flex()
				.id(`ios-agent-${b.address}`)
				.px(4)
				.py(4)
				.rounded(4)
				.cursor_pointer()
				.when(focusedAgent.has(b.address), (el) => el.bg(t.selected))
				.hover((s) => s.bg(t.hover))
				.on_click(() => run("pane.focus", { pane: b.pane }))
				.child(line(
					word(`${b.state.icon} ${b.state.code}`, tone[b.state.tone]),
					sep(),
					fill(b.space, b.idle ? t.muted : t.foreground),
					b.flag && word(" ●", t.blocked),
					b.goal && sep(),
					b.goal && word(b.goal.text, b.goal.active ? t.muted : t.dim),
				))
				.child(line(
					word(`  ${b.units.text}`, b.units.active ? t.working : t.dim),
					sep(),
					word(b.context.text, zone[b.context.zone]),
					sep(),
					word(b.compactions, t.muted),
				))
				.when(Boolean(b.act), (el) => el.child(line(
					word("  ACT", label),
					sep(),
					fill(b.act.text, b.act.dirty && b.decay === 0 ? t.ansi3 : value),
					b.pr && sep(),
					b.pr && word(b.pr.text, b.pr.known ? value : t.dim),
				)))
				.when(Boolean(b.model), (el) => el.child(line(word("  MDL", label), sep(), fill(b.model, value))))
				.when(Boolean(b.row5), (el) => el.child(b.row5.kind === "ask"
					? h_flex().min_w(0).items_start().child(word(`  ${b.row5.label}`, t.dim)).child(sep())
						.child(div().flex_1().min_w(0).text_color(t.blocked).child(b.row5.text))
					: line(
						word(`  ${b.row5.label}`, t.dim),
						sep(),
						fill(b.row5.text, b.row5.kind === "rdy" ? t.done : t.muted),
						b.row5.age && sep(),
						b.row5.age && word(b.row5.age, t.dim),
					)));
		};

		const otherLine = (b) => h_flex()
			.id(`ios-agent-${b.address}`)
			.px(4)
			.py(3)
			.rounded(4)
			.min_w(0)
			.items_center()
			.cursor_pointer()
			.when(focusedAgent.has(b.address), (el) => el.bg(t.selected))
			.hover((s) => s.bg(t.hover))
			.on_click(() => run("pane.focus", { pane: b.pane }))
			.child(word(`${b.status.icon} ${b.status.word}`, tone[b.status.word]))
			.child(sep())
			.child(div().flex_shrink_1().min_w(0).max_w(120).truncate().text_color(t.muted).child(b.space))
			.child(sep())
			.child(fill(b.title, t.muted));

		return v_flex()
			.size_full()
			.min_h(0)
			.bg(t.chrome)
			.border_t(1)
			.border_color(t.border)
			.font_family(settings().font_family ?? "JetBrains Mono")
			.text_size(12)
			.text_color(t.foreground)
			.child(v_flex().id("ios-list").flex_1().min_h(0).px(8).pb(12).overflow_y_scrollbar()
				.child(heading("SPACES"))
				.children(result.spaces.length ? result.spaces.map(spaceRow) : [note("No spaces.")])
				.child(heading("AGENTS"))
				.children(result.agents.length
					? result.agents.map((b) => (b.kind === "pi" ? piBlock(b) : otherLine(b)))
					: [note("No agent has reported a status.")]));
	}
}
