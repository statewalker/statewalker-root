# Merging pull requests

Every pull request goes through this loop before it merges, in the project repositories and in
this repository alike. The session that opened the pull request drives it. The only exception is
the commits umbrella's `sw.mjs` pushes to `main` during `update`, `release` and `cascade`.

## The loop

1. **Review in a separate agent.** Start a subagent with a fresh context window that did not write
   the change, and give it the **reviewer brief** below: the diff command, the ticket, the
   severity table and the output format. Give it the change, not your opinion of it.
2. **Integrate all feedback.** Fix every finding, whatever its severity, and commit the fixes to
   the pull request's branch. When you reject a finding, record why in the round's record (below);
   a rejected finding without a reason counts as unfixed.
3. **Re-review on critical or high.** If the review reported any **critical** or **high** finding,
   go back to step 1 with a new reviewer, who reviews the whole change again, not just the fixes.
   If it reported only medium and low findings, go to step 4 once they are fixed.
4. **Merge when checks are green.** Every check on the latest commit passes (all of them, not
   only those a ruleset marks required), the branch is rebased on the current base, and any
   human approval the path requires (below) is given. Squash merge. Where a repository has no CI
   yet, "green" means the repository's own check commands (its README) pass locally, and the
   round's record says so.

**Stop after three rounds.** If the third review still reports critical or high findings, stop:
comment on the ticket with the open findings, label it `ready-for-human` (a Wayfinder ticket gets
the alternative in `CLAUDE.md` instead), and leave the pull request open.

## Reviewer brief

Pass this to the reviewer, with the placeholders filled:

> You are an independent reviewer; you did not write this change. Do not modify files, push or
> comment on GitHub.
>
> - **Change**: `git -C <checkout> diff <base-sha> HEAD` (name any vendored paths to skip).
> - **Spec**: ticket `statewalker-root#<n>` (read it and its comments), plus what the pull request
>   says it does.
> - **Axes**: apply both axes of `/code-review` yourself, without spawning sub-agents:
>   *Standards* (the project's documented coding standards, its `CLAUDE.md`, this repository's
>   rules, and the smell baseline) and *Spec* (does the change do what the ticket asks, all of
>   it, and nothing it forbids). Verify factual claims against the code where practical.
> - **Severity**: grade every finding by the table in `docs/process/merging.md`; when in doubt,
>   pick the higher one. This grading replaces `/code-review`'s "do not rerank" rule and its
>   length limits.
> - **Output**: for each finding: severity, file and line, what is wrong with evidence, the
>   concrete fix. Then a table of counts per severity. Do not invent problems.

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| **critical** | Must never merge as it is: breaks users, data or security | Data loss or corruption; security hole or leaked secret; breaks the build, the published API or a dependent project; release or publish path bypassed |
| **high** | Wrong behaviour or a broken promise | The ticket's acceptance criteria not met; a bug in a normal path; missing tests for changed behaviour; a breaking change without a version bump or note; contradicts an ADR or a rule; an instruction that would lead an agent into a wrong action |
| **medium** | Works, but costs later | Edge cases unhandled; unclear naming against `GLOSSARY.md`; duplication; a module made shallower; missing docs for a public API; minor factual inaccuracy |
| **low** | Polish | Style, wording, comments, small simplifications |

## Record of the review

Post each round as one pull request comment: the round number, a table of the findings by
severity, and for each finding whether it was fixed (with the commit) or rejected (with the
reason). This is the record a human reads before approving.

## Human approval

In this repository, the paths listed as "needs human review" in `sessions.md` also need a human
approval before step 4. Sessions act as the human's own GitHub account, so a GitHub approval
cannot express it: **the human approves by merging the pull request themselves, or by telling a
session in their own message to merge it.** A comment on GitHub does not count (sessions can write
those). Until then the session leaves the pull request open after the loop and says so on the
ticket. Project repositories follow their own branch protection.
