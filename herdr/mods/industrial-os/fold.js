// Folding the sidebar to the rail and back, as motion. Pure: no gpui-kit or herdr import. It says when each step
// starts and how each row is erased or typed in; main.js draws that as covers of ground laid over the rows, because
// herdr-app can move and resize an element but cannot scale or clip one.

/**
 * A fold runs in four steps; these are the ms after the start at which steps 1 to 3 begin and at which it is over.
 * Step 0 places what will move, step 1 moves it, step 2 is the snap (the sidebar changes width under full cover),
 * step 3 brings the new rows in. Folding erases the rows first; unfolding is a scan line's pass to the left and back.
 */
export const FOLD_TIMES = Object.freeze({ fold: [30, 400, 430, 850], unfold: [30, 150, 180, 620] });
/** A fold whose steps stopped coming (its mod was reloaded) is dropped after this long. */
export const FOLD_EXPIRE_MS = 3000;
/** The scan line's pass: out to the left before the snap, back to the right after it. */
export const SCAN_OUT_MS = 115, SCAN_BACK_MS = 230;

// A small seeded generator, so both renders of one step agree on every row.
function seeded(seed) {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
	return () => { h = (h + 0x6d2b79f5) >>> 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const between = (random, a, b) => a + random() * (b - a);

/**
 * Each of `count` rows is cut away from its right end, at uneven times and in no order. About one in five drops out
 * at once, one in five flickers first, one in six goes slowly; nothing moves sideways. `{ delay, duration, easing,
 * flicker }` each, in ms; every row is gone within 370 ms. New rows come in the same way, from the left.
 */
export function eraseRows(seed, count) {
	const random = seeded(`erase/${seed}`);
	return Array.from({ length: count }, () => {
		const delay = Math.round(between(random, 0, 150)), k = random();
		if (k < 0.2) return { delay, duration: 20, easing: "linear", flicker: false };
		if (k < 0.4) return { delay: delay + Math.round(between(random, 110, 170)), duration: 20, easing: "linear", flicker: true };
		if (k < 0.57) return { delay, duration: Math.round(between(random, 150, 210)), easing: "ease-in-out", flicker: false };
		return { delay, duration: Math.round(between(random, 60, 150)), easing: "linear", flicker: false };
	});
}

/**
 * The scan line as light aliasing, `height` px tall: long straight stretches (70 to 150 px) alternate with bursts
 * about two-thirds as tall, cut into 6 to 22 px pieces that kink 2 px, thin, dim or drop out.
 * `{ y, h, dx, w, opacity, broken }` each.
 */
export function scanSegments(seed, height) {
	const random = seeded(`scan/${seed}`), segments = [];
	let y = 0, clean = random() < 0.5;
	const put = (h, dx, w, opacity, broken) => { segments.push({ y, h: Math.min(h, height - y), dx, w, opacity, broken }); y += h; };
	while (y < height) {
		if (clean) put(Math.round(between(random, 70, 150)), 0, 2, 1, false);
		else {
			const end = y + Math.round((between(random, 70, 150) * 2) / 3);
			while (y < end && y < height) {
				const r = random();
				put(Math.round(between(random, 6, 22)), r < 0.55 ? (random() < 0.5 ? -2 : 2) : 0, r > 0.8 ? 1 : 2, r > 0.9 ? 0 : r > 0.7 ? 0.6 : 1, true);
			}
		}
		clean = !clean;
	}
	return segments;
}
