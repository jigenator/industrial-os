#!/bin/sh
# Herdr entrypoints. Herdr runs plugin commands from the plugin directory.
#   pane:     run the monitor in this pane, or explain what is missing.
#   open:     open the monitor in a split to the right of the focused pane.
#   open-tab: open the monitor in a new tab.
#   restore:  the startup hook; after a server restart, start the monitor in the panes Herdr restored as shells.
# The open modes are actions, so each can be bound to a key. Any error stays on screen until Enter.
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
hold() {
  printf '%s\n\nPress Enter to close.' "$1"
  read -r _
  exit 1
}
case "${1:-}" in
pane)
  command -v bun >/dev/null 2>&1 || hold 'The automations monitor needs Bun on PATH. Install Bun 1.4.4, then reopen the pane.'
  [ -d "$root/node_modules/effect" ] || hold 'The automations monitor is not installed yet. In the plugin directory run
  bun install --frozen-lockfile
then reopen the pane.'
  bun "$root/bin/automations-monitor.ts"
  status=$?
  [ "$status" -eq 0 ] || hold "The automations monitor stopped (exit $status)."
  ;;
restore)
  # A hook has no screen: report to Herdr's plugin log and exit.
  command -v bun >/dev/null 2>&1 || { echo 'automations-monitor restore: Bun is not on PATH' >&2; exit 1; }
  [ -d "$root/node_modules/effect" ] || { echo 'automations-monitor restore: not installed (bun install --frozen-lockfile)' >&2; exit 1; }
  exec bun "$root/bin/restore.ts"
  ;;
open | open-tab)
  if [ "$1" = open ]; then placement="--placement split --direction right"; else placement="--placement tab"; fi
  # $placement is split into words on purpose.
  # shellcheck disable=SC2086
  exec "${HERDR_BIN_PATH:-herdr}" plugin pane open --plugin "${HERDR_PLUGIN_ID:-industrial-os.automations-monitor}" --entrypoint monitor $placement --focus
  ;;
*)
  echo "usage: automations-monitor.sh pane|open|open-tab|restore" >&2
  exit 2
  ;;
esac
