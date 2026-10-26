// Builds one manifest through the installed Pi with every child_process function replaced, before Pi is imported, by
// one that records the call and throws, so no process can start. argv: JSON { cwd, agentDir, trusted, home, prompts }.
// Prints { spawns, manifest }.
import { createRequire, syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const childProcess = createRequire(import.meta.url)("node:child_process");
const spawns: string[] = [];
for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
	childProcess[name] = (command: unknown) => {
		spawns.push(`${name} ${String(command)}`);
		throw new Error(`${name} blocked`);
	};
}
// ESM named imports of node:child_process, such as Pi's, see the replacements only after this.
syncBuiltinESMExports();

const pi = await import(pathToFileURL(join(process.env.PI_HOST_ROOT!, "dist/index.js")).href);
const { buildManifest } = await import("../../src/sources.ts");
const manifest = await buildManifest(pi, JSON.parse(process.argv[2]));
console.log(JSON.stringify({ spawns, manifest }));
