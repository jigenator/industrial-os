// Copies the design-system files a Herdr mod imports into the mod's `ds/` folder, byte for byte and in the design
// system's own tree, because a mod folder is copied into ~/.config/herdr-app/mods/ as it is and cannot import the
// package. The copied set is exactly the import closure of the imports that reach into `ds/` from the mod's own
// files, in any of its folders (`./ds/…`, and `../ds/…` from one folder down). Node standard library only.
//
//   node herdr/scripts/sync-design-system.mjs           rewrite every mod's ds/ that imports the design system
//   node herdr/scripts/sync-design-system.mjs --check   exit 1 when a copy is missing, extra or different
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MODS = join(HERE, "..", "mods");
export const DESIGN_SYSTEM = join(HERE, "..", "..", "design-system");
const DS_DIR = "ds";

// Static relative specifiers: `import … from "./x"`, `import "./x"` and `export … from "./x"`.
const SPECIFIER = /(?:^|[;\n])\s*(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g;
export const relativeImports = (source) => [...source.matchAll(SPECIFIER)].map((m) => m[1]);

const toPosix = (path) => path.split(sep).join("/");

// The design-system paths named by the mod's own files: every script outside ds/, in any folder, whose import lands in ds/.
export async function modEntries(modDir) {
	const entries = new Set(), inDs = `${DS_DIR}/`;
	for (const file of await listFiles(modDir)) {
		if (!/\.(?:m?js)$/.test(file) || file.startsWith(inDs) || /(^|\/)(node_modules|\.[^/]+)\//.test(file)) continue;
		for (const spec of relativeImports(await readFile(join(modDir, file), "utf8"))) {
			const target = toPosix(normalize(join(dirname(file), spec)));
			if (target.startsWith(inDs)) entries.add(target.slice(inDs.length));
		}
	}
	return [...entries].sort();
}

// Every design-system file the entries reach, as paths relative to the design system.
export async function closure(entries, root = DESIGN_SYSTEM) {
	const seen = new Set(), queue = [...entries];
	while (queue.length) {
		const path = toPosix(normalize(queue.shift()));
		if (seen.has(path)) continue;
		if (path.startsWith("..")) throw new Error(`a design-system file imports outside the design system: ${path}`);
		seen.add(path);
		const source = await readFile(join(root, path), "utf8");
		for (const spec of relativeImports(source)) queue.push(toPosix(join(dirname(path), spec)));
	}
	return [...seen].sort();
}

async function listFiles(dir, base = dir) {
	if (!existsSync(dir)) return [];
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...await listFiles(path, base));
		else out.push(toPosix(relative(base, path)));
	}
	return out.sort();
}

// The mods that import the design system, each with its closure and what its ds/ holds now.
export async function plan() {
	const out = [];
	for (const entry of await readdir(MODS, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const modDir = join(MODS, entry.name), entries = await modEntries(modDir);
		if (!entries.length) continue;
		out.push({ mod: entry.name, dir: join(modDir, DS_DIR), files: await closure(entries), present: await listFiles(join(modDir, DS_DIR)) });
	}
	return out;
}

// Differences between each mod's ds/ and the design system: missing, extra and changed files.
export async function check() {
	const problems = [];
	for (const { mod, dir, files, present } of await plan()) {
		for (const file of files) {
			if (!present.includes(file)) { problems.push(`${mod}: missing ds/${file}`); continue; }
			const [a, b] = await Promise.all([readFile(join(DESIGN_SYSTEM, file)), readFile(join(dir, file))]);
			if (!a.equals(b)) problems.push(`${mod}: ds/${file} differs from design-system/${file}`);
		}
		for (const file of present) if (!files.includes(file)) problems.push(`${mod}: extra ds/${file}`);
	}
	return problems;
}

export async function sync() {
	const written = [];
	for (const { mod, dir, files } of await plan()) {
		await rm(dir, { recursive: true, force: true });
		for (const file of files) {
			await mkdir(dirname(join(dir, file)), { recursive: true });
			await writeFile(join(dir, file), await readFile(join(DESIGN_SYSTEM, file)));
		}
		written.push(`${mod}: ${files.length} files`);
	}
	return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	if (process.argv.includes("--check")) {
		const problems = await check();
		for (const p of problems) console.error(p);
		console.log(problems.length ? `${problems.length} problems; run node herdr/scripts/sync-design-system.mjs` : "ds copies match the design system");
		process.exitCode = problems.length ? 1 : 0;
	} else {
		for (const line of await sync()) console.log(line);
	}
}
