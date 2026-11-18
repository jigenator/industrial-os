// Node module hooks: a mod's imports of the app's own modules resolve to the stand-ins beside this file, so Node
// can load a module that draws. `fs/promises` is replaced only for the mods; tests keep Node's.
const STAND_INS = { "gpui-kit": "./kit.mjs", "gpui-base": "./base.mjs", herdr: "./herdr.mjs", "fs/promises": "./fs.mjs" };
export function resolve(specifier, context, next) {
	const file = STAND_INS[specifier];
	if (file && (specifier !== "fs/promises" || /\/mods\//.test(context.parentURL ?? ""))) return { url: new URL(file, import.meta.url).href, shortCircuit: true };
	return next(specifier, context);
}
