# reloader-guard

The Pi side of the Herdr desktop **Pi Reloader**: a small guard that lets the [Pi Reloader mod](../../herdr/README.md#pi-reloader) reload or quit this Pi only when it is idle, has nothing queued and its editor is empty. **Unsent drafts are never submitted, cleared or copied out of Pi**, and the guard never types into a terminal.

Status: first version. Its checks and a live run with three throwaway Pis in Herdr desktop pass; see [verification records](CONTRIBUTING.md#verification-records). It replaces the companion extension of the herdr-tui plugin [jigenator/herdr-pi-reloader](https://github.com/jigenator/herdr-pi-reloader), adapted for Herdr desktop.

## What it does

Only in Pi's interactive TUI inside a Herdr desktop terminal (`HC_TERMINAL_ID` set), it:

- listens on a loopback TCP port, with a fresh random token for every extension runtime;
- publishes the port, token and its process ids as the herdr-core label `io.pi-reloader.v1` on its own terminal, with `hc label`;
- answers the mod's probes with `ready`, `draft` or `busy` and its session file, never the draft text;
- on a request carrying the right token, terminal, process and session, rechecks the editor and queue immediately before calling Pi's own `reload()` or `shutdown()`.

The wire protocol is [the contract](docs/contract.md). Outside Herdr desktop, or in print, JSON and RPC modes, it registers its internal command and does nothing else.

## Install

The guard does nothing without the [mod](../../herdr/README.md#pi-reloader); install both. Add its entry point to the industrial-os entry in Pi's `settings.json` (`~/.pi/agent/settings.json`), next to the extensions you already select:

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/reloader-guard/src/extension.ts"]
}
```

Then run `pi update --extensions`. New Pi processes load it. **For each Pi already running, run `/reload` once while its editor is empty**; until then the mod reports it as having no guard and leaves it untouched. See [installing the Pi extensions](../README.md#install) for the package entry and filters.

The herdr-tui extension `herdr-pi-reloader.ts` can stay installed beside it: it does nothing without herdr-tui's `HERDR_SOCKET_PATH` and `HERDR_PANE_ID`, and its internal command has another name. Remove it once herdr-tui is retired.

## Privacy and limits

- The token sits in a herdr-core label, which every process of yours can read with `hc get` or `hc ls`. Any such process can reload or quit an idle Pi with an empty editor, the same trust as the herdr-tui guard's private Unix socket. Other users cannot read your herdr-core labels.
- A session whose file Pi has not written yet (no entries) has nothing to resume, so the mod does not restart it.
- A crashed Pi leaves a stale label; the mod finds that its port does not answer and reports no guard.
- Pi on another machine is not handled: its loopback port is that machine's.

## Guides

[Agent guide](AGENTS.md) · [contributing](CONTRIBUTING.md) · [architecture](docs/architecture.md) · [contract](docs/contract.md) · [conventions](docs/conventions.md) · [design](docs/design.md) · [the decision](../../docs/decisions/pi-reloader-desktop.md)

## License

MIT, from the herdr-tui plugin this is adapted from; see [LICENSE](LICENSE).
