import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters as stripAnsi } from "node:util";
import {
	discoverAndLoadExtensions,
	ExtensionRunner,
	SessionManager,
	type ExtensionActions,
	type ExtensionContextActions,
	type ExtensionUIContext,
	type ExtensionWidgetOptions,
	type ModelRegistry,
	type TerminalInputHandler,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { resetCapabilitiesCache, setCapabilities, type Component, type TUI } from "@earendil-works/pi-tui";
import { WIDGET_KEY } from "../src/index.ts";
import { png, tempDir, theme, until, writeImage } from "./helpers.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = /\[image (\d+)\]/;

test.beforeEach(() => setCapabilities({ images: null, trueColor: true, hyperlinks: false }));
test.afterEach(() => resetCapabilitiesCache());

/** Pi's real loader and event runner with a scripted editor, widget host and terminal input. */
async function harness(t: TestContext, options: { persist?: boolean; mode?: Parameters<ExtensionRunner["setUIContext"]>[1] } = {}) {
	const dir = await tempDir(t);
	const loaded = await discoverAndLoadExtensions([join(root, "src/index.ts")], dir, join(dir, "agent"));
	assert.deepEqual(loaded.errors, []);
	const session = options.persist === false ? SessionManager.inMemory(dir) : SessionManager.create(dir, join(dir, "sessions"));
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, dir, session, {} as ModelRegistry);

	let editorText = "";
	let widget: (Component & { dispose?(): void }) | undefined;
	let placement: ExtensionWidgetOptions["placement"];
	const terminalHandlers = new Set<TerminalInputHandler>();
	const notices: string[] = [];
	let editorWrites = 0;
	const ui = {
		onTerminalInput: (handler: TerminalInputHandler) => {
			terminalHandlers.add(handler);
			return () => terminalHandlers.delete(handler);
		},
		getEditorText: () => editorText,
		setEditorText: (text: string) => {
			editorText = text;
			editorWrites++;
		},
		notify: (message: string) => notices.push(message),
		setWidget: (key: string, factory: ((tui: TUI, theme: Theme) => typeof widget) | undefined, widgetOptions?: ExtensionWidgetOptions) => {
			assert.equal(key, WIDGET_KEY);
			widget?.dispose?.();
			widget = factory?.({ requestRender() {} } as unknown as TUI, theme);
			placement = widgetOptions?.placement;
		},
	} as unknown as ExtensionUIContext;
	const contextActions = {
		getModel: () => undefined,
		getScopedModels: () => [],
		isIdle: () => true,
		isProjectTrusted: () => true,
		getSignal: () => undefined,
		abort: () => undefined,
		hasPendingMessages: () => false,
		shutdown: () => undefined,
		getContextUsage: () => undefined,
		compact: () => undefined,
		getSystemPrompt: () => "",
	} satisfies ExtensionContextActions;
	runner.bindCore({} as ExtensionActions, contextActions);
	runner.setUIContext(ui, options.mode ?? "tui");
	await runner.emit({ type: "session_start", reason: "startup" });
	let shut = false;
	const shutdown = async () => {
		if (shut) return;
		shut = true;
		await runner.emit({ type: "session_shutdown", reason: "quit" });
	};
	t.after(shutdown);

	return {
		dir,
		runner,
		session,
		notices,
		shutdown,
		get editorText() { return editorText; },
		set editorText(text: string) { editorText = text; },
		get editorWrites() { return editorWrites; },
		get placement() { return placement; },
		get widgetLines() { return widget?.render(80).map(stripAnsi); },
		paste(data: string) {
			for (const handler of terminalHandlers) assert.equal(handler(data), undefined, "terminal input is never consumed");
		},
	};
}

test("relabels a pasted clipboard path, previews it above the editor and clears with the draft", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "T", "pi-clipboard-0b9e.png"));
	pi.editorText = `what is ${path}`;
	await until(() => LABEL.test(pi.editorText));
	const label = pi.editorText.match(LABEL)![0];
	assert.equal(pi.editorText, `what is ${label}`);
	assert.equal(pi.placement, "aboveEditor");
	await until(() => pi.widgetLines !== undefined);
	assert.deepEqual(pi.widgetLines, [` ${label} pi-clipboard-0b9e.png · ${png().length} B`]);
	const sessionFile = pi.session.getSessionFile()!;
	assert.equal((await readdir(sessionFile.replace(/\.jsonl$/, ".images"))).length, 1);

	pi.editorText = "";
	await until(() => pi.widgetLines === undefined);
});

