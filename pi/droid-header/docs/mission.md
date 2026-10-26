# Mission

## Users and problem

People who run several Pi agents, often side by side in Herdr panes, open a session and cannot tell at a glance which agent it is, where it runs, what it is assigned to, or what it has loaded. Pi's own startup shows its logo, generic hints and a long resource listing.

## Goals and non-goals

Goals:

- Identify the session at the top of the screen: a stable droid ID from the session, its model, Pi version, Herdr pane and sector, start time, and project and branch.
- Show what Pi's settings load, as a compact manifest of context files, skills, prompts and extensions, in place of Pi's listing.
- Do it in the Industrial OS visual language, with a short intro on a fresh session that never delays work.

Non-goals:

- Live status. The footer owns the live model, context and activity; the header records the session's start.
- Changing what Pi loads, installing packages, or adding commands, keys, settings or files.
- Values Pi does not report. Nothing is guessed or decorative-only where a reading is shown.

## Constraints

Runs only in Pi's interactive TUI, through Pi's public extension API and exports. Colors and numerals come from the design system. Pi owns rendering, input and the terminal; the header must fit every width and never take input.
