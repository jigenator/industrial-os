# Design

Industrial OS in the Herdr desktop app: the [sidebar](#sidebar), the [pane plate](#pane-plate), [Lunalee's column](#lunalee-column), the [Pi Reloader](#pi-reloader) window and the [chrome theme](#theme), in the [shared language](../../docs/design.md).

The window is `sidebar | work | lunalee`: the sidebar on the left, Herdr's tabs, panes, Files/Changes panel and status bar in the middle, and Lunalee's column on the right edge.

Panes are flat: square corners, no border and no focus outline, at the operator's choice. The focused pane is not outlined: its [pane plate](#pane-plate) is lit while the others are dark, and for an agent's pane the sidebar's focused pane block marks it too.

## Lunalee column

One full-height column on the right, 580 px (64 terminal columns at font 14, zoom 1), resizable from its left edge between 420 and 900 px, on the chrome background. It is always in the layout; Industrial OS draws nothing in it. Lunalee's install supplies a 1 px `lunalee` mod block at the top, which draws nothing, and the `lunalee-chat` terminal below it. Without Lunalee, the column is a blank 1 px block over a blank terminal slot. What to do when the block disappears is in the [README](../README.md#lunalee-column).

## Sidebar

One mod, `industrial-os`, draws the whole sidebar as three layout blocks, 300 px wide: the [top](#top) (130 px: the crate plate over the shortcut strip), the [list](#list) and the [search hint](#search-hint) (46 px). Narrower than 160 px it is the [rail](#rail). The sidebar's [ground](#ground) is a gradient from `groundTop` to `groundBottom` with a dot on every fourth terminal column and second row, a brighter one every fifth.

It reads like a control room's board: a space is a mission, a tab is a zone, a pane is a unit, and every pane of every tab is listed, not only agents. The words and values below are the design system's [sidebar vocabulary](../../design-system/foundation/README.md#sidebar-vocabulary); this document says where each one shows.

### Vocabulary

| Herdr | Shown as | Designation |
| --- | --- | --- |
| Space | Mission: a band with its name in capitals | A letter by position: `A`, `B`, … `Z`, `AA` |
| Tab | Zone: a title over its panes and a zone on the map | Grid reference `A01`: the space's letter and the tab's position |
| Pane | Unit: two rows in the list and a marker on the map | `DRD-A01-1`: its kind, its tab and its place in the tab |

A unit's kind is `DRD` for a Pi with a valid label, `AGT` for any other agent, `TRM` for a terminal without an agent and `MOD` for a mod's pane. A pane without Pi's signals says what it is in place of the readings it lacks: `HERDR STATUS ONLY`, `TERMINAL` or `MOD`.

### State marks

Each state code has a drawn mark, a one-color mask on a 9 × 9 grid tinted in the state's color. Moving marks advance in hard steps.

| Code | Mark | On the map | When | Color |
| --- | --- | --- | --- | --- |
| `QNS` | A ringed diamond; the ring blinks every 440 ms | `RFI` | The snapshot has a pending question | `blocked` |
| `BLK` | A crossed box | `HOLD` | Herdr reports blocked | `blocked` |
| `WRK` | A core with one satellite circling, 8 steps of 110 ms | `ON TASK` | Herdr reports working | `working` |
| `WRK` with subagents | A core with three satellites, 4 steps of 110 ms | `ON TASK` | Working, and its own subagents (units) ≥ 1 | `working` |
| `SUB` | The same three-satellite mark | `ON TASK` | Units ≥ 1 while the root agent does not work | `working` |
| `RUN` | A frame with a scan line, 4 steps of 220 ms | `EXEC` | Background tasks ≥ 1 (unknown never selects RUN) | `working` |
| `DNE` | A solid grid | `SITREP` | Herdr reports done, or work finished unseen | `done` |
| `IDL` | A ring | `STBY` | Herdr reports idle | grey |
| `UNK` | One cell | `NO COMMS` | Anything else | grey |

The first row that applies wins, in the order `QNS`, `BLK`, `WRK`, `SUB`, `RUN`, `DNE`, `IDL`/`UNK`. Another agent's code is Herdr's status: `BLK`, `WRK`, `DNE`, `IDL` or `UNK`. A plain terminal or mod pane is `IDL`.

**Work finished unseen.** Herdr makes `done` only from Pi's root agent. A Pi also shows `DNE` when units or background tasks fall from ≥ 1 to 0 between consecutive observations while Herdr does not report working and the agent is not seen. Seen means its tab is the shown tab of the shown space. Unknown counts, including a missing label, never count as zero, so a drop through unknown is no completion. Seeing it, Herdr working, or either count returning to ≥ 1 clears it. The rule keeps its state in the mod's `localStorage`, saved when it changes (timestamps alone at most once a minute); entries for agents gone 30 days are forgotten.

**Label rules.** The label is the frozen `io.signals.v1` publication: SignalsSnapshot v1 without `usage`, plus `backgroundTasks` and `flag`. It counts only with `version` 1, on a live terminal whose agent status `app` is `pi`; otherwise it is stale and ignored. Each field is validated; a missing or malformed value is unknown, shown as `??`, `--%` or absent, never as zero or clean. Free text is cut to 200 code units, and terminal and bidi controls are removed.

### Light

Colour is light: text and bars in the accent, the critical red or the warning yellow bleed a little of their own color (a blurred copy under the crisp one, at `glow` strength). Grey and white text does not, and neither does anything on the plate: paper does not glow. A state change latches: the pane's block is black on acid for 130 ms, black on its new color for 130 ms, then settled. Both colors are laid at `latch` strength, so the ground and its dots show through a little.

### Ground

The list's ground lights up; only shade changes, and no dot moves.

- **At rest** the dots are held back to `groundDotRest` of their color.
- **Near the pointer** the dots within 110 px come up, brighter the closer, and a ring of brighter shade pulses out from the pointer, 150 px in 1.6 s, every 2.4 s, fading as it grows. The light comes up in 200 ms and goes in 500 ms after the pointer leaves the list.
- **A sweep**: a one-pixel line in the accent at `sweep` strength travels down the list every 16 s, and the dots within 70 px of it come up.

### Top

The crate plate is paper (`paper`), six terminal rows tall, over the shortcut strip. Dragging it moves the window. The macOS window buttons stand on the plate's 18 px gutter, in line with the readings under them and level with the maker's name: the layout's `traffic_lights`.

| Part | Shows |
| --- | --- |
| Maker | `INDUSTRIAL-OS ®`, weight 800, top right, on its own paper over the map. |
| Machine | A benzene-ring sign, this computer's name from `hostname -s` in capitals (`LOCAL` until it is known; at most 12 characters, a longer one runs as ticker tape under the pointer), then `· RUNNING` while any droid runs, else `· STANDBY`. |
| `NN DRD` | Droids running, with the Industrial OS mark: every agent shown as working (Pi `WRK`, `SUB` or `RUN`, and other agents Herdr reports working; `QNS` and `BLK` outrank working and do not count) plus every Pi's subagents (units), including a `QNS` or `BLK` Pi's. Capped `99`. **An exception to unknown-is-never-zero, chosen by the operator:** a Pi whose units are unknown adds only itself if working, so the count can undercount. |
| `NN SPACES` | The number of spaces. |
| Map | The right of the plate is a window onto [the map](#the-map), printed in ink. The crosshair is literal: the unit under it is the focused pane, or the first pane of the shown space when no pane has the keyboard, and it is named beside it. Only a row of ACTION REQUIRED under the pointer takes the crosshair. When the watched unit changes the map pans to it under the crosshair, a fifth of the way each frame (about a third of a second), also from one space's belt to another's; it does not jump. The map dissolves leftwards into the paper. |
| Light | A slanted band of acid light (`light`: paper × accent) lies on the paper under the map's ink and shifts as the watched unit moves on its patrol. |

The shortcut strip is glass, one row: `SETTINGS` (`app.settings`) and `ADD MACHINE` (`mod.open machine-add`). A key under the pointer is black on acid. A lit dot beside `SETTINGS` means an update is ready to install.

### List

From the top: ACTION REQUIRED, the view switch, then the shown view, which scrolls and fades out at the bottom edge.

**ACTION REQUIRED** appears only while something needs the person, with its count in red: questions and blocks first, then work finished unseen. Its block is red glass with a red dot grid. Each row is set as a pane's rows are: mark and code; `SPACE › TAB` in capitals (ticker tape under the pointer when too long); the `/flag` flag; the age; then what it waits on, at most two lines: the question's text with ` (+N)` for further questions, `waiting on approval`, or `finished, not yet seen`. Four rows show; `+ NN MORE` shows the rest. Click a row to focus its pane.

**The view switch** is `MISSIONS` and `AGENTS` over a ruler. An acid index pointer sits under the shown view; under the pointer it turns white and follows it along the ruler. The choice is remembered.

#### Missions view

One band per space in Herdr's order, across the whole sidebar.

| Part | Shows |
| --- | --- |
| Band | The name in capitals, weight 800, and a caret: `▾` open, `▸` shut. Click to shut or open; the choice is remembered. A [quiet](#quiet-spaces) space starts shut. The shown space's band has an acid dot grid fading from the left. |
| `+` | Under the pointer it opens to the right in 150 ms into `+ NEW TAB` with the key bound to `tab.new`; click for a new tab in that space. |
| `NN NEED YOU` | Its panes that are `QNS` or `BLK`, in red. Absent at zero. |
| `↓N` | Commits behind the upstream, from `git rev-list --left-right --count HEAD...@{upstream}` in the folder of the space's first terminal (else the space's folder), on its machine. Absent at zero, without an upstream, or outside a repository. |
| Map | A window onto [the map](#the-map), 74 px tall, over this space's belt. At full strength for the shown space and the one under the pointer, else dimmed. |
| Tab title | The tab's name in capitals, or `TAB NN` when nobody named it, with its grid reference at the right; greyer when none of its panes is lit. One too long fades out at the right and runs as ticker tape under the pointer. A left click does nothing; a right click opens Herdr's own tab menu at the pointer (Rename, New tab, Close), the one its tab bar opens. |
| Panes | Each of the tab's panes, as below. |

A pane is two rows; click it to focus the pane (`pane.focus`).

```text
⠇ WRK  Building Industrial-OS si…  ⚑ 4M
       02AU ⠋⠙                      35%
```

| Row | Shows |
| --- | --- |
| 1 | The state mark and code; the pane's name (the terminal's title, else the program's name, else the mod's); the `/flag` flag; the age, as one unit in capitals (`4S`, `12M`, `3H`, `2D`): for a Pi, since its working phase began, since work finished unseen, else since the root agent last settled; for another agent, since its tab began working or last changed. Absent when unknown. |
| 2 | For a Pi: units `NNAU` (grey `00AU` at zero and `??AU` unknown, acid above zero) with one spinning icon per unit up to 12 and `+N` beyond, and context used at the right (`35%`, `--%` unknown; yellow from 70%, red from 90%, acid below that while the pane is lit, else grey). Otherwise what the pane is. |

The focused pane (the one with the keyboard) has an acid bar in the gutter, two rows tall at most however far the pane opens, lit like a lamp: a soft bloom of its colour that pulses slowly, glass and a dot grid that thins out to the right, and the dots near the pointer come up a little. A focused Pi opens instead of showing row 2, so nothing is shown twice:

```text
⠇ WRK  Building Industrial-OS si…  ⚑ 4M
  ACT  feat/herdr-sidebar-rail*     #85
  MDL  opus-5.5 hi               CMP 01
  GOAL 12M
  02AU ⠋⠙
  CTX  ━━━━━━━━──────────────────   35%
  ASK  approve the rollback plan? (+1)
```

| Line | Shows |
| --- | --- |
| `ACT` | The branch, with a yellow `*` when it has changes, exactly when status-bar's footer shows a branch (Git and GitHub known, HEAD on a branch); otherwise Active's directory as status-bar shows it. Then `#N` for an open PR or `#?` when the lookup is unavailable. |
| `MDL` | Short model (`claude-` dropped, a trailing `-N-N` as `-N.N`) and the short thinking level (`off`, `mn`, `lo`, `md`, `hi`, `xh`, `mx`; others verbatim); compactions `CMP NN` (`CMP ??` unknown) at the right. |
| `GOAL` | The goal's time in pi-goal's format in capitals (`12M`, `1H0M`), while there is one. |
| `NNAU` | The units line, when units are not zero. The count is the line's title. |
| `CTX` | Context used as a bar and a percent, in the zone's color; the bar is lit as the gutter bar is at about half its strength, without the pulse. |
| `ASK` / `BLK` | The pending question, or `waiting on approval`, at most three lines, in red. |

Under the pointer a pane is scanned. The scanner is one frame per list, faint acid glass with four corner marks whose light pulses: it fades in over 120 ms on the first pane the pointer reaches, then slides to each next one in 170 ms, changing height as it goes, and stays on the last pane until the pointer leaves the list. A white bar in the gutter waits for the scanner to settle on the pane, once its fade or slide is over; a pane the frame only passes over gets none. Then the bar grows from its middle to the pane's height in 130 ms, its light fading in with it, and its lamp pulses; and in place of the flag and age stands its readout: its designation and status as on the map, `DRD-A01-1 · ON TASK`, in the state's color and always lit. The readout types in from the right in seven steps over 150 ms, 60 ms after the pointer arrives, and its digits re-read, cycling until they settle left to right; its light comes once they hold still. Its map window swings to the pane and brackets it.

#### Agents view

Every pane in one fixed order: what is active first (`QNS`, `BLK`, `WRK`, `SUB`, `RUN`), then by urgency (blocked, done, working, idle), and within each of those a space's panes together under its name with their count. A space with panes at two levels is listed once at each. Rows are the missions view's, with the tab's name on row 2.

`agent.next` / `agent.prev` follow the shown view's order (`setAgentOrder`).

#### Quiet spaces

A space is quiet when it is not shown and has had no activity for 48 hours or more. Activity is: being shown; a change in its pane or agent count; any pane working or blocked, Pi `SUB`/`RUN` included; any Pi reporting units. A space first seen has no history and starts at now, never an inferred old age; a clock step backwards clamps to now. Activity is remembered per mod copy and forgotten 30 days after a space is gone. A quiet space's band starts shut.

#### The hide grip

A knurled band in the right gutter, half way down, whose ridges breathe. Under the pointer it grows open in 160 ms, from 9 × 46 px to 17 × 150 px, into an acid tab reading `‹‹‹ HIDE` whose chevrons march left, with the key bound to `industrial-os.fold` when there is one; its light comes on once it has grown. Click it, or press that key, to fold the sidebar to the rail.

### The map

One map for the whole workspace: a belt of land per space, a zone per tab, a unit per pane, drawn as dots on dark glass. Every window in the sidebar looks onto the same map.

- **Land.** A dot floor, contour lines, and wandering roads, the same every time for a given number of spaces and tabs.
- **Zones.** A dotted outline with its grid reference and tab name above and its status below: `HALTED` (every pane blocked, in red), `ACTIVE` (any working), `PENDING` (any needing the person) or `SECURE`.
- **Units.** A marker in the state's color with a tag: designation, status, and the pane's name. A working unit patrols a small loop and leaves a trail; its subagents are dots that sortie around it; a working or blocked unit pings.
- **Traffic.** Droids travel the roads, a flyer crosses now and then, and a contact ping opens near some zone every few seconds. These are ambience and carry no data.
- **Camera.** A space's window rests on the unit under the pointer, else the zone whose title is under the pointer, else the focused unit, else the unit that most needs a look. It swings to a new target.
- **Edge.** No frame: the map is drawn 10 px past its place and dissolves into the ground through a one-bit dither that shimmers.
- **Exposure.** On its dark board the map is a hologram: every drawing is added back over itself out of focus, once tight and once wide, so what is lit bleeds light and comes out brighter than it was drawn. The zone under the pointer, or the zone of the pane under it, goes from 74% to full strength at once and its light with it; the tag of the pane under the pointer prints its status on a lit plate, drawn weaker than text so that exposure lands it on the accent rather than burning it out, with its print lit along with it. A space's whole window brightens and dims in 200 ms as the pointer or the shown space moves to it or away. The plate's map is printed and is not exposed.

### Search hint

At the bottom, one line that is not a field: a square lens, `search spaces, agents, tabs` in grey, and the key bound to `mod.open:picker`. It says that search exists and which key opens it. Under the pointer the lens and the key plate turn acid, the words brighten and glass (`glass`) comes up behind the line. As the pointer arrives the line flickers once in hard steps over 168 ms: down to a fifth at 36 ms, back at 72 ms, down to 0.45 at 132 ms, back at 168 ms, with one pixel of `fringeRed` on its left end and of `fringeCyan` on its right while it runs. The rail's lens plate flickers the same way. A click opens Herdr's picker, as the key does.

### Rail

Folded (narrower than 160 px; 76 px on macOS so the window buttons fit), each block draws its rail form:

- **Top.** The paper carries `RUNNING` or `STANDBY`, the droid count as an acid plate with the Industrial OS mark, and, above zero, the panes that need the person as an orange `×` plate. Below it a `»` strip unfolds the sidebar; under the pointer acid fills it from the left in 170 ms and its chevrons run.
- **List.** One lamp per pane, grouped by space in the list's order: `█` lit for working, `×` blocked, `✓` done, `○` idle, `·` unknown, then the state code. The focused pane's lamp has the selected background. Click a lamp to focus its pane.
- **Bottom.** A lens button that opens the picker.

### Folding and unfolding

The hide grip, the rail's `»` strip and the `industrial-os.fold` key fold the sidebar to the rail and back, in motion. One runs at a time.

- **Folding.** Every row of the sidebar is cut away from its right end at its own moment within 370 ms: about one in five drops out at once, one in five flickers first, one in six goes slowly. Then the sidebar is the rail, and the rail's rows come in the same way, from the left.
- **Unfolding** is a power-on. A broken acid scan line runs from the rail's right edge to its left in 115 ms and the rail goes dark behind it; the sidebar opens; the line runs back to the right edge in 230 ms, uncovering the sidebar as it goes, and fades. Behind it the rows come in as they go out on folding: in no order, from the left, each at its own moment within 370 ms, about one in five at once, one in five after a flicker, one in six slowly.
- The scan line is light aliasing: long straight stretches alternate with bursts of short pieces that kink 2 px, thin, dim or flicker.

### Keys

A shortcut is the same plate everywhere: 11 px, weight 800, the drawn command sign, radius 2. The plates read the live bindings (`keys()`), so they show what is bound and nothing when unbound. `"<key>": "industrial-os.fold"` in keys.json folds and unfolds the sidebar; `industrial-os.storybook` opens the storybook, and `industrial-os.story-next` and `industrial-os.story-prev` turn its page.

### Storybook

A window, 900 × 760, that shows the sidebar's parts one at a time. It is for whoever changes the sidebar: every form a part can take is in view at once, without waiting for a pane to reach that state.

- **Header**: a paper strip, as the crate plate: `INDUSTRIAL-OS ® PARTS`, at the right the count of stories and `INVENTED DATA`, and `CLOSE` when it is a window. The window drags by it.
- **Index**, 190 px at the left: one line per story, the small pieces first (marks, text, light, key plate), then the blocks built from them. The shown one is white with the focused pane's acid gutter bar.
- **Page**: the part's name, one or two sentences on what it is, then its states as specimens that wrap across the page. A specimen is a grey label over the part on the sidebar's own ground, at the sidebar's width (300 px) unless the part is narrower (the rail's forms, 76 px).
- **States**: one for each form the part takes, among them unknown readings (`??AU`, `--%`), text too long to fit, and no key bound. A state "under the pointer" is drawn as if the pointer were there; a state with two forms changes between them every 1.6 s so its motion plays, and the readout types itself again every 3 s and rests in between. Only the ground's light follows the real pointer.
- **Data**: an invented window of six spaces. No pane, space or agent of yours is read, and a click on a specimen does nothing.
- Only the shown page's map, ground and readout run their clocks.

### Colors and readability

State colors are `theme()` names, so they follow the theme: `working`, `blocked`, `done`, and `foreground`, `dim`, `muted`, `input`, `selected` and `hover` for controls. Every other value, the paper, the map's inks, the list's greys, the ground and every opacity, is the design system's `SIDEBAR_COLORS` and `SIDEBAR_ALPHA`. Every state is readable without color: codes, marks, `*`, the flag, `??`, `--%` and `#?` carry it. Long names are cut with an ellipsis; a question wraps.

### Timing

- Herdr's live data redraws the sidebar when it changes. A clock checked once a second redraws only when a shown age would change (each second under a minute, then each minute, hour and day) or a quiet boundary passes.
- State marks step on a 110 ms clock that redraws the list only while a moving mark, a latch or the open grip is shown.
- The map and the ground's light draw 30 frames a second in their own nested views, and the readout steps every 30 ms in its own while it types, so their motion does not redraw the list.
- Pulses (the scanner's corners, both gutter bars' lamps, the grip's ridges) run 2.8 s there and back, between 30% and full; spinners step every 80 ms; ticker tape every 110 ms. These run natively without redrawing.
- Nothing stops while another app is in front: the map, the marks, the ground and the pulses keep moving. Only the ahead/behind lookups wait for the window.

### Deviations and limits

- A unit count is all Pi publishes about subagents, so every unit icon is a spinner; the mockup's per-subagent `?` and `✓` are not shown.
- herdr-app has no text shadow, blur, mask or pattern of its own, so halos, dot grids, the ground, the map's still parts and fades are SVG files the mod writes at run time and places under or over the text. Until a drawing is written (a moment after start, or after a new text appears) its place is empty.
- Ticker tape steps a whole character at a time. The dots of a pane's block near the pointer follow it in grid steps. Under the scanner a long name is cut with an ellipsis rather than fading under the readout. The scanner's readout belongs to the pane, not to the frame, so between two panes the frame is still on the last one while its readout is gone; the white bar waits until the frame has settled on the pane. After the list scrolls under a still pointer the frame stays where it was until the pointer moves.
- Folding and unfolding cover and uncover rows with ground; nothing is squeezed sideways or brightened as in the mockup, because herdr-app can move and resize an element but cannot scale or clip one. A row is one 18.5 px band of the sidebar, not one line of its content. The scan line's pieces flicker in place rather than being reshuffled.
- The mockup's search bar is a hint here, by the operator's choice: Herdr's picker accepts no text from another mod, so a field in the sidebar could only open it empty.
- Nothing in the sidebar has a tooltip, by the operator's choice. On the rail a pane's name is therefore not shown: its lamp has only the state code.
- The map's exposure is per drawing: a zone's light does not fall on a tag beside it.
- The rail's paper carries no map.
- Unseen-finished state and space activity are per mod copy and per screen.

## Pane plate

The approved sticky droid plate (mockup revision 7, `sticky-droid-plate-mockup/gen.mjs`, outside this repository): a 130 px header over every pane, six plate rows of 18.5 px (the terminal's cell height at font 14) and a 19 px strip, drawn cell for cell on the terminal's column grid by the design system's [unit plate](../../design-system/elements/unit-plate/README.md), [status strip](../../design-system/elements/status-strip/README.md) and [keycap bay](../../design-system/elements/action-label/README.md). No divider and no title row. The plate says who is in the pane; the strip says what it is doing. The plate itself never takes a state color.

### Units

| Unit | Picked when | Plate |
| --- | --- | --- |
| Droid | The pane's agent app is `pi`, or Herdr's program table names Pi | `DRD-` and the session ID's last four hex digits; `S/N` the first eight of its last twelve; the barcode seeded from its last eight (`sessionUnit`, shared with the droid header); `⟁ PI AGENT DROID`, `HALDENN DYNAMICS`, the acid peak. No usable `io.signals.v1` label: `DRD-????`, `S/N ????-????`, the barcode seeded from the terminal address |
| Agent | Any other agent: Herdr's table marks the program as one, or it reports an app | `AGT-` and the first word of the app it reports (`claude-code` → `CLAUDE`), else of the program name; plain `AGT` when the wordmark would not fit whole or a letter has no glyph. `DIR` and the folder, a barcode seeded from the terminal address, `EXTERNAL AGENT`; empty title slot, no peak |
| Terminal | Everything else | `TERM-` and the basename of the terminal's argv[0] (`/bin/zsh -l` → `ZSH`, a login shell's `-` dropped), else plain `TERM`. `DIR` and the folder, `BRANCH` and the branch uppercased (`--` without one); empty title slot, no barcode, no peak |

Every title block is 16 columns, W − 18 … W − 3, so blocks and bays line up across panes. W is the header's width over the terminal's cell width, measured in the app, and every cell sits at its column times that width, so the plate lines up with the terminal under it. Below 56 columns the plate has no title block (the design system's threshold). Over 256 columns the plate is composed 256 columns wide and its middle widened to the pane: the cells from two before the title block move to the right edge, and the gap repeats the plain ground before them, so the title block, barcode and bay still end on W − 3 (herdr-app stops a task after 500–700 ms, and a plate costs it about 1 ms a column).

**The peak keeps clear of Herdr's grip.** Herdr's drag grip, a pill 28 × 18 px (measured at 2x: 56 × 36 device px), appears over the pane's top centre when the pointer reaches the top edge, over the plate. The droid's peak therefore starts right of it: its left-most painted cell is the first column at least the pane's centre plus 14 px (half the grip) plus 2 whole cells, and it still ends three cells before the 16-column title block (the design system's `unitPlate` option `peakFrom`; the droid header in a plain terminal keeps its centred peak). Where both cannot hold there is no peak:

| Columns (W) | Peak |
| --- | --- |
| Under 56 | No title block and no peak |
| 56–79 | Title block, no peak |
| 80–83 | 1-cell stroke (80 columns: cells 44–59) |
| 84–87 | 2-cell stroke (84 columns: 46–63) |
| 88 and over | 3-cell stroke (99 columns: 54–73; 198: 103–122) |
| Over about 418 | No peak: right of the grip it would fall in the widened middle |

Each threshold is one column later when the header's leftover fraction of a cell puts the grip's edge past a column boundary (an 80-column header 8.4 px over 80 cells has no peak). The unpinned centred peak appeared from 72 columns.

### Strip

The strip packs its segments from column 2 with a 3-cell gap and at least 3 clear cells before the bay; when a segment would drop, 2 and 2, then 2 and 1, are tried first; then the lowest-priority segment drops and a clipped text ends in `…`.

| State | Strip |
| --- | --- |
| Pi idle | `esc steer`, `ctrl+c clear`, `/ commands`, `! bash`, dropped from the right as the pane narrows |
| Pi working | `■ <PHASE>` (`THINKING`, `WRITING`, `WAITING`, or the tool's name, `BASH`), the tool's target, the phase's elapsed `mm:ss`, `esc steer` |
| Pi needs you | A black-on-critical `▲ NEEDS YOU` chip and the question, cut with `…` |
| Pi done (Herdr's unseen-finished `done`) | `● DONE`, `SETTLED hh:mm` when the label has the settle time, then the hints after `esc` |
| Pi starting | On the terminal plate, `▶ STARTING pi`, for 3 s or until the label arrives |
| Pi, label missing or malformed | Herdr's own status stands: `■ WORKING` and `esc steer` while Herdr says it works, the `▲ NEEDS YOU` chip alone while it is blocked, else idle's hints; never a phase, question or clock the label does not give. Herdr's blocked shows even when the label says idle |
| Agent | `○ READY`, `■ WORKING` and the time since herdr-core's status change (`status_ms`, when the terminal record has it) or since the mod saw it start working, `▲ NEEDS YOU`, `● DONE` |
| Terminal | `○ READY`; `▶ RUNNING <command> hh:mm:ss`, the foreground command's full argv (one `hc get` per program change; the program's name until it answers) and the time since the mod saw it start; `○ READY  PI EXITED hh:mm` after Pi hands back to the shell, until the next command |

Only what the mod can read is shown. Work already under way when the mod first looks (a command running, an agent working, at install or app start) has no clock, since its start is unknown; a Pi already running is not STARTING. There is no exit status (so no PASSED or FAILED), no reason Pi ended, nothing from other agents beyond their Herdr status. Unknown never shows as zero: a missing time is left out, a missing identity is `DRD-????`, `AGT` or `TERM`.

### Lighting and keys

| Level | When | Look |
| --- | --- | --- |
| Lit | The pane has focus and the window is active | Aluminium plate, frosted strip, the bay on `structural` |
| Standby | The pointer is over an unfocused plate | Graphite at the standby level, lit frost, the bay on `decorative50` |
| Dark | Every other pane, and every pane while the window is inactive | Graphite, the strip on `surface`, the bay on `decorative50` |

Status lamps (`■`, `▶`, `●` and the `NEEDS YOU` chip) keep their lit inks on a dark plate; `READY` dims. The values are the design system's `GRAPHITE_GROUND`, `PLATE_LIGHTING` and `BAY_INKS`. The bay is the title block's 16 columns: `[|][-][^][x]` centred, 2 + 3 + 3 + 3 + 3 + 2, its two end cells part of the end keys' click areas; a hovered key is filled white, a pressed one acid. `[^]` becomes `[v]` while the pane is zoomed. There is no move key: Herdr's grip, top-centre on hover, moves panes.

### Pane plate motion

| Motion | When | Rate |
| --- | --- | --- |
| T2 bank switch | Focus moves, or the window activates or deactivates | A layer at the new lighting over the old, its four vertical banks fading in left to right, 30 ms apart, 40 ms each: 130 ms. A second change mid-switch stacks another layer over both, which fades in from whatever they show (at most three layers) |
| H1 standby | The pointer enters or leaves an unfocused plate | The same layer with all four banks at once: 90 ms in, 120 ms out |
| CRT boot | Pi starts in the pane (the plate becomes a droid) | The design system's `crtBoot` over the `DRD-????` plate and strip, seeded from the terminal address, about 1.5 s |
| K5 serial roll | At the boot's end when the session is known, or when the label lands later | The serial's hex digits roll every 40 ms and lock left to right 50 ms apart from 120 ms, the unit's four wordmark digits on the odd steps; the pre-session barcode until the last lock (470 ms) |
| Reveal | Pi or an agent hands back to the shell | The terminal plate wipes in from the left under the outgoing plate, each outgoing row narrowing to the right edge, rows 60 ms apart, 540 ms each: 900 ms |
| Latch | The strip's state changes within one unit | The design system's `latch` on the status cells, 150 ms |
| K4 registration ghost | The focused, idle plate while the window is active | Every 20–60 s (seeded per plate), the wordmark prints once one cell right in acid, then one cell left in the darker acid, 50 ms each |

T2, H1 and the reveal are Herdr-native: the copy draws each new layer once at its start (opacity 0, or the outgoing row at full width) and once at its end 20 ms later, and Herdr's `.transition("opacity" | "width", { duration, delay })` animates between them without the script; the copy wakes once more when it ends, to drop what is covered. The motions that change characters, which no native transition can, draw frames on a timer at their own step, only while one plays: the CRT boot, the latch and K4 every 50 ms, K5 every 40 ms. Otherwise no timer runs but one wake for the next change the plate makes by itself (a clock's second, STARTING's end, the next ghost). A K4 ghost that falls due while another motion plays waits for it to end. A copy that is not shown stops its timers after two redraws that do not happen, and starts what is due when it is shown again. There is no reduced-motion setting: the plate always animates.

### Deviations from the mockup

- **The reveal's front is continuous.** Each outgoing row narrows with a native width transition, so for its 540 ms the front can cut a cell; the design system's `reveal` steps a whole cell at a time.
- **The peak sits right of centre.** The mockup centres it; Herdr's grip covers the centre (see Units).
- **Herdr's status stands in for a missing label.** The mockup always has the label; without one, a working or blocked Pi shows Herdr's WORKING or NEEDS YOU rather than idle.
- **One spacing rule for every strip.** The mockup's hints try 3/3, 2/2 and 2/1 again after each dropped hint, while its other states pick the tightest spacing once and keep it after a drop. The status strip retries for every state, so a strip that dropped a segment returns to the 3-cell gap when it fits: a working, needs-you or running strip that had to drop shows a 3-cell gap where the mockup shows 2 (seen at 72, 60, 52 and 48 columns). Hints match the mockup at every width.
- **No invented times.** Work already under way when the mod first looks has no clock, and a Pi already running is not STARTING; the mockup always shows both.
- **Shapes, not glyphs.** The mockup sets the plate as text. The mod places every cell on the terminal's measured cell grid and draws block elements, light lines and the peak's Powerline triangles as shapes, as Herdr's terminal draws them, so the barcode's bars and the wordmark's pixels fill their cells and the peak needs no Nerd Font; the triangles' edges step one device pixel at a time. `⟁` is the mod's `mark.svg`.

## Pi Reloader

A window over the layout, 620 × 460 px, opened and closed with `mod.open:industrial-os` (the [keys snippet](../keys/pi-reloader.json) binds `cmd-alt-r`). It stays open while panes and tabs change underneath; only a layout switch closes it. Like the sidebar it is plain text in theme colors; its visual design is deferred.

From top to bottom:

- **Title** `Pi Reloader`, with `↑↓ Enter · Esc` on the right, or `running`.
- **Actions**: `Reload all Pi` and `Reset all Pi`; `>` and the `selected` background mark the selected one. Under them one line says what it does: reload is Pi's own reload and skips drafts; reset quits each Pi and resumes its session in the same shell.
- **Last run**, after a run: `<action>: Success`, `Nothing to do` or `Completed with errors` (in `blocked`); one line of counts, `Reloaded: 1 · Skipped: 2 · Failed: 0` (`Restarted` for a reset); then one line per Pi acted on with its reason, such as `t2n skipped (unsent draft left untouched)` or, in `blocked`, `t2p failed: guard unavailable; …`.
- **Idle or done Pi (n)**: one line per candidate, in Herdr's agent order: address, `idle` or `done`, `guard` or `NO GUARD` (in `blocked`), space / tab, title. Then `Not acted on:` with the busy and protected Pi counts. A test copy adds `Test scope: only …` in `blocked`.

While a run is going the actions give way to one `working` line, `Reset all Pi 1/3`, which counts settled attempts. Focus never moves, so the person can keep working; keys and Esc in the window do nothing until the summary, which returns the keyboard to the window.

**States.** `Success` means at least one Pi completed and nothing failed; `Nothing to do` that nothing completed or failed. Reload is complete only when the new runtime's guard answers; restart only when the resumed Pi on the same session file answers, idle or done. A Pi keeps the idle or done it had: neither action runs a prompt, so Herdr's read state does not change.

**Keys and commands.** `↑`/`k`, `↓`/`j`, `Enter`, `Esc`/`q`; clicking an action runs it. `industrial-os.reloader-reload`, `industrial-os.reloader-reset` and `industrial-os.reloader-close` do the same from keys.json or `herdr-app do`, while the window is open.

## Theme

[themes/acid-black.json](../themes/acid-black.json) is the Herdr desktop app's
theme. It replaces the herdr-tui `theme.toml` fragment and keeps that theme's
roles where the desktop app has an equivalent: a black field, white focus and
buttons with black ink, and acid for work in progress. herdr-tui's
signal-orange chrome has no desktop counterpart and is dropped.
Color names are herdr-app's (`theme()` in `~/.config/herdr-app/herdr.d.ts`);
herdr-app derives any panel color a theme leaves unset, so the file sets every
name the shipped mods use.

| Name | Value | Role | What it colors |
| --- | --- | --- | --- |
| `background` | `#000000` | Field | Terminals and cards |
| `foreground` | `#ffffff` | Primary | Terminal text |
| `ansi` 0–15, `cursor`, `selection` | Terminal Basic Dark | `HERDR_TERMINAL` | Program colors, the terminal cursor and selection, as Ghostty showed them under herdr-tui |
| `canvas`, `chrome` | `#000000` | Field | Behind cards; sidebars and bars |
| `surface`, `popover`, `raised`, `selected` | `#1c1c1c` | Surface | Panels, menus, raised and selected rows (herdr-tui's `active_row_bg`) |
| `hover`, `border` | `#333333` | Ghost (signal color) | Hovered rows, borders and dividers |
| `input` | `#555555` | Structural | Input borders, a stronger border |
| `foreground` (panels), `muted`, `dim` | `#ffffff`, `#cfcfcf`, `#717171` | Primary, secondary, decorative | Panel text by emphasis |
| `accent`, `solid` | `#ffffff` | Primary | Focus, the primary button |
| `accent_foreground`, `solid_foreground` | `#000000` | Field | Ink on those controls |
| `working` | `#c0fe04` | Accent | Agents at work |
| `blocked` | `#f24723` | Critical | Agents that need the person |
| `done` | `#ffffff` | Primary | Finished while unseen |
| `idle`, `unknown` | `#717171` | Decorative | Quiet agents and unreported status |

These are the same state colors herdr-tui's agents sidebar used.

### Theme trade-offs

- `selected` and `raised` are both the surface, so hovering a selected row
  changes nothing; `hover` is the brighter ghost.
- Terminal selection keeps Terminal Basic Dark's blue rather than an Acid /
  Black role, so programs look as they did; panels use the same `selection`.
- `dim` `#717171` is 4.3:1 on black and 3.5:1 on the surface: it is for quiet
  secondary text, not for anything the person must read to act.

### Theme contrast

WCAG contrast ratios computed from the hex values, not measured on a display:

| Pair | Ratio |
| --- | --- |
| `dim` `#717171` on black / on `#1c1c1c` | 4.3:1 / 3.5:1 |
| White text on `selection` `#3f638a` | 6.2:1 |
| `blocked` `#f24723` on black | 5.7:1 |
| Black ink on acid `#c0fe04` | 17.4:1 |
| `border` `#333333` on black | 1.7:1, decorative only: edges and dividers |
