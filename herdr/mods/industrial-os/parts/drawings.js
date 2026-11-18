// Drawings written at run time. herdr-app draws blur, masks and patterns only from SVG files, so a part asks for a
// drawing by key and gets its place back once the file is written. One queue for the mod; `flush` is its only writer.
import { image } from "gpui-kit";
import { appHome, checking } from "herdr";
import { mkdir, readdir, unlink, writeFile } from "fs/promises";

/** This mod's folder under the app's home. A copy under another name (a probe window) rewrites it. */
export const MOD = "mods/industrial-os";
// Hidden, because saving a visible file in a mod's folder reloads the mod.
const GEN = `${MOD}/.gen`;
// The folder is emptied at start once it holds this many files: names are content hashes, so nothing is stale,
// only unused. shortcut: no per-file age, so a busy month's leftovers go all at once; track use if that ever shows.
const GEN_LIMIT = 1500;

const gen = { ready: new Map(), pending: new Map(), flight: new Set(), names: null, busy: false, version: 0 };
// A refused path throws at the call instead of rejecting (a home outside the user's folder cannot be listed), so
// `.catch` alone would miss it and no drawing would ever be written.
const quiet = async (run, otherwise) => { try { return await run(); } catch { return otherwise; } };
const fnv = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0; return h; };

/** The file a drawing was written to, or null until it is. `make` returns its SVG; `key` names it. */
export function asset(key, make) {
	const path = gen.ready.get(key);
	if (path !== undefined) return path;
	if (!gen.pending.has(key) && !gen.flight.has(key)) gen.pending.set(key, make);
	return null;
}
/** The file of a drawing already asked for, or undefined: never queues one. */
export const drawn = (key) => gen.ready.get(key);
/** Moves each time drawings were written: a view that sees it change draws again. */
export const drawingsVersion = () => gen.version;

/** Writes what was asked for since the last call. Call it from a view's clock, never from render. */
export function flush(cx) {
	if (gen.busy || !gen.pending.size || checking()) return;
	gen.busy = true;
	// Owned by no view: a map window may close while its drawings are being written.
	cx.spawn(async () => {
		try {
			const dir = `${appHome()}/${GEN}`;
			if (!gen.names) {
				await quiet(() => mkdir(dir, { recursive: true }));
				let names = await quiet(() => readdir(dir), []);
				if (names.length > GEN_LIMIT) { for (const name of names) await quiet(() => unlink(`${dir}/${name}`)); names = []; }
				gen.names = new Set(names);
			}
			while (gen.pending.size) {
				const batch = [...gen.pending];
				gen.pending.clear();
				for (const [key] of batch) gen.flight.add(key);
				for (const [key, make] of batch) {
					try {
						const text = make(), name = `${fnv(text).toString(36)}-${text.length.toString(36)}.svg`;
						if (!gen.names.has(name)) { await writeFile(`${dir}/${name}`, text); gen.names.add(name); }
						gen.ready.set(key, `${GEN}/${name}`);
					} catch {
						gen.ready.set(key, null); // could not be drawn or written: the part goes without it
					}
					gen.flight.delete(key);
				}
				gen.version++;
			}
		} finally {
			gen.busy = false;
		}
	}, { owner: null });
}

/** A written drawing placed at a spot, or null until it is written. */
export function picture(key, make, x, y, w, h) {
	const path = asset(key, make);
	return path ? image(path).absolute().left(x).top(y).w(w).h(h) : null;
}
