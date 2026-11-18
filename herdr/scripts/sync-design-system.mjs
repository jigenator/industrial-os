// Copies the design-system files a Herdr mod imports into the mod's `ds/` folder, byte for byte and in the design
// system's own tree, because a mod folder is copied into ~/.config/herdr-app/mods/ as it is and cannot import the
// package. The copied set is exactly the import closure of the imports that reach into `ds/` from the mod's own
// files, in any of its folders (`./ds/…`, and `../ds/…` from one folder down). Node standard library only.
//
// A mod whose ds/ holds the sidebar vocabulary also gets its `marks/` folder: herdr-app draws an SVG only from a
// file, so the vocabulary's drawn marks (`markFiles()`) are written there, one file each, and nothing else is kept.
//
//   node herdr/scripts/sync-design-system.mjs           rewrite every mod's ds/ (and marks/) from the design system
//   node herdr/scripts/sync-design-system.mjs --check   exit 1 when a copy or a mark is missing, extra or different
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MODS = join(HERE, "..", "mods");
export const DESIGN_SYSTEM = join(HERE, "..", "..", "design-system");
const DS_DIR = "ds", MARKS_DIR = "marks", VOCABULARY = "foundation/sidebar-vocabulary.mjs";

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
		const files = await closure(entries);
		out.push({ mod: entry.name, dir: join(modDir, DS_DIR), files, present: await listFiles(join(modDir, DS_DIR)), marksDir: join(modDir, MARKS_DIR), marks: await marksOf(files) });
	}
	return out;
}

// The mark files of a mod that copies the sidebar vocabulary, as [name, text] pairs; null for a mod that does not.
async function marksOf(files) {
	if (!files.includes(VOCABULARY)) return null;
	// By package name, as every project reads the design system (the root install links it); the files above are
	// read as files only because they are copied.
	return (await import("@industrial-os/design-system/foundation/sidebar-vocabulary")).markFiles();
}

// Differences between each mod's ds/ and the design system: missing, extra and changed files.
export async function check() {
	const problems = [];
	for (const { mod, dir, files, present, marksDir, marks } of await plan()) {
		for (const file of files) {
			if (!present.includes(file)) { problems.push(`${mod}: missing ds/${file}`); continue; }
			const [a, b] = await Promise.all([readFile(join(DESIGN_SYSTEM, file)), readFile(join(dir, file))]);
			if (!a.equals(b)) problems.push(`${mod}: ds/${file} differs from design-system/${file}`);
		}
		for (const file of present) if (!files.includes(file)) problems.push(`${mod}: extra ds/${file}`);
		if (!marks) continue;
		const drawn = await listFiles(marksDir);
		for (const [name, text] of marks) {
			if (!drawn.includes(name)) problems.push(`${mod}: missing marks/${name}`);
			else if (await readFile(join(marksDir, name), "utf8") !== text) problems.push(`${mod}: marks/${name} differs from the vocabulary's`);
		}
		for (const name of drawn) if (!marks.some(([file]) => file === name)) problems.push(`${mod}: extra marks/${name}`);
	}
	return problems;
}

export async function sync() {
	const written = [];
	for (const { mod, dir, files, marksDir, marks } of await plan()) {
		await rm(dir, { recursive: true, force: true });
		for (const file of files) {
			await mkdir(dirname(join(dir, file)), { recursive: true });
			await writeFile(join(dir, file), await readFile(join(DESIGN_SYSTEM, file)));
		}
		if (marks) {
			await rm(marksDir, { recursive: true, force: true });
			await mkdir(marksDir, { recursive: true });
			for (const [name, text] of marks) await writeFile(join(marksDir, name), text);
		}
		written.push(`${mod}: ${files.length} files${marks ? `, ${marks.length} marks` : ""}`);
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
