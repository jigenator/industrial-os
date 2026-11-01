// Pure derivations of the header's values from what Pi and the environment report. No I/O, clock or Pi import;
// sources.ts and extension.ts gather the inputs. The rules are in ../docs/design.md#values.
import { basename, dirname, isAbsolute, relative, sep } from "node:path";

interface SessionCodes { unit: string; session: string; seed: number }
/** DRD and SES codes: the last four and first eight hex digits of the session ID, `?` for each when it has none. */
export function sessionCodes(sessionId: string | undefined): SessionCodes {
	const hex = (sessionId ?? "").replace(/[^0-9a-f]/gi, "").toUpperCase();
	if (hex.length < 8) return { unit: "????", session: "????????", seed: 0 };
	return { unit: hex.slice(-4), session: hex.slice(0, 8), seed: Number.parseInt(hex.slice(0, 8), 16) | 0 };
}

const herdrId = (value: string | undefined) => (value && /^[A-Za-z0-9:._-]{1,32}$/.test(value) ? value : undefined);
/** PNE and SCT from Herdr's pane, workspace and tab IDs (`wA1:p1`, `wA1` + `wA1:t1` → `WA1:P1`, `WA1.T1`); `--` outside Herdr. */
export function herdrCodes(env: Record<string, string | undefined>): { pane: string; sector: string } {
	const pane = herdrId(env.HERDR_PANE_ID), workspace = herdrId(env.HERDR_WORKSPACE_ID), tab = herdrId(env.HERDR_TAB_ID);
	const tabPart = tab && workspace && tab.startsWith(`${workspace}:`) ? tab.slice(workspace.length + 1) : tab;
	return {
		pane: pane ? pane.toUpperCase() : "--",
		sector: workspace && tabPart ? `${workspace}.${tabPart}`.toUpperCase() : "--",
	};
}

/**
 * A short display form of a model ID, not the ID: provider prefix, a `claude-` family word and a date or `-latest`
 * suffix dropped, a trailing `N-N` version read as `N.N`, uppercased (`claude-opus-5-5` → `OPUS-5.5`).
 */
export function modelLabel(id: string | undefined): string {
	if (!id) return "--";
	const short = id.slice(id.lastIndexOf("/") + 1).toLowerCase()
		.replace(/^claude-/, "").replace(/-(?:\d{8}|latest)$/, "").replace(/(\d+)-(\d+)$/, "$1.$2");
	return short ? short.toUpperCase() : "--";
}
/**
 * The CORE value at boot: model and thinking level. With no model configured Pi reports its placeholder, provider and
 * ID both `unknown`, which is shown as unknown.
 */
export function coreValue(model: { id: string; provider: string } | undefined, thinking: string | undefined): string {
	const id = model && !(model.provider === "unknown" && model.id === "unknown") ? model.id : undefined;
	return `${modelLabel(id)} / ${thinking ? thinking.toUpperCase() : "--"}`;
}

