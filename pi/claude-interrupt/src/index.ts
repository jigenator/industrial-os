import { randomUUID } from "node:crypto";
import type {
	ExtensionAPI,
	ExtensionContext,
	InputEvent,
	Theme,
	ThemeStyle,
} from "@earendil-works/pi-coding-agent";
import { isKeyRelease, isKeyRepeat, matchesKey, parseColor, truncateToWidth } from "@earendil-works/pi-tui";

import { lineWidth, resolveStyle, span, type Line, type Style } from "@industrial-os/design-system/foundation/cells";
import { ACID_BLACK } from "@industrial-os/design-system/foundation/palette";
import { markerBars, markerPlate, MARKER_PLATES, MARKER_TIMELINE } from "@industrial-os/design-system/elements/transcript-marker";
import { flash, FLASH_PRESETS } from "@industrial-os/design-system/motions/flash";
import { ping } from "@industrial-os/design-system/motions/ping";
import { wipe } from "@industrial-os/design-system/motions/wipe";

type Delivery = "steer" | "followUp";

type PendingText = {
	text: string;
	deliverAs: Delivery;
	hasImages: boolean;
};

type PendingQueues = {
	steering: PendingText[];
	followUp: PendingText[];
};

type InterruptState = {
	phase: "aborting" | "starting";
	queues: PendingQueues;
};

function emptyQueues(): PendingQueues {
	return { steering: [], followUp: [] };
}

function ordered(queues: PendingQueues): PendingText[] {
	return [...queues.steering, ...queues.followUp];
}

function push(queues: PendingQueues, item: PendingText): void {
	(item.deliverAs === "steer" ? queues.steering : queues.followUp).push(item);
}

function queuesFrom(items: PendingText[]): PendingQueues {
	const queues = emptyQueues();
	for (const item of items) push(queues, item);
	return queues;
}

function prependEditorText(ctx: ExtensionContext, texts: string[]): void {
	const current = ctx.ui.getEditorText();
	ctx.ui.setEditorText([...texts, current].filter((text) => text.trim()).join("\n\n"));
}

const { barFrame: FRAME, window: WINDOW } = MARKER_TIMELINE;
const transparent: Style = { fg: "default", bg: "default" };

/** Pi owns color-mode conversion. Explicit terminal defaults become absent Pi channels;
 * only transparent acid ink uses the host accent on light themes. Coalesce equivalent
 * concrete styles before styling so motion span boundaries do not add SGR runs.
 */
function markerLine(theme: Theme, line: Line): string {
	const runs: { text: string; style: ThemeStyle; key: string }[] = [];
	for (const piece of line) {
		if (!piece.text) continue;
		const { fg, bg, bold } = resolveStyle(piece.style);
		const foreground = fg === "default" ? undefined
			: bg === "default" && fg.toLowerCase() === ACID_BLACK.accent && theme.appearance === "light" ? "accent" : parseColor(fg);
		const background = bg === "default" ? undefined : parseColor(bg);
		const style: ThemeStyle = { fg: foreground, bg: background, bold };
		const key = `${fg.toLowerCase()}|${bg.toLowerCase()}|${bold}`;
		const last = runs[runs.length - 1];
		if (last?.key === key) last.text += piece.text;
		else runs.push({ text: piece.text, style, key });
	}
	return runs.map(({ text, style }) => theme.style(text, style)).join("");
}

/** One marker row at explicit elapsed ms, or settled when undefined. Pi clips the
 * styled row to width - outputPad, without wrapping or filling the terminal background.
 */
export function renderMarker(theme: Theme, width: number, outputPad: 0 | 1, elapsed?: number): string {
	const m = elapsed === undefined ? WINDOW : Math.max(0, elapsed);
	const contentWidth = Math.max(0, width - outputPad);
	const plate = m < MARKER_TIMELINE.settleWipe
		? flash([markerPlate("live", { outputPad })], { ...FLASH_PRESETS.interrupt, time: m, outlineBackground: "default" })[0]
		: wipe([markerPlate("record", { outputPad })], { time: m, fromStyle: MARKER_PLATES.live })[0];
	const bars = ping([markerBars("lit", { background: "default" })], { time: m, offStyle: transparent })[0];
	const row = [...plate, span(" ", transparent), ...bars];
	row.push(span(" ".repeat(Math.max(0, contentWidth - lineWidth(row))), transparent));
	return truncateToWidth(markerLine(theme, row), contentWidth, "");
}

