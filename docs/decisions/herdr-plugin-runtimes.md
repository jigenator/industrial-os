# A Herdr plugin may own its runtime

Status: current. Date: 2026-10-14; approved by the maintainer when the whiteboard plugin was added. Supersedes, in part, the plugin group rule that every plugin is plain Node 22 with no build.

## Problem

The plugin group required plain Node 22 ES modules, the standard library only, and no build or dependency installation. That suited Spaces, a background daemon. The whiteboard is an interactive pane application built with ratatui in Rust, which needs Cargo and crates. Herdr runs any argv command and supports `[[build]]` commands during `plugin install` ([Herdr 0.9.3 plugin docs](https://raw.githubusercontent.com/herdrdev/herdr/v0.9.3/docs/next/website/src/content/docs/plugins.mdx)).

## Choice

Each Herdr plugin owns its language, runtime and dependencies, as every other project in the repository already does. Node 22 with the standard library and no build stays the default. A plugin that needs another runtime:

- declares its build in the manifest's `[[build]]` and documents the toolchain, because `plugin link` builds nothing and Herdr installs no toolchain;
- locks its dependencies (`Cargo.lock` for Rust) and builds with `--locked`;
- runs its checks with its own toolchain, listed in its contributing guide;
- still follows the group's rules on prompt hooks, socket-partitioned state, bounded diagnostics and no cross-project imports.

The design system is JavaScript, so a plugin in another language cannot import it. It mirrors the color values in one source file, and a Node test in the plugin imports the design-system package by name and compares the two. That keeps the design system as the owner of the colors with an automated check, rather than the manual comparison the [package decision](in-repo-design-system-package.md) left for unmigrated extensions.

## Alternatives

- **Port the whiteboard to Node 22 with the standard library.** It would keep the old rule, but means writing a terminal renderer and input parser that ratatui and crossterm already provide, and dropping the library the maintainer chose.
- **Keep the whiteboard outside the repository.** It would avoid the rule change, but leave it outside the shared visual language and its color check.
- **Ship prebuilt binaries.** No release process exists, and binaries per platform are a publication commitment no current need justifies.

## Consequences

Installing the whiteboard from GitHub needs a Rust toolchain, and developers need Cargo, Node and Python 3 for its checks. A color change in the design system makes the whiteboard's palette test fail until `palette.rs` is updated, in its own commit. The [plugin group guide](../../herdr-plugins/AGENTS.md) states the rule; the [whiteboard architecture](../../herdr-plugins/whiteboard/docs/architecture.md) records how it applies.

## Revisit when

The design system gains a language-neutral color export, a plugin in another runtime has to run where its toolchain cannot be installed, or prebuilt releases are wanted.
