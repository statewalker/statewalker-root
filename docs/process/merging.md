# Merging pull requests

Every pull request goes through this loop before it merges: in the project repositories and in
this repository alike. The session that opened the pull request drives it.

## The loop

1. **Review in a separate agent.** Start a subagent with a fresh context window. It must not
   have written the change. It runs `/code-review` against the pull request's base
   (`git diff <base>...HEAD`), with the ticket as the spec. Every finding it reports carries a
   **severity** (below), the file and line, and a concrete fix. Give the reviewer the diff and the
   ticket, not your opinion of the change.
2. **Integrate all feedback.** Fix every finding, whatever its severity, and commit the fixes to
   the pull request's branch. When you reject a finding, record why in a pull request comment
   (the finding, and the reason it does not apply); a rejected finding without a reason counts as
   unfixed.
3. **Re-review on critical or high.** If the review in step 1 reported any **critical** or
   **high** finding, go back to step 1 with a new reviewer. The new reviewer reviews the whole
   change again, not just the fixes. If the review reported only medium and low findings, go to
   step 4 once they are fixed.
4. **Merge when CI is green.** All required checks pass on the latest commit, the branch is
   rebased on the current base, and any review the path requires (below) is approved. Squash
   merge.

**Stop after three rounds.** If the third review still reports critical or high findings, stop
the loop: comment on the ticket with the open findings, label it `ready-for-human`, and leave the
pull request open.

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| **critical** | Must never merge as it is: breaks users, data or security | Data loss or corruption; security hole or leaked secret; breaks the build, the published API or a dependent project; release or publish path bypassed |
| **high** | Wrong behaviour or a broken promise | The ticket's acceptance criteria not met; a bug in a normal path; missing tests for changed behaviour; a breaking change without a version bump or note; contradicts an ADR |
| **medium** | Works, but costs later | Edge cases unhandled; unclear naming against `GLOSSARY.md`; duplication; a module made shallower; missing docs for a public API |
| **low** | Polish | Style, wording, comments, small simplifications |

When in doubt between two severities, the reviewer picks the higher one.

## Record of the review

Post each round's findings as one pull request comment: the round number, a table of the findings
by severity, and for each one whether it was fixed (with the commit) or rejected (with the reason).
This is the record a human reads before approving.

## Human approval

In this repository, changes to `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `docs/process/**`,
`docs/agents/**`, `tools/**` or `repos.json` also need a human approval before step 4
(`sessions.md`). Project repositories follow their own branch protection.