export type Branch = { kind: "none" } | { kind: "unknown" } | { kind: "branch"; name: string } | { kind: "detached"; sha: string };
/** Reads `.git/HEAD` content: a branch, a detached commit, or unknown for anything else. */
export function parseHead(content: string): Branch {
	const head = content.trim();
	const ref = /^ref:\s*(\S+)$/.exec(head);
	if (ref) return { kind: "branch", name: ref[1].replace(/^refs\/heads\//, "").replace(/^refs\//, "") };
	if (/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(head)) return { kind: "detached", sha: head.slice(0, 7) };
	return { kind: "unknown" };
}
/** ASSIGNMENT: the working directory's name, and its branch (or short commit) when it is in a repository. */
export function assignment(cwd: string, branch: Branch): string {
	const project = (basename(cwd) || cwd).toUpperCase();
	if (branch.kind === "none") return project;
	const where = branch.kind === "branch" ? branch.name : branch.kind === "detached" ? branch.sha : "--";
	return `${project} · ${where.toUpperCase()}`;
}

/**
 * The Escape hint's action: `steer` once a ready manifest shows claude-interrupt, which makes Escape continue on the
 * queued text; otherwise `interrupt`, Pi's own behavior. It shows when an extension is listed as `claude-interrupt` or
 * `<package>/claude-interrupt`, or `steering` is set because an enabled extension's path is claude-interrupt's (a
 * package that contributes only it is listed by its package name). The manifest lists what Pi's settings enable, so a
 * claude-interrupt loaded only with `-e` is not seen.
 */
export function interruptAction(manifest: { status: string; extensions?: readonly string[]; steering?: boolean }): "steer" | "interrupt" {
	if (manifest.status !== "ready") return "interrupt";
	const listed = (manifest.extensions ?? []).some((name) => name === "claude-interrupt" || name.endsWith("/claude-interrupt"));
	return listed || manifest.steering ? "steer" : "interrupt";
}
/** Whether an enabled extension is claude-interrupt: a `claude-interrupt` or `pi-claude-interrupt` folder or file on its path. */
export const isClaudeInterrupt = (path: string) => /(?:^|[\\/])(?:pi-)?claude-interrupt(?:[\\/]|\.[^\\/]*$)/.test(path);

/** DEPLOYED: a local wall-clock time as HH:MM:SS. */
export const clock = (date: Date) => [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");

// --- Manifest names. Skill and prompt names come from Pi; extension resources follow DefaultPackageManager.resolve().

export interface ResourceRef {
	path: string;
	metadata: { source: string; scope: string; origin: string; baseDir?: string; packageRoot?: string };
}
const toPosix = (path: string) => path.split(sep).join("/");
const stem = (file: string) => file.replace(/\.[^.]*$/, "");
const GENERIC_DIRS = new Set(["src", "dist", "lib", "extensions"]);

/** A package's name from its source: npm name without scope or version, git repository name without ref. */
export function packageName(source: string, packageRoot: string | undefined): string {
	if (source.startsWith("npm:")) {
		const spec = source.slice(4);
		const name = spec.startsWith("@") ? spec.split("/")[1] ?? spec : spec;
		return name.replace(/@.*$/, "");
	}
	const url = source.replace(/^git:/, "").replace(/[?#].*$/, "");
	const last = url.replace(/\/+$/, "").split("/").at(-1) ?? url;
	if (source.startsWith("git:") || /^(?:https?|ssh|git):\/\//.test(source) || source.startsWith("git@")) {
		return last.replace(/@[^@]*$/, "").replace(/\.git$/, "");
	}
	return basename(packageRoot ?? source);
}

/** The extension's own name inside a package: the file name, or for an index/extension file its nearest named folder. */
function extensionPart(rel: string): string | undefined {
	const parts = rel.split("/").filter(Boolean);
	const file = stem(parts.pop() ?? "");
	if (file !== "index" && file !== "extension") return file || undefined;
	return parts.reverse().find((dir) => !GENERIC_DIRS.has(dir));
}

/**
 * Display names for enabled extensions, alphabetical. npm and git packages use the package name; a package that
 * contributes several extensions uses `<package>/<extension>`, or the package name where the extension is named after
 * it; a single extension under `packages/<dir>/` uses `<dir>`. Top-level files use the file name, or the folder for
 * `index` files.
 */
export function extensionNames(resources: readonly ResourceRef[]): string[] {
	const perSource = new Map<string, number>();
	for (const r of resources) if (r.metadata.origin === "package") perSource.set(r.metadata.source, (perSource.get(r.metadata.source) ?? 0) + 1);
	return sortNames(resources.map((r) => {
		const { source, origin, packageRoot, baseDir } = r.metadata;
		if (origin !== "package") {
			const file = stem(basename(r.path));
			return file === "index" ? basename(dirname(r.path)) : file;
		}
		const pkg = packageName(source, packageRoot);
		const root = packageRoot ?? baseDir;
		const rel = root ? toPosix(relative(root, r.path)) : basename(r.path);
		if (perSource.get(source) === 1) return /^packages\/([^/]+)\//.exec(rel)?.[1] ?? pkg;
		const ext = extensionPart(rel);
		return !ext || ext === pkg || `pi-${ext}` === pkg ? pkg : `${pkg}/${ext}`;
	}));
}
/** Names alphabetically, as the manifest lists skills, prompts and extensions. */
export const sortNames = (names: string[]) => names.sort((a, b) => a.localeCompare(b));

/** A context file as Pi lists it: relative under the working directory, else `~` for the home directory. */
export function contextPath(path: string, cwd: string, home: string): string {
	const rel = relative(cwd, path);
	if (rel && !rel.startsWith("..") && !isAbsolute(rel)) return toPosix(rel);
	const fromHome = relative(home, path);
	if (home && fromHome && !fromHome.startsWith("..") && !isAbsolute(fromHome)) return `~/${toPosix(fromHome)}`;
	return toPosix(path);
}
