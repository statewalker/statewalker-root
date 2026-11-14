# The weekly routine

One scheduled cloud routine in this repository runs the review's weekly work: it plans and starts
the health reviews ([health-review.md](health-review.md)), escalates old deferred bugs, posts the
review metrics ([review-metrics.md](review-metrics.md)), and proposes rubric examples. Its record
is the pinned [**Review health**](https://github.com/statewalker/statewalker-root/issues/36) issue.
Decided in [When does a health review run, and who starts it?](https://github.com/statewalker/statewalker-root/issues/8)
and [What do we measure?](https://github.com/statewalker/statewalker-root/issues/13).

## Schedule and control

- **Scheduled task** "Weekly review health", on the human's claude.ai account: **every Monday at
  04:57 UTC** (`57 4 * * 1`). Each firing starts a fresh cloud session in the account's default
  environment, which follows the steps below.
- **Pause** it in claude.ai's scheduled tasks (Claude Code, scheduled tasks: disable "Weekly review
  health"), or ask a session to disable it (`update_trigger` with `enabled: false`). Enable it the
  same way. **Run it now** with "Run now" there, or `fire_trigger`.
- Runs are **idempotent within a week**: the plan comment on #36 ends with
  `<!-- review-health: week=<ISO week> -->`, and the dispatcher plans nothing once this week's
  marker is there. A second run in the same week therefore creates no tickets, starts no sessions
  and posts nothing (it stops at step 2). A run that fails before posting the plan leaves its new
  record tickets open and unclaimed: the next run resumes them instead of opening others, and the
  escalations are duplicate-checked.
- The routine reaches only the repositories its session can attach. A project it cannot read is
  listed as skipped in the plan and in the metrics, so attaching the projects (or allowing them
  for the environment) widens what it covers.

## Steps

The routine's prompt points here; a session following it does exactly this, in this order:

1. **Get root.** Attach `statewalker/statewalker-root` (and, where the session can, every project in
   `repos.json`, read access) and clone root. Work on the default branch; no ticket to claim.
2. **Plan and file.** `node tools/health-dispatch.mjs --create --json --md plan.md > plan.json`.
   It files the week's record tickets and escalations, and writes the plan as JSON (stdout) and as
   Markdown (`plan.md`, ending with the week marker). If `alreadyPlanned` is true, stop: this week
   already ran.
3. **Start the sessions.** For every `review` entry with `action: "resume"` and `start: true`,
   and every entry with `action: "create"` (its new ticket number is `created`), create one fresh
   cloud session (`create_session`, source `https://github.com/statewalker/statewalker-root`, title
   `Health review: <project>`) with the prompt `Work on statewalker-root#<N>.` Note each session's
   link.
4. **Post the plan** as one comment on #36: `plan.md` with a "Sessions" list (project, ticket,
   session link) inserted above its last line, the week marker, which must stay last. This
   comment is the week's index line and its guard.
5. **Post the metrics.** `node tools/review-metrics.mjs --create`: it files root `area:root`
   tickets for firing thresholds (duplicate-checked). Post its output as a second comment on #36.
6. **Propose rubric examples.** If the metrics output lists calibration candidates, read each
   pull request's gate record and open **one** pull request here that adds, for each real case, a
   calibration example to `docs/process/review-rubric.md` (critical or not critical, one line, with
   the class and the pull request link). Take it through the merge gate (`merging.md`) and merge it.
   No candidates: no pull request.
7. **End** with a short summary of what was filed, started and posted, as the session's last
   message.

If a step fails, post what happened as a comment on #36 (without the week marker, so the next run
retries) and stop.
