---
name: test-dev
description: Adds focused tests for completed behavior. Use after implementation stabilizes or when behavior changes need coverage.
disable-model-invocation: true
---

# Test Dev

Write focused tests for the completed behavior.

## Workflow

1. Identify the behavior, edge cases, and existing test style.
2. Prefer the narrowest useful test level:
   - pure helpers and registries in focused unit tests
   - component interactions with Testing Library
   - integrated canvas/editor flows in `src/app/App.test.tsx`
3. Prefer roles, labels, and visible text over implementation details in React tests.
4. Do not test third-party libraries. Test this app's wiring and behavior.
5. Run the relevant test target, then rely on final `npm run verify` before completion.

## Output

Report:

- Tests added or updated
- Behavior covered
- Command run and result
- Remaining test gaps, if any
