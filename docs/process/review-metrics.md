# Review metrics

How the human sees whether review converges. Five signals are computed weekly from the merge
gate's records ([merging.md](merging.md), "Record of a pass"), issue labels and pull-request
timestamps; four thresholds open root tickets; and the rubric grows from real cases. Decided in
[What do we measure to know review converges?](https://github.com/statewalker/statewalker-root/issues/13).
No data file: the state stays in issues and pull requests.

## The tool

```sh
node tools/review-metrics.mjs                 # every project in repos.json, plus this repository
node tools/review-metrics.mjs --repos webrun-files,httpeers --json
node tools/review-metrics.mjs --create        # also file the tickets of firing thresholds
```

It reads GitHub with `gh api` (REST), so it reaches only the repositories `gh` can see (in a
cloud session: the attached ones); the others are skipped and listed in the report. Without `--create` it is a dry run: it prints the report,
which is the weekly comment on the pinned **Review health** issue, and the tickets it would file.
`--now <date>` moves the window's end. The weekly dispatcher routine runs it.

## Signals

Over a rolling window of the four weeks before the run, for every pull request merged in it:

| Signal | Computed from |
|---|---|
| Gate passes per pull request: median and maximum | the highest `pass` among a pull request's record lines |
| Critical findings per merge, with downgrades and overrides | the sum of `critical` over all passes, per merged pull request with a record; `downgraded` summed; an override is a pull request whose record says "overridden" (its Outcome column, `merging.md`) |
| Share of findings rejected as speculative | `rejected` / (`critical` + `high` + `rejected`), over all passes |
| Open deferred bugs per project, plus escalations | open issues labelled `bug` with `review-followup` or `health-review`, per project; open root issues labelled `bug` and `ready-for-agent` that are not deferred bugs themselves (escalated bug tickets, `prevention.md`) |
| Time to merge: median | from a pull request's creation to its merge |

The record line ends the pass's comment; a footer appended after it by tooling is ignored. A
merged pull request without a valid record line is listed as **missing a record** (and counted
in time to merge only); a `<!-- gate:` line that does not parse is counted as **malformed**. Both
point at a gate that was skipped or recorded wrongly.

## Thresholds

Each firing threshold becomes one root ticket labelled `area:root` and `needs-triage`, with a
fixed title, unless an open `area:root` issue already has that title (the duplicate check):

| Threshold | Ticket title | Action it asks for |
|---|---|---|
| Median gate passes above 1.5 | `Review metrics: median gate passes above 1.5` | Tighten the rubric or the reviewer brief |
| Speculative share above 30% | `Review metrics: speculative share above 30%` | Recalibrate the reviewer with new examples |
| Critical findings per merge rising for a project: the rate over the latest two weeks is above the rate over the two weeks before, both halves having merges | `Review metrics: critical findings rising in <project>` | A prevention (`ci-baseline`) ticket for that project |
| A project's open deferred bugs growing three weeks in a row: the counts at the end of each of the last four weekly points strictly increase | `Review metrics: deferred bugs growing in <project>` | Extra health-review slots for that project |

## The rubric grows

The report lists **calibration candidates**: pull requests merged in the last seven days with a
downgraded critical finding or an override. The weekly run turns them into one root pull request
proposing new calibration examples for [the review rubric](review-rubric.md), through the merge
gate like any other.

## Tests

`node --test tools/test/*.test.mjs`, run in CI, against recorded GitHub responses in
`tools/test/fixtures/` (`make-review-metrics.mjs` regenerates them). No network: a request with
no recorded response fails the test.
