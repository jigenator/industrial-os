// Node module hooks: a mod's imports of the app's own modules resolve to the stand-ins beside this file, so Node
// can load a module that draws. `fs/promises` and `net` are Node's too, so they are replaced only for the mods:
// nothing a mod does in a test touches the disk or opens a socket.
const STAND_INS = { "gpui-kit": "./kit.mjs", "gpui-base": "./base.mjs", herdr: "./herdr.mjs", "fs/promises": "./fs.mjs", net: "./net.mjs" };
const NODES_TOO = ["fs/promises", "net"];
export function resolve(specifier, context, next) {
	const file = STAND_INS[specifier];
	if (file && (!NODES_TOO.includes(specifier) || /\/mods\//.test(context.parentURL ?? ""))) return { url: new URL(file, import.meta.url).href, shortCircuit: true };
	return next(specifier, context);
}
