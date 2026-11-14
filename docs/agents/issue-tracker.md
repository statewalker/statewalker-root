# Issue tracker: GitHub

Issues, specs and Wayfinder maps for the whole statewalker ecosystem live as GitHub issues on
**`statewalker/statewalker-root`**, including work whose code lands in a project repository. The
one exception: review follow-up issues go to the repository of the pull request they come from
(`docs/process/merging.md`).

**Always name the repository.** Sessions run inside project clones (`repos/<name>`,
`ws/<feature>/<name>`), where `gh` infers the *project* from `git remote`:

- **Issue operations** (tickets, maps, specs): every `gh issue` command carries
  `-R statewalker/statewalker-root`, every `gh api` path names it literally, every MCP call passes
  `owner: statewalker`, `repo: statewalker-root`.
- **Pull-request operations** (open, read checks, comment the review record, update, merge) and
  **review follow-up issues** name **the pull request's own repository**: `-R statewalker/<project>`,
  or `repo: <project>` in MCP calls. A pull-request number means nothing in another repository.

File issues nowhere else, and never into `mattpocock/skills`.

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
  the child body and say so in the handoff comment. A ticket is unblocked when every blocker is
  closed.
- **Count open blockers**: `gh api repos/statewalker/statewalker-root/issues/<n> --jq .issue_dependencies_summary.blocked_by`
  (0 means startable).
- **Comment**: `gh issue comment <n> -R statewalker/statewalker-root --body "..."`.
- **Labels**: `gh issue edit <n> -R statewalker/statewalker-root --add-label "..."` / `--remove-label "..."`.
- **Close**: comment the explanation first, then `gh issue close <n> -R statewalker/statewalker-root`.
  On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.

## Claiming a ticket

Every session acts as the same GitHub account, so an assignee alone cannot tell sessions apart.
A ticket's availability is read from its **status comments**, each starting with one of these
words:

| Status comment | Written by | Ticket is |
|---|---|---|
| `Claimed by <session URL or branch>` | the session taking it | taken |
| `Released: <why>` | a session stopping without finishing | free |
| `Waiting on human: <what is needed>` | a session that needs the human (a decision, a package's first publish, the review loop stopped on a critical finding) | **not available** to sessions |
| `Resumed: <what changed>` | **the human only**, once the wait is over | free |

1. Read the ticket's comments. The latest status comment decides: available only if there is
   none, or it is `Released` or `Resumed`; a ticket labelled `ready-for-human` is not available
   either. Otherwise pick another.
2. Claim with two writes, the session's first: assign the ticket and comment
   `Claimed by <session URL or branch name>`. With `gh`: `--add-assignee @me`. With
   `mcp__github__issue_write`: `assignees` needs a real login (get it with `mcp__github__get_me`;
   `@me` is not accepted), and on `update`, `labels` replaces the whole set, so pass the full list.

A session that stops without finishing comments `Released: <why>` and removes the assignee; one
that needs the human comments `Waiting on human: …` (and, on non-Wayfinder tickets, adds
`ready-for-human`). The human hands a ticket back by commenting `Resumed: …` and, where present,
swapping `ready-for-human` for `ready-for-agent`. Tickets assigned to a human without a claim
comment are theirs, not available.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature
requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue on `statewalker/statewalker-root`.

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

## Review follow-ups in project repositories

Follow-up issues filed in project repositories (`docs/process/merging.md`) are part of the plan
too. When triaging, also sweep them: for each project in `repos.json`,
`gh api 'repos/statewalker/<repo>/issues?state=open&labels=review-followup'`. Every follow-up issue
is also linked from the round record and from the ticket's handoff comment, so the ticket that
caused it leads to it.

## Labels in use

- Triage: see `triage-labels.md`.
- Wayfinder: `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`,
  `wayfinder:task`.
- `area:root` for work on this repository itself; `repo:<name>` for each project a ticket's code
  or decision concerns.
- `review-followup` (with `bug` or `enhancement`) for findings deferred by the review loop. These
  issues are the one kind filed **in the repository of the pull request** rather than here
  (`docs/process/merging.md`); create the labels there with the same REST call, naming that
  repository.

The triage, Wayfinder and `area:root` labels exist. Before applying a label the repository lacks
(a new `repo:<name>`), create it:
`gh api --method POST repos/statewalker/statewalker-root/labels -f name=repo:<name> -f color=ededed`
(a 422 "already_exists" answer is fine). `--add-label` fails on a missing label.
