# Issues placed by subject

**Status**: accepted, 2026-11-14. Amends decision 6 (the issue tracker) of
[root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md).

## Context

The tracker was always `statewalker/statewalker-root`, with two exceptions added one at a time:
merge-gate follow-ups went to the pull request's repository, and health-review findings to the
reviewed project. Issues were placed by **where they came from**, so one project's defects ended up
in two trackers: a `webrun-streams-webrtc` bug found by a health review in webrun-wire, another
found while investigating a CI failure in root
([statewalker-root#57](https://github.com/statewalker/statewalker-root/issues/57)). Only the first
was seen by the safety nets: the deferred-bug check before changing a project, the 28-day
escalation and the health review's sorting all read the project's tracker, for `bug` with
`review-followup` or `health-review`. Decided in
[#59](https://github.com/statewalker/statewalker-root/issues/59).

## Decision

1. **Issues are placed by subject.** An issue about one project alone (a bug, a design question,
   an improvement, a review follow-up, a health-review finding) goes to that project's tracker.
   `statewalker/statewalker-root` holds the plan and the process: Wayfinder maps and their tickets,
   specs and the tickets they break into (even for one project), `area:root` tickets,
   health-review record tickets and escalated bug tickets
   (`docs/agents/issue-tracker.md`).
2. **A project's deferred bugs are all its open `bug` issues**, whatever filed them
   (`docs/process/prevention.md`, `GLOSSARY.md`). The review tools count and escalate them so.

## Consequences

- Everything known about a project's code is in its own tracker; a session changing it lists one
  set of deferred bugs.
- A bug filed by hand in a project now counts in the review metrics and is escalated after four
  weeks, like a review finding.
- Specs keep their tickets in root even when they touch one project, so sub-issues and blocking
  edges stay in one repository; a ticket in a project is claimed and closed with the same status
  comments.
- Existing root issues about one project are not moved; new ones follow the rule.
