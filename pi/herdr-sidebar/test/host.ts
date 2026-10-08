// Test access to the installed Pi host. Tests use the globally installed Pi through PI_HOST_ROOT, never a vendored
// copy or an install; source modules that import Pi's TUI package load through jiti with that package aliased.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.PI_HOST_ROOT) throw new Error("Set PI_HOST_ROOT to the installed Pi package; see CONTRIBUTING.md");
export const hostRoot = process.env.PI_HOST_ROOT;
export const hostRequire = createRequire(resolve(hostRoot, "package.json"));
export const host = await import(pathToFileURL(resolve(hostRoot, "dist/index.js")).href);
export const tui = await import(pathToFileURL(hostRequire.resolve("@earendil-works/pi-tui")).href);
const { createJiti } = hostRequire("jiti");
const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false, alias: { "@earendil-works/pi-tui": hostRequire.resolve("@earendil-works/pi-tui") } });
export const load = (path: string): Promise<any> => jiti.import(resolve(path));
