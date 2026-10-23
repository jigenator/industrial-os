#!/bin/sh
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
case "${1:-}" in
pane) exec bun "$root/bin/dispatch-feed.ts" ;;
open | open-tab)
  if [ "$1" = open ]; then
    exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin "${HERDR_PLUGIN_ID:-industrial-os.dispatch-feed}" --entrypoint feed --placement split --direction right --focus
  else
    exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin "${HERDR_PLUGIN_ID:-industrial-os.dispatch-feed}" --entrypoint feed --placement tab --focus
  fi ;;
*) echo 'usage: dispatch-feed.sh pane|open|open-tab' >&2; exit 2 ;;
esac
