# reloader-guard

The Pi side of the Herdr desktop **Pi Reloader**: a small guard that lets the [Pi Reloader](../../herdr/README.md#pi-reloader), a window of the industrial-os Herdr mod, reload or quit this Pi only when it is idle, has nothing queued and its editor is empty. **Unsent drafts are never submitted, cleared or copied out of Pi**, and the guard never types into a terminal.

Status: contract version 2. Its checks and a live run with three throwaway Pis in Herdr desktop pass; see [verification records](CONTRIBUTING.md#verification-records).

## What it does

Only in Pi's interactive TUI inside a Herdr desktop terminal (`HC_TERMINAL_ID` set), it:

- listens on a loopback TCP port, with a fresh random token for every extension runtime;
- publishes the port and token as the herdr-core label `io.pi-reloader.v2` on its own terminal, with `hc label`;
- answers the mod's probes with `ready`, `draft` or `busy` and its session file, never the draft text;
- on a request carrying the right token and session, rechecks the editor and queue immediately before calling Pi's own `reload()` or `shutdown()`.

The wire protocol is [the contract](docs/contract.md). Outside Herdr desktop, or in print, JSON and RPC modes, it registers its internal command and does nothing else.

## Install

The guard does nothing without the [mod](../../herdr/README.md#pi-reloader); install both. Add its entry point to the industrial-os entry in Pi's `settings.json` (`~/.pi/agent/settings.json`), next to the extensions you already select:

```json
{
  "source": "git:github.com/jigenator/industrial-os",
  "extensions": ["pi/reloader-guard/src/extension.ts"]
}
```

Then run `pi update --extensions`. New Pi processes load it. **For each Pi already running, run `/reload` once while its editor is empty**; until then the mod reports it as having no guard and leaves it untouched. A Pi running an older guard counts as having none: the mod reads only the current label version. See [installing the Pi extensions](../README.md#install) for the package entry and filters.

## Privacy and limits

- The token sits in a herdr-core label, which every process of yours can read with `hc get` or `hc ls`, agent sessions included. Any such process can reload or quit an idle Pi with an empty editor. Other users cannot read your herdr-core labels.
- A session whose file Pi has not written yet (no entries) has nothing to resume, so the mod does not restart it.
- A crashed Pi leaves a stale label; the mod finds that its port does not answer and reports no guard.
- Pi on another machine is not handled: its loopback port is that machine's.

## Guides

[Agent guide](AGENTS.md) · [contributing](CONTRIBUTING.md) · [architecture](docs/architecture.md) · [contract](docs/contract.md) · [conventions](docs/conventions.md) · [design](docs/design.md) · [the decision](../../docs/decisions/pi-reloader-desktop.md)

## License

MIT; [LICENSE](LICENSE) keeps the copyright notice of the code this was adapted from.
