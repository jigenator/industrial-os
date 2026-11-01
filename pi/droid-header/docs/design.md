# Design

When Pi opens, the top of the screen identifies the agent you are talking to and what it has loaded, in place of Pi's logo and hints: a brushed-aluminium maker's plate, a frosted strip of key hints, and a ledger of the droid's specifications and manifest on the chat pane's dark surface. Every value is real, and the header never adds keys, focus or modes. Install, `quietStartup` and limits are in the [README](../README.md); this page owns presentation. It follows the [approved reference](#approved-reference) cell for cell at 104 and 64 columns, apart from the [deviations](#deviations-from-the-approved-reference).

## Layouts

**Hanging ledger, 100 columns and wider.** The plate's title block and peak, the hints on one row, and a 16-cell gutter that holds `SPECIFICATIONS`, `MANIFEST` and each hold's name and count, with the values and items hanging from it.

```text
+─────────────────────────────────────────────────────◢───◤◥───◣───────────────────────────────────────+
  INDUSTRIAL-OS ®                                    ◢   ◤  ◥   ◣                     ⟁ PI AGENT DROID
  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀                   ◢   ◤    ◥   ◣                    ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐
  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀                  ◢   ◤      ◥   ◣                   ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐
  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀                 ◢   ◤        ◥   ◣                  HALDENN DYNAMICS
+ S/N 0000-BEEF ─────────────────────────────────◢───◤──────────◥───◣──────────────────────────────────+
                  escape steer         ctrl+c clear         / commands           ! bash
  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·
  SPECIFICATIONS  MODEL                OPUS-5.5 / HIGH      SECTOR               WA1.T1
  ·   ·   ·   ·   FRAMEWORK   ·   ·    PI 1.4.0   ·   ·   · PANE  ·   ·   ·   ·  WA1:P1   ·   ·   ·   ·
                  DEPLOYED             09:30:00             ASSIGNMENT           INDUSTRIAL-OS · MAIN
  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·

  MANIFEST    31  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·

  CONTEXT ·   02  ~/.pi/agent/AGENTS.md   ·   ·   ·   ·   · AGENTS.md ·   ·   ·   ·   ·   ·   ·   ·   ·

  SKILLS      12  code-review ·   ·    design-review  ·   · incident-response ·  release-notes
                  commit-messages      docs-writing         migrations           security-review
                  debugging            frontend-design    · perf-profiling       test-planning

  PROMPTS     03  /explain             /plan                /review

  EXTENSIONS  14  ask-user                                  industrial-os/image-preview
                  example-tasks                             industrial-os/session-recap
                  …                                         …
```

The extensions hold is cut short here; it continues for its 14 items. The floor's dots fade out toward the last row, which is black.

**Stacked ledger, 56 to 99 columns.** The same plate without the peak below 72 columns, the hints in rows, `SPECIFICATIONS` and each hold's name on their own rows with the count on the second column line, and the values and items under them.

```text
+──────────────────────────────────────────────────────────────+
  INDUSTRIAL-OS ®                             ⟁ PI AGENT DROID
  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀             ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐
  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀             ▌ ▌ ▍ ▍▏█▎▍ ▏█▎▐
  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀             HALDENN DYNAMICS
+ S/N 0000-BEEF ───────────────────────────────────────────────+
  escape steer        / commands
  ctrl+c clear        ! bash
  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·
  SPECIFICATIONS
  MODEL   ·   ·   ·   OPUS-5.5 / HIGH ·   ·   ·   ·   ·   ·   ·
  FRAMEWORK           PI 1.4.0
  DEPLOYED    ·   ·   09:30:00    ·   ·   ·   ·   ·   ·   ·   ·
  SECTOR              WA1.T1
  PANE    ·   ·   ·   WA1:P1  ·   ·   ·   ·   ·   ·   ·   ·   ·
  ASSIGNMENT          INDUSTRIAL-OS · MAIN
  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·

  MANIFEST    ·   ·   31  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·

  CONTEXT ·   ·   ·   02  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·
  ~/.pi/agent/AGENTS.md
  AGENTS.md   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·

  SKILLS  ·   ·   ·   12  ·   ·   ·   ·   ·   ·   ·   ·   ·
  code-review         docs-writing        perf-profiling
  …
```

**Plate only, 40 to 55 columns.** The plate keeps the maker, the `DRD-` wordmark and the serial only, with no title block or peak, over the stacked ledger:

```text
+──────────────────────────────────────────────+
  INDUSTRIAL-OS ®
  █▀▄ █▀▄ █▀▄     █▀▀ █▀█ █▀▄ █▀▀
  █ █ █▀▄ █ █ ▀▀▀ █   █ █ █ █ █▀▀
  ▀▀  ▀ ▀ ▀▀      ▀▀▀ ▀▀▀ ▀▀  ▀▀▀
+ S/N 0000-BEEF ───────────────────────────────+
  escape steer          / commands
  ctrl+c clear          ! bash
```

**Minimal, below 40 columns.** One settled line, `DRD-C0DE ● PI-1.4.0 · 014 MOD · 012 SKL`, clipped with `…`; no plate, ledger, hints or intro.

The plate is the design system's [unit plate](../../../design-system/elements/unit-plate/README.md); its geometry, the peak's room rules and the long-maker order are in its contract. The ledger's table is one set of equal columns per width, at least 20 cells each (two columns of 18–19 cells below 44 columns), from the gutter (hanging) or the left margin (stacked) to three cells before the right edge. Every value, hold item and hint starts on a column line:

- A specification's label is on one column line and its value on the next; a value runs to two cells before the next group's label, or to the right margin, and is clipped there with `…`.
- A hold's items, and the hints, flow top to bottom through the narrowest span of columns (one column, a whole divisor of the column count, or all of them) whose columns hold the longest item with two cells to spare. An item wider than the whole table is clipped to it with `…`.
- An empty hold shows its name and `00` and no items.

Every line is exactly the terminal width at every width; above 1000 columns the 1000-column header is padded with the field. Layout never throws.

## Values

| Field | Rule |
| --- | --- |
| Unit, `DRD-` | The last four hex digits of the session ID, uppercased; `????` when the ID has fewer than eight |
| `S/N` | The first eight hex digits as `0000-BEEF`; `????-????` when unknown. They also seed the barcode and the intro |
| `MODEL` | A short model label, then the thinking level uppercased: the provider prefix, a `claude-` word and a date or `-latest` suffix are dropped, a trailing `N-N` reads `N.N` (`anthropic/claude-sonnet-4-5-20250929` → `SONNET-4.5`). Pi's placeholder model (provider and ID `unknown`) and a missing level are `--` |
| `FRAMEWORK`, `PI-` | `PI` and Pi's `VERSION` |
| `SECTOR` | `HERDR_WORKSPACE_ID` and the tab part of `HERDR_TAB_ID`, joined with `.` and uppercased (`wA1`, `wA1:t1` → `WA1.T1`) |
| `PANE` | `HERDR_PANE_ID` uppercased. IDs that are not 1–32 of `A-Za-z0-9:._-` count as absent; absent is `--` |
| `MANIFEST` and each hold's count | The total and each hold's count as two digits or more, from the manifest; `--` until it is ready. The minimal line's `MOD` and `SKL` are three-digit extension and skill counts |
| Escape hint | Pi's interrupt key, then `steer` once the ready manifest shows claude-interrupt enabled (an extension named `claude-interrupt` or `…/claude-interrupt`, or any enabled extension whose path has a `claude-interrupt` or `pi-claude-interrupt` folder or file), and `interrupt` while the manifest is pending or unavailable, or does not show it |
| `DEPLOYED` | Local `HH:MM:SS` when this Pi process first saw the session |
| `ASSIGNMENT` | The working folder's name uppercased, `·`, and the branch (or the first seven hex digits of a detached commit), uppercased; `--` for a HEAD it cannot read; just the folder outside a repository |
| Context | Pi's context files in load order, relative to the working folder, else `~/` for home, else absolute |
| Skills | The skills Pi's loader accepts, by the name Pi gives them (the frontmatter `name`, else the folder), once each, alphabetical. Pi drops a skill without a description or with unparsable frontmatter |
| Prompts | The prompts Pi has loaded, `/` and their name, alphabetical |
| Extensions | The extensions Pi's settings enable, alphabetical; listed, not proven loaded. A top-level file is its name, or its folder's for `index`. A package contributing one extension is its package name (npm without scope or version, git the repository name without ref, a local path its folder), or `<dir>` when that extension is under `packages/<dir>/`. A package contributing several is `<package>/<extension>`: the extension is its file name, or for `index` and `extension` files the nearest folder not named `src`, `dist`, `lib` or `extensions`; when that equals the package name, or `pi-` plus it does, just the package name |

Untrusted text shows controls and bidi marks as `?` and is clipped on whole graphemes.

## States

| State | Shown |
| --- | --- |
| Manifest pending | The `MANIFEST` total `--` and nothing under it; never `00` or LOADING. The Escape hint says `interrupt` |
| Manifest ready | The total and the four holds; an empty hold shows `00` and no items |
| Manifest unavailable | The total `--`, then `MANIFEST UNAVAILABLE` in critical and `· <reason>` in secondary; never typed or garbled by the intro. Reasons include `SETTINGS UNREADABLE: global ~/.pi/agent/settings.json` (each unreadable file's scope and path) |
| Unknown session | `DRD-????` and `S/N ????-????`, the unknown digits drawn as `?` in label grey |
| Outside Herdr, no model | `--` as in [values](#values) |
| Not a repository | The folder name alone |

## Motion

Only a fresh, empty session animates: Pi's `startup` or `new`, with nothing but setting entries, and `NO_MOTION` unset or empty. The intro is the design system's [CRT boot](../../../design-system/motions/README.md#crtbootlines-options-and-crtbootdurationlines-options) over the whole settled header, seeded from the session, played once and drawn at most every 50 ms (20 frames a second). Every frame is a pure function of the state, the width, the time and the seed; the settled frame is exactly the header above.

| Time (ms) | What happens | Rate |
| --- | --- | --- |
| 0–120 | Power-on: a bright line across the middle row, no text | Once |
| 120–350 | The grounds come up: the aluminium, the frosted strip and the dark floor with its dots, no text | Every other 50 ms frame dims: 10 flickers a second |
| From 350 | Each row types left to right behind an acid `█` cursor, the two cells behind it garbled and, on the dark floor, about ten more in bright phosphor | 50 ms chunks of 4–11 cells (20 a second) |
| `350 + row × stagger` | Row starts, plus a seeded 0–250 ms jitter. `stagger = min(42, 2100 / (rows − 1))` ms, so every row starts within 2.1 s of the first however tall the header | |
| 700–1600 | One refresh bar, three rows lifted toward white, rolls down once | |
| Seeded | Four row tears (1–3 rows shifted 1–4 cells right) and two whole-header flickers, each 50 or 100 ms | Two whole-header flickers |
| End | The last row's end plus 150 ms: about 1.9–3.5 s up to 200 columns, about 4.3 s at 300 columns with a long manifest, never later than 5.85 s | |

The peak's acid paint is typed with its row and hidden under the aluminium until then; the floor's dots are part of the ground and show from 120 ms. A ready manifest that arrives during the intro types its holds from its arrival, its rows staggered as above, and extends the intro by as long as they take; one that arrives after the intro appears settled at once. As a backstop for a header Pi stops drawing, the intro settles 8 s after it starts whatever the frame.

This is the [root motion exception](../../../docs/design.md#motion) for the droid header: typing hides cells it has not reached and garbles two at its cursor, then shows the true text. A row holding a warning or critical cell, such as `MANIFEST UNAVAILABLE`, shows settled in every frame, so a failure is never typed or garbled. Nothing suggests progress that is not happening: the rows type at a seeded pace, not with the manifest's progress, and no frame shows a percentage or a loading word.

The first keystroke, a submitted message or an agent start settles the intro at once, without taking the key. Resumed, forked and reloaded sessions, sessions with content, and `NO_MOTION` set to any non-empty value show the settled header immediately. The 10-a-second grounds flicker and the whole-header flickers are flashing motion with no photosensitivity check.

## Colors

All from the design system, never the Pi theme:

| Part | Color |
| --- | --- |
| Plate ground and hairlines | The unit plate's brushed aluminium (`ALUMINIUM_GROUND`), hairlines its ground's hairline |
| Maker, wordmark, title, barcode, serial | `field`, bold for the maker, wordmark and title |
| `S/N`, division, unknown digits | `SURFACE_PALETTE.aluminiumLabel` |
| Peak | `accent`, the hairline under it `SIGNAL_COLORS.accent75` |
| Strip | White at `FROST_ALPHA` over the surface gradient's top row; keys bold `primary`, actions `SURFACE_PALETTE.frostLamp` |
| Floor | The design system's surface gradient run from 19 to black at the last row (`top` 19, `drop` 19, `edge` 3), its dot lattice one cell clear of ink and left out below lightness 9 |
| `SPECIFICATIONS`, `MANIFEST`, values | Bold `primary` |
| Labels, hold counts, a failure's reason | `secondary` |
| Hold names | Bold `secondary` |
| Items, the total | `primary` |
| `MANIFEST UNAVAILABLE` | `critical` |
| Minimal line | `DRD-` `accent`, `●` Pi chrome `lamp`, the rest `secondary` |

## Approved reference

The operator's approved droid-header concept work, outside this repository: `work/k-motion/g-shared.mjs` (the plate and ledger), `texture.mjs`, whose `renderTextured(width, STATE, 'aluminium', { transition: 'fade-dots' })` is the final composition, `crt.mjs` (`crtFrame`, `crtDuration`) for the intro, and `data.mjs` for the sample state. `test/header.test.ts` holds that composition's settled output at 104 and 64 columns, every cell's text, colors and weight, generated by running the mockup on its own sample state, which is the state this page's frames show; the design system's CRT boot matches `crtFrame` at every 10 ms of both widths.

## Deviations from the approved reference

- **Hairlines.** The mockup draws the plate's hairlines `#dadada`; the header uses the crate banner's treatment, each cell's aluminium ground 28 darker, so the plate shares one look with the crate banner. The goldens differ from the mockup in those cells' ink only. Approved by the operator.
- **Narrow tables.** Below 44 columns the ledger keeps two columns of 18–19 cells rather than one, so labels and values stay side by side. The mockup has no layout below 56. Approved.
- **Stagger cap.** The mockup staggers rows 42 ms apart whatever the height, so a long manifest could boot for many seconds. The stagger is `min(42, 2100 / (rows − 1))` ms; at 104 and 64 columns with the sample state it is the mockup's 42. Approved.
- **Escape hint.** The mockup always says `steer`. The header says `steer` only once the manifest shows claude-interrupt enabled, else `interrupt`, because without claude-interrupt Escape interrupts. A claude-interrupt loaded only with `-e` is not in the manifest, so the hint then says `interrupt`. Approved.
- **Key names come from Pi.** `keyText` gives `escape` and `ctrl+c` and follows the user's bindings; a key Pi cannot name is left out.
- **Barcode and unknown digits.** The barcode is drawn by the design system's `barcode()` from its seeded `random(seed)`, as the mockup's own generator was; an unknown session's digits are `?` in label grey, a state the mockup lacks.
- **Widths.** The mockup is laid out at fixed widths; the header fills any width from 1, padding past 1000 columns with the field, and adds the plate-only and minimal layouts.
- **Backstop.** An 8 s limit settles an intro whose frames Pi stops drawing; the mockup has none.
- **States the mockup lacks.** Pending, unavailable and unknown values, and a late manifest typing from its arrival.
- **Real names.** Manifest names follow [values](#values), not the mockup's hand-written list. The mockup's sample state, which the goldens use, has synthetic IDs (`DRD-C0DE`, `0000-BEEF`, `WA1:P1`, `WA1.T1`, `09:30:00`) and public-safe names.
- **Once.** The mockup replays its intro in a loop; the header plays it once.
