# Design

When Pi opens, the top of the screen identifies the agent you are talking to and what it has loaded: one framed Acid / Black panel in place of Pi's logo and hints. It reads like a machine's data plate. Every value is real, and the panel never adds keys, focus or modes. Install, `quietStartup` and limits are in the [README](../README.md); this page owns presentation. The approved mock it follows is the operator's `approved-mockup.mjs`, settled at 104 columns, reproduced cell for cell by the golden test apart from the [deviations](#deviations-from-the-approved-mock).

## Layouts

**Full, 100 columns and wider.** The frame fills the terminal width; columns past 104 widen the value areas, the manifest and the rules.

```text
┏━ DRD-C0DE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ● ━┓
┃                                                                                                      ┃
┃  █▀▀ █▀█ █▀▄ █▀▀     01 CLS  PI AGENT DROID                  04 SCT  WA1.T1                          ┃
┃  █   █ █ █ █ █▀▀     02 COR  OPUS-5.5 / HIGH                 05 MOD  004 MODULES            \|/      ┃
┃  ▀▀▀ ▀▀▀ ▀▀  ▀▀▀     03 FRM  PI 1.4.0                        06 SKL  003 SKILLS             -*-      ┃
┃  ▏▐▏▐▍▐▎▏▌▎▍▎▏▐▐     •••••   DEPLOYED 09:30:00 ───────────────────┤  ASSIGNMENT             /|\      ┃
┃  ▏▐▏▐▍▐▎▏▌▎▍▎▏▐▐     •••••                                        │  INDUSTRIAL-OS · MAIN            ┃
┃                                                                                                      ┃
┣━ MANIFEST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                      ┃
┃   CTX  02      ▪ ~/.pi/agent/AGENTS.md  ▪ AGENTS.md                                                  ┃
┃   CONTEXT                                                                                            ┃
┃                                                                                                      ┃
┃   SKL  03      ▪ code-review  ▪ debugging  ▪ release-notes                                           ┃
┃   SKILLS                                                                                             ┃
┃                                                                                                      ┃
┃   PRM  02      ▪ /plan  ▪ /review                                                                    ┃
┃   PROMPTS                                                                                            ┃
┃                                                                                                      ┃
┃   EXT  04      ▪ ask-user  ▪ industrial-os/droid-header  ▪ industrial-os/status-bar                  ┃
┃   MODULES      ▪ pi-web-access                                                                       ┃
┃                                                                                                      ┃
┗━ SES-0000BEEF│PNE-WA1:P1│PI-1.4.0 ━━━━━┻━━━━━━━━━━━┻━━━━━━━━━━━┻━━━━━━━━━━━┻━━━━━━━━━━━┻━━━━━━━━━━━┻━┛

 escape interrupt · ctrl+c clear · / commands · ! bash
```

The unit number is the design system's 3×5 pixel numeral (hex letters from `HEX_FONT`), over a two-row barcode seeded from the session. Six numbered plates sit in two columns; values are clipped with `…` before the next column or the starburst. Manifest items flow with two cells between them and wrap under their hold; a hold is at least two rows, its name under its plate.

**Compact, 40 to 99 columns.** One column of plates, values to the frame; no numeral, barcode, dot grid or starburst. The manifest wraps as in the full layout.

```text
┏━ DRD-C0DE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ● ━┓
┃                                                              ┃
┃   01 CLS  PI AGENT DROID                                     ┃
┃   02 COR  OPUS-5.5 / HIGH                                    ┃
┃   03 FRM  PI 1.4.0                                           ┃
┃   04 SCT  WA1.T1                                             ┃
┃   05 MOD  004 MODULES                                        ┃
┃   06 SKL  003 SKILLS                                         ┃
┃                                                              ┃
┃   DEPLOYED 09:30:00                                          ┃
┃   ASSIGNMENT  INDUSTRIAL-OS · MAIN                           ┃
┃                                                              ┃
┣━ MANIFEST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                              ┃
┃   CTX  02      ▪ ~/.pi/agent/AGENTS.md  ▪ AGENTS.md          ┃
┃   CONTEXT                                                    ┃
┃                                                              ┃
┃   SKL  03      ▪ code-review  ▪ debugging                    ┃
┃   SKILLS       ▪ release-notes                               ┃
┃                                                              ┃
┃   PRM  02      ▪ /plan  ▪ /review                            ┃
┃   PROMPTS                                                    ┃
┃                                                              ┃
┃   EXT  04      ▪ ask-user  ▪ industrial-os/droid-header      ┃
┃   MODULES      ▪ industrial-os/status-bar                    ┃
┃                ▪ pi-web-access                               ┃
┃                                                              ┃
┗━ SES-0000BEEF│PNE-WA1:P1│PI-1.4.0 ━━━━━┻━━━━━━━━━━━┻━━━━━━━━━┛

 escape interrupt · ctrl+c clear · / commands · ! bash
```

**Minimal, below 40 columns.** One settled line, `DRD-C0DE ● PI-1.4.0 · 004 MOD · 003 SKL`, clipped with `…`; no manifest, hints or motion.

Every line is exactly the terminal width. Key hints that do not fit are dropped whole from the end.

## Values

