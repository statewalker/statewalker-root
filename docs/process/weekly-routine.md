# The weekly routine

One scheduled cloud routine in this repository runs the review's weekly work: it plans and starts
the health reviews ([health-review.md](health-review.md)), escalates old deferred bugs, posts the
review metrics ([review-metrics.md](review-metrics.md)), and proposes rubric examples. Its record
is the pinned [**Review health**](https://github.com/statewalker/statewalker-root/issues/36) issue.
Decided in [When does a health review run, and who starts it?](https://github.com/statewalker/statewalker-root/issues/8)
and [What do we measure?](https://github.com/statewalker/statewalker-root/issues/13).

## Schedule and control

- **Scheduled task** "Weekly review health", on the human's claude.ai account: **every Monday at
  04:57 UTC** (`57 4 * * 1`). Each firing wakes one long-lived **host session**, "Weekly review
  health (routine host)", started with `statewalker/statewalker-root` as its source, which pulls
  root's `main` and follows the steps below.
- Why a host session: a session that a scheduled task starts from nothing has no repository and no
  `add_repo` tool, so every GitHub call fails (the first run did). A session started with a source
  repository has `add_repo` and `create_session`. If the host session is archived, first try
  `unarchive_session` on it. Otherwise start a new session with root as its source, then **delete**
  the old scheduled task (`delete_trigger`; `update_trigger` cannot change the target) and create a
  new one with the same name, schedule and prompt, targeting the new session
  (`persistent_session_id`). Never leave two "Weekly review health" tasks enabled: two runs at once
  could both plan the week.
- **Pause** it in claude.ai's scheduled tasks (Claude Code, scheduled tasks: disable "Weekly review
  health"), or ask a session to disable it (`update_trigger` with `enabled: false`). Enable it the
  same way. **Run it now** with "Run now" there, or `fire_trigger`.
- Runs are **idempotent within a week**, through two markers on #36:
  - the plan comment ends with `<!-- review-health: week=<ISO week> -->`; once it is there, the
    dispatcher plans nothing (`alreadyPlanned`), so a rerun creates no tickets and starts no
    sessions;
  - the metrics comment ends with `<!-- review-metrics: week=<ISO week> -->`; once it is there, a
    rerun skips the metrics and the rubric pull request.

  A rerun therefore redoes only what failed. A run that fails before posting the plan leaves its
  new record tickets open and unclaimed: the next run resumes them instead of opening others, and
  escalations and threshold tickets are duplicate-checked.
- The tools call the GitHub API for every project, which needs the repository attached **with push
  access** (read access serves only git). A project the session cannot attach is listed as skipped
  in the plan and the metrics; if every project but root is skipped, the run has failed (step 1).

## Steps

The routine's prompt points here; a session following it does exactly this, in this order:

1. **Get root and the projects.** In the host session's existing root checkout (clone it only if
   there is none): `git fetch origin main && git switch main && git merge --ff-only origin/main`
   (if `main` has diverged, `git switch --detach origin/main`), and delete last week's `plan.md`
   and `plan.json`. Attach `statewalker/statewalker-root` and every project in its `repos.json`
   with `add_repo` and **`access: "push"`** (the tools' API calls, the tickets, the comments and
   the pull request need it). There is no ticket to claim. If no project besides root could be attached, post that on #36 (no marker)
   and stop: a plan over root alone is not this routine's job.
2. **Plan and file.** `node tools/health-dispatch.mjs --create --json --md plan.md > plan.json`.
   It files the week's record tickets and escalations, and writes the plan as JSON (stdout) and as
   Markdown (`plan.md`, ending with the week marker). If `alreadyPlanned` is true, this week's plan
   is already posted: go to step 5.
3. **Start the sessions.** For every `review` entry with `action: "resume"` and `start: true`,
   and every entry with `action: "create"` (its new ticket number is `created`), create one fresh
   cloud session (`create_session`, source `https://github.com/statewalker/statewalker-root`, title
   `Health review: <project>`) with the prompt `Work on statewalker-root#<N>.` Note each session's
   link.
4. **Post the plan** as one comment on #36: `plan.md` with a "Sessions" list (project, ticket,
   session link) inserted above its last line, the week marker, which must stay last. This
   comment is the week's index line and its guard.
5. **Post the metrics.** If a comment on #36 already holds this week's metrics marker
   (`gh api 'repos/statewalker/statewalker-root/issues/36/comments?per_page=100' --paginate --jq '.[].body' | grep -F '<!-- review-metrics: week=<ISO week> -->'`),
   skip to step 7. Otherwise `node tools/review-metrics.mjs --create`: it files root `area:root`
   tickets for firing thresholds (duplicate-checked). Post its output, unchanged (it ends with the
   metrics marker), as a second comment on #36.
6. **Propose rubric examples.** If the metrics output lists calibration candidates, read each
   pull request's gate record and open **one** pull request here that adds, for each real case, a
   calibration example to `docs/process/review-rubric.md` (critical or not critical, one line, with
   the class and the pull request link). Take it through the merge gate (`merging.md`) and merge it.
   No candidates: no pull request.
7. **End** with a short summary of what was filed, started and posted, as the session's last
   message.

If a step fails, post what happened as a comment on #36, without any marker, and stop. Rerun the
routine ("Run now"): the markers already posted skip what succeeded. A failure in step 6 after the
metrics are posted is not retried by a rerun: open the pull request by hand from the metrics
comment's calibration candidates.
