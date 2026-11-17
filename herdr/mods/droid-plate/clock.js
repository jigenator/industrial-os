// The copy's two timers, kept honest: a frame timer that runs only while a character-level motion plays (at that
// motion's own step), and one wake for the next time the plate changes by itself (a clock's second, STARTING's end,
// the next K4 ghost, a lighting layer settling). Pure apart from the injected `every(ms, fn)` and `after(ms, fn)`,
// which return `{ cancel() }`, and `now()`. Nothing else ever runs a timer: the lighting switches are native.

export class Scheduler {
	constructor({ every, after, now = Date.now }) {
		this.timers = { every, after };
		this.now = now;
		this.frameTimer = null;
		this.frameStep = null;
		this.wakeTimer = null;
		this.wakeAt = Infinity;
		this.fired = -Infinity; // the last wake deadline that fired: never armed again
	}

	/** Swap the timer functions (a task's cx owns its timers). */
	use(timers) {
		this.timers = { ...this.timers, ...timers };
	}

	/** Run `tick(cx)` every `step` ms; a null step stops it. A changed step restarts it. */
	frame(step, tick) {
		if (step === this.frameStep && (step === null || this.frameTimer)) return;
		this.frameTimer?.cancel();
		this.frameTimer = null;
		this.frameStep = step;
		if (step !== null) this.frameTimer = this.timers.every(step, (cx) => tick(cx));
	}

	/**
	 * Wake once at `at` (epoch ms) for `fire(cx)`: the earliest asked for wins until it fires. A deadline already in the
	 * past fires at once, but a deadline that has fired is never armed again, so an expired time a caller keeps asking
	 * for cannot become a zero-delay loop.
	 */
	wake(at, fire) {
		if (typeof at !== "number" || !Number.isFinite(at) || at <= this.fired) return;
		if (at >= this.wakeAt) return;
		this.wakeTimer?.cancel();
		this.wakeAt = at;
		this.wakeTimer = this.timers.after(Math.max(0, at - this.now()), (cx) => {
			this.fired = this.wakeAt;
			this.wakeAt = Infinity;
			this.wakeTimer = null;
			fire(cx);
		});
	}

	/** Stop both timers (no motion, or the copy is hidden). */
	stop() {
		this.frame(null);
		this.wakeTimer?.cancel();
		this.wakeTimer = null;
		this.wakeAt = Infinity;
	}

	get idle() {
		return !this.frameTimer && !this.wakeTimer;
	}
}
