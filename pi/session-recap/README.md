# pi-session-recap

A personal [Pi](https://pi.dev) extension that leaves a short “while you were away” orientation in the transcript. It states the high-level task, a recent result, and the next step or blocker after you return to one of several sessions.

The recap is UI only: it is not appended to the session, saved in conversation history, or sent to the main or recap model as conversation context. By default it disappears when input or agent work resumes. `/recap keep` can retain completed recaps onscreen during ordinary work.

Status: an MIT-licensed fork, moved with full history into industrial-os without changing behavior. The offline suite runs against pinned Pi 1.2.0, the installed host version. Interactive Pi/Herdr and live providers remain unverified; see [verification records](CONTRIBUTING.md#verification-records).

## Install

Use one filtered settings entry for industrial-os, as described in [Pi installation](../README.md#install):

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/session-recap/index.ts"]
}
```

Merge this path into an existing industrial-os entry, rather than configuring a second source. For development use `pi install <industrial-os checkout>/pi/session-recap`; Pi loads it as-is. Do not enable both local and git copies. No live configuration change is performed by the test suite.

## Triggers

- **Return:** one recap when you focus the terminal or Herdr pane again after at least 90 seconds of continuous blur. Nothing is drafted while you are away, however many runs end. If the agent is still running when you return, the recap waits for `agent_settled` (after retries, compaction, or queued continuation); typing first drops it. An unchanged session is not recapped again.
- **Idle fallback:** 120 seconds after `turn_end` until a real focus event has been seen. Use this when the terminal or multiplexer does not forward focus reliably.
- **Orientation:** shortly after a session resumes or forks.
- **Manual:** `/recap` for a brief orientation, or `/recap detailed` for an on-demand breakdown of the current session. Both bypass the meaningful-activity gate.

Quick pane switches do not call a model. A draft is cancelled when new work starts, `/tree` changes branches, a session is replaced, extensions reload, or Pi shuts down. Temporary UI is cleared at those boundaries; kept rows survive new work but not session/branch resets. Late responses are discarded after cancellation or if the projected session context changed.

## Commands

Run `/recap detailed` for a headed, bulleted breakdown from the beginning of the **current active session branch**: the goal and changing requests, earlier work, decisions, results/tests, useful files/artifacts, blockers, unfinished work and next actions. It asks the recap model to distinguish completed, proposed, unverified and failed work and ground claims in the supplied history. `/recap` and all automatic triggers remain brief; there is no saved detail preference.

Type `/recap ` to see Pi's native suggestions: `model`, `keep`, and `detailed`. Type a prefix such as `/recap det` and press Tab to complete the suggested subcommand. Both recap modes use the same selected model/authentication, separate provider call, cancellation checks, and UI-only keep On/Off behavior. Neither the command operation nor its result is inserted into main-model history; recap text is never persisted by this extension.

Detailed coverage honors persisted context edits on the active branch, not abandoned branches or request-local transformations; summary-only history cannot be reconstructed. See [input coverage](docs/architecture.md#recap-input-and-provider-call).

## Flags

| Flag | Default | Purpose |
|---|---:|---|
| `--recap-away-seconds <n>` | `90` | Continuous blur before returning drafts a recap. |
| `--recap-idle-seconds <n>` | `120` | No-focus-event fallback after `turn_end`. |
| `--recap-disable-focus` | `false` | Disable DECSET `?1004`; idle fallback remains active. |
| `--recap-during-active` | `false` | Draft the return recap without waiting for the agent to settle. |
| `--recap-disable` | `false` | Disable automatic recaps; `/recap` still works. |
| `--recap-model "<provider>/<id>"` | automatic | Explicit recap model; malformed or unknown IDs fall back to the active model. |

Durations are clamped to at least five seconds.

## Onscreen retention

Run `/recap keep` for Pi’s native **On / Off** choice, showing the current global preference. Escape cancels without saving or generating a recap. **Off** is the default. **On** keeps each subsequently completed recap as an ordinary chronological, wrapped transcript row in both regular and fullscreen modes. New input, agent turns, tool activity, notifications, and newer recaps do not replace earlier kept rows. Turning Off affects new recaps only; already-kept rows remain until the UI resets.

The global boolean `keep` shares `<agent-dir>/session-recap.json` with the optional `model`, e.g. `{"model":"provider/id","keep":true}`. Both commands preserve the other setting: after the dialog they take a short lock on the file, reread it and save atomically, so two Pi processes saving at once cannot lose either change. A lock still held after two seconds fails the save with an error; a lock left by a crashed process is cleared after ten seconds; invalid/unreadable settings are not overwritten. Each newly displayed recap rereads retention, so running sessions sharing the agent directory see changes without watchers. No recap text is written to configuration, session entries, or model context.

Kept rows are not durable history: see [display lifetime and unsupported-layout fallback](docs/design.md#display-lifetime).

## Model selection, privacy, and cost

Run `/recap model` to choose a global default from Pi’s available provider/model list. The picker shows the saved choice and any active CLI override; it never calls a model or changes Pi’s main model. Escape cancels without saving. **Automatic** clears the default and restores the existing automatic policy (unless overridden).

The choice is stored in `<agent-dir>/session-recap.json` as an optional `model` string alongside the optional `keep` boolean. Automatic removes only `model`, preserving retention (reset writes `{}` when no retention preference exists). The directory comes from Pi’s `getAgentDir()`: normally `~/.pi/agent`, respecting `PI_CODING_AGENT_DIR`, never project configuration or `settings.json`. Nothing is created on extension load. Each recap rereads the file, so already-running sessions sharing that directory see changes on their next recap; in-flight requests are not rerouted. Invalid/unreadable files warn without exposing their contents and use automatic model selection (unless overridden by `--recap-model`) and temporary display. Failed saves report an error, not success.

The extension uses Pi’s authentication for the selected provider and chooses, in order:

1. a nonempty `--recap-model` override;
2. the saved global default;
3. `anthropic/claude-haiku-4-5` for Anthropic sessions, when available;
4. a same-provider GPT-5.6 Luna model for GPT sessions, when available;
5. the active model.

If a selected model has no usable authentication, the recap is skipped, not rerouted to another provider. Malformed or unknown CLI overrides, and unknown saved model IDs, fall directly back to the active model rather than its cheaper sibling.

Input coverage and token bounds differ between [brief and detailed recaps](docs/architecture.md#recap-input-and-provider-call). Detailed mode can send the whole available branch, including images and tool excerpts; neither mode has a hard total-input-token budget. Sensitive session data goes to the selected provider, and long sessions can exceed its context limit.

Only a clean `stopReason: "stop"` is displayed; failed, aborted, deferred, tool-use, pending, and token-limit-truncated responses are discarded. Errors are reported with only a safe reason, such as an HTTP status (`HTTP 429: rate limit or spending cap reached`) or a network error code, never the provider's message.

A Pi-only custom API handler (for example, a runtime-only `claude-bridge` handler) cannot be routed by the standalone `pi-ai` compatibility completion. That case is skipped silently. Being listed in Pi’s picker is not proof of standalone recap compatibility; custom APIs are not filtered out. Select a built-in API-backed provider/model with `/recap model` or `--recap-model` if one is available. OpenAI Codex and Google models using built-in Pi API types are supported by the same completion path.

Every generated recap is one separate provider request and may incur cost; detailed recaps can cost more because they send more history. `--recap-disable`, longer timers, or a cheaper explicit model are the available controls.

## Provenance

Imported from Thomas Mustier’s MIT-licensed [`session-recap`](https://github.com/tmustier/pi-extensions/tree/main/session-recap) at exact upstream commit [`4a63a2ebd3683d86597e226c7ff778ea4837dd73`](https://github.com/tmustier/pi-extensions/commit/4a63a2ebd3683d86597e226c7ff778ea4837dd73), released upstream as `@tmustier/pi-session-recap` 0.5.1 on 2026-09-22. The imported revision is the merged compatibility PR [#112](https://github.com/tmustier/pi-extensions/pull/112), targets Pi 0.87, and does **not** contain PR [#106](https://github.com/tmustier/pi-extensions/pull/106) (`0c9b11657af023a6d1c064d04e95a1456301f3ff` was not an ancestor and the PR remained open as of 2026-10-01).

This fork integrates the still-needed #106 response-validity fix and focused regressions, with credit to **Serge Baranov (`CrazyCoder`)**, then adapts lifecycle and terminal-input ownership for Pi 1.0. Provider error details are intentionally redacted beyond that patch. The original MIT copyright and full license are in [LICENSE](./LICENSE); the imported release history is retained in [CHANGELOG.md](./CHANGELOG.md).

## Guides

- [Agent guide](AGENTS.md): rules and task routes.
- [Contributing](CONTRIBUTING.md): setup, exact checks and verification records.
- [Architecture](docs/architecture.md): input projection, provider calls, settings and lifecycle.
- [Conventions](docs/conventions.md): engineering rules and adoption gaps.
- [Design](docs/design.md): presentation, focus and display lifetime.
- [Mission](docs/mission.md): scope and non-goals.
