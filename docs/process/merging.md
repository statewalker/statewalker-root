# Merging pull requests

Every pull request goes through this loop before it merges, in the project repositories and in
this repository alike. The session that opened the pull request drives it **automatically, without
waiting for the human between rounds**, until the change is clean or the round limit is reached.
The only exception is the commits umbrella's `sw.mjs` pushes to `main` during `update`, `release`
and `cascade`.

## Roles

- **Reviewer**: a subagent with a fresh context window that did not write the change. It reports
  findings with a proposed severity, following the reviewer brief below.
- **Judge**: the session that launched the reviewer. It does not take findings on trust: it
  checks each one against the code and decides whether it is **real**, **speculative** (no
  concrete failure can be shown) or **cosmetic** (taste, not a defect), and it may re-grade the
  severity. Every verdict and re-grade carries a one-line reason in the round's record.

## Severity

| Severity | Kind | Meaning | Handling |
|---|---|---|---|
| **critical** | bug, blocker | The pull request cannot be integrated as it is: changes are required immediately | **Always fixed in this pull request, before merging.** Never deferred |
| **high** | bug | Wrong behaviour or a broken promise: a defect in a normal path, acceptance criteria not met, a contradiction that leads an agent or a user into a wrong action | Fixed in this pull request when cheap; otherwise **one follow-up issue per finding** |
| **medium** | improvement | Works, but costs later: an unhandled edge case, unclear naming, duplication, missing docs, a minor inaccuracy | Fixed when cheap; otherwise collected into **one follow-up issue** |
| **low** | improvement | Polish: wording, style, small simplifications | Fixed when cheap; otherwise into the same follow-up issue, or dropped if cosmetic |

Critical and high are **bugs**; medium and low are **improvements**. When in doubt, the reviewer
proposes the higher severity and the judge decides.

**Cheap or expensive.** A fix is expensive when it needs a design decision, reaches beyond the
pull request's scope or files, or would take more effort than the rest of the round's fixes
together. Expensive fixes are deferred as follow-up issues, except critical ones, which are fixed
or block the merge.

## The loop

1. **Review.** Launch a new reviewer with the brief below.
2. **Judge.** Classify every finding: real, speculative or cosmetic; confirm or re-grade its
   severity. Speculative findings are rejected with the reason. Cosmetic findings are fixed only
   if trivial, otherwise dropped.
3. **Act on the real findings:**
   - critical: fix now;
   - high: fix now if cheap, otherwise open one follow-up issue per finding;
   - medium and low: fix now if cheap, otherwise collect them into one follow-up issue for the
     round.

   Commit the fixes to the pull request's branch and post the round's record (below).
4. **Decide.**
   - If this round fixed any critical or high finding in the pull request, the fixes need
     verifying: go back to step 1 with a new reviewer, who reviews the whole change again.
   - Otherwise the change is **clean**: go to step 5.
   - **Round limit: 3.** After the third round, do not start another. If a critical finding is
     still open, **do not merge**: comment `Waiting on human: review loop stopped with a critical
     finding` on the ticket, add `ready-for-human` (not on Wayfinder tickets), and leave the pull
     request open. Otherwise, defer every open high finding as its own follow-up issue and go to
     step 5.
5. **Merge when checks are green.** Every check on the latest commit passes (all of them, not
   only those a ruleset marks required), the branch is up to date with its base (rebase locally,
   or `update_pull_request_branch` in the cloud; either is fine with squash merge), and any human
   approval the path requires (below) is given. Squash merge. Where a repository has no CI yet,
   "green" means the repository's own check commands (its README) pass locally, and the record
   says so.

## Follow-up issues

Created on `statewalker/statewalker-root` (`docs/agents/issue-tracker.md`), labelled
`review-followup`, `needs-triage` and `repo:<name>` for the project concerned:

- **One per deferred high finding**: also labelled `bug`; title `Review: <the defect>`; body:
  the finding, its evidence (file and line at the merged commit), the proposed fix, and links to
  the pull request and the round's record.
- **One per round for the deferred medium and low findings** that the judge found real (not
  speculative, not cosmetic): also labelled `enhancement`; title
  `Review improvements: <pull request title>`; body: one checklist item per finding with its
  evidence and proposed fix.

The round's record lists every follow-up issue it opened.

## Reviewer brief

Pass this to the reviewer, with the placeholders filled:

> You are an independent reviewer; you did not write this change. Do not modify files, push or
> comment on GitHub.
>
> - **Change**: `git -C <checkout> diff origin/<base>...HEAD` (three dots: against the merge base,
>   so a moved base branch does not distort the diff; name any vendored paths to skip).
> - **Spec**: ticket `statewalker-root#<n>` (read it and its comments), plus what the pull request
>   says it does.
> - **Axes**: apply both axes of `/code-review` yourself, without spawning sub-agents:
>   *Standards* (the project's documented coding standards, its `CLAUDE.md`, this repository's
>   rules, and the smell baseline) and *Spec* (does the change do what the ticket asks, all of
>   it, and nothing it forbids). Verify factual claims against the code where practical.
> - **Severity**: propose one per finding from the table in `docs/process/merging.md` (critical:
>   cannot be integrated as is; high: bug; medium and low: improvements). This grading replaces
>   `/code-review`'s "do not rerank" rule and its length limits.
> - **Output**: for each finding: severity, file and line, what is wrong with evidence (a concrete
>   failure, not a possibility), the concrete fix, and whether the fix is cheap or expensive.
>   Then a table of counts per severity. Do not report speculative or cosmetic points as defects.

## Record of the round

Post each round as one pull request comment, one row per finding:

| Column | Content |
|---|---|
| # | the finding's id in this round |
| Proposed / judged | the reviewer's severity, the judge's severity |
| Verdict | real, speculative or cosmetic, with the reason |
| Outcome | fixed (commit), deferred (issue link), rejected or dropped (reason) |

followed by the round's decision: another round, clean, or stopped. This is the record a human
reads before approving.

## Human approval

In this repository, the paths listed as "needs human review" in `sessions.md` also need a human
approval before step 5. Sessions act as the human's own GitHub account, so a GitHub approval
cannot express it: **the human approves by merging the pull request themselves, or by telling a
session in their own message to merge it.** A comment on GitHub does not count (sessions can write
those). Until then the session leaves the pull request open after the loop and says so on the
ticket. Project repositories follow their own branch protection.
