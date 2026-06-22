---
name: orchestrate
description: Run one lightweight task through planning, implementation, specialist checks, verification, and lesson capture
---

# Orchestrate

This command is optional shorthand. The global `agent-orchestration` rule applies the same workflow automatically to normal coding tasks.

Use this when you want to explicitly remind the chat to run one task through the lightweight orchestration flow. Keep orchestration lightweight: no central manager, no duplicate tracker, and no worktrees unless the user explicitly asks or the task clearly needs isolation.

## 1. Classify The Task

Decide the route before editing:

- **Small clear task**: inspect relevant rules/docs and nearby code, then implement directly.
- **Standard task**: do a short plan in chat, then implement.
- **Complex, ambiguous, risky, user-facing, performance-sensitive, or library/API-dependent task**: invoke the `planner` skill before implementation.

Ask a clarifying question only when the answer changes the implementation.

## 2. Research Expectations

- Always check relevant project rules, `docs/ai-context.md` for broad changes, and nearby source/tests before acting.
- Use Context7 for current library/framework/API docs when a task depends on external APIs.
- Use web search when current product behavior, ecosystem changes, or non-code facts matter.
- Keep research summaries short and cite what was checked.

## 3. Model Routing

The current task chat is the coordinator and may use the user's preferred strong model.

When the chat model is Composer 2.5 Fast, follow the **maximum reasoning mode** section in `agent-orchestration.mdc` (deep thinking overrides lightweight defaults).

When spawning subagents, default routine work to `composer-2-fast`:

- implementation follow-ups with `all-rounder`
- readability/extensibility refactors with `refactorer`
- cleanup with `cleaner`
- straightforward test work with `test-dev`
- checklist-style UX/perf reviews when the scope is narrow

Keep subtle planning, hard debugging, architecture decisions, and failed cheaper-agent attempts in the current strong chat unless the user asks otherwise.

## 4. Role Order

Use only the roles that add value for the task:

1. `planner` when the task is not obvious.
2. `all-rounder` for focused implementation.
3. `refactorer` when working code needs readability, maintainability, or extensibility improvement.
4. `ux-controller` only for user-facing workflow or power-user interaction changes.
5. `perf-controller` only for performance-sensitive code, rendering, loops, caching, large data, or bundle/runtime concerns.
6. `cleaner` for owned-change cleanup before final verification.
7. `test-dev` for focused tests once behavior is stable.
8. `lessons-keeper` to capture durable project lessons, not one-off notes.

Do not run a role just to be thorough.

## 5. Git And Worktrees

- Do not create worktrees, manage duplicate tasks, or run merge-awareness checks by default.
- Use worktrees only when the user asks or when there is clear parallel/conflicting work.
- Preserve unrelated user changes. Stage/commit only when the user explicitly asks through another command.

## 6. Completion

- For source changes, run fresh `pnpm verify` before claiming completion.
- For docs/rules/command-only changes, verify frontmatter, paths, command names, and stale references.
- Report what changed, what was verified, and any residual risk.
