# Issue tracker: GitHub

Issues are GitHub issues, **placed by subject**, so that everything known about one project is in
one tracker and every safety net (deferred bugs, escalation, health review) sees it:

| The issue is about… | Tracker |
|---|---|
| One project alone: a bug, a design or architecture question, an improvement, a review follow-up (`docs/process/merging.md`), a health review's finding (`docs/process/health-review.md`), a CI baseline gap | **that project's own repository** |
| Several projects, or the plan: Wayfinder maps and their tickets, specs and the tickets they break into (even when all of them touch one project: sub-issues and blocking edges stay in one repository) | **`statewalker/statewalker-root`** |
| The process or this repository (`area:root`), health-review record tickets, escalated bug tickets (which link the project's issue) | **`statewalker/statewalker-root`** |

When unsure, ask: could a session fix it with one pull request in one project, without a decision
from the plan? Then it belongs to that project. A project issue that turns out to need a decision
across projects gets a root ticket (or a Wayfinder ticket) that links it; the project issue stays
where it is.

**Always name the repository.** Sessions run inside project clones (`repos/<name>`,
`ws/<feature>/<name>`), where `gh` infers the *project* from `git remote`:

- **Root issue operations** (maps, specs, their tickets, process tickets): every `gh issue`
  command carries `-R statewalker/statewalker-root`, every `gh api` path names it literally, every
  MCP call passes `owner: statewalker`, `repo: statewalker-root`.
- **Project issue operations** and **pull-request operations** (open, read checks, comment the
  review record, update, merge) name **the project's repository**: `-R statewalker/<project>`, or
  `repo: <project>` in MCP calls. An issue or pull-request number means nothing in another
  repository; in a cloud session the project must be selected or attached.

The commands below show `statewalker/statewalker-root`; for a project issue, name the project
instead. File issues nowhere else, and never into `mattpocock/skills`.

**Before creating any issue, check that it is not already filed.** Search the target repository's
open issues for the same defect or question (`gh api 'search/issues?q=repo:statewalker/<repo>+is:issue+is:open+<keywords>'`,
or `list_issues` with the label, such as `review-followup`, and read the titles). If it exists, do
not create a duplicate: update the existing issue only when the new finding changes its scope or
description (edit the body, or comment what is new), and link it wherever the new one would have
been linked.

## Which tool works where

| Session | Works | Does not work |
|---|---|---|
| Local | `gh issue …`, `gh pr …`, `gh api …` | — |
| Cloud (Claude Code on the web) | `gh api` (REST), the GitHub MCP tools | `gh issue …` / `gh pr …` (they use GraphQL, which cloud sessions block) |

In cloud sessions use the MCP tools (load them with ToolSearch, `+github issue`, `+github pull`),
and `gh api` (REST) for what they lack, such as blocking edges and labels. Both only reach
repositories selected for the session or attached to it; others answer 403.

| Operation | MCP tool |
|---|---|
| Create, edit, label, assign, close | `mcp__github__issue_write` |
| Read an issue, its comments, sub-issues | `mcp__github__issue_read` |
| List issues | `mcp__github__list_issues` |
| Comment | `mcp__github__add_issue_comment` |
| Add / remove a sub-issue | `mcp__github__sub_issue_write` |
| Open a pull request | `mcp__github__create_pull_request` |
| Read a pull request, its diff, check runs, reviews | `mcp__github__pull_request_read` (`get`, `get_diff`, `get_check_runs`, …) |
| Comment on a pull request (the review record) | `mcp__github__add_issue_comment` with the PR number |
| Update a branch from its base | `mcp__github__update_pull_request_branch` |
| Squash-merge | `mcp__github__merge_pull_request` (`merge_method: squash`) |

## Conventions (local `gh`; REST equivalents work everywhere)

- **Create**: `gh issue create -R statewalker/statewalker-root --title "..." --body "..."` (heredoc
  for multi-line bodies).
- **Read**: `gh issue view <n> -R statewalker/statewalker-root --json number,title,body,labels,comments`.
- **List**: `gh issue list -R statewalker/statewalker-root --state open --json number,title,labels`
  with `--label` / `--state` filters.
- **Sub-issue**: `gh api --method POST repos/statewalker/statewalker-root/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`
  (works with every `gh` version), or `gh issue create -R statewalker/statewalker-root --parent <parent> ...`
  (`gh` 2.94+).
  Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's native issue dependencies, the canonical, UI-visible representation:
  `gh api --method POST repos/statewalker/statewalker-root/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`,
  where `<blocker-db-id>` is the numeric database id
  (`gh api repos/statewalker/statewalker-root/issues/<n> --jq .id`), not the `#number`. Use this in
  cloud sessions too. Only if the call fails, write `Blocked by: #<n>, #<n>` on the first line of
  the child body and say so in the handoff note. A ticket is unblocked when every blocker is
  closed.
- **Count open blockers**: `gh api repos/statewalker/statewalker-root/issues/<n> --jq .issue_dependencies_summary.blocked_by`
  (0 means startable).
- **Comment**: `gh issue comment <n> -R statewalker/statewalker-root --body "..."`.
- **Labels**: `gh issue edit <n> -R statewalker/statewalker-root --add-label "..."` / `--remove-label "..."`.
- **Close**: comment the explanation first, then `gh issue close <n> -R statewalker/statewalker-root`.
  On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.

## Claiming a ticket

Every session acts as the same GitHub account, so an assignee alone cannot tell sessions apart.
A ticket's availability is read from its **status lines**. A status line is a line of a comment
that starts with one of these words, or a `Waiting on human:` after a sentence in a longer
comment. Write each on its own line, so both people and `tools/status.mjs` read it the same way:

| Status comment | Written by | Ticket is |
|---|---|---|
| `Claimed by <session URL or branch>` | the session taking it | taken |
| `Released: <why>` | a session stopping without finishing | free |
| `Waiting on human: <what is needed>` | a session that needs the human (a decision, a package's first publish, the merge gate stopped on a critical finding) | **not available** to sessions |
| `Resumed: <what changed>` | **the human only**, once the wait is over | free |

1. Read the ticket's comments. The latest status line decides: available only if there is none,
   or it is `Released` or `Resumed`, or the claim is stale (below). A ticket labelled
   `ready-for-human` is not available either. Otherwise pick another.
2. Claim with two writes, the session's first: assign the ticket and comment
   `Claimed by <session URL or branch name>`. With `gh`: `--add-assignee @me`. With
   `mcp__github__issue_write`: `assignees` needs a real login (get it with `mcp__github__get_me`;
   `@me` is not accepted), and on `update`, `labels` replaces the whole set, so pass the full list.

A session that stops without finishing comments `Released: <why>` and removes the assignee; one
that needs the human comments `Waiting on human: …` (and, on non-Wayfinder tickets, adds
`ready-for-human`). The human hands a ticket back by commenting `Resumed: …` and, where present,
swapping `ready-for-human` for `ready-for-agent`. Tickets assigned to a human without a claim
comment are theirs, not available. Keep the labels in step with the status: a ticket whose
latest status is `Waiting on human` carries `ready-for-human`, not `ready-for-agent` (not on
Wayfinder tickets, which take no triage labels).

### Stale claims

A claim is **stale** when nothing was added to the ticket for **48 hours** after it: no comment of
any kind. A session that worked on the ticket would have left progress comments (below), so a
quiet claim means a session that was interrupted. `tools/status.mjs` lists stale claims apart.

A quiet ticket is not proof that the work stopped. Older claims predate the checkpoint rule, and
work can go on away from the ticket: commits on a branch, a pull request in its merge gate, or a
cloud session waiting on a scheduled wake. Before taking a stale ticket, check all of these:

1. **The session:** for a cloud claim, `get_session` on the claim's session URL shows it neither
   working nor waiting on a scheduled wake (its triggers, `list_triggers`), and its last event is
   older than 48 hours.
2. **The work:** the pull requests and branches the ticket or its note names have no commit,
   comment or check run in the last 48 hours. Where you can't read them (an unattached project),
   treat them as live.
3. **The claimant:** the claim names a session URL or a cloud session branch, not a local branch
   or "guided by the human".

If all three hold, comment `Released: stale claim of <date> (<session>): <what you checked>`, then
claim as usual. Otherwise don't release: comment `Waiting on human: confirm the claim of <date> is
stale` and pick another ticket. Before continuing a released ticket, read its comments and its
current handoff note: the interrupted session's state is there, by the checkpoint rule below.

### Checkpoints: keep the state recoverable

A session can stop at any moment (a container reclaimed, a limit, a crash). The next session must
be able to rebuild where the work stands from GitHub and the root alone. So, while working:

- **Comment on the ticket at each milestone**, as `Progress: <what changed>`, with links:
  - a pull request opened or merged;
  - a release published;
  - a decision taken in a grilling;
  - a child session started or finished;
  - a blocker found.

  One or two lines, linking the pull request, issue or commit. Never retell what the link already
  says. A progress comment also keeps the claim from going stale.
- **Before a long step** (a CI wait, a release, a subagent fan-out), comment what is running and
  how to check it, for example the run, the branch or the child session.
- **When the next step is the human's**, comment `Waiting on human: <exactly what>` at once, and
  set `ready-for-human` (not on Wayfinder tickets). Don't leave it only in a note.
- **File what is left as issues**, with blocking edges, rather than as lists in a comment or a
  note.
- **Write a handoff note only for what issues can't hold.** That means standing rules, a
  multi-ticket plan in flight, or running state across several repositories. When the ticket and
  its comments are enough to continue, write no note (`docs/process/handoffs.md`, "When to write
  a note").

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature
requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue in the tracker its subject belongs to (the table at the top): a map, spec or
its tickets on `statewalker/statewalker-root`; a standalone issue about one project in that
project's repository.

## Working a ticket in a project's tracker

A ticket in a project's repository is claimed, released and handed back exactly as in **Claiming
a ticket**, with the comments on that issue. The session's pull request in the same repository
links it as `#<n>`; a ticket in root is linked in full, `statewalker/statewalker-root#<n>`. As for
root tickets, no closing keywords: the session closes the issue with a comment once its pull
request has merged. Labels the project lacks (the triage labels, `bug`) are created there first,
as in **Labels in use**.

## When a skill says "fetch the relevant ticket"

Read it as in **Read** above (or `issue_read` in cloud sessions).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: one issue labelled `wayfinder:map`, holding the Destination / Notes / Decisions so far /
  Not yet specified / Out of scope body.
- **Child ticket**: a sub-issue of the map, labelled `wayfinder:<type>` (`research`, `prototype`,
  `grilling`, `task`), optionally `repo:<name>` (the override in `CLAUDE.md`).
- **Blocking**: see **Blocking** above.
- **Frontier**: the map's open sub-issues with no open blocker that are available (see
  **Claiming a ticket**: not claimed, not waiting on the human); first in map order wins.
- **Claim**: see **Claiming a ticket**.
- **Resolve**: comment the answer, close the ticket, append a context pointer (gist + link) to the
  map's Decisions so far.

## Issues in project repositories

Project issues are part of the plan too. When triaging, also sweep each project in `repos.json`:
`gh api 'repos/statewalker/<repo>/issues?state=open&labels=needs-triage'`. Every review follow-up is
also linked from the gate's pass record and from the ticket's handoff note, so the ticket that
caused it leads to it.

## Labels in use

- Triage: see `triage-labels.md`.
- Wayfinder: `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`,
  `wayfinder:task`.
- `area:root` for work on this repository itself; `repo:<name>` for each project a ticket's code
  or decision concerns.
- `subject:<id>` for the subject a root issue belongs to (`GLOSSARY-MAP.md`; ids in
  `subjects/subjects.json`).
  - **Required** on every map, spec and standalone root issue, set when it is created.
  - A map's or spec's tickets (sub-issues) inherit their parent's subject and need no label.
  - Wayfinder tickets may carry it, beside `repo:` labels.
  - `node tools/status.mjs` lists open issues with no derivable subject under **unsorted**.
- `review-followup` (with `bug`) for high findings the merge gate filed instead of fixing (issues
  from the earlier review loop may carry `enhancement`). These
  issues are filed **in the repository of the pull request** rather than here
  (`docs/process/merging.md`); create the labels there with the same REST call, naming that
  repository.
- `health-review`: here, on a health review's record ticket; in a project, on that review's
  findings, with `bug` or `enhancement` (`docs/process/health-review.md`).
- `bug`: in a project, every open issue with it is one of the project's **deferred bugs**, whatever
  filed it (`docs/process/prevention.md`); here, on escalated bug tickets and on follow-ups from
  this repository's own pull requests.
- `ci-baseline`: in a project, one issue per missing CI baseline measure (`docs/process/prevention.md`).

The triage, Wayfinder and `area:root` labels exist. Before applying a label the repository lacks
(a new `repo:<name>`), create it:
`gh api --method POST repos/statewalker/statewalker-root/labels -f name=repo:<name> -f color=ededed`
(a 422 "already_exists" answer is fine). `--add-label` fails on a missing label.
