# Tab rule

`tabRule({tabCells=14,focused=false},{width})` returns one exact-width line: column 0 is blank, columns 1–14 are heavy `━`, then a `─` hairline to the edge. No ruler marks. Focus is acid; the host must also name focus outside the rule.

`tabRule({tabCells,focused,inks},{width,lead})` also takes separate `inks.tab` and `inks.rule` colors (an omitted one keeps its default) and `lead: false` to drop the blank first column, for board hosts such as the automations monitor: `tabRule({tabCells:3,inks:{tab:'primary',rule:BOARD_INKS.faint}},{width,lead:false})` is a readout rule, and `tabCells: 0` a plain hairline. Without `inks` and with the default lead, output is unchanged.

`verticalRule({ink},{height})` returns `height` one-cell lines of `│` in `ink` (default the rule ink), for a column divider.

`leader({glyph='┄'},{maxWidth=0})` repeats `┄` or `·` for exactly that budget (0–1000).

`neatline({label=''},{width,measure})` centers a supplied reference between ghost-ink dashed registration marks (the junctions retain rule ink). At tiny widths decoration yields.

`nameRule({plate='LUNALEE',label='',time='',meter=[],joins=[]},{width,measure})` centers a solid accent slab and readout on a thin rule. The group ends at the last plate, time, label or meter cell and starts at `floor((width − groupWidth)/2)`; one blank separates it from each rail, with any odd spare cell on the right. Working label yields before meter/name; time is optional and used only without working content. Tiny widths ultimately clip the name. `joins` are viewport columns receiving `┴` where not covered by the name/readout. `meter` is a caller-rendered structural line, validated as safe spans, not an ANSI string.

Animate only the structural tab with draw-in's opt-in style mode (`steps:6,lag:0`, tick defaults to 40 ms in style mode). Off is the whole focused rule; plain retains every rule glyph.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
