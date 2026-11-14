# Development process

How work moves from an idea to released packages. The skills named here live in
`.claude/skills/`; `/ask-matt` routes when unsure which one fits.

## 1. Pick the route by size

| The work is… | Route |
|---|---|
| Too big or foggy for one session, or spans several projects | `/wayfinder` → map issue here; one decision ticket per session until the way is clear, then a spec |
| A clear feature | `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` (one ticket) or `/implement-spec` (whole spec, parallel subagents) |
| A bug or regression | `/diagnosing-bugs`, with `/tdd` for the regression test |
| A design question | `/prototype` (throwaway) or a `wayfinder:prototype` ticket |
| Code-health survey | `/improve-codebase-architecture` on one project, every few days |
| After a session | `/retro`: findings become `area:root` tickets |

Every route ends in issues on this repository (`docs/agents/issue-tracker.md`). Specs and tickets
carry `repo:<name>` labels naming the projects their code lands in.

## 2. Parallel work

Three layers, kept apart differently:

| Layer | Shared or isolated | How |
|---|---|---|
| Knowledge: skills, `CLAUDE.md`, glossary, ADRs | Shared, read-mostly | This repository's `main` |
| Code: projects and their branches | Isolated per session | Cloud: each session's own container. Local: a workspace of worktrees per feature (`sessions.md`) |
| Coordination: who does what | Shared | Issues: claim by assigning, blocking edges, Wayfinder frontier |

Rules that make parallel sessions work:

- **One ticket per session.** Claim it first; an assigned ticket is taken.
- **Blocking edges follow the layers.** A ticket changing a lower-layer API blocks the tickets
  that consume it.
- **Worktrees and containers postpone collisions to merge time; they do not remove them.** Two
  tickets touching a shared config, type or message catalog still collide: say so in their
  tickets, or order them with a blocking edge.
- **Large refactors and renames go first,** before parallel work branches off them.
- **The session that wrote a change merges it** and resolves its conflicts: it knows the intent.

## 3. Changes across projects

1. One branch name across projects: `<ticket-number>-<slug>`.
2. Build and test the projects together before releasing: locally in a workspace (`sessions.md`);
   in the cloud, by cloning the projects side by side under `repos/` and linking with
   `pnpm` overrides or umbrella's `tools/workspace.mjs`.
3. One pull request per project, each linking the ticket; the ticket lists them.
4. Merge **lowest layer first**, then release (below), then update the next layer's branch.

## 4. Release

Only through umbrella's `tools/sw.mjs`, from a clean `main` clone, one release at a time (one
publisher is deliberate: no version races, no npm credential in CI):

```sh
node tools/sw.mjs cascade <lowest-changed-project> --dry-run
node tools/sw.mjs cascade <lowest-changed-project>
```

`release` publishes under the npm tag `next`, installs and imports every entry back from npm, then
promotes to `latest`. Releases are run by a human, or by a session whose ticket says so.

## 5. Conventions inside each project

Target layout (being rolled out by the refactoring plan):

```
packages/   published libraries, plus private test kits (*-tests, *-conformance)
examples/   small private runnable examples, one per feature, run in CI as smoke tests
apps/       deployable or long-lived apps (have a deploy target or an image)
protos/     throwaway prototype ladders; may break; never released
site/       the project's documentation site, if it has one
```
