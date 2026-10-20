# Mission

## Users and problem

People who paste screenshots or drop image files into Pi see only a long path in the draft and cannot tell which image it is before sending.

## Goals and non-goals

Goals:

- Show which image each image path in the draft refers to, above the editor.
- Leave everything else to Pi: the draft, the submission and how images reach the model.

Non-goals:

- Changing the draft, labelling paths, attaching images, copying or caching files, or adding keys, commands or settings.
- Replacing Pi's editor or changing how Pi pastes from the clipboard.
- Relative paths, URLs, or image types beyond PNG, JPEG, GIF and WebP.

## Constraints

Runs only in Pi's interactive TUI. Pi owns input, rendering and images; the extension polls the draft because Pi has no editor-change event for extensions, and it must coexist with extensions that replace the editor component.
