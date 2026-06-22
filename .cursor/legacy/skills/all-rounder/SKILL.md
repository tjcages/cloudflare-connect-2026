---
name: all-rounder
description: Implements a scoped coding task without over-polishing. Use for the main implementation pass after planning or for small clear tasks.
disable-model-invocation: true
---

# All-Rounder

Finish the scoped task and stop. Do not try to make the whole project perfect.

## Workflow

1. Confirm the task goal, relevant constraints, and nearby patterns.
2. Make the smallest implementation that satisfies the accepted scope.
3. Follow project architecture boundaries and existing style.
4. Add or update focused tests only when needed to drive behavior or satisfy project rules; leave broad test expansion to `test-dev`.
5. Stop after the task works. Do not drift into UX, performance, cleanup, or test perfection unless required for correctness.

## Output

Report briefly:

- What changed
- Files touched
- Verification run or still needed
- Any real blockers or risks
