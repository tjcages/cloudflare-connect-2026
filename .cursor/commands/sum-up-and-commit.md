---
name: sum-up-and-commit
description: Clean up the current task, capture reusable lessons, then commit and push owned changes
---

# Sum Up And Commit

Use this when the user says the task is done and wants the current agent to clean up, document durable lessons, commit, and push.

## 0. Model Routing

Always run this command's cleanup, verification, commit, push, and worktree-finish workflow with Composer 2 Fast, regardless of the current chat model.

- If the current model is not Composer 2 Fast, immediately launch a subagent with `model: composer-2-fast` and delegate this entire command to it.
- The current model should only relay the final result from that Composer 2 Fast subagent, unless delegation fails.
- If delegation fails, stop and tell the user that Cursor command frontmatter does not currently provide a documented way to force a model for a slash command.

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

## 6. Finish The Branch

First check whether the current checkout is a secondary worktree with `git worktree list --porcelain`.

If this is a normal checkout:

- Check whether the branch tracks a remote.
- If it has an upstream, run `git push`.
- If it has no upstream, run `git push -u origin HEAD`.

If this is a secondary worktree:

- Record the current worktree path and branch name.
- Ensure the worktree is clean after the task commit.
- Move to the primary repository checkout and ensure `main` is clean.
- Update `main` with `git pull --ff-only`.
- Merge the worktree branch into `main`.
- Push `main`.
- Remove the secondary worktree with `git worktree remove <path>` after the merge and push succeed.

Never force-push or force-remove a worktree unless the user explicitly asks in this invocation.

## 7. Final Summary

Tell the user:

- What was cleaned up.
- What docs or rules were updated, if any.
- What verification passed.
- The commit hash, merge result when applicable, push result, and whether the worktree was removed.
