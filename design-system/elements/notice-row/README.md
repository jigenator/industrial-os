# Notice row

`noticeRow({glyph='·',plate='',text='',detail=[],tone='neutral'},{width,measure})` returns a headline plus zero or more supplied detail rows. Glyph is one curated structural glyph; tone is neutral/warning/critical. Optional plate uses the existing slab label. No guessed status, right-hand state column or command execution.

A simple notice is one clipped row. Detail is a list of text values; each wraps at complete graphemes, preserving every source character (including copyable recovery commands). Output row count is explicit in the returned array. A detail grapheme wider than the entire viewport throws RangeError rather than losing it or splitting it. The host owns vertical scrolling/budgets. Start-of-conversation markers compose the rule family's neatline rather than pretending to be messages. Spinner/state words are supplied; motions and clocks are separate.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
