import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, truncate, writeFile } from "node:fs/promises";
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
import {
	Editor,
	KeybindingsManager,
	resetCapabilitiesCache,
	setCapabilities,
	setKeybindings,
	TUI_KEYBINDINGS,
	type Component,
	type TUI,
} from "@earendil-works/pi-tui";
import { WIDGET_KEY } from "../src/index.ts";
import { registry } from "../src/store.ts";
import { png, tempDir, theme, until, writeImage } from "./helpers.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = /\[image (\d+)\]/;

test.beforeEach(() => setCapabilities({ images: null, trueColor: true, hyperlinks: false }));
test.afterEach(() => resetCapabilitiesCache());

/** Raw terminal input, as Pi's TUI delivers it. */
const KEY = { enter: "\r", undo: "\x1f", up: "\x1b[A", down: "\x1b[B", home: "\x01", end: "\x05" };
const bracketed = (text: string) => `\x1b[200~${text}\x1b[201~`;

/**
 * Pi's real loader and event runner, with pi-tui's real `Editor` behind `ctx.ui` and a fake widget host.
 * `press` feeds raw input the way Pi's TUI does: every terminal-input listener first, then the editor.
 */
async function harness(t: TestContext, options: { persist?: boolean; mode?: Parameters<ExtensionRunner["setUIContext"]>[1] } = {}) {
	const dir = await tempDir(t);
	const loaded = await discoverAndLoadExtensions([join(root, "src/index.ts")], dir, join(dir, "agent"));
	assert.deepEqual(loaded.errors, []);
	const session = options.persist === false ? SessionManager.inMemory(dir) : SessionManager.create(dir, join(dir, "sessions"));
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, dir, session, {} as ModelRegistry);

	const tuiStub = { terminal: { rows: 40, columns: 80 }, requestRender() {} } as unknown as TUI;
	const plain = (text: string) => text;
	const editor = new Editor(tuiStub, {
		borderColor: plain,
		selectList: { selectedPrefix: plain, selectedText: plain, description: plain, scrollInfo: plain, noMatch: plain },
	});
	// Lay out wide, so the long temporary paths in these drafts do not wrap and Up/Down act per line.
	editor.render(400);
	const submitted: string[] = [];
	editor.onSubmit = (text) => {
		submitted.push(text);
		editor.addToHistory(text);
	};
	let widget: (Component & { dispose?(): void }) | undefined;
	let placement: ExtensionWidgetOptions["placement"];
	const terminalHandlers = new Set<TerminalInputHandler>();
	const notices: string[] = [];
	let editorWrites = 0;
	let beforeRead: (() => void) | undefined;
	const ui = {
		onTerminalInput: (handler: TerminalInputHandler) => {
			terminalHandlers.add(handler);
			return () => terminalHandlers.delete(handler);
		},
		// Pi's interactive mode reads the expanded text and writes through `Editor.setText`.
		getEditorText: () => {
			beforeRead?.();
			return editor.getExpandedText();
		},
		setEditorText: (text: string) => {
			editorWrites++;
			editor.setText(text);
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
		editor,
		notices,
		submitted,
		shutdown,
		/** The expanded draft; setting it stands for another writer, such as an extension, calling `setText`. */
		get editorText() { return editor.getExpandedText(); },
		set editorText(text: string) { editor.setText(text); },
		get editorWrites() { return editorWrites; },
		get placement() { return placement; },
		get widgetLines() { return widget?.render(80).map(stripAnsi); },
		set beforeRead(hook: (() => void) | undefined) { beforeRead = hook; },
		/** Feed raw terminal input through the listeners, then the editor, as Pi's TUI does. */
		press(...inputs: string[]) {
			for (const input of inputs) {
				let data = input;
				for (const handler of terminalHandlers) {
					const result = handler(data);
					assert.equal(result?.consume, undefined, "terminal input is never consumed");
					if (result?.data !== undefined) data = result.data;
				}
				editor.handleInput(data);
			}
		},
		type(text: string) {
			this.press(...[...text]);
		},
	};
}

