# Agent guide

Purpose: build a curated, native-terminal-first design system. Product scope lives in [the mission](docs/mission.md).

## Critical engineering rules

- Keep polished elements here; leave experiments, source catalogs, recordings, and discovery reports outside the repository. See [mission](docs/mission.md).
- This is currently documentation-only. Do not invent an installed framework, working command, released API, or completed runtime test. See [architecture](docs/architecture.md).
- Keep displayed values truthful, render within the supplied cell budget, and preserve input/focus behavior. Color and animation cannot be the only carriers of meaning. See [design](docs/design.md).
- Do not copy third-party assets or code without checking rights and retaining required notices. Do not publish private paths, data, credentials, or internal artifact links. See [conventions](docs/conventions.md).

## Read for the task

Scan the supporting-document map and read every document whose condition applies before changing that area. Follow relevant sections and any scoped instructions; do not load unrelated manuals.

| Task | Route |
| --- | --- |
| Add or refine an element | Design, architecture, conventions, then contributing |
| Change a public contract or dependency | Architecture, conventions, then contributing |
| Change product scope or the default visual language | Mission and design |
| Change guidance or validation | The relevant canonical guide, this map, then contributing |

## Where work belongs

Canonical rules belong in the guides below. Element folders are proposed, not yet created; use the placement rules in architecture when the first element is approved. Do not create empty packages or speculative adapters.

## Implement and verify

Trace existing callers before changing shared behavior. Follow the engineering conventions rather than reproducing a conflicting pattern. Use the validation sequence in contributing and report passed, failed, skipped, and not-run checks separately.

## Supporting documents

Keep one direct link, purpose, and concrete reading condition for every supporting guidance document, including future element specifications, scoped instructions, and decisions. Add rows when documents are added.

| Document | Purpose | Read when |
| --- | --- | --- |
| [README.md](README.md) | User orientation and release status | Changing public usage or onboarding |
| [CLAUDE.md](CLAUDE.md) | Runtime import of this guide | Checking agent entry points |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup and validation | Making or verifying any change |
| [docs/mission.md](docs/mission.md) | Product scope and constraints | Choosing features or changing scope |
| [docs/conventions.md](docs/conventions.md) | Engineering rules | Writing or reviewing code and technical guidance |
| [docs/architecture.md](docs/architecture.md) | Placement, boundaries, and evolution | Adding elements or changing dependencies/contracts |
| [docs/design.md](docs/design.md) | Visual language, interactions, and acceptance | Changing anything human-facing |