| Field | Rule |
| --- | --- |
| Unit, `DRD-` | The last four hex digits of the session ID, uppercased; `????` when the ID has fewer than eight |
| `SES-` | The first eight hex digits; `????????` when unknown. They also seed the barcode, dither and decode |
| `02 COR` | A short model label, then the thinking level uppercased: the provider prefix, a `claude-` word and a date or `-latest` suffix are dropped, a trailing `N-N` reads `N.N` (`anthropic/claude-sonnet-4-5-20250929` → `SONNET-4.5`). Pi's placeholder model (provider and ID `unknown`) and a missing level are `--` |
| `03 FRM`, `PI-` | Pi's `VERSION` |
| `04 SCT` | `HERDR_WORKSPACE_ID` and the tab part of `HERDR_TAB_ID`, joined with `.` and uppercased (`wA1`, `wA1:t1` → `WA1.T1`) |
| `PNE-` | `HERDR_PANE_ID` uppercased. IDs that are not 1–32 of `A-Za-z0-9:._-` count as absent; absent is `--` |
| `05 MOD`, `06 SKL` | Three-digit extension and skill counts from the manifest; `--` until it is ready |
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
| Manifest pending | Counts `--`, the manifest area empty below the divider; never `000` or LOADING |
| Manifest ready | Counts and the four holds; an empty hold shows `00` and no items |
| Manifest unavailable | `MANIFEST UNAVAILABLE` in critical and `· <reason>` in secondary, counts `--`; never animated or scrambled. Reasons include `SETTINGS UNREADABLE: global ~/.pi/agent/settings.json` (each unreadable file's scope and path) |
| Unknown session, outside Herdr, no model | `????`, `--` as in [values](#values); the unknown numeral is drawn in decorative |
| Not a repository | The folder name alone |

## Motion

Only a fresh, empty session animates: Pi's `startup` or `new`, with nothing but setting entries. The intro plays once, at most 20 frames a second, and every frame is a pure function of its time:

| Time (ms) | What happens | Rate |
| --- | --- | --- |
| 0–500 | Top rule draws left to right | |
| 0–1500 | Lamp blinks `○`/`●`, then holds `●` | Flips every 80 ms, about 6 flashes a second |
| 100–900 | Side rails draw down | |
| 250–800 | Bottom rule draws right to left | |
| 300–1000 | Unit number assembles from the design system's numeral dither | |
| 500 + 170 × plate | Each plate warms through accent 25, 50, 75 % to acid | 60 ms per step |
| 700 + 170 × plate | Its value decodes: blank, scramble, true text | Glyph changes every 70 ms; true within 500 ms |
| 700–1100 | Barcode scans in | |
| 900–1300 | `MANIFEST` divider draws | |
| 1100 | Dot grid appears | |
| 1200–1600 | `DEPLOYED` leader types | |
| 1300 until settled | Starburst spins `\|/-\`, then rests on `*` | Steps every 70 ms |
| 1500–2000 | `ASSIGNMENT` types | |
| 1200–2700 | Manifest items print in order; a hold's plate flashes acid as it starts | Plate flash 120 ms |
| 2500–2900 | Key hints appear group by group | |
| 2900 | Settled | |

A ready manifest that arrives during the intro prints from its arrival, so the intro ends at most 1.7 s later (at most 4.6 s in all); one that arrives after the intro appears settled at once. The compact layout runs the same timeline without the numeral, barcode, dots and starburst.

Decode uses the [root decode exception](../../../docs/design.md#motion): only plate values decode, each within 500 ms, and the failure state never does. Typed rows reveal real text; nothing suggests progress that is not happening, and no frame shows a percentage or a loading word.

The first keystroke, a submitted message or an agent start settles the intro at once, without taking the key. Resumed, forked and reloaded sessions, sessions with content, and `NO_MOTION` set to any non-empty value show the settled panel immediately. The lamp is decoration, not a status: it does not track activity. Its 80 ms flashes and the starburst are fast motion with no photosensitivity check.

## Colors

All from the design system's Acid / Black roles and Pi chrome, never the Pi theme:

| Part | Role |
| --- | --- |
| Frame, rules, junctions, separators | structural |
| `DRD-` ID, starburst | accent |
| Lamp | Pi chrome `lamp` |
| Plates | field on accent, warming through `accent25`, `accent50`, `accent75` |
| Values, numeral, barcode, manifest items, `DEPLOYED` | primary |
| Hold names, `ASSIGNMENT`, `▪`, dot grid, coordinates, hint keys, an unknown numeral | decorative |
| Hold plates (settled), `MANIFEST`, hint actions, a failure's reason | secondary |
| `MANIFEST UNAVAILABLE` | critical |

## Deviations from the approved mock

- **No `ctrl+o more` hint.** In Pi that key expands only Pi's own header; this one has nothing to expand. The operator chose to drop it.
- **Key names come from Pi.** `keyText` gives `escape` where the mock wrote `esc`, and follows the user's bindings.
- **Seeded by the design system.** The barcode uses the design system's seeded generator, and the unit number assembles with its numeral dither, not the mock's own generator and flicker.
- **Real names.** Manifest names follow [values](#values), not the mock's hand-written list.
- **Synthetic values in the golden frame.** The mock hard-codes one real session's IDs and start time. The golden test runs it with synthetic ones (`DRD-C0DE`, `SES-0000BEEF`, `WA1:P1`, `WA1.T1`, `09:30:00`) and a public-safe manifest, with the design system's `D` and `E` glyphs added to the mock's font; this page's frames use the same values.
- **Width.** The mock clamps to 100–140 columns; the header fills any width from 100 and adds the compact and minimal layouts below.
- **States the mock lacks.** Pending, unavailable and unknown values, and a late manifest extending the intro.
- **Once.** The mock replays its intro in a loop; the header plays it once.