const settle = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

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
	pi.press(bracketed("line\n".repeat(20)));
	assert.equal(pi.editor.getText(), "[paste #1 +21 lines]");
	pi.press(bracketed(` ${path}`));
	await until(() => pi.widgetLines !== undefined);
	await settle();
	assert.equal(pi.editorWrites, 0);
	assert.equal(pi.editor.getText(), `[paste #1 +21 lines] ${path}`);

	pi.editorText = "";
	await until(() => pi.widgetLines === undefined);
	pi.press(bracketed(path));
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
	await settle();
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
	await settle();
	assert.equal(pi.editorText, path);
});

test("warns once and leaves the text when an image is over the size limit", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "huge.png"));
	await truncate(path, 20 * 1024 * 1024 + 1);
	pi.editorText = `see ${path}`;
	await until(() => pi.notices.length === 1);
	pi.editorText = `see ${path} `;
	await settle();
	assert.equal(pi.editorText, `see ${path} `);
	assert.equal(pi.notices.length, 1);
	assert.match(pi.notices[0], /huge\.png is over 20 MB; left as text, not attached/);
	assert.equal(pi.widgetLines, undefined);
});

test("undoing a relabel keeps the path as typed, while a newly pasted path is still relabelled", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("undo"));
	pi.type("see ");
	pi.press(bracketed(path));
	await until(() => LABEL.test(pi.editorText));
	assert.equal(pi.editorWrites, 1);

	pi.press(KEY.undo);
	assert.equal(pi.editorText, `see ${path}`);
	await settle();
	assert.equal(pi.editorText, `see ${path}`, "the undone path is not relabelled again");
	assert.equal(pi.editorWrites, 1);
	assert.match(pi.widgetLines![0], /^ a\.png · /, "an unlabelled path is still previewed");

	pi.type(" and");
	await settle();
	assert.equal(pi.editorText, `see ${path} and`, "typing does not relabel the undone path either");
	const other = await writeImage(join(pi.dir, "b.png"), png("undo-other"));
	pi.press(bracketed(` ${other}`));
	await until(() => /and \[image \d+\]$/.test(pi.editorText));
	assert.ok(pi.editorText.startsWith(`see ${path} and `));

	const result = await pi.runner.emitInput(pi.editorText, undefined, "interactive");
	assert.ok(result.action === "transform");
	assert.equal(result.images?.length, 2, "the undone path is still cached and attached on submit");
	assert.ok(!result.text.includes(path));
});

test("recalling a history entry is never rewritten, so Down still restores the unsent draft", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("history"));
	pi.editor.addToHistory(`look at ${path}`);
	pi.type("unsent draft");
	await settle(300);

	// The first Up moves to the start of the line; the second recalls the entry.
	pi.press(KEY.up, KEY.up);
	assert.equal(pi.editorText, `look at ${path}`);
	await until(() => pi.widgetLines !== undefined);
	await settle();
	assert.equal(pi.editorText, `look at ${path}`);
	assert.equal(pi.editorWrites, 0);

	pi.press(KEY.down);
	assert.equal(pi.editorText, "unsent draft");
	await settle();
	assert.equal(pi.editorText, "unsent draft");
	assert.equal(pi.editorWrites, 0);
});

test("a tab-heavy paste that Pi collapses is never expanded by a rewrite", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("tabs"));
	pi.press(bracketed("\t".repeat(251)));
	assert.equal(pi.editor.getText(), "[paste #1 1004 chars]");
	pi.press(bracketed(` ${path}`));
	await until(() => pi.widgetLines !== undefined);
	await settle();
	assert.equal(pi.editorWrites, 0);
	assert.equal(pi.editor.getText(), `[paste #1 1004 chars] ${path}`);
});