/** Exported for the regression harness; Pi uses the default export. */
export function createClaudeInterrupt(pi: ExtensionAPI): void {
	let pending = emptyQueues();
	let interrupt: InterruptState | undefined;
	let expectedReplay: PendingText[] = [];
	let skipNextUserStart = false;
	let unsubscribeTerminal: (() => void) | undefined;
	let ownsEscape = false;
	const markerType = "claude-interrupt-steering";
	let animation: {
		id: string;
		startedAt: number;
		/** Frame-stepped animation time; render state is a pure function of it. */
		elapsed: number;
		ctx: ExtensionContext;
		timer?: ReturnType<typeof setTimeout>;
		requestRender?: () => void;
	} | undefined;

	// Pi invalidates `pi` when the session is replaced, but this runtime's entry
	// components keep rendering until the new session rebinds the transcript.
	// Entry renderers receive no context, so the pad is read live until shutdown
	// and then kept as plain data.
	let retiredOutputPad: 0 | 1 | undefined;
	const currentOutputPad = (): 0 | 1 => retiredOutputPad ?? (pi.getSettings().outputPad === 0 ? 0 : 1);

	// Only this runtime's live identity animates. Saved entries always render done.
	pi.registerEntryRenderer<{ id: string }>(markerType, (entry, _options, theme) => ({
		render: (width) => {
			const live = animation && entry.data?.id === animation.id ? animation : undefined;
			return [renderMarker(theme, width, currentOutputPad(), live?.elapsed)];
		},
		invalidate() {},
	}));

	const disposeAnimation = (): void => {
		const live = animation;
		if (!live) return;
		clearTimeout(live.timer);
		animation = undefined;
		live.requestRender?.(); // Finalize the transcript row, never remove it.
	};

	const clearAnimation = (): void => {
		const ctx = animation?.ctx;
		disposeAnimation();
		ctx?.ui.setWidget(markerType, undefined);
	};

	const reset = (): void => {
		unsubscribeTerminal?.();
		unsubscribeTerminal = undefined;
		ownsEscape = false;
		clearAnimation();
		pending = emptyQueues();
		interrupt = undefined;
		expectedReplay = [];
		skipNextUserStart = false;
	};

	const consumeExpectedReplay = (event: InputEvent): boolean => {
		if (event.source !== "extension" || expectedReplay.length === 0) return false;

		const expected = expectedReplay[0];
		if (event.text !== expected.text || (event.images?.length ?? 0) !== 0) return false;

		expectedReplay.shift();
		return true;
	};

	pi.on("input", (event, ctx) => {
		if (consumeExpectedReplay(event)) return;
		if (!event.streamingBehavior) return;

		const item: PendingText = {
			text: event.text,
			deliverAs: event.streamingBehavior,
			hasImages: (event.images?.length ?? 0) > 0,
		};

		if (interrupt?.phase === "aborting") {
			// Once an interrupt has started, Pi cannot losslessly move a newly queued
			// image through the editor. Reject that late submission explicitly while
			// retaining its text, rather than invalidating the captured text batch.
			if (item.hasImages) {
				prependEditorText(ctx, item.text ? [item.text] : []);
				ctx.ui.notify("Attachment was not queued while interrupting; its text was restored to the editor.", "warning");
				return { action: "handled" };
			}

			// A text submit can race the old run settling after Escape. Include it in
			// the replay batch; Pi's old queue is cleared once more at settlement.
			push(interrupt.queues, item);
			return;
		}

		push(pending, item);
	});

	pi.on("message_start", (event) => {
		if (event.message.role !== "user" || interrupt) return;
		if (skipNextUserStart) {
			skipNextUserStart = false;
			return;
		}

		// Pi drains steering before follow-ups. Mirroring that priority keeps our
		// observer aligned even when equal text was submitted more than once.
		if (pending.steering.length > 0) pending.steering.shift();
		else pending.followUp.shift();
	});

	pi.on("session_start", (_event, ctx) => {
		reset();
		if (ctx.mode !== "tui") return;

		unsubscribeTerminal = ctx.ui.onTerminalInput((data) => {
			if (!matchesKey(data, "escape")) return;
			// Raw input listeners run before Pi filters Kitty release events. Only
			// presses act; a held extension-owned Escape must not natively abort the
			// continuation through repeats after agent_start has cleared interrupt.
			if (isKeyRelease(data)) {
				ownsEscape = false;
				return;
			}
			if (isKeyRepeat(data)) return ownsEscape ? { consume: true } : undefined;
			ownsEscape = false; // A genuine new press chooses ownership again.
			clearAnimation();

			if (interrupt?.phase === "aborting") {
				// Another press while the original abort settles is idempotent.
				ownsEscape = true;
				return { consume: true };
			}

			if (interrupt?.phase === "starting") {
				// Preflight can fail before agent_start (for example, authentication).
				// A second Escape abandons extension restart tracking, requests an abort,
				// and restores every captured message visibly. Escape therefore never
				// remains disabled indefinitely even when no agent_start event arrives.
				const replay = ordered(interrupt.queues);
				interrupt = undefined;
				expectedReplay = [];
				pending = emptyQueues();
				skipNextUserStart = false;
				ownsEscape = true;
				ctx.abort();
				prependEditorText(ctx, replay.map((item) => item.text));
				return { consume: true };
			}

			if (!ctx.hasPendingMessages()) return;

			const queue = ordered(pending);
			// We cannot recover structured queue entries through Pi 0.99.1. If Pi
			// reports a queue but we observed no text, or an observed image is present,
			// leave Escape to Pi's native handler.
			if (queue.length === 0 || queue.some((item) => item.hasImages)) return;

			const draft = ctx.ui.getEditorText();
			ownsEscape = true;
			interrupt = {
				phase: "aborting",
				queues: pending,
			};
			expectedReplay = [];
			pending = emptyQueues();
			skipNextUserStart = false;

			// In TUI mode ctx.abort() clears Pi's queues and prepends their text to
			// the editor. Restore the exact pre-abort draft immediately; our captured
			// submitted messages are replayed only after agent_settled.
			ctx.abort();
			ctx.ui.setEditorText(draft);
			return { consume: true };
		});
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (interrupt?.phase !== "aborting") {
			// A normal settlement means Pi drained (or discarded) its queues.
			pending = emptyQueues();
			return;
		}

		const state = interrupt;
		const replay = ordered(state.queues);
		if (replay.length === 0) {
			interrupt = undefined;
			return;
		}

		// Clear text submitted during the short abort/settle window. It has already
		// been captured above, but may still be sitting in Pi's old queue.
		if (ctx.hasPendingMessages()) {
			const draft = ctx.ui.getEditorText();
			ctx.abort();
			ctx.ui.setEditorText(draft);
		}

		state.phase = "starting";
		expectedReplay = [...replay];
		pi.sendUserMessage(replay[0].text, { expandPromptTemplates: true });
	});

	pi.on("agent_start", (_event, ctx) => {
		if (interrupt?.phase !== "starting") return;

		clearAnimation();
		if (ctx.mode === "tui") {
			const live: NonNullable<typeof animation> = { id: randomUUID(), startedAt: Date.now(), elapsed: 0, ctx };
			animation = live;
			pi.appendEntry(markerType, { id: live.id });
			// Entry renderers have no TUI handle. This zero-row widget supplies only
			// redraw/lifecycle access; the single visible row belongs to history.
			ctx.ui.setWidget(markerType, (tui) => {
				live.requestRender = () => tui.requestRender();
				// Each timer advances at least one frame and catches up after a late
				// wake-up, so the animation ends within WINDOW / FRAME timers.
				const schedule = (): void => {
					const due = Math.min(WINDOW, live.elapsed + FRAME) - (Date.now() - live.startedAt);
					live.timer = setTimeout(advance, Math.min(FRAME, Math.max(0, due)));
				};
				const advance = (): void => {
					if (animation !== live) return;
					const reached = Math.floor((Date.now() - live.startedAt) / FRAME) * FRAME;
					live.elapsed = Math.min(WINDOW, Math.max(live.elapsed + FRAME, reached));
					if (live.elapsed === WINDOW) {
						clearAnimation();
						return;
					}
					tui.requestRender();
					schedule();
				};
				schedule();
				return {
					render: () => [],
					invalidate() {},
					// Pi disposes before removal; never recurse into setWidget here.
					dispose: () => { if (animation === live) disposeAnimation(); },
				};
			});
		}

		const state = interrupt;
		const replay = ordered(state.queues);
		const remainder = replay.slice(1);

		// Track the replayed remainder exactly like an ordinary Pi queue. This makes
		// another Escape during the continuation interrupt and resume it again.
		pending = queuesFrom(remainder);
		skipNextUserStart = true;

		for (const item of remainder) {
			pi.sendUserMessage(item.text, {
				deliverAs: item.deliverAs,
				expandPromptTemplates: true,
			});
		}

		interrupt = undefined;
	});

	pi.on("session_shutdown", () => {
		retiredOutputPad = currentOutputPad();
		reset();
	});
}

export default createClaudeInterrupt;
