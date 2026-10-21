# Contributing

Follow the [repository workflow](../../CONTRIBUTING.md) and [project guide](AGENTS.md).

## Toolchain and setup

Node.js 22.19+ runs the check with the standard test runner; there is no TypeScript, build, formatter or linter, and no development dependency. The check imports the design system by package name, so run the root `npm install` once ([setup](../../CONTRIBUTING.md#setup)). It also needs an installed Pi, found the way [status-bar](../status-bar/CONTRIBUTING.md) finds it; a missing host is a failed prerequisite, not a pass.

## Full validation sequence

Run from `pi/theme/`:

```sh
export PI_HOST_ROOT="$(npm root -g)/@earendil-works/pi-coding-agent"
test -f "$PI_HOST_ROOT/dist/index.js"
npm test
```

`npm test` runs `test/theme.test.mjs`: Pi's validator accepts the file and Pi's loader builds it as the dark `industrial-os` theme; every variable is the design-system color it is named after; every token names a variable and every variable is used; the editor border is bone at all seven thinking levels and acid in bash mode; acid is limited to its six highlight tokens; and error, removed lines, warning, text and the export page keep their roles.

Pi's RPC mode does not load themes: a deliberately invalid theme passed to `pi --mode rpc --theme` exits 0 without a message. So the installed-Pi check is interactive. From an empty temporary directory, with a temporary agent directory whose `settings.json` sets `"theme": "industrial-os"` and lists the checkout as a package with `"extensions": []`, `"skills": []` and `"prompts": []`, start `PI_CODING_AGENT_DIR=<temp agent dir> pi --no-session` in a terminal. It passes when Pi starts without a theme warning and draws the editor border in bone, `38;2;226;220;203` in the terminal's output (in Herdr, `herdr pane read <pane> --ansi`). Bone exists only in this theme, so it shows that Pi loaded it from the root manifest rather than falling back.

Finish with the [repository-wide checks](../../CONTRIBUTING.md#repository-wide-checks).

## Review and documentation

On a Pi upgrade, rerun the check first: it imports Pi's validator and loader by internal path, which can move. A new required token fails Pi's validator; give it a design-system variable and a line in the [design](docs/design.md). Update the README for install and limits, architecture for seams, design for colors and contrast.

## Verification records

2026-10-22, first version, macOS, Node 22.23.0, installed Pi 1.3.0.

- Design system: `node --test` **403/403**, including the new `PI_CHROME` check; see [its record](../../design-system/CONTRIBUTING.md#pi-chrome-colors-verification-2026-10-22).
- `npm test`: **5/5**. Changing `bone` to `#e2dccc` failed the design-system test, and deleting `mdHr` failed Pi's validator; both were restored.
- Installed-Pi interactive load in Herdr, as above: Pi 1.3.0 started without a theme warning and drew the editor border as `38;2;226;220;203`. The only warning was the expected "No models available" of the empty agent directory.
- The draft theme was also run as a full Pi session in Herdr with status-bar, signals-collector and claude-interrupt loaded, and David approved its look. 256-color terminals and light terminals: **not checked**.
