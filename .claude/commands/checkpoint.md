---
description: Record progress after a step — update TASKS.md and DECISIONS.md, run checks, and commit
---

We just finished a step. Do the following, in order:

1. Run the checks that apply to what changed: `npm test` and `npx tsc --noEmit` in `api/`, `npm run build` in `web/`. If anything fails, stop, show me the error, and do not commit.
2. In `docs/TASKS.md`: tick the completed items and append one line to the Log table: time, step id, what was done, and any issues or shortcuts taken.
3. In `docs/DECISIONS.md`: add an entry for any new design decision made in this step (use the file's format). If none, skip.
4. Show me `git status` and a short summary of the diff.
5. Stage everything except `.env` files and commit with a conventional message (`feat:`, `fix:`, `chore:`, `docs:`) describing the step. Do not push unless I ask.
6. Tell me the next step from `docs/PROMPTS.md` and how much of the time budget in `docs/TASKS.md` is left.

$ARGUMENTS
