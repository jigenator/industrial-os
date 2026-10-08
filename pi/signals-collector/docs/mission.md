# Mission

Provide one truthful collection owner per interactive Pi session for Industrial OS displays and future in-session panels/dashboards. Git/PR, activity, context reserve, compactions, goal, phase/question and shared quota belong here, not inside renderers. Public surface: the [snapshot contract](contract.md) and display-only `set_active_project` tool.

Goals: push/coalesce changes, synchronously discover current state in either load order, preserve existing Active persistence and footer semantics, avoid duplicate machine-wide CodexBar rounds, and clean up all session work without stale publishes.

Non-goals: rendering, motion, Ponytail/Tatsu/background-task status observation, Herdr token/configuration work, changing cwd/tool behavior, Git writes/authentication, a daemon/provider registry, or speculative cross-session signal transport. A consumer outside Pi's in-process session is a daemon revisit condition.
