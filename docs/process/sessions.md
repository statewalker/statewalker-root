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
| Wayfinder maps, specs, their tickets | Issues here | Not files. Claimed with assignee + claim comment |
| Bugs and other issues about one project | Issues in that project (`docs/agents/issue-tracker.md`) | Not files. Claimed the same way |
| Progress, decisions in flight | Comments on the ticket | Append-only |
| Handoff notes | `docs/handoffs/YYYY-MM-DD.<note-name>.md`, one file each, linked from a ticket comment (`docs/handoffs/README.md`) | New files never conflict; a note is never edited after it merges |
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
- **Merge it when the session ends**, even if the project PRs are still in review. Short-lived
  pull requests are what keep conflicts rare.
- Before merging: the merge gate in `merging.md`, run automatically. The session merges as soon
  as the gate's conditions hold (no open critical finding, every high finding fixed or filed as a
  follow-up issue, checks green), with no human approval step. Rebase onto `main`; resolve
  conflicts yourself. Squash merge. The human reads the pass records and the follow-up issues,
  and reverts or reopens if needed.

A session with nothing to contribute here opens no pull request; its trace is the ticket.

## Start a session

### Cloud (claude.ai/code)

1. New session → select **`statewalker/statewalker-root`**, plus every project the session will
   change or open pull requests in, plus the private project if it must read it
   (statewalker-sites). Unselected public projects can be cloned with git for reading, but API
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
node tools/repos.mjs clone                         # once: every project into repos/; later: pull
node tools/ws.mjs new 42-sqlite-cache webrun-files webrun-sites
cd ws/42-sqlite-cache && pnpm install
cd statewalker-root && claude --add-dir ..         # then: "Work on statewalker-root#42."
```

`tools/ws.mjs` (`tools/README.md`) creates the worktrees on the branch (the existing one, local or
remote, else a new one from `origin/main`) and writes the workspace's `pnpm-workspace.yaml`
(below). `new` again adds projects to a workspace; `list` shows every workspace's branches and
state; `sync` rewrites the `pnpm-workspace.yaml` after a project changed its globs or catalogs;
`rm` removes the worktrees once nothing is left uncommitted or unpushed. The tools find `repos/`
and `ws/` in the main checkout, so they work the same when run from the workspace's
`statewalker-root/` worktree.

**Linking the projects** so changes build and test together, in the folder that holds the project
checkouts (`ws/<feature>/` locally, where `tools/ws.mjs` writes it; by hand in the cloud), a
`pnpm-workspace.yaml` with

- `packages:` each project's own package globs, prefixed with its folder name (copy them from the
  project's `pnpm-workspace.yaml`, e.g. `webrun-files/packages/*`);
- `catalog:` and `catalogs:` merged from every project's `pnpm-workspace.yaml` (projects declare
  dependencies as `catalog:`, so install fails without them); where two projects give different
  ranges, take the one with the highest minimum version;
- `linkWorkspacePackages: true`;

then `pnpm install` there. A `@statewalker/*` dependency resolves to the checkout only when the
checkout's version satisfies the range: after bumping a lower project's version, widen the upper
project's range too. Otherwise pnpm installs the published version without saying so.

Worktrees hold only tracked files: copy `.env` files in, and give each workspace its own
dev-server ports.

## End a session

1. Project PRs opened, each referencing the ticket (`#<n>` for a ticket in the same project,
   `statewalker/statewalker-root#<n>` for one in root), and taken through the merge gate in
   `merging.md` before merging (lowest layer first).
2. **Handoff note** in `docs/handoffs/YYYY-MM-DD.<note-name>.md` (`docs/handoffs/README.md`; not
   the `/handoff` skill's `$TMPDIR` file). It covers what was done, links to every follow-up issue
   the merge gate filed or reused, links to every PR, what is left, and anything the next session
   must know. It is committed in this session's root PR, and a one-line comment on the ticket links
   it. Close the ticket if it is
   resolved; otherwise comment `Released: <why>` and remove the assignee, or
   `Waiting on human: <what>` when the next step is the human's.
3. New work discovered → new tickets (with blocking edges), not notes in files.
4. This repository's PR rebased, through the merge gate, and merged automatically (or left open
   with `Waiting on human` if the gate stopped on a critical finding).
5. Locally: `node tools/ws.mjs rm <feature>` once the workspace's branches are merged.
