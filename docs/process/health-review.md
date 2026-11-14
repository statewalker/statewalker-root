# Health review

The second tier of review ([two-tier-review](../adr/2026-11-14-two-tier-review.md)). The merge
gate blocks only critical findings and reports bugs only in the lines a pull request changes; the
health review is where everything else is caught: medium and low findings, bugs in unchanged
code, architecture, and the deferred bugs left open. One run reviews **one project**, weekly,
**independent of releases**: it never runs before a release and never blocks one. Decided in
[What does a health review cover and produce?](https://github.com/statewalker/statewalker-root/issues/7),
[When does it run?](https://github.com/statewalker/statewalker-root/issues/8) and
[How are deferred bugs picked up?](https://github.com/statewalker/statewalker-root/issues/12).

## The record ticket

Every run has one **record ticket** in this repository, and a session runs a health review only
when it was given one ("Work on statewalker-root#N"):

- Title `Health review: <project>`, labels `health-review` and `repo:<project>`; the body names
  the project and the **base commit**: the commit the project's previous record ticket reviewed,
  or "first run" if there is none.
- The weekly dispatcher creates record tickets for the projects that changed (up to five a week)
  and starts one session per ticket. The human can start a run for any project at any time by
  opening a record ticket the same way and starting a session on it.
- It is claimed, released and resumed like any ticket (`docs/agents/issue-tracker.md`). A run left
  unfinished is released, and the next week's dispatcher resumes the same ticket instead of
  opening another.

## The dispatcher's plan

`tools/health-dispatch.mjs` decides the week's runs from the record tickets, each project's
latest commit on `main` and the open deferred bugs:

```sh
node tools/health-dispatch.mjs            # dry run: prints the plan (--json for the routine)
node tools/health-dispatch.mjs --create   # files the record tickets and escalations
```

1. **Unfinished runs first**: every open record ticket, oldest first, counts against the cap.
   It is started again only if it is available (no claim, `Released` or `Resumed`); a claimed or
   waiting one just takes its slot.
2. **Then changed projects**: the projects without an open record ticket whose `main` moved since
   their last recorded commit (the `<!-- health-review: … -->` line of their latest closed record
   ticket; a closed record without that line is ignored). The least recently reviewed come first,
   never reviewed before all; ties go to the lower layer (from `CLAUDE.md`'s project table; apps,
   infra and this repository last), then by name. One new record ticket each, never a second open
   one for a project.
3. **The cap: five runs a week.** The rest wait for next week; unchanged projects are skipped.
4. **Escalations**: every open deferred bug 28 days old or older becomes a root ticket labelled
   `bug`, `ready-for-agent` and `repo:<project>` that links it (with acceptance criteria), unless an
   open root `bug` issue already links it.

Repositories `gh` cannot read (in a cloud session: unattached ones) are skipped and listed. Tests:
`tools/test/health-dispatch.test.mjs`, on recorded responses.

## Inputs

1. **The change since the base commit.** Note the project's `main` head when the run starts: it
   is the **reviewed commit**. Review `git diff <base>..<reviewed>`; on a first run, the whole
   project at the reviewed commit.
2. **The open deferred bugs and follow-ups** in the project's tracker: issues labelled
   `review-followup` or `health-review` (`prevention.md`, "Deferred bugs before starting").
3. **An architecture survey**: `/improve-codebase-architecture` on the project (a human-started
   skill: read `.claude/skills/improve-codebase-architecture/SKILL.md` and follow its exploration
   and candidate list, without the interactive grilling), weighted towards what the change touched.
4. **The standards**: the project's `CLAUDE.md`, `README.md`, glossary and ADRs, its `REVIEW.md` if
   any, and [the review rubric](review-rubric.md).

## Review and judging

Launch reviewers with the brief in `merging.md` ("Reviewer brief"), **Health review** scope: every
severity on the change, plus critical-class problems anywhere in the project. A first run of a
large project may split the project among several reviewers, one per area, each with the same
brief. The session judges every finding with the gate's rules (`merging.md`, "Roles" and
"Severity"): real, speculative or cosmetic; re-graded where needed; critical only with the
rubric's evidence. Speculative and cosmetic findings are dropped, with the reason in the record.

## Outputs

All tickets go to **the project's own tracker** (named explicitly, `-R statewalker/<project>`),
after the duplicate check (`docs/agents/issue-tracker.md`), creating missing labels there. Each
links the record ticket in full (`statewalker/statewalker-root#<n>`).

- **Critical-class problems** found anywhere: the rubric's "problems already on `main`" treatment,
  at once: an issue labelled `bug` and `ready-for-human`; a leaked secret is also reported to the
  human on the record ticket immediately.
- **Bugs** (high): one issue per bug, labelled `health-review` and `bug`, with its evidence (file
  and line at the reviewed commit) and the proposed fix. Uncapped. These are deferred bugs from
  now on.
- **Improvements** (medium and low): grouped by area, labelled `health-review` and `enhancement`.
  **At most ten new improvement tickets per run**, the most valuable; the rest are only listed in
  the record, for the next run to reconsider.
- **Architecture**: the survey's top one to three deepening candidates, each as an issue labelled
  `health-review`, `enhancement` and `ready-for-human`. They are design decisions for the human,
  never implemented by the run.
- **At most one tidy pull request** in the project, holding only cheap, mechanical improvements
  (naming, duplication, dead code), no behaviour change and no deferred-bug fixes. It passes the
  merge gate like any other pull request, judged by the same session.
- **Deferred-bug sorting**, without fixing anything: close each open deferred bug already fixed,
  with a comment saying where (commit or pull request); update those whose scope changed. Escalating
  bugs open four weeks or longer is the dispatcher's job.

## The record

When the run is done, comment on the record ticket and close it. The comment has these parts, in
this order:

1. **Reviewed**: the project, the base commit and the reviewed commit, and whether it was a first
   run.
2. **Tickets**: links to every issue opened or reused, by kind (critical, bug, improvement,
   architecture).
3. **Beyond the cap**: the improvements not filed, one line each with file and line.
4. **Oldest open bugs**: the project's five oldest open deferred bugs, with their age, and the ones
   this run closed or updated.
5. **Tidy pull request**: its link and merge state, or "none".
6. **Dropped**: findings judged speculative or cosmetic, one line each with the reason.

The comment's last line is exactly one machine-readable line, which the next run and the
dispatcher read to find where to start:

```
<!-- health-review: project=<project> commit=<reviewed commit sha> -->
```

A run that cannot finish comments `Released: <why>` with what it has done so far, and leaves the
ticket open, unassigned, for the dispatcher to resume.

The weekly routine ([weekly-routine.md](weekly-routine.md)) adds one comment per week to the pinned [**Review health**](https://github.com/statewalker/statewalker-root/issues/36) issue, linking that week's
record tickets.
