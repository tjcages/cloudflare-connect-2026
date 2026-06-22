---
name: lessons-keeper
description: Captures durable lessons from a completed task. Use near the end of a task to update docs or Cursor rules when reusable conventions, architecture notes, or agent behaviors were learned.
disable-model-invocation: true
---

# Lessons Keeper

Capture reusable lessons only. Do not commit, push, or create one-off notes.

## What To Capture

- Product architecture, data flow, extension recipes, or repo maps belong in `docs/ai-context.md`.
- Recurring agent behavior, coding standards, testing expectations, or file-specific guidance belong in `.cursor/rules/*.mdc`.
- Project-specific command or workflow guidance belongs in `.cursor/commands/` or `.cursor/skills/` only when it will be reused.

## What To Skip

- One-off implementation details
- Temporary decisions that only matter to the current task
- Duplicates of existing rules or docs
- Broad rewrites when a concise addition would work

## Rule Requirements

Rules must use `.mdc` files with valid frontmatter:

- `description`
- `alwaysApply: true` for universal behavior, or `globs` plus `alwaysApply: false` for scoped behavior

## Output

Report:

- Lessons captured
- Files updated or proposed
- Why the lesson is durable
- If no update is warranted, say so clearly
