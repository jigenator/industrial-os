# Lesson Maker agent guide

Purpose: a terminal lesson editor whose lessons are schema-validated JSON files that agents write and people edit on top, with chat and pictures through the installed Pi. Follow the [root guide](../AGENTS.md) too.

## Boundaries

- Node 22 plain ESM and standard library; no dependencies or other-project imports except exported `@industrial-os/design-system` subpaths. Root install resolves that package. Pi is loaded at run time from the installed Pi, only in `src/pi.mjs`; this project never depends on or installs it.
- [`schema/lesson.schema.json`](schema/lesson.schema.json) is the lesson contract. Change it with `src/schema.mjs` (which refuses keywords it does not check), the file mapping in `src/lesson.mjs`, the example and the tests together. Never write a lesson that fails validation, and never write a file that opened read-only.
- Only `src/lesson.mjs` writes files: the lesson (atomically), attached pictures copied into its picture folder, its history folder beside it (`<name>.lesson.history/`: a copy of the saved lesson before each AI request that can change it, never overwritten, and `chat.jsonl`, appended finished chat entries), and the app's settings (model and effort) in `~/.config/lesson-maker/settings.json`; Pi's imagegen writes generated pictures (with its own metadata JSON) into that folder. Nothing deletes files. No history is written for a lesson opened read-only; a request whose copy cannot be written does not run. Restored chat is display only, never sent to a model. Model calls, and the Jev aim check through pi-typesafe's tool, go only through the Pi bridge, except reading aloud: Pi has no speech models, so `src/speech.mjs` alone calls Google's speech endpoint (with the key Pi's `getAuth('google')` gives), runs `afplay`, and writes its audio to a private temporary folder it removes; tests use the fake bridge in `test/fake-ai.mjs`, never live Pi. AI requests may read, never write: Pi's read-only tools (`read`, `ls`, `find`, `grep`, rooted at the lesson's project), `src/documents.mjs` (`read_document` for local files and Tatsu artifacts, `list_artifacts`) and, for whole-slide and whole-lesson requests, `picture_prompt` (a saved picture prompt, which the lesson JSON given to models leaves out). Artifacts come only through the `tatsu` CLI, downloaded into a private temporary folder that `documents.mjs` removes; no network calls of its own. Give requests no write, edit or shell tools. Its lesson changes go through `src/edits.mjs` and the schema, never straight into state.
- Keep model, scheduling, geometry, line rendering, input dispatch, PNG and Kitty contracts separate from the terminal host.
- Preserve linked-title/name symmetry and first-in-group invariant; linked Type/layout remain editable. Box requests lock only their box; a whole-lesson request locks everything while it waits and until its first `claim_slides`, then only the slides and groups it claimed, and its tools refuse changes outside the claim; whole-lesson requests run one at a time; review cancels rather than pauses. Never hide chat; Types, layouts and placements are always laid out as visible options, never a dropdown (short windows reach them by scrolling the form). The slide preview is not interactive; editing happens only in the form boxes, which keep fixed places for every schema field, and saves on leaving a box.
- Chrome comes from design-system elements. Authorized composition gaps live in [conventions](docs/conventions.md#adoption-gaps); do not create local reusable visual primitives.
- Every click target must keep a keyboard path; render returns targets beside cells and the controller maps clicks onto key actions.
- Do not claim native image, mouse-forwarding or accessibility verification from captured escape sequences or PTY input.

## Read for the task

| Task | Route |
| --- | --- |
| Run or use Lesson Maker, or change the lesson file | [README](README.md), [design](docs/design.md), [the schema](schema/lesson.schema.json) |
| Change behavior, data, hierarchy or lifecycle | [Architecture](docs/architecture.md), [conventions](docs/conventions.md) |
| Change anything visible, keyboard- or mouse-facing | [Design](docs/design.md), the imported elements' contracts in the root map |
| Make or verify any change | [Contributing](CONTRIBUTING.md), then repository-wide checks |

## Placement

`main.mjs` is the CLI (executable, so it can be linked onto `PATH` as `lesson`), `sample-image.mjs` the explicit binary-stdout generator; `schema/` holds the lesson schema, `examples/` the bundled example lesson and its pictures (the tests' fixture), `src/` the runtime modules and `test/` offline/isolated-PTY evidence. Docs describe only implemented behavior and explicitly unverified boundaries.
