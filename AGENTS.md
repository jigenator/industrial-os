# Agent guide

Purpose: the monorepo for Pi and Herdr visualization, user experience, and tooling, built on one terminal-only visual language. Product scope is in [the mission](docs/mission.md).

This guide holds the rules for the whole repository. Each project is its own project with its own guides; follow the root guides and the project's guides together.

## Critical engineering rules

- No project imports another project's code, except that any project may import `@industrial-os/design-system` by package name through an exported subpath; never a relative path into `design-system/` or an unexported module. A Pi extension loads with the host's peer packages plus that package, resolved through the root install. Full rule: [conventions](docs/conventions.md#module-and-dependency-rules). Check: review imports; `design-system/package.test.mjs` checks the exports map; no automated cross-project check.
- The design system owns color values; until an extension migrates to the package, its color constants mirror the design system and must match it. Change the design system first, then each extension that still mirrors it. Full rule: [decision](docs/decisions/in-repo-design-system-package.md). Check: both rendering extensions import their colors from the package; review that no hex value is copied into them, and compare any extension that has not migrated against `design-system/foundation/palette.mjs` and `signal-colors.mjs`.
- Claim only what the stated checks support. Do not invent an installed package, released API, or Herdr check that has not run; keep automated, Pi-load, and interactive evidence separate. Full rule: [conventions](docs/conventions.md#tests).
- Do not publish private paths, data, credentials, or copied assets without rights and notices. Full rule: [conventions](docs/conventions.md#dependencies-and-generated-output).
- Keep each rule, command, and value in one canonical place and trace callers before changing shared behavior. Full rule: [conventions](docs/conventions.md#engineering-principles).

## Read for the task

Scan the supporting-documents map and read every document whose condition applies before changing that area. Follow the project's guide for its routes; do not load the other project's manuals.

| Task | Route |
| --- | --- |
| Work in the design system | [The design-system guide](design-system/AGENTS.md) and its routes |
| Work on a Pi extension | [The Pi guide](pi/AGENTS.md), then the extension's own guide, for example [claude-interrupt](pi/claude-interrupt/AGENTS.md), [signals-collector](pi/signals-collector/AGENTS.md) or [status-bar](pi/status-bar/AGENTS.md) |
| Change the visual language or a palette value | [Design](docs/design.md), [the package decision](docs/decisions/in-repo-design-system-package.md), the design-system guide, then each extension that mirrors the value |
| Import the design system from another project | [Conventions](docs/conventions.md#module-and-dependency-rules), [the package decision](docs/decisions/in-repo-design-system-package.md#migrating-an-extension), then the importing project's guide |
| Add or move in a project | [Architecture](docs/architecture.md#where-the-next-change-belongs), [contributing](CONTRIBUTING.md#adding-or-moving-in-a-project), then this map |
| Change a repository-wide rule or check | [Conventions](docs/conventions.md), this map, then [contributing](CONTRIBUTING.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| An element, motion, storybook story, or terminal host | `design-system/`; placement in [its architecture](design-system/docs/architecture.md#where-the-next-change-belongs), rules in [its conventions](design-system/docs/conventions.md) | Standard library only; imports no other project; elements and motions never own I/O; a new module gets an export entry |
| claude-interrupt behavior or marker | `pi/claude-interrupt/`; placement in [its architecture](pi/claude-interrupt/docs/architecture.md) | Pi peer packages and the design-system package only; never block streaming, input, or focus |
| status-bar footer, motion, or status integrations | `pi/status-bar/`; placement in [its architecture](pi/status-bar/docs/architecture.md) | Display-only snapshot consumer; no collection I/O; Pi/design-system exported subpaths only |
| Session signals, Active selection, or shared quota cache | `pi/signals-collector/`; placement in [its architecture](pi/signals-collector/docs/architecture.md) | TUI-only collector; events only to consumers, no extension imports |
| A new Pi extension | `pi/<name>/` with the [project document set](docs/architecture.md#contracts-between-the-root-and-a-project) | Its own manifest, checks, and license; the design system only by package name |
| Shared experience or scope | `docs/design.md`, `docs/mission.md` | Then each project separately |
| Herdr configuration | Planned `herdr/`; nothing exists | Do not create it before maintained content exists |

## Implement and verify

Follow the engineering conventions rather than reproducing a conflicting pattern. Use the validation sequence in the changed project's contributing guide, then the [repository-wide checks](CONTRIBUTING.md#repository-wide-checks). Report passed, failed, skipped, and not-run checks separately.

## Supporting documents

Every supporting guidance document is listed here with a direct link, purpose, and reading condition. Keep this map current when guidance is added, moved, or removed.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | Monorepo overview, layout, and licensing | Changing public usage, onboarding, or the layout |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow, repository-wide checks, and adding a project | Making or verifying any change |
| [docs/mission.md](docs/mission.md) | Product scope and constraints | Choosing features or changing scope |
| [docs/design.md](docs/design.md) | The shared visual and interaction language, states, and acceptance | Changing anything human-facing in any project |
| [docs/conventions.md](docs/conventions.md) | Repository-wide engineering rules and adoption gaps | Writing or reviewing code or technical guidance |
| [docs/architecture.md](docs/architecture.md) | Project map, dependency direction, project contracts, and where new projects go | Adding a project, changing what a project depends on, or tracing a cross-project change |
| [docs/decisions/standalone-packages.md](docs/decisions/standalone-packages.md) | Why there is no workspace or repository command; partly superseded, since the root `package.json` now also links the design-system package | Proposing a root toolchain or CI |
| [docs/decisions/extension-colors-take-precedence.md](docs/decisions/extension-colors-take-precedence.md) | Superseded history: why the extensions once owned palette values | Tracing the history of the color rule |
| [docs/decisions/in-repo-design-system-package.md](docs/decisions/in-repo-design-system-package.md) | Why the design system is a private in-repo package, why it owns the colors, and what migrating an extension requires | Changing a color, importing the design system, changing the root `package.json`, or migrating an extension |
| [design-system/README.md](design-system/README.md) | Design-system orientation, run commands, package name, and status | Using the design system or changing its onboarding |
| [design-system/AGENTS.md](design-system/AGENTS.md) | Design-system rules, task routes, and placement | Working anywhere in `design-system/` |
| [design-system/CLAUDE.md](design-system/CLAUDE.md) | Runtime import of the design-system guide | Checking agent entry points |
| [design-system/CONTRIBUTING.md](design-system/CONTRIBUTING.md) | Design-system setup, commands, validation including the package test, and verification records | Making or verifying a design-system change |
| [design-system/docs/architecture.md](design-system/docs/architecture.md) | Design-system modules, package exports, boundaries, and evolution | Adding elements or motions, or changing design-system dependencies, exports, or contracts |
| [design-system/docs/conventions.md](design-system/docs/conventions.md) | Design-system stack, package exports, text contract, palette source, and performance rules | Writing or reviewing design-system code |
| [design-system/docs/design.md](design-system/docs/design.md) | The design system's element set, reference and signal colors, motions with their rates, and storybook | Changing anything human-facing in the design system |
| [design-system/foundation/README.md](design-system/foundation/README.md) | Line model, text/glyph contract, the palette and signal colors, color mixing, seeded randomness, color output | Changing shared rendering, text handling, glyphs, or colors |
| [design-system/elements/label-plate/README.md](design-system/elements/label-plate/README.md) | Label plate contract: capped and slab forms, tones | Using or changing label plates |
| [design-system/elements/numbered-panel/README.md](design-system/elements/numbered-panel/README.md) | Numbered panel contract | Using or changing panels |
| [design-system/elements/gauge/README.md](design-system/elements/gauge/README.md) | Gauge contract, zones, scales, and truthfulness rules | Using or changing gauges |
| [design-system/elements/status-row/README.md](design-system/elements/status-row/README.md) | Status row contract and states | Using or changing status rows |
| [design-system/elements/count-plate/README.md](design-system/elements/count-plate/README.md) | Count plate contract: CMP and AU plates, tiers, unknown and overflow | Using or changing count plates or unit badges |
| [design-system/elements/lamp/README.md](design-system/elements/lamp/README.md) | Lamp contract: working, idle, and unknown activity cells | Using or changing activity lamps |
| [design-system/elements/thread-rail/README.md](design-system/elements/thread-rail/README.md) | Thread rail contract: lamp, ROOT plate, unit marks, AU badge, and yielding | Using or changing the thread rail |
| [design-system/elements/transcript-marker/README.md](design-system/elements/transcript-marker/README.md) | Transcript marker contract: plate states, bar row, and the claude-interrupt timeline | Using or changing transcript markers |
| [design-system/elements/instrument-frame/README.md](design-system/elements/instrument-frame/README.md) | Instrument frame contract: framed footer geometry, plate column, wrapping, and minimal layout | Using or changing instrument frames |
| [design-system/elements/pixel-numeral/README.md](design-system/elements/pixel-numeral/README.md) | Pixel numeral contract: 3×5 font, tones, fallbacks, and reconstruction | Using or changing large numerals |
| [design-system/elements/segment-meter/README.md](design-system/elements/segment-meter/README.md) | Segment meter contract: quota segments, provider columns, countdowns, and stale ages | Using or changing segment meters or provider columns |
| [design-system/elements/state-chip/README.md](design-system/elements/state-chip/README.md) | State chip contract: label, shape, and code states with the Tatsu preset | Using or changing state chips |
| [design-system/elements/mode-plate/README.md](design-system/elements/mode-plate/README.md) | Mode plate contract: icon, title, and mode letters with the PNYTL preset | Using or changing mode plates |
| [design-system/motions/README.md](design-system/motions/README.md) | Every motion's contract, parameters, rates, presets, state-cell opt-in, motion-off, host timing, and extension rules | Using, adding, or changing a motion |
| [design-system/examples/README.md](design-system/examples/README.md) | Storybook keys, sections and scrolling index, playback rates, the marker timeline, reuse examples, host seam, and how to add stories | Using the storybook or showcase, adding a story, or changing a host |
| [pi/README.md](pi/README.md) | Pi extensions index, status, and install | Using the Pi extensions or adding one |
| [pi/AGENTS.md](pi/AGENTS.md) | Rules every Pi extension shares and the required project set | Working anywhere in `pi/` |
| [pi/CLAUDE.md](pi/CLAUDE.md) | Runtime import of the Pi guide | Checking agent entry points |
| [pi/CONTRIBUTING.md](pi/CONTRIBUTING.md) | Shared Pi toolchain facts, the root install, and how to move an extension in | Adding or moving in a Pi extension, or changing how extensions are installed |
| [pi/claude-interrupt/README.md](pi/claude-interrupt/README.md) | claude-interrupt purpose, install, limits, and compatibility | Using claude-interrupt |
| [pi/claude-interrupt/AGENTS.md](pi/claude-interrupt/AGENTS.md) | claude-interrupt rules, routes, and placement | Working anywhere in `pi/claude-interrupt/` |
| [pi/claude-interrupt/CLAUDE.md](pi/claude-interrupt/CLAUDE.md) | Runtime import of the claude-interrupt guide | Checking agent entry points |
| [pi/claude-interrupt/CONTRIBUTING.md](pi/claude-interrupt/CONTRIBUTING.md) | claude-interrupt setup, checks, validation sequence, and verification records | Making or verifying a claude-interrupt change |
| [pi/claude-interrupt/docs/architecture.md](pi/claude-interrupt/docs/architecture.md) | claude-interrupt modules, interrupt and marker flows, invariants, and limits | Changing claude-interrupt behavior or its Pi dependencies |
| [pi/claude-interrupt/docs/conventions.md](pi/claude-interrupt/docs/conventions.md) | claude-interrupt's TypeScript and Pi-extension rules | Writing or reviewing claude-interrupt code |
| [pi/claude-interrupt/docs/mission.md](pi/claude-interrupt/docs/mission.md) | claude-interrupt intent, goals, and non-goals | Choosing or changing what claude-interrupt does |
| [pi/claude-interrupt/docs/design.md](pi/claude-interrupt/docs/design.md) | The interrupt experience and the exact marker specification | Changing anything a claude-interrupt user sees |
| [pi/status-bar/README.md](pi/status-bar/README.md) | status-bar purpose, behavior, install, and limitations | Using status-bar |
| [pi/status-bar/AGENTS.md](pi/status-bar/AGENTS.md) | status-bar rules, routes, and placement | Working anywhere in `pi/status-bar/` |
| [pi/status-bar/CLAUDE.md](pi/status-bar/CLAUDE.md) | Runtime import of the status-bar guide | Checking agent entry points |
| [pi/status-bar/CONTRIBUTING.md](pi/status-bar/CONTRIBUTING.md) | status-bar toolchain, host prerequisite, checks, and validation sequence | Making or verifying a status-bar change |
| [pi/status-bar/docs/architecture.md](pi/status-bar/docs/architecture.md) | status-bar modules, flows, contracts, invariants, and limits | Changing status-bar behavior, state, I/O, or its Pi dependencies |
| [pi/status-bar/docs/conventions.md](pi/status-bar/docs/conventions.md) | status-bar's TypeScript and Pi-extension rules and adoption gaps | Writing or reviewing status-bar code |
| [pi/status-bar/docs/mission.md](pi/status-bar/docs/mission.md) | status-bar goals, non-goals, and constraints | Choosing or changing what status-bar does |
| [pi/status-bar/docs/design.md](pi/status-bar/docs/design.md) | The footer experience, its palette, motion, and UI states | Changing anything a status-bar user sees or a status-bar color |
| [docs/decisions/session-signals-collection.md](docs/decisions/session-signals-collection.md) | Why collection has one TUI owner and shared quota cache | Changing collector/display ownership or transport |
| [pi/signals-collector/README.md](pi/signals-collector/README.md) | Collector install, consumer guide and limits | Using the collector or changing its public surface |
| [pi/signals-collector/AGENTS.md](pi/signals-collector/AGENTS.md) | Collector rules, routes and placement | Working anywhere in pi/signals-collector |
| [pi/signals-collector/CLAUDE.md](pi/signals-collector/CLAUDE.md) | Runtime import of the collector guide | Checking agent entry points |
| [pi/signals-collector/CONTRIBUTING.md](pi/signals-collector/CONTRIBUTING.md) | Collector commands, fixtures and evidence | Making or verifying a collector change |
| [pi/signals-collector/docs/architecture.md](pi/signals-collector/docs/architecture.md) | Collector modules, state, I/O and context parity | Changing collection, contracts or dependencies |
| [pi/signals-collector/docs/conventions.md](pi/signals-collector/docs/conventions.md) | Collector engineering rules and gaps | Writing or reviewing collector code |
| [pi/signals-collector/docs/mission.md](pi/signals-collector/docs/mission.md) | Collector goals and non-goals | Choosing collector scope |
| [pi/signals-collector/docs/design.md](pi/signals-collector/docs/design.md) | Collector raw signals, tool and unknown states | Changing human-facing signals |
| [pi/signals-collector/docs/contract.md](pi/signals-collector/docs/contract.md) | Canonical v1 snapshot and shared quota cache | Changing a signal, cache or consumer |
| [pi/signals-collector/docs/decisions/agent-reported-active-workspace.md](pi/signals-collector/docs/decisions/agent-reported-active-workspace.md) | Why Active is explicit, agent-reported and display-only | Changing Active selection, persistence or cwd relationship |
