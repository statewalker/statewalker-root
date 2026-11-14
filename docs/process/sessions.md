# Sessions

How a session starts, works, contributes to this repository, and ends. Every session starts from
this repository, works one ticket, and leaves its trace in two places: the ticket (state) and a
pull request here (knowledge).

## Where each artifact goes

Parallel sessions each have their own copy of this repository. They only meet in issues and on
`main`, so artifacts are placed where concurrent edits do not collide:

| Artifact | Where | Why it does not collide |
|---|---|---|
| Tickets, Wayfinder maps, specs | Issues here | Not files. Claimed by assignment |
| Progress, handoff, decisions in flight | Comments on the ticket | Append-only |
| Code | Pull requests in the project repositories | Never in this repository |
| ADRs | `docs/adr/YYYY-MM-DD-<slug>.md`, one file each | New files never conflict |
| Research | `docs/research/<slug>.md`, one file each | New files never conflict |
| Glossary, `CLAUDE.md`, process docs, skills, tools | Edited in this repository's PR | Shared files: keep the edit small, rebase just before merging |
| Indexes (`docs/adr/README.md`) | One line per entry, appended | Rebase resolves appends trivially |

**Never** write state into files here (task lists, status tables, session logs): it is what the
issues are for, and it is what would make every pull request conflict.

## Pull requests into this repository

Every session contributes through **its own pull request**, never by pushing to `main`:

- Branch: the session branch (cloud) or `<ticket-number>-<slug>` (local).
- Title: `root: <ticket title>`; body links the ticket (`Part of #<n>`) and the project PRs.
- **Merge it when the session ends**, even if the project PRs are still in review. Short-lived
  pull requests are what keep conflicts rare.
- Squash merge. Before merging: rebase onto `main`; resolve conflicts yourself.
- **Merges on green**: changes confined to `docs/adr/`, `docs/research/`, additions to
  `GLOSSARY.md`, and appended index lines.
- **Needs human review**: anything that changes how agents behave: `CLAUDE.md`, `AGENTS.md`,
  `.claude/**`, `docs/process/**`, `docs/agents/**`, `tools/**`, `repos.json`.

A session with nothing to contribute here opens no pull request; its trace is the ticket.

## Start a session

### Cloud (claude.ai/code)

1. New session → select **`statewalker/statewalker-root`**, plus every project the session will
   **push** to (public projects can be cloned read-only without selecting them; a running session
   can attach more).
2. Prompt with the ticket, for example:
   - `Work on statewalker-root#12.`
   - `/wayfinder statewalker-root#4` (work the next frontier ticket of a map)
   - `/grill-with-docs` for a new idea, then `/to-spec`.
3. The session follows `CLAUDE.md`: claims the ticket, clones what it needs into `repos/`, works.

Each cloud session has its own container, so cloud sessions never share files: run as many in
parallel as there are unblocked, unclaimed tickets.

### Local

```sh
git clone git@github.com:statewalker/statewalker-root.git && cd statewalker-root
claude          # then: "Work on statewalker-root#12."
```

Several local sessions in parallel need separate files. Per feature, use a workspace:

```
statewalker-root/
├── repos/<name>/            clean clones on main: worktree source only, never edited
└── ws/<feature>/            one per session (gitignored)
    ├── <project>/           worktree on branch <ticket>-<slug>
    └── <project>/
```

```sh
git -C repos/webrun-files worktree add ../../ws/42-sqlite-cache/webrun-files -b 42-sqlite-cache
```

Start that session inside `ws/<feature>/` and point it at this repository's `CLAUDE.md`. Worktrees
hold only tracked files: copy `.env` files in, and give each workspace its own dev-server ports.
A `tools/ws.mjs` that creates, lists, syncs and removes workspaces is planned
(`docs/refactoring/README.md`, phase 1).

## End a session

1. Project PRs opened (or merged, lowest layer first), each linking the ticket.
2. **Handoff comment** on the ticket: what was done, links to every PR, what is left, anything
   the next session must know. Close the ticket if it is resolved.
3. New work discovered → new tickets (with blocking edges), not notes in files.
4. This repository's PR rebased, green, and merged (or left for review if it is in the
   review-required set).
