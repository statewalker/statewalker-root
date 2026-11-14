# Root repository and session model

**Status**: accepted, 2026-11-14. The release clause of decision 5 and the last consequence are
superseded by [ci-publishing-and-umbrella-retired](2026-11-14-ci-publishing-and-umbrella-retired.md).
Decision 3's merge clause (the review loop) is amended by
[two-tier-review](2026-11-14-two-tier-review.md): pull requests pass the merge gate instead.
Decision 6's tracker clause is amended by [issues-placed-by-subject](2026-11-14-issues-placed-by-subject.md):
an issue about one project goes to that project's tracker.

## Context

The ecosystem spans about twenty project repositories. Agent sessions started inside one project
see only that project; skills and agent instructions were duplicated per project; nothing gave
work spanning projects an overview. The Home Repo pattern (aihero.dev, "The Home Repo Pattern")
addresses this; `umbrella` already covers registry and release tooling but not the agent process.

## Decision

1. `statewalker-root` is the root project: every session starts here. It holds the shared skills
   (`.claude/skills/`, copied from `mattpocock/skills`, pinned in `skills-lock.json`), the project
   map (`CLAUDE.md`, `repos.json`), ecosystem-wide glossary and ADRs, process docs and research.
   It holds no product code.
2. **State lives in GitHub issues on this repository**: tickets, Wayfinder maps, specs, progress
   and handoffs. Never in files.
3. **Every session contributes through its own pull request**, merged automatically when the
   session ends, once the review loop's conditions hold (`docs/process/merging.md`): no open
   critical finding, every other open finding filed as a follow-up issue in that pull request's
   repository, checks green. No direct pushes to `main`, and no human approval step; the human
   audits through the round records and follow-up issues.
4. ADRs are named `YYYY-MM-DD-<slug>.md`, not numbered, so parallel sessions never collide. This
   overrides the vendored `domain-modeling` skill (stated in `CLAUDE.md`).
5. Code changes are pull requests in the project repositories, one per project, merged lowest
   layer first; releases stay with umbrella's `tools/sw.mjs`, run locally by a human.
6. The issue tracker is always this repository, except review follow-up issues, which go to the
   repository of the pull request they come from; `repos.json` here is the source of truth for the
   managed projects.

## Consequences

- Parallel sessions only conflict on shared files (glossary, `CLAUDE.md`, process docs); small
  edits and rebase-before-merge keep that cheap.
- The skills are editable copies: updating them is a deliberate PR
  (`npx skills@latest update`), reviewed like any change to agent behaviour.
- Two repositories (root and umbrella) carry ecosystem-wide concerns until refactoring decision
  0.1 settles whether to merge them.
