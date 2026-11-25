# What did two weeks of agent work on webrun-vcs produce, and what did it cost?

Measured on 2026-11-25 (about 18:30 UTC; limit observation added at 18:45) for the plan `statewalker/statewalker-root#282`. The
sources are primary but partial:

- `git log origin/main --since=2026-11-11 --numstat --date=short` of `statewalker/webrun-vcs`, up to
  `b6fc2b1` (default rename detection). The oldest commit, `c60d922`, is the boundary of a shallow
  fetch: its numstat is the whole tree, so it is counted as a commit but not in the line counts.
- The GitHub API (merged pull requests, closed issues).
- The usage figures (`cost_usd`) that each Claude Code cloud session reports through `get_session`.

Session records are visible only from 2026-11-22 on, so costs before that date are estimated, not
measured.

## Question

How much work landed in webrun-vcs over the last two weeks? What did the agent sessions cost per
ticket? What will the rest of the plan (Wave 5's last tickets, the Wave 5 follow-up bugs, Wave 6)
cost? Do the subscription's limits allow it?

## Short answer

- **Volume (2026-11-13 to 2026-11-25).** 285 squash-merged pull requests, one commit each on
  `main` (273 by the maintainer's sessions, 11 release PRs, 1 Dependabot). That is about +300k / −54k
  lines of library source, +250k / −20k lines of tests (604 new test files, 285 of them native-git
  twins) and +19k lines of docs. 85 of the plan's 116 tickets are closed, plus 23 webrun-vcs issues;
  52 webrun-vcs issues are open.
- **Cost per ticket: about $25–31,** whichever way the work was run.
  - Waves 1–4: one long session (`VCS - w4`) ran the last 67 of them, with in-session agents, and
    reported $2,057 (~$31 each).
  - Wave 5: one child session per ticket, plus a cheap orchestrator, reported $513 for 19 sessions
    (~$27 each; $16 for a small bug fix).
- **Estimated cost of the whole two weeks: about $6.5k–8.5k** in reported usage. 273 merged PRs at
  $25–31 each gives $6.8k–8.5k. The added-lines ratio of Wave 5 (~$11 per 1k added lines) applied to
  598k added lines gives ~$6.6k.
- **Remaining plan: about $1.0k–1.2k** of new usage.

  | Remaining work | Estimate |
  |---|---|
  | Wave 5: finish 4 running tickets, then #373 and #374 | ~$90 more (~$70 already spent) |
  | 12 Wave 5 follow-up bugs (11 labelled `bug`, plus the unlabelled #348) | ~$190–325 |
  | Wave 6: 24 tickets plus webrun-vcs#245 | ~$680–710 |
  | Orchestrator | ~$40–60 |

- **Limits.** The account is on a subscription, so `cost_usd` is not billed. It measures usage at
  API rates, and usage counts against the plan's limits. Sessions report only
  `rate_limit_info: {rateLimitType: "seven_day", status}`, never the percentage used. The weekly
  window was already at `allowed_warning` at 18:31 UTC on 2026-11-25, after ~$650 of VCS usage, so
  the plan is paused until the human resumes it. See "Subscription limits" below.

## Two weeks of work in webrun-vcs

Commits by day on `main`. The 2026-11-13 row counts both commits of that day; its lines are those of
`c2c944f` alone, since `c60d922` is the shallow-fetch boundary (see the sources above).

| Day | Commits | Added | Deleted |
|---|---|---|---|
| 2026-11-13 | 2 | 885 | 262 |
| 2026-11-14 | 28 | 44,818 | 29,348 |
| 2026-11-15 | 44 | 78,990 | 16,640 |
| 2026-11-16 | 10 | 41,179 | 8,201 |
| 2026-11-17 | 22 | 50,006 | 3,970 |
| 2026-11-18 | 16 | 51,163 | 2,904 |
| 2026-11-19 | 10 | 31,060 | 2,134 |
| 2026-11-20 | 18 | 43,872 | 2,958 |
| 2026-11-21 | 15 | 34,286 | 1,994 |
| 2026-11-22 | 12 | 27,009 | 2,980 |
| 2026-11-23 | 26 | 42,972 | 4,961 |
| 2026-11-24 | 61 | 106,487 | 6,419 |
| 2026-11-25 (to 18:30) | 21 | 45,651 | 1,355 |
| **Total** | **285** | **598,378** | **84,126** |

By kind of file (numstat over the same range):

| Kind | Added | Deleted |
|---|---|---|
| Library and app source (`*/src/*.ts`) | 300,496 | 54,179 |
| Tests (`*.test.ts`, `tests/`) | 249,598 | 20,036 |
| Docs (Markdown: CLAUDE.md, changesets, guides) | 18,858 | 5,406 |
| Test fixtures (`/fixtures/`) | 14,702 | 0 |
| Other | 6,267 | 144 |
| Package manifests and lockfile | 5,021 | 1,057 |
| CI tested-package records (`.tested/`) | 3,436 | 3,304 |

The library source is 326k lines today (`git ls-files 'packages/*/src/**/*.ts' | xargs cat | wc -l`
at `b6fc2b1`), so most of it was written or rewritten in these two weeks. There are 823 test files
in all (`git ls-files '*.test.ts'`).

## What each session cost

All sessions ran Claude Opus 5.5 at medium effort in the cloud environment.

### Waves 1–4: one long session

`VCS - w4` ran from 2026-11-22 18:25 to 2026-11-25 06:45. It reported $2,057.16 (6.07G cache-read
tokens, 108M cache-write, 13.6M output). Its history is one context that grew across 67
tickets (plan tickets #283–#350: 4 of Wave 1, 5 of Wave 2, 39 of Wave 3 and 19 of Wave 4, closed
2026-11-23 and 2026-11-24), so about $31 per ticket.

### Wave 5: one child session per ticket

On 2026-11-25 an orchestrator session started one cloud session per ticket and handled the root
issue comments itself, because children cannot write to this repository. It reported $21.36 by
18:20. The finished children reported:

| Session | Cost |
|---|---|
| Bundles (#351) | $28.4 |
| Repack as a command (#358) | $21.6 |
| `git archive` (#352) | $36.6 |
| Plumbing reads (#353) | $50.7 |
| Plumbing diffs (#354) | $22.9 |
| Small plumbing helpers (#356) | $35.6 |
| `git refs` migrate (#357) | $29.3 |
| Object-store commands (#359) | $24.5 |
| rerere (#360) | $27.6 |
| `git replace` (#361) | $17.9 |
| Plumbing writes (#355) | $33.1 |
| HTTP client config (#363) | $21.3 |
| `merge-tree` (#362) | $25.3 |
| Progress callbacks (#365) | $22.1 |
| Dumb HTTP client (#364) | $29.2 |
| Environment variables (#368) | $21.3 |
| LFS config (#367) | $27.2 |
| Host drivers (#369) | $22.7 |
| Bug fix webrun-vcs#376 | $15.9 |
| **Total, 19 sessions** | **$513.2** |

Mean ~$27, median ~$25, range $16–51.

Four more children were still running at 18:20: sha1dc (#366) $29.6, receive limits (#370) $27.0,
unpack-objects (#371) $14.1, and upload-pack config (#372), just started.

**Comparison.** Per ticket, the two ways cost about the same ($27 against $31). The child sessions
keep each context small and run four tickets at once. Wave 5 closed 18 tickets and one urgent fix in
about 11 hours. Each child also leaves its own record on its PR.

### Before 2026-11-22: estimated

Sessions older than 2026-11-22 are not listed, so their usage is unknown. From 2026-11-13 to
2026-11-21 about 165 PRs merged. At $25–31 each, that is $4.1k–5.1k. With the Wave 4 and Wave 5
figures, the two weeks total about $6.5k–8.5k. The two methods above agree within that range.

## Remaining plan

| Work | Count | At $/item | Estimate |
|---|---|---|---|
| Wave 5 tickets still to merge (#366, #370–#374) | 6 | ~$27 | ~$160, of which ~$70 already spent: ~$90 new |
| Wave 5 follow-ups labelled `bug` (webrun-vcs #357, #361, #363, #364, #367, #369, #371, #375, #378–#380) | 11 | $16–27 | ~$175–300 |
| Unlabelled data-loss bug webrun-vcs#348 (`repack -A` drops objects) | 1 | $16–27 | ~$15–25 |
| Other Wave 5 follow-ups (enhancements: #347, #349, #351, #359, #365) | 5 | ~$27 | ~$135, optional |
| Wave 6 (#375–#398) | 24 | ~$27 | ~$650 |
| statewalker/webrun-vcs#245 (compatObjectFormat) | 1 | ~$30–60 | ~$45 |
| Orchestrator | 1 | — | ~$40–60 |
| **New usage, without the enhancements** | | | **~$1.0k–1.2k** |

Two Wave 6 tickets are partly done already: #375 by #351, and #376 by #352. They should cost less.

## Subscription limits

What the sessions can see:

- **The reported limit is weekly.** Every session reports
  `rate_limit_info: {rateLimitType: "seven_day", isUsingOverage: false, status}`.
- **The weekly window reset on 2026-11-25 07:00 UTC.** At that hour the orchestrator saw
  `status: "allowed_warning"` with `resetsAt` 2026-11-25 07:00 UTC. That window ran from 2026-11-18
  07:00. It held the `VCS - w4` session's $2,057, plus 61 VCS PRs merged between 2026-11-18 07:00
  and that session's start (2026-11-22 18:25), about $1.5k–1.9k at $25–31 each, plus the other
  projects' sessions. Last week's VCS usage was therefore about $3.6k–4.0k. Sessions
  then reported `status: "allowed"` until 18:31 UTC (below), in a window ending 2026-12-02 07:00 UTC.
- **No percentage is reported.** Sessions see only `allowed` or `allowed_warning`, never how much of
  the window is used, so the exact headroom cannot be checked from a session.

What follows from it:

- **This week so far (18:20 UTC):** about $610 of VCS work (orchestrator, 19 finished and 4 running children)
  plus the other projects' sessions running at the same time (cellb.dev, Flue, sites).
- **Observed at 18:31 UTC the same day: `allowed_warning`.** The estimate above said the remaining
  plan should fit. The window turned to `allowed_warning` after only ~$650 of VCS usage since its
  reset: ~$566 for the 19 finished sessions, the orchestrator and sha1dc's $32, plus the three
  children still running (~$80). The warning therefore
  does not track VCS usage alone. Either it starts at a much lower share of the window than last
  week suggested, or other sessions this week (cellb.dev, Flue, sites) used much more than the
  VCS sessions. Sessions cannot tell which.
- **Decision taken.** The human paused the plan at that point. The three running children finish;
  nothing new starts until the human sees the account's usage and decides the budget allows it.
- **Lesson.** Last week's VCS usage at the moment of the warning does not size this week's
  headroom. Read the account's usage page before committing to a batch, and keep the orchestrator's
  check of `rate_limit_info` before each child.
- **The other projects are one possible cause.** They share the weekly window, and the warning
  arrived before Wave 6 started.
- **Mitigation.** Sessions see `status` change to `allowed_warning` (and `isUsingOverage`). The
  orchestrator checks its own `rate_limit_info` before starting each child and starts none unless
  it reads `allowed`. After a warning the plan stays paused until the human resumes it, whatever
  the window's reset date (2026-12-02 07:00 UTC this time).
- **The exact figure** is in the account's usage settings on claude.ai, which a session cannot read.

## Method and caveats

- **Line counts** are from `git log --numstat` and include generated fixtures and the CI's
  tested-package records. Kinds are told apart by path.
- **`cost_usd`** is each session's own figure for its tokens at API rates. It is not an invoice on a
  subscription, and it leaves out CI minutes.
- **The pre-2026-11-22 estimate** assumes earlier PRs cost what later ones did per PR and per line.
  Earlier PRs included the large Wave 1–3 foundations, so it may run low.
- **Sessions of other projects** share the weekly limit but are not counted in the VCS figures.
