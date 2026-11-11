# Mission

Provide one truthful collection owner per interactive Pi session for Industrial OS displays, future in-session panels/dashboards and Herdr desktop mods. Git/PR, activity, background-task count, context reserve, compactions, goal, phase/question, the manual flag and reading configured usage belong here, not inside renderers. Public surface: the [snapshot contract](contract.md), its `io.signals.v1` herdr-core label, the display-only `set_active_project` tool and `/flag`.

Goals: push/coalesce changes, synchronously discover current state in either load order, preserve existing Active persistence and footer semantics, read usage only from the source-collector sources a user lists, and clean up all session work without stale publishes.

Non-goals: collecting provider usage itself (source-collector sources do), rendering, motion, Ponytail/Tatsu status observation, herdr-tui tokens or Herdr configuration, changing cwd/tool behavior, Git writes/authentication, a daemon/provider registry, or cross-session transport beyond the one herdr-core label. Consumers outside Pi read that label; a consumer it cannot serve is a daemon revisit condition.
