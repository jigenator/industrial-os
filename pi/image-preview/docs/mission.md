# Mission

## Users and problem

People who paste screenshots or drop image files into Pi end up with long temporary paths in the draft. They cannot see which image a path is, and the model gets text rather than the picture. A temporary clipboard file can also disappear before a later tool call opens it.

## Goals and non-goals

Goals:

- Turn image paths in the draft into short labels and show which image each label is, above the editor.
- Attach the images on submit, keeping a durable path to a session-local copy in the message text.
- Never lose typed text, a collapsed paste or the editor itself; anything unexpected leaves the path as typed.

Non-goals:

- Replacing Pi's editor, adding key bindings or changing how Pi pastes from the clipboard.
- Image editing, cropping, annotation or format conversion beyond the thumbnail.
- Cleaning up session image folders, or managing images outside the current draft and submission.
- Relative paths, URLs, or image types beyond PNG, JPEG, GIF and WebP.

## Constraints

Detection, preview and the submit rewrite run only in Pi's interactive TUI. Pi owns input, rendering and image normalization; the extension observes the draft by polling because Pi has no editor-change event for extensions. It must coexist with other extensions that replace the editor component, so it never replaces the editor itself.
