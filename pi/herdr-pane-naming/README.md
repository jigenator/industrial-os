# pi-herdr-pane-naming

A Pi extension that keeps the **actual Herdr pane label** describing what the
session is working on, without asking the main model to do naming housekeeping.

```text
User message delivered, or assistant activity changes
  → Jev (through pi-typesafe): does the current name still fit?
  → if not, a small title model writes a short title
  → extension: rename this process's own Herdr pane
```

**On by default.** Every main interactive Pi session in a Herdr pane names its
pane, including new, resumed, forked and reloaded sessions, `/goal` runs, skill
and template prompts, and messages sent by other extensions. Existing labels are
taken over. `/pane-naming off` is the only off switch, and it applies to new
panes too until `/pane-naming on`.

This is not an agent-callable rename tool. It does not route work, change Pi's
main model, or modify Herdr's managed status extension.

Status: moved with full history into industrial-os, with no behavior change. Automated and installed-Pi evidence is in [contributing](CONTRIBUTING.md#verification-records); live Herdr and provider behavior are not qualified by the move. No license has been selected.

## Requirements

- Pi `1.0.4` or compatible; Herdr CLI/server `0.9.3` or compatible.
- Node `22.19+` (required by `pi-typesafe`).
- A TypeSafe key for Jev: run `/typesafe login` once (from the
  [`pi-typesafe`](https://github.com/DevMortimer/pi-typesafe) package), or set
  `TYPESAFE_API_KEY`. The key is read for every check, so logging in later takes
  effect without a reload.
- A title model Pi can use. Without a saved choice, naming uses
  `google/gemini-3.5-flash-lite` when Pi has it configured, otherwise the
  session's current model.

The only runtime dependency is `pi-typesafe`, which brings `@typesafe-ai/sdk`.

## Install

Use one filtered settings entry for industrial-os, as described in [Pi installation](../README.md#install):

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/herdr-pane-naming/index.ts"]
}
```

Merge this path into an existing industrial-os entry rather than adding a second source. For a local checkout, follow [root setup](../../CONTRIBUTING.md#setup) first, then `pi install <industrial-os checkout>/pi/herdr-pane-naming`. Pi loads local paths as-is; it installs no dependencies there. The root install supplies `pi-typesafe` for this subfolder ([decision](../../docs/decisions/pane-naming-root-dependency.md)). Do not configure the local and git copies together.

Do not enable this in a session where the main agent is also told to rename panes; the two will fight over the label.

## Commands

- `/pane-naming status` — on/off here, the new-pane default, this session's Jev
  check and title request counts, the cooldown, the title model in use (marked
  `default` or `fallback`), and the TypeSafe key status.
- `/pane-naming on` — enable naming here and save "on" for new panes.
- `/pane-naming off` — stop naming here and save "off" for new panes. The current
  label is left alone. Other running panes keep naming until they restart or reload.
- `/pane-naming cooldown 30` — seconds between assistant-activity checks
  (whole number, **1–3,600**; default **30**).
- `/pane-naming model google/gemini-3.5-flash-lite` — the title model, as
  `provider/model-id`; it must already be available in Pi.

`cooldown` and `model` apply immediately in this pane and are saved for future
panes. Other running panes keep their settings until restart or `/reload`.
Changing the model cancels pending work started with the previous model. A
shorter cooldown can run a queued activity check immediately.

Settings live in `~/.pi/agent/pane-naming.json` (`PI_CODING_AGENT_DIR` is
respected), written atomically with owner-only permissions. No credentials are
stored there. A missing file means the defaults (on). An unreadable or invalid
file at startup produces a warning and the defaults; commands then refuse to
overwrite it until you fix or delete it (`off` still stops the current pane).

Startup flags: `--pane-naming-model provider/model-id` overrides the saved model
for that session; `--pane-naming` turns naming on for that session even when the
saved default is off. Neither changes the saved file.

## Behavior and limits

Naming runs only in a main interactive Herdr pane, from delivered user text and finalized assistant activity. Assistant checks coalesce behind the cooldown; there is no polling. See [the event flow and safeguards](docs/architecture.md), and [label ownership and PR numbers](docs/design.md). A hand-set name does not pause automation; turn naming off to keep it.

## Data sharing and cost

Jev requests go to `api.typesafe.ai` through `pi-typesafe`; title requests go to
the title model's provider through Pi. Both can receive:

- the first 2,000 characters of the latest user request;
- up to 2,000 characters of the previous named task's request;
- the current pane label (at most 80 characters);
- on user-triggered checks, up to 600 characters of the latest assistant visible text;
- on activity-triggered checks, up to 600 characters of the latest assistant
  progress text and up to eight requested tool names (≤64 characters each);
- the title model also receives the allowed PR numbers.

No full transcript, system prompt, thinking, images, tool arguments, file
contents, or tool output is forwarded. These excerpts **can still contain
sensitive data**; there is no general redaction. The label is visible in Herdr.

Cost bounds:

- No per-session check cap. Spend is bounded by the cooldown, by the fact that
  only `update`/`new_task` call the title model, and by `pi-typesafe`'s optional
  daily caps, shared with every other pi-typesafe user on the machine:
  `PI_TYPESAFE_MAX_REQUESTS_PER_DAY`, `PI_TYPESAFE_MAX_INPUT_TOKENS_PER_DAY`,
  `PI_TYPESAFE_MAX_USD_PER_DAY`. A reached cap is reported as a Jev failure.
- Naming checks appear in `/typesafe status` (today's requests, tokens and
  estimated cost). They are **not** included in Pi's main-session token/cost totals.
- Each model request has an **8-second deadline**; each Herdr command **1.5 seconds**.
  No automatic retries. Cancelled or failed requests may still be billed.
- Title responses are capped at **160 output tokens** with thinking disabled for
  Pi's Google adapter.

## Diagnosing failures

Failures never turn naming off. A failed attempt shows one warning naming its
stage (`Title model selection`, `Herdr read`, `Jev`, `Title model`, or
`Herdr rename`), the elapsed time, and a safe reason: pi-typesafe's own message
(for example `No API key. Run /typesafe login in Pi, or set TYPESAFE_API_KEY…`
or an HTTP status with advice), a deadline, a title validation rule, or a known
network error code. The same warning is not repeated until a check succeeds, so a
missing key cannot flood the screen; the next activity simply tries again.

Each failure is also saved as a `herdr-pane-naming-failure` custom entry
(`paneId`, session check/title counts, stage, reason, elapsed time) that survives
reload without entering model context. Request text, rejected titles, raw errors,
response bodies and credentials are never logged. Cancelled or superseded work is
not a failure. A startup warning also appears when no title model is usable or
`pi-typesafe` reports the key as missing or rejected; naming stays on and picks
up a later `/typesafe login` or `/pane-naming model` without re-enabling.

## Upgrading from 0.1

- `CLOUDFLARE_JEV_API_CREDENTIALS_FILE` is no longer read; Jev uses the
  pi-typesafe key. You can remove the variable and the credentials file.
- Naming is on unless `/pane-naming off` saved it off. A saved `"enabled": true`
  keeps working.
- `/pane-naming adopt` and `/pane-naming limit` are gone. A saved `checkLimit`
  is ignored and dropped the next time settings are saved.
- Earlier per-session ownership/check-count entries in old sessions are ignored.

## Guides

- [Agent guide](AGENTS.md): rules and task routes.
- [Contributing](CONTRIBUTING.md): setup, checks and verification records.
- [Architecture](docs/architecture.md): modules, events, cancellation and Herdr writes.
- [Conventions](docs/conventions.md): engineering rules and adoption gaps.
- [Design](docs/design.md): labels, PR references and feedback.
- [Mission](docs/mission.md): scope and non-goals.
