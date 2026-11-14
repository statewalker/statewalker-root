# Two-tier review: merge gate and health review

**Status**: accepted, 2026-11-14. Amends decision 3 (the merge clause) of
[root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md).

## Context

Every pull request went through a review loop: a reviewer agent reported findings of every
severity, the session fixed them, and a new reviewer reviewed the whole change again, up to three
rounds. Reviewer agents always find something, so the loop did not converge. Bootstrapping this
repository took three full rounds, with 6, 6 and 1 high findings and many smaller ones, and still
ended with a high finding open. Every merge was slow, and most of what the rounds produced was
improvement, not defects that justified blocking. The sources behind the decision are in
[converging-ai-review](../research/converging-ai-review.md); the decisions were made in the map
[Converging review](https://github.com/statewalker/statewalker-root/issues/2) and specified in
[#17](https://github.com/statewalker/statewalker-root/issues/17).

## Decision

1. **Merge gate, on every pull request** (`docs/process/merging.md`). After CI is green, one
   reviewer pass reports only **critical findings** and high findings in the changed lines.
   Critical is a closed definition with an evidence bar (`docs/process/review-rubric.md`). Critical
   findings are fixed and re-verified on the fix diff only, for at most three passes; high findings
   are fixed when cheap or filed as one issue each; then the pull request merges automatically. A
   critical finding still open after three passes stops the merge for the human, who alone can
   override one. No exemptions.
2. **Health review, weekly per project.** It reviews what merged since the previous run at every
   severity, plus an architecture survey, and files tickets in the project's tracker. It never
   blocks a merge or a release.
3. **One record per gate pass**, a pull request comment ending in a machine-readable line, so that
   review convergence can be measured weekly.
4. **Prevention** moves the deterministic critical classes (broken build, broken API, leaked
   secret, release-path bypass) into CI checks and process rules, so the gate rarely finds
   anything critical.

## Consequences

- A merge costs one reviewer pass in the common case; only critical fixes cost more, and never
  more than three passes.
- Improvements (medium and low) are no longer raised per pull request; they surface in the weekly
  health review, capped per run.
- Deferred bugs gain a lifecycle beyond the pull request that found them: the health review sorts
  and escalates them.
- The rubric is shared by both tiers and grows from real downgrades and overrides.
