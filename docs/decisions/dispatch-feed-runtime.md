# Dispatch feed uses Bun and plain TypeScript

Status: current. The dispatch-feed assignment explicitly chose the collector's
Bun/TypeScript/oxlint/oxfmt pins for this pane, under the [plugin runtime rule](herdr-plugin-runtimes.md).

## Choice

Bun 1.4.4 runs TypeScript directly. TypeScript 7.1.0-beta, @types/bun 1.3.5,
oxlint 1.89.0, oxlint-tsgolint 7.0.2004 and oxfmt 0.74.0 are pinned exactly in the
plugin manifest and its own Bun lockfile. No root dependency changes. The Herdr
manifest declares `bun install --frozen-lockfile`; link builds nothing. Root
`npm install` remains necessary to link the design system before running.

No Effect runtime: this consumer has one serialized polling path, a small bounded
socket client and a terminal loop, with no scheduler, database, service or scoped
process pipeline. Explicit cancellation/cleanup is smaller here. Node-compatible
net, child_process and terminal APIs run under Bun; Bun tests exercise the actual
runtime. The collector remains separate; its code is never imported.

## Alternatives and cost

Node 22 plus an emitted build would add a separate compile/distribution step and
conflict with the selected stack. Effect would add runtime weight and a second
service abstraction without simplifying the pane's current effects. A compiled
binary would add platform release packaging not needed by a local checkout.
Exact pins isolate the beta checker/tooling risk; upgrades need deliberate
validation. Development packages remain tooling only, not runtime imports.

## Evidence and revisit

The [plugin contributing guide](../../herdr-plugins/dispatch-feed/CONTRIBUTING.md)
records frozen install, checks and runtime tests. Bun's official
[Node compatibility](https://bun.sh/docs/runtime/nodejs-apis), Node 22.23's
[net API](https://nodejs.org/docs/v22.23.0/api/net.html), and Effect 4.0.6's
[wire serializer](https://unpkg.com/effect@4.0.6/src/rpc/RpcSerialization.ts)
were consulted. The serializer's Cause-array failure and omitted void result are
covered by the consumer's fake-socket checks. Herdr's versioned
[plugin contract](https://raw.githubusercontent.com/herdrdev/herdr/v0.9.5/docs/next/website/src/content/docs/plugins.mdx)
was checked for the installed host. No browser library or new runtime package
was added. Revisit if Bun cannot restore a supported host's terminal correctly,
the socket contract grows beyond bounded polling, or standalone distribution is
requested. No generalized runtime exception is granted to other projects.
