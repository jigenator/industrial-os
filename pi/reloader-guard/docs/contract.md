# Guard contract

Status: current, version 2. This is the canonical wire protocol between the guard (`src/extension.ts`) and its one client, the Herdr desktop [Pi Reloader mod](../../../herdr/mods/pi-reloader/reloader.js). Change it here first, then both sides and their tests together. Version 2 removed `pid`, `ppid` and `terminal` from the label and the wire; version 1 labels and requests are refused.

## The label

Only in Pi's interactive TUI, and only when `HC_TERMINAL_ID` is a non-empty string, the guard listens on `127.0.0.1` at a port the system picks, then sets one herdr-core label on its own terminal:

```sh
hc label "$HC_TERMINAL_ID" 'io.pi-reloader.v2={"v":2,"port":53494,"token":"<32 hex>"}'
```

| Field | Meaning |
| --- | --- |
| `v` | `2` |
| `port` | The loopback TCP port this runtime listens on |
| `token` | 16 random bytes in lowercase hex, new for every extension runtime (startup, reload, session switch). Every request must carry it |

A reload or session switch publishes a new label from the next runtime, with a new port and token. Only a quit clears the label (`io.pi-reloader.v2=`). A crashed Pi leaves its label behind; its port no longer answers, which a client must treat as no guard.

A client accepts a label only on a live terminal whose herdr-core status is Pi's own report (`status.app` is `pi`).

## Requests and replies

One connection carries one request: a single JSON line of at most 4096 bytes, and one JSON line back, then the guard closes. A connection idle for 3 seconds is closed.

```json
{"v":2,"token":"<label token>","action":"probe","session":null}
```

| Field | Rule |
| --- | --- |
| `token` | Must equal this runtime's token |
| `action` | `probe`, `reload` or `quit` |
| `session` | For `reload` and `quit`, must equal the session file the last probe returned (`null` included); ignored for `probe` |

```json
{"v":2,"session":"/…/sessions/2026-…jsonl","status":"ready"}
```

| `status` | Meaning |
| --- | --- |
| `ready` | Idle, nothing queued, the editor is empty |
| `draft` | The editor holds text, whitespace included. The text is never sent |
| `busy` | Working, messages queued, another request pending or the runtime shutting down |
| `accepted` | Only for `reload` or `quit`: the action is starting. It is not completion |
| `error` | `error` says why; nothing was done |

`session` is the absolute session file only once Pi has written it; a session with no entries yet has `null`, so there is nothing to resume.

## Acting

For `reload` and `quit` the guard first answers any status other than `ready` without acting. When ready, it dispatches its internal command `pi-reloader-guard-control` with a one-time value through `pi.sendUserMessage(…, { expandPromptTemplates: true })`, which runs the command without entering the editor. The command checks the token, the session and the state once more, replies `accepted`, and then calls Pi's `ctx.reload()` or `ctx.shutdown()` with no await in between. If the command text ever arrives as ordinary input, the guard swallows it.

A client must verify every accepted action:

- **Reload:** the terminal's label shows a different token, and a probe with the new token answers.
- **Quit:** herdr-core shows the root shell back in front (`foreground.pid` is the terminal's `pid`) with no agent status.

Nothing in the protocol types into a terminal. A missing, stale or unresponsive guard is a failure, never a reason to fall back to terminal input.
