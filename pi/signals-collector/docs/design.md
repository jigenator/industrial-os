# Design

The collector has no terminal layout, colors or motion. Displays own presentation under the [root visual language](../../../docs/design.md). Signal names are plain technical labels; paths and bounded free-text targets/questions stay raw for each consumer to sanitize at its sink. No account identity or raw subprocess diagnostics enter quota state.

`set_active_project` is an agent declaration, not execution control. Its result names the full validated path in terminal-safe text and explicitly says cwd/tools/instructions/resources are unchanged. It preserves the existing schema/details and selected-branch restoration. See [the decision](decisions/agent-reported-active-workspace.md).

States are truthful: not inspected is null; unavailable is not clean/absent; AU/CMP/context/goal can be unknown. Root working is `!ctx.isIdle()`, independently of fleet count; `agent_end` is not settlement. The phase is null when idle. Questions persist until their matching tool completion or abandonment/settlement/session cleanup. Timestamps remain epoch milliseconds, with duration formatting in consumers. The [contract](contract.md) defines exact field meanings and compatibility limits.
