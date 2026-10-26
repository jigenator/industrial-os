# Notice row

`noticeRow({glyph='·',plate='',text='',detail=[],tone='neutral',plateFirst=false,glyphInk,plateStyle},{width,measure})` returns a headline plus zero or more supplied detail rows. Glyph is one curated structural glyph; tone is neutral/warning/critical. Optional plate uses the existing slab label; `plateStyle` can override its validated colors. `plateFirst:true` puts it before the glyph, and `glyphInk` independently selects a validated foreground. Headline defaults to decorative ink, or secondary for critical errors; measured rich text can supply further word-level styles. No guessed status, right-hand state column or command execution.

A simple notice is one clipped row. Detail is a list of text values; each wraps at complete graphemes, preserving every source character. Output row count is explicit in the returned array. A detail grapheme wider than the entire viewport throws RangeError rather than losing it or splitting it. The host owns vertical scrolling/budgets. Start-of-conversation markers compose the rule family's neatline rather than pretending to be messages. Command details instead use `{kind:'command',text,label:'SH'}`. They occupy one full-width surface band, with text at column 2 and a right-aligned structural ` SH ` label. Use `label:''` for continuation rows. **Hosts own splitting commands at safe boundaries**; this renderer never hard-wraps a path. An overlong row clips with a whole-grapheme ellipsis as a nonthrowing safety net. String details retain the existing lossless wrapping behavior. Command text and labels both accept measured slots.

```js
noticeRow({
  plate: 'LINK', plateFirst: true, glyph: '⠋', glyphInk: 'accent',
  plateStyle: { fg: 'field', bg: SURFACE_PALETTE.plateGrey }, text: 'connecting',
}, { width: 66 });
noticeRow({ plate: 'LINK', plateFirst: true, tone: 'critical', glyph: '■', text: 'not running', detail: [
  { kind: 'command', text: '$ cd synthetic-project', label: 'SH' },
  { kind: 'command', text: '  service && bun run src/main.ts', label: '' },
]}, { width: 66 });
```

Spinner/state words are supplied; motions and clocks are separate.

## Text, errors and checks

Block budgets are integer width (and height when supplied) 1–1000; inline budgets are 0–1000 or Infinity unless stated otherwise. Text slots use the [foundation measured-text contract](../../foundation/README.md#measured-text-slots): supply `measure` for Unicode or rich slots; otherwise strings retain ASCII sanitizing. Output spans are new; inputs are not mutated. Backgrounds are transparent except explicitly filled plates/keycaps. Plain painting preserves geometry and state words. Invalid types throw TypeError; invalid ranges/enums throw RangeError. Structural glyphs require one-cell terminal rendering.

Run the colocated `*.test.mjs` with `node --test`, then the [full validation sequence](../../CONTRIBUTING.md#full-validation-sequence). The storybook uses actual public calls with synthetic fixtures. Unit checks are not native appearance, input or image-alpha certification.
