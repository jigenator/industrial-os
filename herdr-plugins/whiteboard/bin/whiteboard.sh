#!/bin/sh
# Herdr entrypoints. Herdr runs plugin commands from the plugin directory.
#   pane:     run the board in this pane, or explain how to build it.
#   open:     open the board in a split to the right of the focused pane.
#   open-tab: open the board in a new tab.
# The open modes are actions, so each can be bound to a key.
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
open | open-tab)
  if [ "$1" = open ]; then placement="--placement split --direction right"; else placement="--placement tab"; fi
  # $placement is split into words on purpose.
  # shellcheck disable=SC2086
  exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin "${HERDR_PLUGIN_ID:-industrial-os.whiteboard}" --entrypoint board $placement --focus
  ;;
*)
  echo "usage: whiteboard.sh pane|open|open-tab" >&2
  exit 2
  ;;
esac
