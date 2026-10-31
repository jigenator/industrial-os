# Provider usage comes from configured source-collector sources

Status: current. Date: 2026-10-31; approved. Supersedes the quota part of [session signals have one collection owner](session-signals-collection.md). Source and offline tests implement this decision; live engine, provider and interactive Pi/Herdr qualification are separate.

## Choice

Provider usage is collected by ordinary [source-collector](../../source-collector/README.md) sources, one per provider, in a private config. Each source's transform emits one `usage` item following the [usage item convention](../../pi/signals-collector/docs/contract.md#usage-item-convention). `pi/signals-collector` reads only the source ids listed in the Pi setting `industrialOs.usageSources`, with a scoped `get` over source-collector's socket, timed from each source's `nextAt` while its pane is visible, and maps them into the v1 `usage` field in that order. Its [state table](../../pi/signals-collector/docs/contract.md#state-table) is canonical. Displays render whatever usage columns arrive; nothing outside the private config and the documented convention names CodexBar or a provider.

## Why

- **Consumers choose.** A scoped `get` and dispatch-feed's include list let each client read only the sources it shows, instead of every client taking a fixed set.
- **CodexBar is machine-wide collection, which source-collector already owns.** The collector's own cache, directory watch and exclusive lock reimplemented scheduling, persistence and stale handling for one command. The engine already schedules commands, keeps last-known data as stale, bounds output and runs one owner per user.
- **New providers are configuration.** Kimi, Grok or another provider is a new private source, not a code change to a fixed provider union.

## Alternatives

- **Keep the CodexBar cache in the collector:** keeps a second machine-wide scheduler, lock protocol and accepted stale-taker race beside the engine, and a hard-coded provider list. Rejected.
- **Have status-bar read source-collector directly:** a renderer would own I/O and polling. Rejected; collection stays in the collector.
- **Configure the list outside Pi settings:** another configuration location for a per-user Pi display choice. Rejected; Pi 1.4.0's `getSettings()` keeps custom keys.

## Consequences and revisit

- The usage row is hidden when the engine is not running and has not answered this session; after an earlier answer the last data stays, marked failed. This trades the old standalone CodexBar call for one shared owner.
- Every visible configured Pi session polls on its own, timed from each source's `nextAt`. A scoped `get` watches only its selected sources, so while one is visible the usage sources run at `every` rather than `idleEvery` and other sources are unaffected.
- Usage items are ordinary engine items, so other clients see them unless scoped. Dispatch-feed should run with an include list.
- The snapshot stays v1: `provider` widens from a fixed union to a source id, with optional raw `tag` and `color`.
- The former cache file and lock are no longer used and may be deleted.

Revisit if a push transport or a consumer outside Pi needs usage in another shape; that is a source-collector contract change, not a collector cache.
