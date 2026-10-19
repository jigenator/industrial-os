# Design

A recap restores orientation rather than becoming a status dashboard: high-level task first, then a concrete result and next step/blocker. Detailed mode instead asks for headed/bulleted history grounded in the current branch. Both are generated model text, not an authoritative audit.

Within the [shared terminal language](../../../docs/design.md), this extension uses Pi's theme `accent` for a bold `✦ recap` heading and `dim` for the body; drafting uses `✦ drafting recap…` in status. It has no custom animation, Acid / Black role mapping or design-system import. Text carries state independently of color, but contrast/glyph fidelity in Herdr has not been qualified.

## Display lifetime

This is **keep onscreen only**, not saved history: all kept rows disappear on compaction or display rebuild (including some `/settings` changes), reload, shutdown, session replacement, or branch navigation. There is no restoration from disk. Pi 1.0’s verified private layout is used only to append to its chat container; if that layout no longer matches, the extension warns and falls back to temporary display rather than pinning or persisting the text.

By default a regular-mode recap is an above-editor widget. Fullscreen mode adds temporary wrapped transcript content with an invisible disposal-owner widget below the editor. Input or new agent/turn work clears temporary display. Keep On instead appends ordinary chronological rows to the admitted chat container in either mode. Pi `Text` owns wrapping at narrow/resized widths; detailed output preserves newlines and brief output collapses whitespace. Existing kept rows use the current theme on render.

## Commands and states

Pi's native keyboard selectors handle model and keep choice; Escape cancels without saving or inference. Native argument autocomplete exposes the subcommands described in [commands](../README.md#commands). No agent tools or model-history messages are registered.

Only a complete, current response is shown. Errors notify with a safe reason; unsupported runtime-only APIs silently skip, and unavailable authentication does not reroute providers. A failed or cancelled draft never appears as partial success. Global settings dialogs and status are distinct from the main model's work.

## Focus and Herdr limits

The imported baseline used `@earendil-works/pi-*` **1.0.0**; current evidence is in [contributing](../CONTRIBUTING.md#verification-records). It uses Pi 1.0’s canonical `buildSessionProjection()`, final `agent_settled` boundary, `session_shutdown` cleanup, and `ctx.ui.onTerminalInput()` ownership rather than attaching its own stdin listener.

Herdr findings are deliberately separated:

- **Imported source evidence (not re-qualified during this move):** Herdr 0.9.3 corresponds to source commit `7b116c05bfda646af39d2524c54e70c751f57ee8`. Its [focus synchronization](https://github.com/herdrdev/herdr/blob/7b116c05bfda646af39d2524c54e70c751f57ee8/src/app/api.rs#L842) sends `CSI O` to the pane losing focus and `CSI I` to the pane gaining focus, but only when the pane application enabled DECSET `?1004`; its source includes pane-switch and outer-window-focus tests. Client-local navigation uses [separate focus reconciliation](https://github.com/herdrdev/herdr/blob/7b116c05bfda646af39d2524c54e70c751f57ee8/src/server/headless/client_views.rs#L420), so not every client movement implies a global pane transition. This extension enables that mode while its Pi session is active.
- **Not runtime-verified here:** no existing Herdr pane was focused, renamed, reloaded, reset, or otherwise touched, and no live pane-switch acceptance test was run. Multi-client/local-view focus semantics can differ from a single-client pane switch.
- **Fallback:** window focus and pane focus are different signals. If the active setup does not deliver reliable pane transitions, pass `--recap-disable-focus` so the explicit 120-second idle fallback remains authoritative.

The extension observes Pi-owned input and returns it unconsumed. Terminal focus reporting is not proof of a particular Herdr client/pane being visible. Real focus, resizing, appearance and accessibility need the separately authorized manual validation in [contributing](../CONTRIBUTING.md#full-validation-sequence).
