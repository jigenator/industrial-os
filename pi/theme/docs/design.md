# Design

The theme puts Pi's own interface in the [shared language](../../../docs/design.md): a quiet, mostly greyscale instrument on the black field, where acid marks the few things that matter and warning and critical keep their meaning. Every value is a design-system color; the variable named in each row is its design-system key.

## What each part of Pi gets

| Part of Pi | Tokens | Color |
| --- | --- | --- |
| Text, supporting text, faint text | `text`, `muted`, `dim` | `primary` white, `secondary` `#cfcfcf`, `decorative` `#717171` |
| Editor border | `thinkingOff` … `thinkingMax` | `bone` `#e2dccb` at every level |
| Editor border in bash mode | `bashMode` | `accent` acid |
| Highlights: selected item, cursor, success, keywords, added lines, accent borders | `accent`, `success`, `syntaxKeyword`, `toolDiffAdded`, `borderAccent` | `accent` acid |
| Borders | `border`, `borderMuted` | `decorative`, `structural` `#555555` |
| Your messages, tool boxes, custom messages | `userMessageBg`, `toolPendingBg`, `toolSuccessBg`, `customMessageBg` | `surface` `#1c1c1c` |
| A failed tool | `toolErrorBg` | `critical25` `#3c1209`, with `critical` error text |
| Selected rows, search matches, scrollbar track | `selectedBg`, `searchMatchBg`, `scrollbarTrack` | `ghost` `#333333` |
| Thinking text, strings | `thinkingText`, `syntaxString` | `checkPeak` `#9c9c9c` |
| Warnings, errors, removed lines | `warning`, `error`, `toolDiffRemoved` | `warning` `#d79e52`, `critical` `#f24723` |
| Markdown | `md*` | Headings and links white, code `secondary`, rules and fences `structural`, bullets and link URLs `decorative` |
| HTML export | `export` | Page `field`, cards `surface`, info `ghost` |

Bone is the theme's one [Pi chrome color](../../../design-system/foundation/README.md#pi-chrome-colors): a warm off-white inspired by Marathon's interface, not a published Marathon brand color. Because the border is bone at every thinking level, the border no longer shows the level; the footer does. A state is never carried by color alone: Pi's tool boxes, errors and warnings keep their text.

## Contrast

WCAG contrast ratios of the theme's text colors on the backgrounds they appear on, computed from the sRGB values:

| Text | Field | Surface | Ghost | Critical 25 |
| --- | --- | --- | --- | --- |
| `primary` | 21.00 | 17.04 | 12.63 | 16.37 |
| `bone` | 15.33 | 12.44 | 9.23 | 11.95 |
| `secondary` | 13.48 | 10.94 | 8.11 | 10.51 |
| `accent` | 17.42 | 14.14 | 10.48 | 13.58 |
| `warning` | 8.90 | 7.22 | 5.36 | 6.94 |
| `checkPeak` | 7.65 | 6.21 | 4.60 | 5.96 |
| `critical` | 5.70 | 4.63 | 3.43 | 4.44 |
| `decorative` | 4.30 | 3.49 | 2.59 | 3.35 |

`decorative` is below 4.5:1 everywhere, and it is used for faint text: `dim` hints, comments, code operators and punctuation, diff context in tool boxes, link URLs, list bullets, the quote border and the scrollbar thumb. That follows the root rule's allowance only because it is nonessential detail, which was the approved look; essential text uses `secondary` or brighter. `structural` (2.82:1 on the field) is used only for rules, fences and the muted border. These are computed ratios, not a contrast certification of a terminal's rendering.
