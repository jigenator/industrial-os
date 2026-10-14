#!/bin/sh
# Herdr entrypoints. Herdr runs plugin commands from the plugin directory.
#   pane: run the board in this pane, or explain how to build it.
#   open: ask Herdr to open the board pane (an action, so it can be bound to a key).
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
case "${1:-}" in
pane)
  bin="$root/target/release/whiteboard"
  if [ ! -x "$bin" ]; then
    printf 'The whiteboard is not built yet. Run this, then reopen the pane:\n\n  cd %s && cargo build --release --locked\n\nPress Enter to close.' "$root"
    read -r _
    exit 1
  fi
  exec "$bin"
  ;;
open)
  exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin "${HERDR_PLUGIN_ID:-industrial-os.whiteboard}" --entrypoint board --focus
  ;;
*)
  echo "usage: whiteboard.sh pane|open" >&2
  exit 2
  ;;
esac
