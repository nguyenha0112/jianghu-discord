# Workflow Rules

This file is the mandatory collaboration workflow for this repository.

## Core Rules

1. Every meaningful change must follow: `test -> commit -> push`.
2. Never keep important changes only on local for a long time.
3. Do not batch many unrelated changes into one late push.
4. After each completed work chunk, sync the repository immediately.

## Production Flow

Use this flow for production-grade work:

1. Create a working branch.
2. Implement the change.
3. Run relevant tests and verification.
4. Commit the change with a clear message.
5. Push the branch to remote.
6. Open a PR.
7. Review and only then merge into `main` or `master`.

Do not merge directly into the main branch for production flow.

## Personal / Direct Flow

If the owner explicitly wants direct updates on the main branch:

1. Implement the change.
2. Run relevant tests.
3. Commit immediately.
4. Push immediately.

Even in direct flow, do not delay sync for too long.

## Bot Project Rules

For this Discord game bot repository:

1. If gameplay logic changes, update or add tests when practical.
2. If user-visible rules change, update docs or progress tracking.
3. If runtime data files are changed, restart the bot before reporting the work complete.
4. If commands or slash command definitions change, re-register commands when needed.

## Communication Rules

1. Explain what is being changed before major edits.
2. Verify behavior before saying a feature is done.
3. If a workflow or git step is missed, correct it immediately.

## Non-Negotiable Reminder

The expected default working rhythm is:

`edit -> test -> commit -> push`

For production:

`branch -> test -> commit -> push -> PR -> merge`
