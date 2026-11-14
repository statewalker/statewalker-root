# Development process

How work moves from an idea to released packages. The skills named here live in
`.claude/skills/`; `/ask-matt` routes when unsure which one fits. Most of them are started by the
human typing the command; a session started with only a ticket reads the skill's `SKILL.md` and
follows it (`CLAUDE.md`, "Skills only a human can start").

## 1. Pick the route by size

| The work is… | Route |
|---|---|
| Too big or foggy for one session, or spans several projects | `/wayfinder` → map issue here; one decision ticket per session until the way is clear, then a spec |
| A clear feature | `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` (one ticket) or `/implement-spec` (whole spec, parallel subagents; claims every ticket, `CLAUDE.md` overrides) |
| A bug or regression | `/diagnosing-bugs`, with `/tdd` for the regression test |
| A design question | `/prototype` (throwaway) or a `wayfinder:prototype` ticket |
| Code-health survey | `/improve-codebase-architecture` on one project, every few days |
| After a session | `/retro`: findings become `area:root` tickets |

Every route ends in issues on this repository (`docs/agents/issue-tracker.md`). Specs, tickets
and Wayfinder tickets carry `repo:<name>` labels naming the projects they concern.

## 2. Parallel work

Three layers, kept apart differently:

| Layer | Shared or isolated | How |
|---|---|---|
| Knowledge: skills, `CLAUDE.md`, glossary, ADRs | Shared, read-mostly | This repository's `main` |
| Code: projects and their branches | Isolated per session | Cloud: each session's own container. Local: a workspace of worktrees per feature (`sessions.md`) |
| Coordination: who does what | Shared | Issues: claim (assignee + claim comment), blocking edges, Wayfinder frontier |

Rules that make parallel sessions work:

- **One ticket per session.** Claim it first; a ticket with an open claim comment is taken
  (`docs/agents/issue-tracker.md`).
- **Blocking edges follow the layers.** A ticket changing a lower-layer API blocks the tickets
  that consume it.
- **Worktrees and containers postpone collisions to merge time; they do not remove them.** Two
  tickets touching a shared config, type or message catalog still collide: say so in their
  tickets, or order them with a blocking edge.
- **Large refactors and renames go first,** before parallel work branches off them.
- **The session that wrote a change merges it** and resolves its conflicts: it knows the intent.
  Pull requests that need human review are merged by the human (`merging.md`).

## 3. Changes across projects

1. **Branches**: locally, one branch name across this repository and every project:
   `<ticket-number>-<slug>`. In the cloud, use the session branch the harness names, in every
   repository: check each project checkout with `git branch --show-current` and create the branch
   there if the harness left it on `main`.
2. **Build and test together** before anything is released, in one pnpm workspace over all the
   projects (`sessions.md`, "Linking the projects"): locally in `ws/<feature>/`, in the cloud over
   the session's checkouts.
3. **One pull request per project**, each referencing the ticket in full
   (`statewalker/statewalker-root#<n>`); the ticket lists them.
4. **Land bottom-up, with a release between layers.** Each project resolves `@statewalker/*` from
   npm through its catalog, so an upper project can only go green against a released lower one:
   1. Take the lowest project's pull request through the review loop (`merging.md`) and merge it.
   2. Comment on the ticket asking the human to run `node tools/sw.mjs release <lower-project>`
      (release, **not** cascade: a cascade would release the dependents from `main`, without the
      open pull requests), comment `Waiting on human: release <lower-project>` and add
      `ready-for-human` (Wayfinder tickets: the comment only). Stop there.
   3. The human releases, then comments `Resumed: <project> <version> released` and swaps
      `ready-for-human` for `ready-for-agent`.
   4. A session claims the ticket again, raises the upper project's catalog range to the new
      version, gets its checks green, takes it through the review loop and merges it.
   5. Repeat per layer. After the last pull request merges, the human runs
      `node tools/sw.mjs cascade <lowest-changed-project>`: it publishes only what is still
      unreleased, then updates and releases **every** dependent in order, including dependents
      that the change did not touch.

## 4. Release

Only through umbrella's `tools/sw.mjs`, one release at a time (one publisher is deliberate: no
version races, no npm credential in CI). **Run locally by a human**: `release` needs `npm whoami`
with publish rights on `@statewalker`, and npm asks for a 2FA one-time password while publishing,
so cloud sessions cannot release. A session's job ends at merged pull requests and a ticket
comment naming what to release next (§3).

`sw.mjs` works on umbrella's own clones (`umbrella/repos/`, from umbrella's `repos.json`), not on
this repository's `repos/`:

```sh
git clone git@github.com:statewalker/umbrella.git && cd umbrella   # private
node tools/repos.mjs clone          # once; later: node tools/repos.mjs pull
node tools/sw.mjs release <project> --dry-run    # one project
node tools/sw.mjs cascade <project> --dry-run    # a project and every dependent, in order
```

`release` publishes under the npm tag `next`, installs and imports every entry back from npm, then
promotes to `latest`. `update`, `release` and `cascade` commit and push `main` of the projects
they touch directly: these commits are the one exception to the pull-request rule. cellb.dev is
not in umbrella's registry yet, so it cannot be released this way until refactoring step 1.1.

## 5. Conventions inside each project

Target layout (being rolled out by the refactoring plan):

```
packages/   published libraries, plus private test kits (*-tests, *-conformance)
examples/   small private runnable examples, one per feature, run in CI as smoke tests
apps/       deployable or long-lived apps (have a deploy target or an image)
protos/     throwaway prototype ladders; may break; never released
site/       the project's documentation site, if it has one
```
