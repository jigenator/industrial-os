# Agent guide

Purpose: the monorepo for Pi and Herdr visualization, user experience, and tooling, built on one terminal-only visual language. Product scope is in [the mission](docs/mission.md).

This guide holds the rules for the whole repository. Each project is its own project with its own guides; follow the root guides and the project's guides together.

## Critical engineering rules

- No project imports another project's code, except that any project may import `@industrial-os/design-system` by package name through an exported subpath; never a relative path into `design-system/` or an unexported module. The outside-repository Lunalee consumer alone uses pinned root-package public paths under the [package decision](docs/decisions/in-repo-design-system-package.md#lunalee-pinned-public-git-consumption); this changes no in-repo imports. A Pi extension loads with the host's peer packages and, where used, that root-linked package. Pane naming alone additionally requires root-installed `pi-typesafe`, retained in its own manifest too; [the specific exception](docs/decisions/pane-naming-root-dependency.md) mandates peer suppression and permits no other root runtime dependency. Full rule: [conventions](docs/conventions.md#module-and-dependency-rules). Check: review imports; `design-system/package.test.mjs` checks the exports map; no automated cross-project check.
- The design system owns color values; until an extension migrates to the package, its color constants mirror the design system and must match it. Change the design system first, then each extension that still mirrors it. Full rule: [decision](docs/decisions/in-repo-design-system-package.md). Check: the rendering extensions, claude-interrupt, status-bar and droid-header, import their colors from the package; review that no hex value is copied into them, and compare any extension that has not migrated against `design-system/foundation/palette.mjs` and `signal-colors.mjs`; Lunalee surface colors live in `surface-palette.mjs`.
- Draw visual components with the design system: import its elements, and when one is missing or differs, add or extend it there first (an option whose default changes no other caller), then use it. A project keeps only layout, data and host seams. Full rule: [conventions](docs/conventions.md#design-system-components). Check: review; no automated check.
- Claim only what the stated checks support. Do not invent an installed package, released API, or Herdr check that has not run; keep automated, Pi-load, and interactive evidence separate. Full rule: [conventions](docs/conventions.md#tests).
- Do not publish private paths, data, credentials, or copied assets without rights and notices. Full rule: [conventions](docs/conventions.md#dependencies-and-generated-output).
- Keep each rule, command, and value in one canonical place and trace callers before changing shared behavior. Full rule: [conventions](docs/conventions.md#engineering-principles).

## Read for the task

Scan the supporting-documents map and read every document whose condition applies before changing that area. Follow the project's guide for its routes; do not load the other project's manuals.

| Task | Route |
| --- | --- |
| Work in the design system | [The design-system guide](design-system/AGENTS.md) and its routes |
| Work on a Pi extension | [The Pi guide](pi/AGENTS.md), then the extension's own guide, for example [claude-interrupt](pi/claude-interrupt/AGENTS.md), [signals-collector](pi/signals-collector/AGENTS.md), [status-bar](pi/status-bar/AGENTS.md) or [herdr-sidebar](pi/herdr-sidebar/AGENTS.md) |
| Work on the Pi theme | [The Pi guide](pi/AGENTS.md), then [the theme guide](pi/theme/AGENTS.md) |
| Work on pane naming, session recaps, image previews or the startup header | [The Pi guide](pi/AGENTS.md), then [herdr-pane-naming](pi/herdr-pane-naming/AGENTS.md), [session-recap](pi/session-recap/AGENTS.md), [image-preview](pi/image-preview/AGENTS.md) or [droid-header](pi/droid-header/AGENTS.md) |
| Work on a Herdr plugin | [Plugin group guide](herdr-plugins/AGENTS.md), then the plugin's guide, [Spaces](herdr-plugins/spaces/AGENTS.md), [Whiteboard](herdr-plugins/whiteboard/AGENTS.md), [Dispatch feed](herdr-plugins/dispatch-feed/AGENTS.md) or [Automations monitor](herdr-plugins/automations-monitor/AGENTS.md), and its routes |
| Work on the Herdr configuration | [The Herdr guide](herdr/AGENTS.md) and its routes |
| Change the visual language or a palette value | [Design](docs/design.md), [the package decision](docs/decisions/in-repo-design-system-package.md), the design-system guide, then each extension that mirrors the value |
| Import the design system from another project | [Conventions](docs/conventions.md#module-and-dependency-rules), [the package decision](docs/decisions/in-repo-design-system-package.md#migrating-an-extension), then the importing project's guide |
| Work on the local source engine | [Source-collector guide](source-collector/AGENTS.md), then its contract and contributing routes |
| Add or move in a project | [Architecture](docs/architecture.md#where-the-next-change-belongs), [contributing](CONTRIBUTING.md#adding-or-moving-in-a-project), then this map |
| Change a repository-wide rule or check | [Conventions](docs/conventions.md), this map, then [contributing](CONTRIBUTING.md) |

## Where work belongs

| Change | Start here | Boundary |
| --- | --- | --- |
| An element, motion, storybook story, or terminal host | `design-system/`; placement in [its architecture](design-system/docs/architecture.md#where-the-next-change-belongs), rules in [its conventions](design-system/docs/conventions.md) | Standard library only; imports no other project; elements and motions never own I/O; a new module gets an export entry |
| claude-interrupt behavior or marker | `pi/claude-interrupt/`; placement in [its architecture](pi/claude-interrupt/docs/architecture.md) | Pi peer packages and the design-system package only; never block streaming, input, or focus |
| status-bar footer, motion, or status integrations | `pi/status-bar/`; placement in [its architecture](pi/status-bar/docs/architecture.md) | Display-only snapshot consumer; no collection I/O; Pi/design-system exported subpaths only |
| Session signals, Active selection, or usage-source reads | `pi/signals-collector/`; placement in [its architecture](pi/signals-collector/docs/architecture.md) | TUI-only collector; events only to consumers, no extension imports |
| Herdr sidebar token values, reporting, `herdr:blocked` or `/flag` | `pi/herdr-sidebar/`; the [token contract](pi/herdr-sidebar/docs/token-contract.md), placement in [its architecture](pi/herdr-sidebar/docs/architecture.md) | Pi peer packages only; display-only apart from the `/flag` session reminder; reports only in TUI mode inside Herdr |
| Herdr pane naming | `pi/herdr-pane-naming/`; [architecture](pi/herdr-pane-naming/docs/architecture.md) | Main TUI-only; runs Herdr CLI pane get/rename on its own inherited pane, calls TypeSafe/Jev and a title model; no extension imports |
| Away or detailed session recaps | `pi/session-recap/`; [architecture](pi/session-recap/docs/architecture.md) | TUI-only; calls a recap model; output UI only, never saved or main-model history |
| Editor image previews | `pi/image-preview/`; [architecture](pi/image-preview/docs/architecture.md) | TUI-only; host peers only; reads the editor, never changes it or the submission; writes no files |
| The startup header, droid details or its manifest | `pi/droid-header/`; [design](pi/droid-header/docs/design.md), [architecture](pi/droid-header/docs/architecture.md) | TUI-only; host peers and design-system subpaths; reads `.git/HEAD` and Pi's settings through its public loaders, never running npm or Git; never installs or writes; never takes input |
| Colors of Pi's own interface | `pi/theme/`; [its architecture](pi/theme/docs/architecture.md) | One JSON theme; design-system values only, checked against the package and Pi's validator |
| A new Pi extension | `pi/<name>/` with the [project document set](docs/architecture.md#contracts-between-the-root-and-a-project) | Its own manifest, checks, and license; the design system only by package name |
| Scheduled sources, shared task snapshots or local triage | `source-collector/`; [architecture](source-collector/docs/architecture.md), [contract](source-collector/docs/contract.md) | Bun + Effect; private configs, one local owner, polling Unix RPC; no project imports |
| Shared experience or scope | `docs/design.md`, `docs/mission.md` | Then each project separately |
| Spaces reporting, activity history or quiet sorting | `herdr-plugins/spaces/`; [Spaces contract](herdr-plugins/spaces/docs/token-contract.md) | Node 22 stdlib only; one detached daemon per socket; tests never touch live Herdr |
| Dispatch feed dashboard, source triage or pane lifecycle | `herdr-plugins/dispatch-feed/`; [architecture](herdr-plugins/dispatch-feed/docs/architecture.md), [design](herdr-plugins/dispatch-feed/docs/design.md) | Bun + TypeScript; source-collector JSON-RPC only, no source imports; design-system exported subpaths |
| Whiteboard input, drawing or board storage | `herdr-plugins/whiteboard/`; placement in [its architecture](herdr-plugins/whiteboard/docs/architecture.md) | Rust with locked crates; colors only in `src/palette.rs`, checked against the design system; tests never touch live Herdr |
| Automations monitor screens, Tatsu reads or terminal lifecycle | `herdr-plugins/automations-monitor/`; the [data contract](herdr-plugins/automations-monitor/docs/architecture.md#data-contract), placement in [its AGENTS](herdr-plugins/automations-monitor/AGENTS.md#placement) | Bun, TypeScript and Effect with a locked install; reads only the two `tatsu automations … --json` commands; a startup hook restarts it in panes Herdr restores; design-system colors by exported subpath; tests never touch live Herdr or the real `tatsu` |
| Herdr configuration, such as the agents-sidebar rows | `herdr/`; placement in [its architecture](herdr/docs/architecture.md) | Valid Herdr TOML merged by hand; design-system colors; tokens from the owning reporter's contract |

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
| [docs/decisions/in-repo-design-system-package.md](docs/decisions/in-repo-design-system-package.md) | Why the design system owns colors, in-repo package imports, the pinned Lunalee exception and migration requirements | Changing a color, importing the design system (including Lunalee), changing the root `package.json`, or migrating an extension |
| [design-system/README.md](design-system/README.md) | Design-system orientation, run commands, package name, and status | Using the design system or changing its onboarding |
| [design-system/AGENTS.md](design-system/AGENTS.md) | Design-system rules, task routes, and placement | Working anywhere in `design-system/` |
| [design-system/CLAUDE.md](design-system/CLAUDE.md) | Runtime import of the design-system guide | Checking agent entry points |
| [design-system/CONTRIBUTING.md](design-system/CONTRIBUTING.md) | Design-system setup, commands, validation including the package test, and verification records | Making or verifying a design-system change |
| [design-system/docs/architecture.md](design-system/docs/architecture.md) | Design-system modules, package exports, boundaries, and evolution | Adding elements or motions, or changing design-system dependencies, exports, or contracts |
| [design-system/docs/conventions.md](design-system/docs/conventions.md) | Design-system stack, package exports, text contract, palette source, and performance rules | Writing or reviewing design-system code |
| [design-system/docs/design.md](design-system/docs/design.md) | The design system's element set, reference and signal colors, motions with their rates, and storybook | Changing anything human-facing in the design system |
| [design-system/foundation/README.md](design-system/foundation/README.md) | Line model, measured slots/glyphs, palettes, surface compositing, seeded randomness and color output | Changing shared rendering, text handling, glyphs, or colors |
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
| [design-system/elements/line-meter/README.md](design-system/elements/line-meter/README.md) | Line meter contract: compact used-percent bar, zones, idle and unknown | Using or changing line meters |
| [design-system/elements/column-block/README.md](design-system/elements/column-block/README.md) | Column block contract: gutter, value, marks, right slot, and stacking | Using or changing column blocks |
| [design-system/elements/tab-rule/README.md](design-system/elements/tab-rule/README.md) | tab-rule chrome contract and checks | Using or changing tab-rule |
| [design-system/elements/action-label/README.md](design-system/elements/action-label/README.md) | action-label chrome contract and checks | Using or changing action-label |
| [design-system/elements/popup-header/README.md](design-system/elements/popup-header/README.md) | popup-header chrome contract and checks | Using or changing popup-header |
| [design-system/elements/notice-row/README.md](design-system/elements/notice-row/README.md) | notice-row chrome contract and checks | Using or changing notice-row |
| [design-system/elements/scope-meter/README.md](design-system/elements/scope-meter/README.md) | scope-meter chrome contract and checks | Using or changing scope-meter |
| [design-system/elements/sounding-meter/README.md](design-system/elements/sounding-meter/README.md) | sounding-meter chrome contract and checks | Using or changing sounding-meter |
| [design-system/elements/feed-bezel/README.md](design-system/elements/feed-bezel/README.md) | feed-bezel chrome contract and checks | Using or changing feed-bezel |
| [design-system/elements/input-frame/README.md](design-system/elements/input-frame/README.md) | input-frame chrome contract and checks | Using or changing input-frame |
| [design-system/elements/callout/README.md](design-system/elements/callout/README.md) | callout content family contract and checks | Using or changing callout |
| [design-system/elements/document-block/README.md](design-system/elements/document-block/README.md) | document-block content family contract and checks | Using or changing document-block |
| [design-system/elements/sheet-card/README.md](design-system/elements/sheet-card/README.md) | sheet-card content family contract and checks | Using or changing sheet-card |
| [design-system/elements/desk-tray/README.md](design-system/elements/desk-tray/README.md) | desk-tray content family contract and checks | Using or changing desk-tray |
| [design-system/elements/operation-row/README.md](design-system/elements/operation-row/README.md) | operation-row content family contract and checks | Using or changing operation-row |
| [design-system/elements/section-head/README.md](design-system/elements/section-head/README.md) | Section head contract: mark, title, count and rule | Using or changing section heads |
| [design-system/elements/board-marks/README.md](design-system/elements/board-marks/README.md) | Board marks contract: run outcomes, schedule marks, state cells, pointer and spine | Using or changing board marks |
| [design-system/elements/time-lane/README.md](design-system/elements/time-lane/README.md) | Time lane contract: scale, axis, track, runs, NOW and line composition | Using or changing time lanes |
| [design-system/elements/readout/README.md](design-system/elements/readout/README.md) | Readout contract: tall-numeral block, one-line form, slot strip, split bar and phase steps | Using or changing readouts |
| [design-system/elements/event-row/README.md](design-system/elements/event-row/README.md) | Event row contract: log and detail forms | Using or changing event rows |
| [design-system/elements/scroll-rail/README.md](design-system/elements/scroll-rail/README.md) | Scroll rail contract: track, thumb and nothing-to-scroll | Using or changing scroll rails |
| [design-system/elements/crate-banner/README.md](design-system/elements/crate-banner/README.md) | Crate banner contract | Using or changing crate-banner |
| [design-system/elements/unit-plate/README.md](design-system/elements/unit-plate/README.md) | Unit plate contract: maker, pixel wordmark, serial, title block, barcode and peak | Using or changing the unit plate |
| [design-system/motions/README.md](design-system/motions/README.md) | Every motion's contract, parameters, rates, presets, state-cell opt-in, motion-off, host timing, and extension rules, including the CRT boot | Using, adding, or changing a motion |
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
| [docs/decisions/session-signals-collection.md](docs/decisions/session-signals-collection.md) | Why collection has one TUI owner; its quota cache part is superseded | Changing collector/display ownership or transport |
| [docs/decisions/usage-via-source-collector.md](docs/decisions/usage-via-source-collector.md) | Why provider usage is configured source-collector sources read through a Pi setting | Changing usage collection, its configuration or the usage item convention |
| [pi/signals-collector/README.md](pi/signals-collector/README.md) | Collector install, consumer guide and limits | Using the collector or changing its public surface |
| [pi/signals-collector/AGENTS.md](pi/signals-collector/AGENTS.md) | Collector rules, routes and placement | Working anywhere in pi/signals-collector |
| [pi/signals-collector/CLAUDE.md](pi/signals-collector/CLAUDE.md) | Runtime import of the collector guide | Checking agent entry points |
| [pi/signals-collector/CONTRIBUTING.md](pi/signals-collector/CONTRIBUTING.md) | Collector commands, fixtures and evidence | Making or verifying a collector change |
| [pi/signals-collector/docs/architecture.md](pi/signals-collector/docs/architecture.md) | Collector modules, state, I/O and context parity | Changing collection, contracts or dependencies |
| [pi/signals-collector/docs/conventions.md](pi/signals-collector/docs/conventions.md) | Collector engineering rules and gaps | Writing or reviewing collector code |
| [pi/signals-collector/docs/mission.md](pi/signals-collector/docs/mission.md) | Collector goals and non-goals | Choosing collector scope |
| [pi/signals-collector/docs/design.md](pi/signals-collector/docs/design.md) | Collector raw signals, tool and unknown states | Changing human-facing signals |
| [pi/signals-collector/docs/contract.md](pi/signals-collector/docs/contract.md) | Canonical v1 snapshot, usage source convention and shared PR cache | Changing a signal, cache or consumer |
| [pi/signals-collector/docs/decisions/agent-reported-active-workspace.md](pi/signals-collector/docs/decisions/agent-reported-active-workspace.md) | Why Active is explicit, agent-reported and display-only | Changing Active selection, persistence or cwd relationship |
| [pi/herdr-sidebar/README.md](pi/herdr-sidebar/README.md) | herdr-sidebar purpose, rows, install, and limitations | Using herdr-sidebar |
| [pi/herdr-sidebar/AGENTS.md](pi/herdr-sidebar/AGENTS.md) | herdr-sidebar rules, routes, and placement | Working anywhere in `pi/herdr-sidebar/` |
| [pi/herdr-sidebar/CLAUDE.md](pi/herdr-sidebar/CLAUDE.md) | Runtime import of the herdr-sidebar guide | Checking agent entry points |
| [pi/herdr-sidebar/CONTRIBUTING.md](pi/herdr-sidebar/CONTRIBUTING.md) | herdr-sidebar toolchain, checks, validation sequence, and verification records | Making or verifying a herdr-sidebar change |
| [pi/herdr-sidebar/docs/token-contract.md](pi/herdr-sidebar/docs/token-contract.md) | The canonical Herdr sidebar token contract: keys, geometry, and rules | Changing a sidebar token, row, or width, in either herdr-sidebar or `herdr/` |
| [pi/herdr-sidebar/docs/architecture.md](pi/herdr-sidebar/docs/architecture.md) | herdr-sidebar modules, inputs, Herdr reporting, invariants, and limits | Changing herdr-sidebar behavior, lifecycle, I/O, or its Pi or Herdr dependencies |
| [pi/herdr-sidebar/docs/conventions.md](pi/herdr-sidebar/docs/conventions.md) | herdr-sidebar's TypeScript and Pi-extension rules and adoption gaps | Writing or reviewing herdr-sidebar code |
| [pi/herdr-sidebar/docs/mission.md](pi/herdr-sidebar/docs/mission.md) | herdr-sidebar goals, non-goals, and constraints | Choosing or changing what herdr-sidebar does |
| [pi/herdr-sidebar/docs/design.md](pi/herdr-sidebar/docs/design.md) | What each sidebar value and state means, truthfulness, and timing | Changing anything a herdr-sidebar user sees |
| [pi/herdr-pane-naming/README.md](pi/herdr-pane-naming/README.md) | herdr-pane-naming purpose, status, install, commands and privacy/limits | Using herdr-pane-naming or changing its public surface |
| [pi/herdr-pane-naming/AGENTS.md](pi/herdr-pane-naming/AGENTS.md) | herdr-pane-naming rules, routes and placement | Working anywhere in pi/herdr-pane-naming |
| [pi/herdr-pane-naming/CLAUDE.md](pi/herdr-pane-naming/CLAUDE.md) | Runtime import of the herdr-pane-naming guide | Checking agent entry points |
| [pi/herdr-pane-naming/CONTRIBUTING.md](pi/herdr-pane-naming/CONTRIBUTING.md) | herdr-pane-naming toolchain, exact checks and verification records | Making or verifying a herdr-pane-naming change |
| [pi/herdr-pane-naming/docs/architecture.md](pi/herdr-pane-naming/docs/architecture.md) | herdr-pane-naming modules, flows, dependencies and invariants | Changing behavior, lifecycle, persistence or I/O |
| [pi/herdr-pane-naming/docs/conventions.md](pi/herdr-pane-naming/docs/conventions.md) | herdr-pane-naming engineering rules and adoption gaps | Writing or reviewing code |
| [pi/herdr-pane-naming/docs/design.md](pi/herdr-pane-naming/docs/design.md) | herdr-pane-naming presentation, interaction and states | Changing anything human-facing |
| [pi/herdr-pane-naming/docs/mission.md](pi/herdr-pane-naming/docs/mission.md) | herdr-pane-naming goals, non-goals and constraints | Choosing or changing scope |
| [pi/session-recap/README.md](pi/session-recap/README.md) | session-recap purpose, status, install, commands and privacy/limits | Using session-recap or changing its public surface |
| [pi/session-recap/AGENTS.md](pi/session-recap/AGENTS.md) | session-recap rules, routes and placement | Working anywhere in pi/session-recap |
| [pi/session-recap/CLAUDE.md](pi/session-recap/CLAUDE.md) | Runtime import of the session-recap guide | Checking agent entry points |
| [pi/session-recap/CONTRIBUTING.md](pi/session-recap/CONTRIBUTING.md) | session-recap toolchain, exact checks and verification records | Making or verifying a session-recap change |
| [pi/session-recap/docs/architecture.md](pi/session-recap/docs/architecture.md) | session-recap modules, flows, dependencies and invariants | Changing behavior, lifecycle, persistence or I/O |
| [pi/session-recap/docs/conventions.md](pi/session-recap/docs/conventions.md) | session-recap engineering rules and adoption gaps | Writing or reviewing code |
| [pi/session-recap/docs/design.md](pi/session-recap/docs/design.md) | session-recap presentation, interaction and states | Changing anything human-facing |
| [pi/session-recap/docs/mission.md](pi/session-recap/docs/mission.md) | session-recap goals, non-goals and constraints | Choosing or changing scope |
| [pi/image-preview/README.md](pi/image-preview/README.md) | image-preview purpose, status, install, behavior and limits | Using image-preview or changing its public surface |
| [pi/image-preview/AGENTS.md](pi/image-preview/AGENTS.md) | image-preview rules, routes and placement | Working anywhere in pi/image-preview |
| [pi/image-preview/CLAUDE.md](pi/image-preview/CLAUDE.md) | Runtime import of the image-preview guide | Checking agent entry points |
| [pi/image-preview/CONTRIBUTING.md](pi/image-preview/CONTRIBUTING.md) | image-preview toolchain, exact checks and verification records | Making or verifying an image-preview change |
| [pi/image-preview/docs/architecture.md](pi/image-preview/docs/architecture.md) | image-preview modules, flow, state, host seams and invariants | Changing behavior, lifecycle or host dependencies |
| [pi/image-preview/docs/conventions.md](pi/image-preview/docs/conventions.md) | image-preview engineering rules and adoption gaps | Writing or reviewing code |
| [pi/image-preview/docs/design.md](pi/image-preview/docs/design.md) | image-preview preview layout, states and colors | Changing anything human-facing |
| [pi/image-preview/docs/mission.md](pi/image-preview/docs/mission.md) | image-preview goals, non-goals and constraints | Choosing or changing scope |
| [pi/droid-header/README.md](pi/droid-header/README.md) | droid-header purpose, status, install, `quietStartup`, values and limits | Using droid-header or changing its public surface |
| [pi/droid-header/AGENTS.md](pi/droid-header/AGENTS.md) | droid-header rules, routes and placement | Working anywhere in pi/droid-header |
| [pi/droid-header/CLAUDE.md](pi/droid-header/CLAUDE.md) | Runtime import of the droid-header guide | Checking agent entry points |
| [pi/droid-header/CONTRIBUTING.md](pi/droid-header/CONTRIBUTING.md) | droid-header toolchain, exact checks and verification records | Making or verifying a droid-header change |
| [pi/droid-header/docs/architecture.md](pi/droid-header/docs/architecture.md) | droid-header modules, flow, state, host seams and invariants | Changing behavior, lifecycle, I/O or host dependencies |
| [pi/droid-header/docs/conventions.md](pi/droid-header/docs/conventions.md) | droid-header engineering rules and adoption gaps | Writing or reviewing code |
| [pi/droid-header/docs/design.md](pi/droid-header/docs/design.md) | droid-header layouts, values, states, intro rates, colors, the approved reference and its deviations | Changing anything human-facing |
| [pi/droid-header/docs/mission.md](pi/droid-header/docs/mission.md) | droid-header goals, non-goals and constraints | Choosing or changing scope |
| [pi/theme/README.md](pi/theme/README.md) | The Pi theme's purpose, install and limits | Using the Pi theme or changing its public usage |
| [pi/theme/AGENTS.md](pi/theme/AGENTS.md) | Pi theme rules, routes and placement | Working anywhere in pi/theme |
| [pi/theme/CLAUDE.md](pi/theme/CLAUDE.md) | Runtime import of the Pi theme guide | Checking agent entry points |
| [pi/theme/CONTRIBUTING.md](pi/theme/CONTRIBUTING.md) | Pi theme commands, checks and verification records | Making or verifying a Pi theme change |
| [pi/theme/docs/architecture.md](pi/theme/docs/architecture.md) | Pi theme files, host seams and invariants | Changing the theme's check, packaging or Pi version |
| [pi/theme/docs/conventions.md](pi/theme/docs/conventions.md) | Pi theme engineering rules and gaps | Writing or reviewing the theme or its check |
| [pi/theme/docs/design.md](pi/theme/docs/design.md) | What each part of Pi gets, and contrast | Changing a Pi theme color |
| [docs/decisions/pane-naming-root-dependency.md](docs/decisions/pane-naming-root-dependency.md) | Why pane naming needs root-installed pi-typesafe and peer suppression | Changing root dependencies, npm peer handling or pane-naming packaging |
| [herdr/README.md](herdr/README.md) | Herdr configuration purpose, status, how to merge it, and limitations | Using the Herdr configuration |
| [herdr/AGENTS.md](herdr/AGENTS.md) | Herdr configuration rules, routes, and placement | Working anywhere in `herdr/` |
| [herdr/CLAUDE.md](herdr/CLAUDE.md) | Runtime import of the Herdr guide | Checking agent entry points |
| [herdr/CONTRIBUTING.md](herdr/CONTRIBUTING.md) | Herdr configuration checks, validation sequence, and verification records | Making or verifying a Herdr configuration change |
| [herdr/docs/architecture.md](herdr/docs/architecture.md) | Herdr configuration files, dependencies, invariants, and where the next file goes | Adding a Herdr configuration file or changing what it depends on |
| [herdr/docs/conventions.md](herdr/docs/conventions.md) | Rules for Herdr configuration files and their checks | Writing or reviewing Herdr configuration |
| [herdr/docs/design.md](herdr/docs/design.md) | Agents layout B and Spaces rows, width, colors, and states; the chrome theme | Changing anything a user sees in the Herdr sidebar or Herdr's chrome colors |
| [herdr-plugins/README.md](herdr-plugins/README.md) | Plugin index and operator install procedure | Using or adding a Herdr plugin |
| [herdr-plugins/AGENTS.md](herdr-plugins/AGENTS.md) | Shared plugin rules and detach/lock boundaries | Working anywhere in herdr-plugins |
| [herdr-plugins/CLAUDE.md](herdr-plugins/CLAUDE.md) | Runtime import of the group guide | Checking agent entry points |
| [herdr-plugins/spaces/README.md](herdr-plugins/spaces/README.md) | Spaces setup, privacy, operations and limits | Using Spaces or changing its public surface |
| [herdr-plugins/spaces/AGENTS.md](herdr-plugins/spaces/AGENTS.md) | Spaces task routes and critical invariants | Working anywhere in herdr-plugins/spaces |
| [herdr-plugins/spaces/CLAUDE.md](herdr-plugins/spaces/CLAUDE.md) | Runtime import of the Spaces guide | Checking agent entry points |
| [herdr-plugins/spaces/CONTRIBUTING.md](herdr-plugins/spaces/CONTRIBUTING.md) | Spaces validation sequence and evidence | Making or verifying a Spaces change |
| [herdr-plugins/spaces/docs/architecture.md](herdr-plugins/spaces/docs/architecture.md) | Daemon modules, protocol, history, locks and sorting | Changing Spaces behavior, lifecycle or persistence |
| [herdr-plugins/spaces/docs/conventions.md](herdr-plugins/spaces/docs/conventions.md) | Spaces engineering rules and gaps | Writing or reviewing Spaces code |
| [herdr-plugins/spaces/docs/design.md](herdr-plugins/spaces/docs/design.md) | Spaces geometry, truthfulness and quiet behavior | Changing anything a Spaces user sees |
| [herdr-plugins/spaces/docs/mission.md](herdr-plugins/spaces/docs/mission.md) | Spaces goals and non-goals | Choosing Spaces scope |
| [herdr-plugins/spaces/docs/token-contract.md](herdr-plugins/spaces/docs/token-contract.md) | Canonical Spaces key list, values, width and TTL | Changing Spaces values or Herdr rows |
| [docs/decisions/spaces-plugin-daemon.md](docs/decisions/spaces-plugin-daemon.md) | Why Spaces has one socket-keyed plugin daemon | Changing plugin ownership or daemon design |
| [docs/decisions/herdr-plugin-runtimes.md](docs/decisions/herdr-plugin-runtimes.md) | Why a Herdr plugin may use a runtime other than Node, and what that requires | Adding a plugin in another language or changing a plugin's build |
| [herdr-plugins/whiteboard/README.md](herdr-plugins/whiteboard/README.md) | Whiteboard install, opening, controls, storage and limits | Using the whiteboard or changing its public surface |
| [herdr-plugins/whiteboard/AGENTS.md](herdr-plugins/whiteboard/AGENTS.md) | Whiteboard rules, routes and placement | Working anywhere in herdr-plugins/whiteboard |
| [herdr-plugins/whiteboard/CLAUDE.md](herdr-plugins/whiteboard/CLAUDE.md) | Runtime import of the whiteboard guide | Checking agent entry points |
| [herdr-plugins/whiteboard/CONTRIBUTING.md](herdr-plugins/whiteboard/CONTRIBUTING.md) | Whiteboard toolchain, validation sequence, isolated Herdr check and evidence | Making or verifying a whiteboard change |
| [herdr-plugins/whiteboard/docs/architecture.md](herdr-plugins/whiteboard/docs/architecture.md) | Whiteboard modules, Herdr entrypoints, board paths, saving and invariants | Changing whiteboard behavior, storage or dependencies |
| [herdr-plugins/whiteboard/docs/conventions.md](herdr-plugins/whiteboard/docs/conventions.md) | Whiteboard Rust rules and gaps | Writing or reviewing whiteboard code |
| [herdr-plugins/whiteboard/docs/design.md](herdr-plugins/whiteboard/docs/design.md) | Whiteboard layout, colors, states and interaction | Changing anything a whiteboard user sees |
| [herdr-plugins/whiteboard/docs/mission.md](herdr-plugins/whiteboard/docs/mission.md) | Whiteboard goals and non-goals | Choosing whiteboard scope |
| [docs/decisions/source-collector-service.md](docs/decisions/source-collector-service.md) | Why one generic local polling engine, separate from session signals | Changing source ownership, transport or private-config boundaries |
| [docs/decisions/bun-effect-runtime.md](docs/decisions/bun-effect-runtime.md) | Source collector's runtime exception and exact pinning policy | Changing its runtime, dependencies or toolchain |
| [source-collector/README.md](source-collector/README.md) | Purpose, run, service limits, privacy and deletion | Using the source engine or changing its public surface |
| [source-collector/AGENTS.md](source-collector/AGENTS.md) | Source engine critical rules, routes and placement | Working anywhere in source-collector |
| [source-collector/CLAUDE.md](source-collector/CLAUDE.md) | Runtime import of the source-collector guide | Checking agent entry points |
| [source-collector/CONTRIBUTING.md](source-collector/CONTRIBUTING.md) | Exact checks, fixtures and isolated foreground smoke evidence | Making or verifying a source-collector change |
| [source-collector/docs/architecture.md](source-collector/docs/architecture.md) | Modules, lifecycle, storage, failure boundaries and evolution | Changing scheduling, runners, persistence, I/O or service ownership |
| [source-collector/docs/conventions.md](source-collector/docs/conventions.md) | Bun/Effect engineering rules and known limits | Writing or reviewing source-collector code |
| [source-collector/docs/design.md](source-collector/docs/design.md) | Truthful source states, counts, ages and week attribution | Changing snapshot meanings or human-facing diagnostics |
| [source-collector/docs/mission.md](source-collector/docs/mission.md) | Source engine goals and non-goals | Choosing source-collector scope |
| [source-collector/docs/contract.md](source-collector/docs/contract.md) | Canonical config, SourceOutput, Snapshot and RPC semantics | Changing a source, signal, action or client |
| [herdr-plugins/automations-monitor/README.md](herdr-plugins/automations-monitor/README.md) | Automations monitor purpose, requirements, install, keys, privacy and limits | Using the automations monitor or changing its public surface |
| [herdr-plugins/automations-monitor/AGENTS.md](herdr-plugins/automations-monitor/AGENTS.md) | Automations monitor rules, routes and placement | Working anywhere in herdr-plugins/automations-monitor |
| [herdr-plugins/automations-monitor/CLAUDE.md](herdr-plugins/automations-monitor/CLAUDE.md) | Runtime import of the automations monitor guide | Checking agent entry points |
| [herdr-plugins/automations-monitor/CONTRIBUTING.md](herdr-plugins/automations-monitor/CONTRIBUTING.md) | Automations monitor toolchain, validation sequence, PTY, frame and isolated Herdr checks, and evidence | Making or verifying an automations monitor change |
| [herdr-plugins/automations-monitor/docs/architecture.md](herdr-plugins/automations-monitor/docs/architecture.md) | Automations monitor modules, flows, the Tatsu data contract and invariants | Changing reads, polling, the terminal lifecycle or dependencies |
| [herdr-plugins/automations-monitor/docs/conventions.md](herdr-plugins/automations-monitor/docs/conventions.md) | Automations monitor TypeScript and Effect rules and gaps | Writing or reviewing automations monitor code |
| [herdr-plugins/automations-monitor/docs/design.md](herdr-plugins/automations-monitor/docs/design.md) | Automations monitor layout, states, colors, keys, truthfulness and mockup deviations | Changing anything an automations monitor user sees |
| [herdr-plugins/automations-monitor/docs/mission.md](herdr-plugins/automations-monitor/docs/mission.md) | Automations monitor goals and non-goals | Choosing automations monitor scope |
| [docs/decisions/automations-monitor-stack.md](docs/decisions/automations-monitor-stack.md) | Why the automations monitor runs on Bun, TypeScript 7 and Effect, and supersedes the pipeline-floor branch | Changing the automations monitor's runtime, dependencies or build |
| [design-system/elements/type-unit/README.md](design-system/elements/type-unit/README.md) | Type Unit contract | Using or changing type-unit |
| [design-system/elements/activity-strip/README.md](design-system/elements/activity-strip/README.md) | Activity Strip contract | Using or changing activity-strip |
| [design-system/elements/plan-counter/README.md](design-system/elements/plan-counter/README.md) | Plan Counter contract | Using or changing plan-counter |
| [design-system/elements/activity-trace/README.md](design-system/elements/activity-trace/README.md) | Activity Trace contract | Using or changing activity-trace |
| [design-system/elements/alert-ticker/README.md](design-system/elements/alert-ticker/README.md) | Alert Ticker contract | Using or changing alert-ticker |
| [design-system/elements/ambient-field/README.md](design-system/elements/ambient-field/README.md) | Ambient Field contract | Using or changing ambient-field |
| [herdr-plugins/dispatch-feed/README.md](herdr-plugins/dispatch-feed/README.md) | Purpose, setup, keys, privacy and limits | Using dispatch-feed or changing its public surface |
| [herdr-plugins/dispatch-feed/AGENTS.md](herdr-plugins/dispatch-feed/AGENTS.md) | Critical rules and task routes | Working anywhere in dispatch-feed |
| [herdr-plugins/dispatch-feed/CLAUDE.md](herdr-plugins/dispatch-feed/CLAUDE.md) | Runtime guide import | Checking entry points |
| [herdr-plugins/dispatch-feed/CONTRIBUTING.md](herdr-plugins/dispatch-feed/CONTRIBUTING.md) | Commands, isolation procedure and evidence | Making or verifying a dispatch-feed change |
| [herdr-plugins/dispatch-feed/docs/architecture.md](herdr-plugins/dispatch-feed/docs/architecture.md) | Wire, state, rendering and lifecycle boundaries | Changing protocol consumption or lifecycle |
| [herdr-plugins/dispatch-feed/docs/conventions.md](herdr-plugins/dispatch-feed/docs/conventions.md) | Bun/TypeScript and testing rules | Writing or reviewing dispatch-feed code |
| [herdr-plugins/dispatch-feed/docs/design.md](herdr-plugins/dispatch-feed/docs/design.md) | Dashboard geometry, states, motion exception and focus | Changing anything a dispatch-feed user sees |
| [herdr-plugins/dispatch-feed/docs/mission.md](herdr-plugins/dispatch-feed/docs/mission.md) | Goals and non-goals | Choosing dispatch-feed scope |
| [docs/decisions/dispatch-feed-runtime.md](docs/decisions/dispatch-feed-runtime.md) | Why the pane uses Bun and plain TypeScript, without Effect | Changing the pane runtime or packaging |
