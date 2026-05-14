---
name: sum-up-and-commit
description: Clean up the current task, capture reusable lessons, then commit and push owned changes
---

# Sum Up And Commit

Use this when the user says the task is done and wants the current agent to clean up, document durable lessons, commit, and push.

## 1. Establish Ownership

- Inspect the working tree with `git status --short`, `git diff`, `git diff --cached`, and recent commits.
- Identify which files and hunks this agent introduced or intentionally owns in this task.
- Preserve unrelated user or other-agent changes. Do not revert, reformat, stage, or commit files outside the current task.
- If ownership is unclear, ask before editing or staging.

## 2. Clean Up Owned Changes

Review only owned changes for:

- Temporary debug logs, commented-out experiments, TODOs, dead branches, and unused imports/exports.
- Duplicate helpers, duplicated constants, or logic that should reuse an existing local helper.
- Test fixtures or tests that no longer match the final behavior.
- Docs or comments made stale by the final implementation.
- Generated artifacts, secrets, credentials, or environment files that should not be committed.

Make the smallest cleanup needed. Do not broaden the task into unrelated refactors.

## 3. Capture Reusable Lessons

If the user pointed out a durable project convention or a lesson future agents should reuse, update the right knowledge surface:

- Use `docs/ai-context.md` for product architecture, data flow, extension recipes, or repository maps.
- Use `.cursor/rules/*.mdc` for recurring agent behavior, coding standards, testing expectations, or file-specific rules.
- Keep new rules concise, actionable, and scoped with correct frontmatter.

Do not add docs or rules for one-off implementation details.

## 4. Verify

- For source changes, run fresh `npm run verify`.
- For docs/rules/command-only changes, verify frontmatter, paths, command names, and stale references.
- If verification fails, fix owned issues and rerun the failed stage plus the relevant final verification.
- Report any residual risk instead of claiming success from partial evidence.

## 5. Commit

- Stage only relevant owned files.
- Review staged diff with `git diff --cached`.
- Write a concise commit message that explains why the change exists.
- Do not skip hooks.
- Do not amend unless the current conversation created the previous commit, it has not been pushed, and amending is explicitly appropriate.

Use this commit form:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <summary>

<optional body>
EOF
)"
```

## 6. Push

- Check whether the branch tracks a remote.
- If it has an upstream, run `git push`.
- If it has no upstream, run `git push -u origin HEAD`.
- Never force-push unless the user explicitly asks in this invocation.

## 7. Final Summary

Tell the user:

- What was cleaned up.
- What docs or rules were updated, if any.
- What verification passed.
- The commit hash and push result.
