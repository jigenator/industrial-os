# Engineering conventions

The [root conventions](../../../docs/conventions.md) and [plugin group rules](../../AGENTS.md) apply.

## Rules

- Rust 2024 edition, built with `cargo build --release --locked`. Commit `Cargo.lock` with `Cargo.toml`. Add a crate only for a current need, and check its documentation for the locked version.
- `cargo clippy --all-targets` has no warnings.
- Colors are the `palette.rs` constants, mirroring design-system roles and signal colors; [design](design.md#layout-and-color) owns the swatch and ink mapping. Never write a `Color` value or a named terminal color anywhere else; the palette test rejects it.
- Clipboard requests are raw UTF-8 text in the App outbox. Only `main.rs` emits OSC 52 and runs the best-effort clipboard subprocess; spawn, pipe writes, timed wait/kill and reaping stay off the input/render thread. Use `std::process`, no clipboard crate. Tests inject fake commands and must never write to the real clipboard; the override contract is in [README](../README.md#clipboard).
- Keep `ui.rs` free of I/O and of state changes other than the hit regions it records. `App` is tested with synthetic crossterm events and a fixed canvas; `ui.rs` with ratatui's `TestBackend`.
- Board files are untrusted input: parse failures are errors, and missing fields use defaults. Changing the JSON shape needs a default for every new field so existing boards still load.
- Tests that write files use the temporary directory and remove what they create.
- Measure text in cells with `unicode-width`, never in bytes or characters.

## Known gaps

No license has been selected, no Windows support and no CI. The PTY check needs Python 3, which macOS and most Linux systems provide; no Python package is installed. `unicode-width` is not a terminal-width oracle. No latency or load measurement exists.
