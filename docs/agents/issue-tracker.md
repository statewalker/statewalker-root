# Issue tracker: GitHub

Issues, specs and Wayfinder maps for the whole statewalker ecosystem live as GitHub issues on
**`statewalker/statewalker-root`**, including work whose code lands in a project repository.

**Always name the repository.** Sessions run inside project clones (`repos/<name>`,
`ws/<feature>/<name>`), where `gh` infers the *project* from `git remote`. Every `gh issue` / `gh pr`
command below carries `-R statewalker/statewalker-root`; every `gh api` path names it literally;
every MCP call passes `owner: statewalker`, `repo: statewalker-root`. File issues only here, never
into a project repository and never into `mattpocock/skills`.

## Which tool works where

| Session | Works | Does not work |
|---|---|---|
| Local | `gh issue …`, `gh pr …`, `gh api …` | — |
| Cloud (Claude Code on the web) | `gh api` (REST), the GitHub MCP tools | `gh issue …` / `gh pr …` (they use GraphQL, which cloud sessions block) |

In cloud sessions use the MCP tools for issue reads and writes (load them with ToolSearch,
`+github issue`), and `gh api` (REST) for what they lack, such as blocking edges:

| Operation | MCP tool |
|---|---|
| Create, edit, label, assign, close | `mcp__github__issue_write` |
| Read an issue, its comments, sub-issues | `mcp__github__issue_read` |
| List issues | `mcp__github__list_issues` |
| Comment | `mcp__github__add_issue_comment` |
| Add / remove a sub-issue | `mcp__github__sub_issue_write` |

## Conventions (local `gh`; REST equivalents work everywhere)

- **Create**: `gh issue create -R statewalker/statewalker-root --title "..." --body "..."` (heredoc
  for multi-line bodies).
- **Read**: `gh issue view <n> -R statewalker/statewalker-root --json number,title,body,labels,comments`.
- **List**: `gh issue list -R statewalker/statewalker-root --state open --json number,title,labels`
  with `--label` / `--state` filters.
- **Sub-issue**: `gh issue create -R statewalker/statewalker-root --parent <parent> ...`, or
  `gh api --method POST repos/statewalker/statewalker-root/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`.
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
A claim is two writes, the session's first:

1. Read the ticket's comments. If the latest `Claimed by` comment has no later `Released` or
   handoff comment, the ticket is taken: pick another.
2. Assign the ticket (`--add-assignee @me`, or `assignees` in `issue_write`) **and** comment
   `Claimed by <session URL or branch name>`.

A session that stops without finishing comments `Released: <why>` and removes the assignee.
Tickets assigned to a human without a claim comment are theirs, not available.

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
- **Frontier**: the map's open sub-issues with no open blocker and no claim; first in map order
  wins.
- **Claim**: see **Claiming a ticket**.
- **Resolve**: comment the answer, close the ticket, append a context pointer (gist + link) to the
  map's Decisions so far.

## Labels in use

- Triage: see `triage-labels.md`.
- Wayfinder: `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`,
  `wayfinder:task`.
- `area:root` for work on this repository itself; `repo:<name>` for each project a ticket's code
  or decision concerns.

A label the repository lacks is created on first use.