test("an undo that may restore a collapsed paste after the editor was cleared blocks rewriting again", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("undo-paste"));
	pi.press(bracketed("line\n".repeat(20)));
	pi.editorText = "";
	await settle(300);
	pi.press(KEY.undo);
	assert.equal(pi.editor.getText(), "[paste #1 +21 lines]");
	pi.press(bracketed(` ${path}`));
	await until(() => pi.widgetLines !== undefined);
	await settle();
	assert.equal(pi.editorWrites, 0);
	assert.equal(pi.editor.getText(), `[paste #1 +21 lines] ${path}`);
});

test("a path inserted while an earlier one is being cached is found too", async (t) => {
	const pi = await harness(t);
	const first = await writeImage(join(pi.dir, "a.png"), png("first"));
	const second = await writeImage(join(pi.dir, "b.png"), png("second"));
	const firstHash = createHash("sha256").update(png("first")).digest("hex");
	let inserted = false;
	pi.beforeRead = () => {
		// The first read after the first image is labelled is inside that scan, before its rewrite.
		if (inserted || !registry().labelByHash.has(firstHash)) return;
		inserted = true;
		pi.editor.insertTextAtCursor(` ${second}`);
	};
	pi.press(bracketed(first));
	await until(() => /^\[image \d+\] \[image \d+\]$/.test(pi.editorText));
	assert.ok(inserted);
});

test("on Enter a bash or command draft gets its paths back before the editor submits it", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("bash-submit"));
	pi.press(bracketed(path));
	await until(() => LABEL.test(pi.editorText));
	const label = pi.editorText;
	const cached = registry().byLabel.get(Number(label.match(LABEL)![1]))!.path;

	// Turn the draft into a bash command and submit before any poll can see it.
	pi.press(KEY.home);
	pi.type("!open ");
	pi.press(KEY.enter);
	assert.deepEqual(pi.submitted, [`!open ${cached}`]);

	// The same with a slash command, and with a collapsed paste in the draft, whose content is kept.
	pi.press(bracketed(path));
	await until(() => LABEL.test(pi.editorText));
	pi.press(KEY.home);
	pi.type("/review ");
	pi.press(KEY.end);
	pi.press(bracketed("line\n".repeat(20)));
	pi.press(KEY.enter);
	assert.equal(pi.submitted[1], `/review ${cached}${"line\n".repeat(20)}`.trim());
});

test("a remapped undo key is honoured", async (t) => {
	setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, { "tui.editor.undo": "ctrl+u" }));
	t.after(() => setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS)));
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("remapped"));
	pi.press(bracketed(path));
	await until(() => LABEL.test(pi.editorText));
	pi.press("\x15");
	assert.equal(pi.editorText, path);
	await settle();
	assert.equal(pi.editorText, path);
	assert.equal(pi.editorWrites, 1);
});

test("when the session copy cannot be written the path is left as typed, with one warning", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "a.png"), png("blocked"));
	// A file where the images folder should be makes every copy fail.
	await writeFile(pi.session.getSessionFile()!.replace(/\.jsonl$/, ".images"), "");
	pi.press(bracketed(`see ${path}`));
	await until(() => pi.notices.length === 1);
	await settle();
	assert.equal(pi.editorText, `see ${path}`);
	assert.equal(pi.editorWrites, 0);
	assert.match(pi.notices[0], /a\.png could not be saved to the session folder; left as text, not attached/);

	const result = await pi.runner.emitInput(`see ${path}`, undefined, "interactive");
	assert.deepEqual(result, { action: "continue" });
	assert.equal(pi.notices.length, 1);
});

test("a too-large path warns on submit even when nothing else changes", async (t) => {
	const pi = await harness(t);
	const path = await writeImage(join(pi.dir, "huge.png"));
	await truncate(path, 20 * 1024 * 1024 + 1);
	assert.deepEqual(await pi.runner.emitInput(`see ${path}`, undefined, "interactive"), { action: "continue" });
	assert.equal(pi.notices.length, 1);
	assert.match(pi.notices[0], /huge\.png is over 20 MB/);
});
