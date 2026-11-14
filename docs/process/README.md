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
| Code-health survey | A health review of one project: weekly from the routine ([weekly-routine.md](weekly-routine.md)), or on demand ([health-review.md](health-review.md)); `/improve-codebase-architecture` for a survey alone |
| After a session | `/retro`: findings become `area:root` tickets |

Whatever the route: tickets reach `ready-for-agent` only with acceptance criteria, bug fixes and
new behaviour carry tests, and a session lists a project's deferred bugs before changing it
([prevention.md](prevention.md)).

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
  Merging is automatic once the merge gate's conditions hold (`merging.md`).

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
      it changes, through the merge gate (`merging.md`) and merge it.
   2. CI opens or updates that project's "version packages" pull request (§4). Take it through the
      merge gate and merge it: CI publishes. In a project that still publishes on every merge
      (§4, "Transition"), step 1's merge already published: skip this step.
   3. Once npm serves the new versions (`node tools/repos.mjs pull`, then
      `node tools/packages.mjs status <project>` shows no `unpublished` line: without the pull,
      the clone still holds the old versions and reads "up to date"), raise the upper
      project's catalog range where the new version falls outside it, get its checks green, take
      it through the merge gate and merge it.
   4. Repeat per layer. No human release step sits between layers.

   Dependents the change did not touch are updated automatically after a publish
   ([#15](https://github.com/statewalker/statewalker-root/issues/15)): a compatible version only
   moves their lockfile. Until that lands, `node tools/packages.mjs deps <project>` lists them and
   `status` shows which references are behind. A project whose `ci.yml` has no `publish` job yet
   cannot release: block the ticket on that project's CI-publishing ticket (open one if missing).

## 4. Release

**Only through CI**: npm trusted publishing over OIDC, from the standard `publish` job of each
project's `ci.yml` (in the `npm` environment, only from `main`, with provenance). One shape
everywhere, the **version pull request**: changesets accumulate on `main`; CI opens a "version
packages" pull request that applies them (versions, `CHANGELOG.md`); merging it publishes. That pull
request goes through the merge gate like any other, so a session can release without a human release
step ([decision](https://github.com/statewalker/statewalker-root/issues/10)). No project's `npm`
environment requires reviewers: the merge publishes at once, with no approval in GitHub Actions, so
the merge gate on the version pull request is the release decision.

- **Never publish by hand**, from any machine, and never add a publish step outside the standard
  `publish` job: the shared CI fails such a pull request, and the merge gate grades it a
  release-path bypass (critical). **One exception: a package's first version.** Trusted publishing
  needs a package that already exists on npm, so the `publish` job skips a new package with a
  warning. A human publishes its first version once, with their 2FA, and adds the trusted
  publisher; a session that adds a package comments `Waiting on human: first publish of <package>`
  on the ticket.
- **Transition.** Not every project has the version-pull-request shape yet. A project whose
  `ci.yml` says "Every merge to main publishes" (webrun-sites, statewalker-ai, and per
  [#10](https://github.com/statewalker/statewalker-root/issues/10) statewalker-kernel and
  statewalker-knowledge) versions and publishes straight from `main` after each merge: there,
  merging any pull request with a changeset or a changed package publishes, with no version pull
  request to review. Read a project's `ci.yml` header before merging. Each moves to the version
  pull request through its CI-publishing ticket.
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
