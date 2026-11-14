# Sessions

How a session starts, works, contributes to this repository, and ends. Every session starts from
this repository, works one ticket, and leaves its trace in two places: the ticket (state) and a
pull request here (knowledge).

## Where each artifact goes

Every session works on its own branch in its own checkout of this repository: its container in the
cloud, its own worktree locally (below). Sessions only meet in issues and on `main`, so artifacts
are placed where concurrent edits do not collide:

| Artifact | Where | Why it does not collide |
|---|---|---|
| Tickets, Wayfinder maps, specs | Issues here | Not files. Claimed with assignee + claim comment |
| Progress, handoff, decisions in flight | Comments on the ticket | Append-only |
| Code | Pull requests in the project repositories | Never in this repository |
| ADRs | `docs/adr/YYYY-MM-DD-<slug>.md`, one file each | New files never conflict |
| Research | `docs/research/<slug>.md`, one file each | New files never conflict |
| Out-of-scope records (`/triage`) | `.out-of-scope/<concept>.md`, one file each | New files never conflict |
| Glossary, `CLAUDE.md`, process docs, skills, tools | Edited in this repository's PR | Shared files: keep the edit small, rebase just before merging |
| Indexes (`docs/adr/README.md`) | One line per entry, appended | Rebase resolves appends trivially |

**Never** write state into files here (task lists, status tables, session logs): it is what the
issues are for, and it is what would make every pull request conflict.

## Pull requests into this repository

Every session contributes through **its own pull request**, never by pushing to `main`:

- Branch: the session branch (cloud, named by the harness) or `<ticket-number>-<slug>` (local).
- Title: `root: <ticket title>`; body links the ticket (`Part of #<n>`, bare is fine here) and the
  project PRs.
- **Merge it when the session ends** if it is in the first category below, even if the project
  PRs are still in review. Short-lived pull requests are what keep conflicts rare.
- Before merging: the review loop in `merging.md`. Rebase onto `main`; resolve conflicts
  yourself. Squash merge.

Two merge categories:

- **Merges once the loop passes**: changes confined to new files in `docs/adr/` and
  `docs/research/`, new entries in `GLOSSARY.md`, and appended index lines.
- **Needs human review**: everything else, including edits to existing glossary entries,
  `docs/projects.md`, `docs/refactoring/**`, `README.md`, `skills-lock.json`, `CLAUDE.md`,
  `AGENTS.md`, `.claude/**`, `docs/process/**`, `docs/agents/**`, `tools/**`, `.github/**` and
  `repos.json`, and `.out-of-scope/`. When unsure, it needs review. Sessions act as the human's
  own GitHub account, so GitHub approvals cannot express this: the session takes the pull request
  through the review loop, leaves it open, and **the human approves by merging it, or by telling a
  session in their own message to merge it** (`merging.md`).

A session with nothing to contribute here opens no pull request; its trace is the ticket.

## Start a session

### Cloud (claude.ai/code)

1. New session → select **`statewalker/statewalker-root`**, plus every project the session will
   change or open pull requests in, plus the private projects it must read (umbrella,
   statewalker-sites). Unselected public projects can be cloned with git for reading, but API
   and pull-request calls on them are refused until the project is attached; a running session
   can attach more.
2. Prompt with the ticket, for example:
   - `Work on statewalker-root#12.`
   - `/wayfinder statewalker-root#4` (work the next frontier ticket of a map)
   - `/grill-with-docs` for a new idea, then `/to-spec`.
3. The session follows `CLAUDE.md`: claims the ticket, works in the harness's checkouts of the
   selected projects (switching each to the session branch if the harness left it on `main`),
   and clones unselected public projects into `repos/` only to read them.

Each cloud session has its own container, so cloud sessions never share files: run as many in
parallel as there are unblocked, unclaimed tickets.

### Local

One clone of this repository holds the clean project clones; each session gets a **workspace**:
its own worktree of this repository plus worktrees of the projects it changes, all on one branch.

```
statewalker-root/                 main clone of this repository: stays on main
├── repos/<name>/                 clean project clones on main: worktree source only, never edited
└── ws/<feature>/                 one per session (gitignored)
    ├── statewalker-root/         worktree of this repository, branch <ticket>-<slug>: start here
    ├── <project>/                worktree, branch <ticket>-<slug>
    ├── <project>/
    └── pnpm-workspace.yaml       links the projects (below)
```

```sh
git clone git@github.com:statewalker/statewalker-root.git && cd statewalker-root
F=42-sqlite-cache
git worktree add ws/$F/statewalker-root -b $F
git clone git@github.com:statewalker/webrun-files.git repos/webrun-files   # once per project
git -C repos/webrun-files worktree add ../../ws/$F/webrun-files -b $F
cd ws/$F/statewalker-root && claude --add-dir ..   # then: "Work on statewalker-root#42."
```

**Linking the projects** so changes build and test together, in the folder that holds the project
checkouts (`ws/<feature>/` locally): write a `pnpm-workspace.yaml` with

- `packages:` each project's own package globs, prefixed with its folder name (copy them from the
  project's `pnpm-workspace.yaml`, e.g. `webrun-files/packages/*`);
- `catalog:` and `catalogs:` merged from every project's `pnpm-workspace.yaml` (projects declare
  dependencies as `catalog:`, so install fails without them); where two projects give different
  ranges, take the one with the highest minimum version;
- `linkWorkspacePackages: true`;

then `pnpm install` there. A `@statewalker/*` dependency resolves to the checkout only when the
checkout's version satisfies the range: after bumping a lower project's version, widen the upper
project's range too. umbrella's `tools/workspace.mjs` implements this merge for its own clones;
`tools/ws.mjs` (`docs/refactoring/README.md`, step 1.5) will do it here.

Worktrees hold only tracked files: copy `.env` files in, and give each workspace its own
dev-server ports.

## End a session

1. Project PRs opened, each referencing `statewalker/statewalker-root#<n>`, and taken through the review loop in
   `merging.md` before merging (lowest layer first).
2. **Handoff comment** on the ticket (not the `/handoff` skill's file): what was done, links to
   every PR, what is left, anything the next session must know. Close the ticket if it is
   resolved; otherwise comment `Released: <why>` and remove the assignee, or
   `Waiting on human: <what>` when the next step is the human's.
3. New work discovered → new tickets (with blocking edges), not notes in files.
4. This repository's PR rebased, through the review loop, and merged (or left for review if it is
   in the review-required set).
5. Locally: `git worktree remove` the workspace's worktrees once their branches are merged.
