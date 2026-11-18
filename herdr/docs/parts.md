# Sidebar parts and the storybook

Status: current at the change that split `mods/industrial-os/main.js` into parts, 2026-11-18. Why the parts live inside the one mod is in [the decision](../../docs/decisions/herdr-combined-mod.md).

A part is one piece of the sidebar that draws itself from what it is given: a pane's row, a space's band, the crate plate. The sidebar places the parts; the storybook shows each one alone, in its states. Both import the same files, so there is one copy of each part.

## What a part is

- A file in `mods/industrial-os/parts/`. It imports `gpui-kit` and `gpui-base` itself, the pure modules one folder up (`../format.js`, `../assets.js`, `../vocabulary.js`, …) and other parts.
- A function that returns elements (`paneRow(t, { … })`), or a nested `View` with its own clock where something moves that Herdr cannot animate (`MapView`, `GroundView`, `ReadoutView`).
- **Data in, elements out.** A part is given the theme (`t`, from `theme()`), plain data from the pure modules, and its handlers. It does not read spaces, panes or agents from Herdr, run a command or keep remembered state: `main.js` does those and passes the results in. Four files read the app for their own needs only: `text.js` (which fonts exist), `drawings.js` (the app's folder), and `map-window.js` and `ground-light.js` (`checking()`, and `theme()` in the ground's light).
- **Its contract is the comment above its export**: every argument, what each handler is called with, and what it returns. Change the comment with the code.
- **Every element that moves, hovers or scrolls is named through `partId`** (`.id(partId("ios-band-s1"))`). Herdr keeps an element's motion and hover by its id, across the whole view. A view that draws one part twice wraps each drawing in `scoped("#2", () => …)`, which ends every id inside with that suffix. The sidebar draws each part once and never needs it; the storybook does it for every specimen.
- **Drawings go through `picture` or `asset`** in `drawings.js`, by key. The file is written a tick later, so a part must look right without it.
- A part never imports `main.js`, `storybook.js`, `stories.js` or `sample.js`. Check: `test/industrial-os-layout.test.mjs`.

## The parts

| File | Draws | Exports |
| --- | --- | --- |
| `sheet.js` | Nothing: the measures every part is set on, and `partId` / `scoped` | `INNER`, `PAD`, `CH`, `CODE_W`, `NAME_X`, `ROW`, `PLATE_H`, `BAND_H`, `STEP_MS`, `BLACK`, `WHITE`, `rgba`, `present`, `hold`, `partId`, `scoped` |
| `drawings.js` | Nothing: the queue of SVG drawings and its one writer | `MOD`, `asset`, `drawn`, `drawingsVersion`, `flush`, `picture` |
| `stage.js` | Nothing: what a root view shares with its nested views | `openStage`, `stageOf` |
| `marks.js` | Drawn signs and state marks; the colours of a state | `sign`, `stateMark`, `toneColors`, `LIT_TONES`, `zoneColors` |
| `text.js` | Words, one-line cuts, lit text, ticker tape; the font | `font`, `lit`, `word`, `cutLine`, `tape` |
| `light.js` | A bar with its glow, a lamp's pulse, the gutter bar beside a pane | `LAMP`, `lamp`, `bar`, `hoverBar` |
| `key-plate.js` | A shortcut's plate, from a binding as keys.json writes it | `keyParts`, `keyPlate` |
| `crate-plate.js` | The paper label at the top, open and on the rail | `cratePlate`, `cratePlateRail` |
| `shortcut-strip.js` | The strip under the plate, open and on the rail | `shortcutStrip`, `unfoldStrip` |
| `search-hint.js` | The search line, open and on the rail | `searchHint` |
| `action-required.js` | ACTION REQUIRED | `actionRequired` |
| `view-ruler.js` | The view switch | `viewRuler` |
| `space-band.js` | A space's band | `spaceBand` |
| `titles.js` | A tab's title and a group's | `tabTitle`, `tabTitleChars`, `groupTitle` |
| `pane-row.js` | A pane's rows, quiet and open, and the readings it carries | `paneRow`, `paneRowHeight`, `latchOf`, `readoutOf`, `unitCount`, `unitIcons`, `contextText`, `contextBar`, `detailLine`, `labelCell` |
| `scanner.js` | The scanner's frame and the readout it types | `scannerFrame`, `scannerStill`, `readoutWidth`, `ReadoutView` |
| `map-window.js` | A window onto the map (nested view) | `MapView`, `FRAME_MS` |
| `ground-light.js` | The list's ground and its light (nested view) | `GroundView` |
| `hide-grip.js` | The hide grip | `hideGrip` |
| `rail-lamp.js` | One lamp of the rail | `railLamp` |
| `fold-covers.js` | A fold in motion over one block | `foldCovers` |

What each part looks like and means is in [the design](design.md#sidebar); this table only says where it is.

## The storybook

A view of the same mod: every part alone, in its states, on invented data. It reads no space, pane or agent from Herdr, only the theme and the fonts, and its handlers do nothing, so a click in it changes no pane.

- **Open it as a window:** bind a key to the mod's `storybook` command in `~/.config/herdr-app/keys.json`, for example `"cmd-alt-s": "industrial-os.storybook"`, or run `herdr-app do industrial-os.storybook`. The sidebar's list block answers the command, so the `industrial-os` layout must be shown. Opening it again replaces the open window; `CLOSE` in its header closes it, and so does a layout switch.
- **Or show it in a layout block:** `{ "mod": "industrial-os", "props": { "part": "storybook" } }`.
- **Turn the page** from the index on the left, or bind keys to `industrial-os.story-next` and `industrial-os.story-prev`. It remembers the page.
- A state with two forms (at rest, under the pointer) changes between them every 1.6 s, so its motion shows. The states that depend on the real pointer say so in their label.

Its files:

| File | Owns |
| --- | --- |
| `storybook.js` | The window: header, index, page, the clock, and what a story's `render(s)` is given (documented above the class) |
| `stories.js` | `STORIES`: one entry per part with `id`, `title`, `about`, and `states()`, each a `label` and a `render(s)`; `uses` names the nested views it needs, `moves` asks for a redraw every step |
| `sample.js` | The invented window, in the shapes Herdr gives: pure, so the tests use it too |

## Adding or changing a part

1. Change or add the file in `parts/`, with its contract comment. A new look starts in the design system's sidebar vocabulary, as before.
2. Add or update its story in `stories.js`: one state per form it can take, including unknown values and text that is too long. `test/industrial-os-parts.test.mjs` fails while a part has no story.
3. Place it from `main.js`.
4. Run the [validation sequence](../CONTRIBUTING.md#validation-sequence), and look at the story in an [isolated app](../CONTRIBUTING.md#isolated-app).

## The stand-in

`herdr/stand-in/` lets Node load code that imports `gpui-kit`, `gpui-base`, `herdr` and `fs/promises`: an element builder that records what was asked of it and throws on any method it was not told the app has, a `herdr` whose window a test sets, an in-memory file system, and `Sim`, which runs views on a clock a test moves. A test registers `stand-in/hooks.mjs` and then imports the mod.

It proves that the code runs and what tree it builds. It does not lay out or paint: sizes, fonts, clipping and real motion are seen only in the app. A `gpui-kit` method new to the mod is added to `stand-in/kit.mjs` after checking it in the app's `gpui-kit.d.ts`.
