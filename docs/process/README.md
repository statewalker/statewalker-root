# Development process

How work moves from an idea to published packages. The skills named here live in
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
  Merging is automatic once the review loop's conditions hold (`merging.md`).

## 3. Changes across projects

1. **Branches**: locally, one branch name across this repository and every project:
   `<ticket-number>-<slug>`. In the cloud, use the session branch the harness names, in every
   repository: check each project checkout with `git branch --show-current` and create the branch
   there if the harness left it on `main`.
2. **Build and test together** before anything is released, in one pnpm workspace over all the
   projects (`sessions.md`, "Linking the projects"): locally in `ws/<feature>/`
   (`node tools/ws.mjs new <feature> <project…>`), in the cloud over the session's checkouts.
3. **One pull request per project**, each referencing the ticket in full
   (`statewalker/statewalker-root#<n>`); the ticket lists them.
4. **Land bottom-up, with a publish between layers.** Each project resolves `@statewalker/*` from
   npm through its catalog, so an upper project can only go green against a published lower one:
   1. Take the lowest project's pull request, with a changeset (`pnpm changeset`) for each package
      it changes, through the review loop (`merging.md`) and merge it.
   2. CI opens or updates that project's "version packages" pull request (§4). Take it through the
      review loop and merge it: CI publishes.
   3. Once npm serves the new versions (`node tools/packages.mjs status <project>`), raise the upper
      project's catalog range where the new version falls outside it, get its checks green, take
      it through the review loop and merge it.
   4. Repeat per layer. No human release step sits between layers.

   Dependents the change did not touch are updated automatically after a publish
   ([#15](https://github.com/statewalker/statewalker-root/issues/15)): a compatible version only
   moves their lockfile. Until that lands, `node tools/packages.mjs deps <project>` lists them and
   `status` shows which references are behind. A project whose `ci.yml` has no `publish` job yet
   cannot release: block the ticket on that project's CI-publishing ticket (open one if missing).

## 4. Release

**Only through CI**: npm trusted publishing over OIDC, from the standard `publish` job of each
project's `ci.yml` (gated by the `npm` environment, with provenance). One shape everywhere, the
**version pull request**: changesets accumulate on `main`; CI opens a "version packages" pull
request that applies them (versions, `CHANGELOG.md`); merging it publishes. That pull request goes
through the review loop like any other, so a session can release without the human
([decision](https://github.com/statewalker/statewalker-root/issues/10)).

- **Never publish by hand**, from any machine, and never add a publish step outside the standard
  `publish` job: the shared CI fails such a pull request, and the review loop grades it a
  release-path bypass (critical).
- To check what a project has not published, or which references are behind npm:
  `node tools/packages.mjs status [project…]` over the clones in `repos/`
  (`node tools/repos.mjs clone`, later `pull`).
- To check published packages install and import from npm: `tools/npmverify.sh` (`tools/README.md`).

## 5. Conventions inside each project

Target layout (being rolled out by the refactoring plan):

```
packages/   published libraries, plus private test kits (*-tests, *-conformance)
examples/   small private runnable examples, one per feature, run in CI as smoke tests
apps/       deployable or long-lived apps (have a deploy target or an image)
protos/     throwaway prototype ladders; may break; never released
site/       the project's documentation site, if it has one
```
