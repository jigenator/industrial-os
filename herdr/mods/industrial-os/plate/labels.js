// The label handshake's writes: `io.droid-plate.v1=1` on the terminal this copy draws a plate for, cleared from any
// terminal it no longer draws for. Pure apart from what the view injects: `hc(args)` (a promise of `{ code }`) and
// `sleep(ms)`. One worker runs the writes one at a time, so a set and a clear can never land out of order.
//
// What the copy wants (`desired`) is kept apart from what it knows: `confirmed` is the terminal whose set `hc`
// acknowledged, and `maybe` every terminal that may carry the label (a set was sent and no clear has been
// acknowledged since). Each step compares them: a terminal in `maybe` that is not desired is cleared first, then the
// desired one is set. A write that fails or times out is retried after a growing pause, at most RETRY_LIMIT times for
// that write; a change of `desired` resets the count and wakes a pausing worker, so an obsolete retry never runs.
// A write that timed out may still land later, so a terminal's next write first waits (bounded) for its earlier one.
// close() supersedes everything: nothing is desired, the worker stops before its next write, and close clears every
// terminal that may carry the label itself, after that terminal's earlier write has landed (bounded).

/** The label the pane header sets on its pane's terminal while it draws a plate there, for the droid header to read. */
export const PLATE_LABEL = "io.droid-plate.v1";

/** How long one `hc label` may take before it counts as failed. */
export const WRITE_TIMEOUT_MS = 2000;
/** Retries of one failed write, after 250, 500 and 1000 ms. */
export const RETRY_LIMIT = 3;
export const RETRY_BASE_MS = 250;
/** In close(), how long the write in flight is waited for before the clears are sent anyway. */
export const CLOSE_WAIT_MS = 100;

const TIMEOUT = Symbol("timeout");

export class LabelPublisher {
	constructor() {
		this.desired = null;
		this.confirmed = null;
		this.maybe = new Set();
		this.closed = false;
		this.running = false;
		this.outstanding = new Map(); // terminal → its last write's promise, until it settles (even after a timeout)
		this.attempts = new Map(); // write key → failures
		this.wakeUp = null; // resolves a worker's retry pause early
		this.generation = 0; // bumped by every change of desired
	}

	/** The terminal to label (null: none). Returns true when the worker should be started. */
	want(terminal) {
		if (this.closed) return false;
		const next = typeof terminal === "string" && terminal ? terminal : null;
		if (next !== this.desired) {
			this.desired = next;
			this.generation++;
			this.attempts.clear();
			this.wakeUp?.();
		}
		const write = this.pending();
		return !this.running && write !== null && !this.spent(write);
	}

	/** Whether a write's retries are used up (until what is wanted changes). */
	spent(next) {
		return (this.attempts.get(`${next.op}\u0000${next.terminal}`) ?? 0) > RETRY_LIMIT;
	}

	/** The next write, or null when what is known matches what is wanted. */
	pending() {
		for (const terminal of this.maybe) if (terminal !== this.desired) return { op: "clear", terminal };
		if (this.desired && this.confirmed !== this.desired) return { op: "set", terminal: this.desired };
		return null;
	}

	// One `hc label`, after the terminal's earlier write has landed (or `fenceMs` has passed). True when acknowledged.
	async write({ op, terminal }, hc, sleep, timeoutMs, fenceMs = timeoutMs) {
		const earlier = this.outstanding.get(terminal);
		if (earlier) await Promise.race([earlier, sleep(fenceMs)]);
		const args = ["label", terminal, `${PLATE_LABEL}=${op === "set" ? "1" : ""}`];
		const call = Promise.resolve().then(() => hc(args)).then((r) => !!r && r.code === 0, () => false);
		this.outstanding.set(terminal, call);
		call.then(() => { if (this.outstanding.get(terminal) === call) this.outstanding.delete(terminal); });
		const ok = await Promise.race([call, sleep(timeoutMs).then(() => TIMEOUT)]);
		return ok === true;
	}

	/** Runs writes until nothing is pending, the retries are spent, or close() is called. One worker at a time. */
	async run({ hc, sleep, timeoutMs = WRITE_TIMEOUT_MS }) {
		if (this.running) return;
		this.running = true;
		try {
			for (;;) {
				if (this.closed) return;
				const next = this.pending();
				if (!next) return;
				const key = `${next.op}\u0000${next.terminal}`, failures = this.attempts.get(key) ?? 0;
				if (failures > RETRY_LIMIT) return; // spent until desired changes
				if (failures > 0) {
					const generation = this.generation;
					await Promise.race([sleep(RETRY_BASE_MS * 2 ** (failures - 1)), new Promise((resolve) => { this.wakeUp = resolve; })]);
					this.wakeUp = null;
					if (this.closed) return;
					if (generation !== this.generation) continue; // what is wanted changed: recompute
				}
				if (next.op === "set") this.maybe.add(next.terminal);
				const ok = await this.write(next, hc, sleep, timeoutMs);
				if (ok && next.op === "clear") {
					this.maybe.delete(next.terminal);
					if (this.confirmed === next.terminal) this.confirmed = null;
				}
				if (ok && next.op === "set") this.confirmed = next.terminal;
				if (ok) this.attempts.delete(key);
				else this.attempts.set(key, failures + 1);
			}
		} finally {
			this.running = false;
		}
	}

	/**
	 * Supersedes every pending write: nothing is wanted from now on, and every terminal that may carry the label is
	 * cleared. Waits at most `waitMs` for a terminal's write in flight (a set sent before close must not land after its
	 * clear).
	 */
	async close({ hc, sleep, waitMs = CLOSE_WAIT_MS, timeoutMs = WRITE_TIMEOUT_MS }) {
		this.closed = true;
		this.desired = null;
		this.generation++;
		this.wakeUp?.();
		const targets = [...this.maybe];
		await Promise.all(targets.map(async (terminal) => {
			if (await this.write({ op: "clear", terminal }, hc, sleep, timeoutMs, waitMs)) this.maybe.delete(terminal);
		}));
		this.confirmed = null;
	}
}
