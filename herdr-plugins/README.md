# Herdr plugins

Independent Herdr plugins for Industrial OS. Each owns its runtime, manifest,
checks and guides; shared rules are in [AGENTS.md](AGENTS.md).

| Plugin | Purpose | Runtime |
| --- | --- | --- |
| [Spaces](spaces/README.md) | Per-space counts, quiet ages and quiet-unit ordering | Node 22, standard library only |

## Install

Review the manifest and source first: plugins run as your user, with Herdr's
socket authority, not in a sandbox. With Node 22 on Herdr's PATH, an operator
can link a checkout:

```sh
herdr plugin link ./herdr-plugins/spaces
```

For a published revision, Herdr also supports
`herdr plugin install <owner>/<repo>/herdr-plugins/spaces --ref <revision>`.
This is an install description, not verification that a published revision
exists. Neither linking nor installing was executed during development.
Then merge the [Spaces fragment](../herdr/README.md#spaces) by hand.
