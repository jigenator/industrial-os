# Architecture

## Modules and dependencies

The extension remains one `index.ts` module. It imports Node crypto/fs/path, Pi's projection/session/agent-dir APIs, `pi-ai/compat` completion functions and Pi TUI containers/text. It imports neither another extension nor the design system. `package.json` declares host peers and pinned Pi 1.0.0 development packages; `tsconfig.json` checks only `index.ts` under strict NodeNext, with `skipLibCheck`.

| Seam in `index.ts` | Owns | Tests |
| --- | --- | --- |
| `buildRecapContext`, `hasMeaningfulActivity` | Edited message projection, framing, brief window, detailed full-branch coverage and automatic activity gate | `tests/context.test.mjs`, `tests/detailed.test.mjs` |
| `selectRecapModel`, `generateRecap`, `describeFailure` | Provider selection/auth, completion routing, response validity and redacted failure reason | `tests/model-selection.test.mjs`, `tests/reasoning-off.test.mjs`, `tests/truncated-response.test.mjs`, `tests/unknown-api-provider.test.mjs` |
| Settings read/validate/save | Global model/keep preferences, exclusive temporary file and atomic rename | `tests/global-model.test.mjs` |
| `showRecap`, `recapChat`, `createRetainedRecapUI` | Temporary widgets, private-layout admission, retained chronological UI-only rows and disposal | `tests/transcript-recap.test.mjs`, `tests/retention.test.mjs` |
| Default registration | Flags/command, focus parsing, timers, request/picker cancellation and context fingerprint | `tests/lifecycle.test.mjs`, `tests/projection-validation.test.mjs`, command/lifecycle cases above |

## Recap input and provider call

Detailed input includes all available messages on that branch, including pre-compaction work, with Pi's latest branch-local context replacements/removals applied. It does not read other sessions or abandoned branches. Compaction and branch summaries are excluded because they can contain stale redacted content or abandoned-path work; system prompts and tool declarations are excluded too. Where summaries were excluded, the request tells the model to disclose that only available edited active-branch messages are covered: **summary-only/imported history cannot be reconstructed**. This is not an exhaustive audit of raw history. Request-local extension `context` transformations are not replayed; persisted `context_edit` entries are honored.

Pi 1.0 transcript system messages (including prompt sections and tool declarations) are excluded. A recap uses no tools, system prompt, skills, reasoning, or prompt-cache retention.

- **Brief:** output is limited to 256 tokens and normalized to a single paragraph. Input remains the latest 30 projected messages (extended backward when necessary to retain a tool-call boundary), plus the initial request and active compaction or branch summary. Long initial-request framing retains its first/last 4,000 characters.
- **Detailed:** output preserves headings/bullets/newlines and allows up to 4,096 tokens, capped by the selected model's declared output maximum. Input spans the edited active branch without a message-window bound or initial-request truncation; summaries are excluded as described above.
- **Both:** each long tool-result text block retains its first/last 2,000 characters with a truncation marker. There is no hard total-input-token budget: ordinary messages, tool calls, images, and (for brief recaps) summaries can still be large. A long detailed session may exceed the selected provider's context limit and fail; there is no automatic chunking, retry, extra summarization call, or silent fallback to recent-only history.

The automatic gate requires a tool call or at least 30 assistant words since the latest user message. Manual commands bypass it. Context is fingerprinted before generation and rebuilt before display; changed projection discards the response. Recap output itself never becomes input. See [model selection, privacy and cost](../README.md#model-selection-privacy-and-cost) for authentication/fallback policy and response acceptance.

A single standalone `completeSimple` call normally omits reasoning. The Codex responses API instead uses `complete` with explicit `reasoningEffort: "none"`. No main-model switch or tools are involved. There is no provider deadline added by this extension; cancellation relies on the provider signal, and late responses are fenced.

## Lifecycle and persistence

`session_start` resets the prior runtime state, optionally attaches Pi-owned terminal input, and schedules resume/fork orientation after 300 ms. `turn_end` arms the idle timer only before real focus events have been observed. Blur marks a long-enough absence without inference; return generates or defers until `agent_settled`. [Triggers and flags](../README.md#triggers) own the user timing contract.

Input, turn/agent start, session/tree replacement and shutdown cancel requests and pickers; navigation also clears deduplication and retained rows. Shutdown releases the focus listener/mode and every timer. A picker suppresses recap work until it closes; a superseded picker cannot save or clear a newer picker. Abort and projected-context checks reject stale output after authentication or generation.

Only model and keep preferences persist to `<agent-dir>/session-recap.json`. No session-file I/O, recap entries or recap text persistence is introduced. Commands reread settings after dialogs before atomic save, preserving the other field; malformed/unreadable data is never overwritten. The [README](../README.md#onscreen-retention) owns cross-session setting semantics; [design](design.md) owns UI lifetime.

## Host seams and evolution

`recapChat` uses Pi's private document/header/resources/chat container layout, admits only regular/fullscreen mode and falls back to temporary UI on mismatch. Offline retention tests use the actual pinned host constructor, mount methods, selector and widget disposal, without starting a renderer. They deep-import host internals and the loader's nested pi-ai copy; host/package topology changes can break them even when public APIs still load. Keep that evidence distinct from installed-host RPC and interactive verification.

Split this module only for a concrete change; preserve projection, cancellation, safe errors and UI-only output. A context budget, provider timeout, design-system migration or stable retention host API would be a separate behavior change.