test("keeps the path in a bash draft but still previews it", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("bash"));
	pi.editorText = `!open ${path}`;
	await until(() => pi.widgetLines !== undefined);
	assert.equal(pi.editorText, `!open ${path}`);
	assert.equal(pi.editorWrites, 0);
	assert.match(pi.widgetLines![0], /^ a\.png · /);
});

test("does not rewrite a draft holding a collapsed paste until the editor is emptied", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("collapsed"));
	pi.paste(`\x1b[200~${"line\n".repeat(20)}\x1b[201~`);
	pi.editorText = `${"line\n".repeat(20)}${path}`;
	await until(() => pi.widgetLines !== undefined);
	assert.equal(pi.editorWrites, 0);

	pi.editorText = "";
	await until(() => pi.widgetLines === undefined);
	pi.editorText = path;
	await until(() => LABEL.test(pi.editorText));
});

test("on interactive submit replaces labels with cached paths and attaches the images", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("submit"));
	pi.editorText = path;
	await until(() => LABEL.test(pi.editorText));
	const existing = { type: "image" as const, data: "AAAA", mimeType: "image/jpeg" };
	const result = await pi.runner.emitInput(`see ${pi.editorText}`, [existing], "interactive");
	assert.equal(result.action, "transform");
	if (result.action !== "transform") return;
	const imagesDir = pi.session.getSessionFile()!.replace(/\.jsonl$/, ".images");
	assert.match(result.text, new RegExp(`^see ${imagesDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[0-9a-f]{16}\\.png$`));
	assert.deepEqual(result.images, [existing, { type: "image", data: png("submit").toString("base64"), mimeType: "image/png" }]);
});

test("leaves non-interactive submissions untouched", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("rpc"));
	for (const source of ["rpc", "extension"] as const) {
		assert.deepEqual(await pi.runner.emitInput(`see ${path}`, undefined, source), { action: "continue" });
	}
});

test("outside the TUI it neither watches the editor nor transforms input", async (t) => {
	const pi = await harness(t, { mode: "rpc" });
	const path = await writeImage(join(pi.dir, "a.png"), png("rpc-mode"));
	pi.editorText = path;
	await new Promise((resolve) => setTimeout(resolve, 500));
	assert.equal(pi.editorText, path);
	assert.equal(pi.widgetLines, undefined);
	assert.deepEqual(await pi.runner.emitInput(`see ${path}`, undefined, "interactive"), { action: "continue" });
});

test("without a session file it labels and attaches the original path", async (t) => {
	const pi = await harness(t, { persist: false });
	const path = await writeImage(join(pi.dir, "a.png"), png("no-session"));
	pi.editorText = path;
	await until(() => LABEL.test(pi.editorText));
	const result = await pi.runner.emitInput(pi.editorText, undefined, "interactive");
	assert.ok(result.action === "transform");
	assert.equal(result.text, path);
	assert.deepEqual(await readdir(pi.dir).then((names) => names.filter((name) => name.endsWith(".images"))), []);
});

test("a label from another session is re-copied into the current session on submit", async (t) => {
	const first = await harness(t);
	const path = await writeImage(join(first.dir, "a.png"), png("switch"));
	first.editorText = path;
	await until(() => LABEL.test(first.editorText));
	const label = first.editorText;
	await first.shutdown();

	const second = await harness(t);
	const result = await second.runner.emitInput(label, undefined, "interactive");
	assert.ok(result.action === "transform");
	const imagesDir = second.session.getSessionFile()!.replace(/\.jsonl$/, ".images");
	assert.equal(dirname(result.text), imagesDir);
	assert.equal(result.images?.length, 1);
});

test("shutdown stops watching and removes the preview", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("shutdown"));
	pi.editorText = `!x ${path}`;
	await until(() => pi.widgetLines !== undefined);
	await pi.shutdown();
	assert.equal(pi.widgetLines, undefined);
	pi.editorText = path;
	await new Promise((resolve) => setTimeout(resolve, 500));
	assert.equal(pi.editorText, path);
});

test("warns once and leaves the text when an image is over the size limit", async (t) => {
	const pi = await harness(t);
	const { truncate } = await import("node:fs/promises");
	const path = await writeImage(join(pi.dir, "huge.png"));
	await truncate(path, 20 * 1024 * 1024 + 1);
	pi.editorText = `see ${path}`;
	await until(() => pi.notices.length === 1);
	pi.editorText = `see ${path} `;
	await new Promise((resolve) => setTimeout(resolve, 500));
	assert.equal(pi.editorText, `see ${path} `);
	assert.equal(pi.notices.length, 1);
	assert.match(pi.notices[0], /huge\.png is over 20 MB; left as text, not attached/);
	assert.equal(pi.widgetLines, undefined);
});
