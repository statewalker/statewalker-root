# How do others make AI code review converge?

Research for `statewalker/statewalker-root#4`. Sources read on 2026-11-14. Statements marked
**(inference)** are this note's own reasoning, not a source's claim.

## Question

What do high-trust primary sources say about keeping automated (LLM) code review from looping or
nitpicking: blocking versus non-blocking severities, scoping re-review, deduplicating findings
across rounds, calibrating reviewers, filtering speculative or cosmetic findings, and moving
some review from per-PR to periodic?

## Short answer

- **Block on bugs only.** Claude Code Review and Codex reserve "fix before merge" (Claude's
  Important) or posting at all (Codex: P0 and P1 only) for bug-level findings; nits are labelled
  non-blocking. The other tools label severity (Copilot's High/Medium/Low) without defining a
  merge gate.
- **Re-review the delta, not the whole change.** Claude Code Review's automatic re-reviews focus
  on what changed since the last review and hold back nits and findings on unchanged code; it
  skips re-review entirely when no blocking finding is open and the diff is unchanged.
- **Carry state between rounds.** Reviewers resolve their own fixed threads, read replies to
  earlier findings, and group like findings once.
- **Calibrate with a repo file**, not prompt tweaks per run: define what "blocking" means here,
  cap nits, list what not to report, and give contrasting examples.
- **Verify before posting** and require evidence (a `file:line` citation); Google's bar for
  review-time checks is under 10% effective false positives.
- **Stop by rule, not by "clean".** Matt Pocock's docs say plainly that the review never comes
  back clean: act on cited findings, then stop.
- **Push whole-codebase and judgement-call findings to a periodic pass** on the default branch,
  where they feed a backlog instead of blocking a merge.

## Findings

### Severity thresholds: blocking vs non-blocking

- Google asks reviewers to label severity ("Nit:", "Optional", "FYI") because without labels
  "authors may interpret all comments as mandatory"
  (https://google.github.io/eng-practices/review/reviewer/comments.html). The "senior principle"
  is to approve once a change "definitely improves the overall code health"; there is "no such
  thing as 'perfect' code" (https://google.github.io/eng-practices/review/reviewer/standard.html).
- Claude Code Review has three markers: Important ("a bug that should be fixed before merging"),
  Nit ("worth fixing but not blocking") and Pre-existing ("not introduced by this PR"). The review
  "never approves or blocks"; to gate a merge, CI reads the count of Important findings
  (`normal`) from the check run (https://code.claude.com/docs/en/code-review-pull-requests).
  By default it targets "bugs that would break production, not formatting preferences or missing
  test coverage" (https://code.claude.com/docs/en/code-review).
- Codex: "In GitHub, Codex flags only P0 and P1 issues so review comments stay focused on
  high-priority risks"; teams widen or narrow this in `AGENTS.md`
  (https://learn.chatgpt.com/docs/third-party/github).
- Copilot labels comments High/Medium/Low "so you can prioritize which suggestions to address and
  when" (https://github.blog/changelog/2026-05-12-copilot-code-review-comment-experience-improvements);
  its reviews do not count toward required approvals by default
  (https://docs.github.com/en/copilot/concepts/agents/code-review).

### Re-review scoped to the fix vs the whole change

- Claude Code Review: "A later review that starts on its own, such as after a push, focuses on
  what changed since the last review and posts fewer nits and pre-existing findings." Findings on
  unchanged code are counted as "outside the scope of this re-review and not posted". A full
  re-review is an explicit request (`@claude review`). After a push that leaves the diff the same,
  it posts "Code review skipped — no new changes" when no Important finding is open
  (https://code.claude.com/docs/en/code-review-pull-requests).
- Repositories choose when reviews run: once on PR creation, after every push, or manual
  (https://code.claude.com/docs/en/code-review). Copilot reviews "only once" unless configured to
  review each push (https://docs.github.com/en/copilot/concepts/agents/code-review).
- Matt Pocock, `implement-spec` docs (local clone of `mattpocock/skills`,
  `docs/engineering/implement-spec.md`): the skill runs `code-review` once at the end and sends
  all findings to one fix subagent, "but it doesn't yet say when to stop after that fix"; one user
  reported "the review and fix loop took roughly four hours" on a five-ticket feature. Advice: "If
  you see a second broad review start, tell it to run focused checks for the fixed findings and
  stop." Running the spec-axis review before all tickets land makes every unbuilt ticket "read as
  a failure", which feeds the loop.

### Deduplicating findings across rounds

- Claude Code Review deduplicates within a run ("Rank: the findings that remain are deduplicated
  and ranked by severity"), resolves its earlier thread "when it judges the issue fixed", and reads
  replies on earlier findings, then "can resolve the thread or post one follow-up reply". If "the
  same kind of finding keeps coming back", the fix is a `REVIEW.md` rule
  (https://code.claude.com/docs/en/code-review, https://code.claude.com/docs/en/code-review-pull-requests).
  Its changelog: re-reviews "no longer open with LGTM while earlier blocking findings are still
  open" (anthropics/claude-code `CHANGELOG.md`).
- Copilot "groups like comments together" ("Copilot will only point this out once")
  (2026-05-12 changelog above), and now "resolves that comment during its rereview" while
  outstanding feedback "stays open"; in GitHub's experiments it "surfaced more high severity
  findings and fewer nits"
  (https://github.blog/changelog/2026-09-11-auto-resolution-and-analysis-updates-in-copilot-code-review).
- CodeRabbit stores "Learnings" from replies to its comments and loads them as context for later
  comments; its docs do not claim they suppress repeats and note learnings "are not always
  respected" (https://docs.coderabbit.ai/knowledge-base/learnings).

### Calibrating reviewers with examples or rubrics

- Claude Code Review's `REVIEW.md` exists "to cut nit volume". Its example redefines Important
  ("Style, naming, and refactoring suggestions are Nit at most"), says "Report at most five Nits
  per review", lists "Do not report" (anything CI enforces, generated files), and suggests a higher
  bar for some paths: "only report if near-certain and severe". It is read from the base branch,
  "never from the pull request's own changes" (https://code.claude.com/docs/en/code-review-customize).
- Graphite rules follow "Rule → Bad example → Good example → Reasoning" with "2-3 clear,
  contrasting examples"; exclusions should be narrow; each rule tracks an acceptance rate (issues
  that "led to code changes") so teams can "refine or remove rules with low acceptance rates"
  (https://graphite.com/docs/ai-review-customization).
- Anthropic's prompting guide: "A few well-crafted examples ... improve accuracy and consistency";
  "Include 3–5 examples"
  (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).
- CodeRabbit's `chill` profile is the default; `assertive` gives "more feedback (which may feel
  nitpicky)" (https://docs.coderabbit.ai/reference/configuration).

### Filtering speculative or cosmetic findings

- Google (Tricorder): review-time checks must "produce less than 10% effective false positives",
  where an issue is an effective false positive "if developers did not take some positive action
  after seeing the issue"; a "Not useful" button feeds analyzer owners, and analyzers with high
  rates get disabled. Results show on "edited files or lines"
  (https://abseil.io/resources/swe-book/html/ch20.html; Sadowski et al., CACM 61(4) 2018,
  https://cacm.acm.org/magazines/2018/4/226371-lessons-from-building-static-analysis-tools-at-google/pdf).
- Claude Code Review's second stage is "Verify: ... checks the candidate findings against the code
  and filters out false positives"; `REVIEW.md` can demand that "behavior claims need a
  `file:line` citation in the source, not an inference from naming"
  (code-review and code-review-customize pages above). Local `/code-review` at `low` effort
  "reports the findings it's most confident in, so you see fewer false positives"
  (https://code.claude.com/docs/en/code-review-local).
- Matt Pocock (`docs/engineering/code-review.md`): "Sub-agent output is a hypothesis, not
  evidence"; every finding must carry a citation; smells are "always judgement calls"; and on
  repeat runs: "There is no convergence guarantee. Treat a pass as a list of leads. Act on the
  ones with a cited rule behind them, then stop. Do not run it in a loop until it comes back
  clean, because it never will." He also prefers a fresh session to review ("confirmation bias
  with a slash command").

### Moving review from per-PR to periodic

- Google: "developers actually do want the ability to view analysis results over the entire
  codebase during code browsing" (examples: security teams, planning a cleanup), separately from
  review; and "existing issues in otherwise working code are typically only worth highlighting
  (and fixing) if they are particularly important (security issues, significant bug fixes, etc.)"
  (https://abseil.io/resources/swe-book/html/ch20.html). The exception matters: particularly
  important pre-existing issues still deserve attention outside the periodic pass.
- GitHub Code Quality splits the two: rules-based scans "identify existing quality debt across
  your codebase" on the default branch, AI analysis covers "recently changed files", and rulesets
  can block PRs below a threshold (https://docs.github.com/en/code-security/concepts/about-code-quality).
- Claude Code Review files pre-existing bugs under their own non-blocking marker; `/code-review`
  can run from a scheduled task (code-review-pull-requests and code-review-local pages above).
- Matt Pocock routes "the whole codebase has drifted, not one diff" to
  `improve-codebase-architecture`, "the whole-codebase counterpart", and `retro` turns repeated
  misses into a `CODING_STANDARDS.md` rule the review then reads (`docs/engineering/code-review.md`).

## Implications for a two-tier policy

All of this section is **(inference)**, measured against `docs/process/merging.md`.

1. **Merge gate (per PR).** Keep blocking on critical only. The sources support it: the two tools
   that define a gate (Claude Code Review, Codex) draw it at bug level, and none blocks on nits. Consider whether *high*
   should block too, since Claude's Important and Codex's P1 both sit at "bug".
2. **Scope later rounds to the fix.** `merging.md` step 4 sends a new reviewer over "the whole
   change again". Every source that addresses it scopes re-review to the delta and treats a full
   pass as an explicit, rarer request. Round 2+ should check the fixes for the round's findings
   plus the diff since the last round, and report new findings on unchanged code only if critical.
3. **Pass prior rounds to the reviewer.** Give round N the earlier records (finding, verdict,
   outcome) so rejected and deferred findings are not raised again, mirroring thread resolution
   and reply-reading.
4. **Calibrate in a file.** A per-project `REVIEW.md`-style section (or this repo's reviewer brief)
   with a definition of critical, two or three contrasting examples per severity, a nit cap and a
   "do not report" list. Track how often each class is judged speculative, as Graphite and
   Tricorder do, and tighten the brief where it is high.
5. **Health review (periodic, per project).** Route smells, pre-existing bugs, drift and
   architecture to a scheduled whole-codebase pass on the default branch, whose output is
   follow-up issues, never a merge block. That also lets the per-PR gate drop the smell baseline's
   judgement calls.

## Open questions

- Should *high* block the merge gate, or only be filed? Sources split "bug" from "nit", not
  critical from high.
- How often should the health review run per project, and what caps its output so the backlog
  stays triageable? No source gives a cadence.
- How to measure our own "effective false positive" rate cheaply from round records.
- Matt Pocock's skill has no stop rule after the fix pass yet (his docs say so); watch the
  `mattpocock/skills` changelog for one.

## Sources

- Google eng-practices: https://google.github.io/eng-practices/review/reviewer/comments.html,
  https://google.github.io/eng-practices/review/reviewer/standard.html
- Software Engineering at Google, ch. 20: https://abseil.io/resources/swe-book/html/ch20.html
- Sadowski et al., "Lessons from building static analysis tools at Google", CACM 2018:
  https://cacm.acm.org/magazines/2018/4/226371-lessons-from-building-static-analysis-tools-at-google/pdf
- Claude Code Review: https://code.claude.com/docs/en/code-review,
  https://code.claude.com/docs/en/code-review-pull-requests,
  https://code.claude.com/docs/en/code-review-customize,
  https://code.claude.com/docs/en/code-review-local; `CHANGELOG.md` in
  https://github.com/anthropics/claude-code
- Anthropic prompting best practices:
  https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- OpenAI Codex in GitHub: https://learn.chatgpt.com/docs/third-party/github
- GitHub Copilot code review: https://docs.github.com/en/copilot/concepts/agents/code-review,
  https://github.blog/changelog/2026-05-12-copilot-code-review-comment-experience-improvements,
  https://github.blog/changelog/2026-09-11-auto-resolution-and-analysis-updates-in-copilot-code-review
- GitHub Code Quality: https://docs.github.com/en/code-security/concepts/about-code-quality
- CodeRabbit: https://docs.coderabbit.ai/reference/configuration,
  https://docs.coderabbit.ai/knowledge-base/learnings
- Graphite: https://graphite.com/docs/ai-review-customization
- Matt Pocock, `mattpocock/skills` (local clone at commit `5863806`):
  `docs/engineering/implement-spec.md`, `docs/engineering/code-review.md`,
  `skills/engineering/implement-spec/SKILL.md`, `CHANGELOG.md`
