---
name: jianghu-project-workflow
description: Use when working in the Jianghu Discord bot repository or when the user asks for workflow discipline, git hygiene, frequent sync, production PR flow, or persistent project-specific collaboration rules. This skill enforces test-commit-push discipline, production branch-and-PR flow, and fast repository synchronization after each meaningful change.
---

# Jianghu Project Workflow

Use this skill whenever you are editing, reviewing, testing, or shipping changes in this project.

## Mandatory Git Rhythm

For every meaningful change:

1. Make the change.
2. Run the relevant verification.
3. Commit promptly.
4. Push promptly.

Do not let multiple completed work chunks sit locally without being pushed.

## Production Rule

For production-oriented work:

1. Create a working branch first.
2. Implement and verify the change.
3. Commit the change.
4. Push the branch.
5. Open a PR.
6. Merge only after review/approval.

Never skip the PR step for production flow.

## Direct Main-Branch Rule

If the user explicitly wants direct updates on the main branch:

1. Still verify the change.
2. Commit after each meaningful completed chunk.
3. Push immediately after the commit.

Do not postpone git sync.

## Bot-Specific Discipline

When changing this Discord bot:

1. If gameplay logic changes, run the closest available game test.
2. If runtime behavior changes, restart the local bot before claiming it is active.
3. If slash commands change, re-register them when needed.
4. If user-facing rules change, update progress/docs when relevant.

## Reporting Style

When closing work:

1. State what changed.
2. State what was verified.
3. State whether it was committed and pushed.

If commit/push did not happen yet, do not present the work as fully synced.
