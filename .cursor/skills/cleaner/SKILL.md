---
name: cleaner
description: Cleans only owned changes before verification. Use after implementation to remove temporary code, dead branches, unnecessary abstractions, and stale comments without broad refactors.
disable-model-invocation: true
---

# Cleaner

Clean the completed task without expanding scope.

## Check Owned Changes Only

- Debug logs, commented-out experiments, stale TODOs
- Unused imports, exports, variables, and dead branches
- Duplicate helpers, constants, or logic that should reuse existing local code
- Overbuilt abstractions that do not reduce real complexity
- Tests, fixtures, docs, or comments made stale by the final behavior
- Generated artifacts, secrets, credentials, or environment files

Preserve unrelated user or other-agent changes.

## Output

Report:

- Cleanup performed
- Anything intentionally left alone
- Verification still needed
