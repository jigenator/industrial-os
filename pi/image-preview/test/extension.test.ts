import assert from "node:assert/strict";
import { truncate } from "node:fs/promises";
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
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { resetCapabilitiesCache, setCapabilities, type Component, type TUI } from "@earendil-works/pi-tui";
import { WIDGET_KEY } from "../src/index.ts";
import { MAX_IMAGE_BYTES } from "../src/image.ts";
import { png, tempDir, theme, until, writeImage } from "./helpers.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test.beforeEach(() => setCapabilities({ images: null, trueColor: true, hyperlinks: false }));
test.afterEach(() => resetCapabilitiesCache());

/**
 * Pi's real loader and event runner, with a fake `ctx.ui` whose editor text the test sets. Every UI call
 * that could change the editor or input is recorded, so tests can assert it never happens.
 */
async function harness(t: TestContext, mode: Parameters<ExtensionRunner["setUIContext"]>[1] = "tui") {
	const dir = await tempDir(t);
	const loaded = await discoverAndLoadExtensions([join(root, "src/index.ts")], dir, join(dir, "agent"));
	assert.deepEqual(loaded.errors, []);
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, dir, SessionManager.inMemory(dir), {} as ModelRegistry);

	let editorText = "";
	let widget: (Component & { dispose?(): void }) | undefined;
	let placement: ExtensionWidgetOptions["placement"];
	let widgetCalls = 0;
	const forbidden: string[] = [];
	const ui = {
		getEditorText: () => editorText,
		setEditorText: () => forbidden.push("setEditorText"),
		pasteToEditor: () => forbidden.push("pasteToEditor"),
		setEditorComponent: () => forbidden.push("setEditorComponent"),
		onTerminalInput: () => {
			forbidden.push("onTerminalInput");
			return () => undefined;
		},
		notify: () => forbidden.push("notify"),
		setWidget: (key: string, factory: ((tui: TUI, theme: Theme) => typeof widget) | undefined, options?: ExtensionWidgetOptions) => {
			assert.equal(key, WIDGET_KEY);
			widgetCalls++;
			widget?.dispose?.();
			widget = factory?.({ requestRender() {} } as unknown as TUI, theme);
			placement = options?.placement;
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
	runner.setUIContext(ui, mode);
	await runner.emit({ type: "session_start", reason: "startup" });
	const shutdown = () => runner.emit({ type: "session_shutdown", reason: "quit" });
	t.after(shutdown);

	return {
		dir,
		runner,
		forbidden,
		shutdown,
		set editorText(text: string) { editorText = text; },
		get placement() { return placement; },
		get widgetCalls() { return widgetCalls; },
		get widgetLines() { return widget?.render(80).map(stripAnsi); },
	};
}

const settle = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

test("previews an image path above the editor, follows edits and clears with the path", async (t) => {
	const pi = await harness(t);
	const shot = await writeImage(join(pi.dir, "T", "pi-clipboard-0b9e.png"));
	const other = await writeImage(join(pi.dir, "My Shots", "b.png"), png("other"));
	pi.editorText = `what is ${shot}`;
	await until(() => pi.widgetLines !== undefined);
	assert.equal(pi.placement, "aboveEditor");
	assert.deepEqual(pi.widgetLines, [` pi-clipboard-0b9e.png · ${png().length} B`]);

	pi.editorText = `what is ${shot} and "${other}" and ${shot}`;
	await until(() => pi.widgetLines?.length === 2);
	assert.deepEqual(pi.widgetLines, [` pi-clipboard-0b9e.png · ${png().length} B`, ` b.png · ${png("other").length} B`]);

	pi.editorText = "what is it";
	await until(() => pi.widgetLines === undefined);
	assert.deepEqual(pi.forbidden, []);
});

test("never changes the editor or the submission", async (t) => {
	const pi = await harness(t);
	assert.equal(pi.runner.hasHandlers("input"), false, "no input handler");
	const path = await writeImage(join(pi.dir, "a.png"));
	pi.editorText = `!open ${path}`;
	await until(() => pi.widgetLines !== undefined);
	pi.editorText = path;
	await settle();
	assert.deepEqual(await pi.runner.emitInput(`see ${path}`, undefined, "interactive"), { action: "continue" });
	assert.deepEqual(pi.forbidden, []);
});

test("ignores missing files, non-images and files over the size cap", async (t) => {
	const pi = await harness(t);
	const huge = await writeImage(join(pi.dir, "huge.png"));
	await truncate(huge, MAX_IMAGE_BYTES + 1);
	const fake = await writeImage(join(pi.dir, "fake.png"), Buffer.from("not an image"));
	pi.editorText = `${huge} ${fake} ${join(pi.dir, "missing.png")}`;
	await settle();
	assert.equal(pi.widgetCalls, 0);
	assert.deepEqual(pi.forbidden, []);
});

test("outside the TUI it does not watch the editor", async (t) => {
	const pi = await harness(t, "rpc");
	pi.editorText = await writeImage(join(pi.dir, "a.png"));
	await settle();
	assert.equal(pi.widgetCalls, 0);
});

test("shutdown removes the preview and stops watching", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"));
	pi.editorText = path;
	await until(() => pi.widgetLines !== undefined);
	await pi.shutdown();
	assert.equal(pi.widgetLines, undefined);
	const calls = pi.widgetCalls;
	pi.editorText = `${path} `;
	await settle();
	assert.equal(pi.widgetCalls, calls);
});

test("a session restart replaces the watch rather than adding one", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"));
	pi.editorText = path;
	await until(() => pi.widgetLines !== undefined);
	await pi.runner.emit({ type: "session_start", reason: "new" });
	// The old watch removed its widget; the new one shows the same draft once.
	await until(() => pi.widgetLines !== undefined);
	const calls = pi.widgetCalls;
	pi.editorText = "";
	await until(() => pi.widgetLines === undefined);
	await settle();
	assert.equal(pi.widgetCalls, calls + 1, "one watch clears the widget");
});
