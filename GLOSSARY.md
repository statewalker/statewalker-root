# Glossary

Ecosystem-wide terms. Project-local terms live in each project's own glossary
(`docs/agents/domain.md`).

**Root project**: this repository, `statewalker-root`. Holds the plan, the knowledge and the
skills; no product code. Every session starts here.
_Avoid_: umbrella (the archived repository whose tools moved here), home repo (the pattern's name).

**Project**: one repository under `github.com/statewalker` listed in `repos.json`, usually a pnpm
monorepo of several packages.
_Avoid_: repo (fine in prose about git), monorepo (says how, not what).

**Package**: one `package.json` inside a project. **Library**: a package published to npm.
**App**: a private package that runs or deploys. **Example**: a small private runnable package
showing one library feature. **Proto**: a throwaway prototype that may break.

**Layer**: a project's position in the dependency order of its published packages (L0 = depends on
no other project). Published packages depend only on lower layers; changes merge and release
bottom-up. Private packages may reach sideways (cellb.dev → statewalker-knowledge, webrun-vcs).

**Session**: one agent conversation working one ticket, on its own branch in its own checkout of
this repository: its container in the cloud, its workspace's worktree locally.

**Workspace**: locally, `ws/<feature>/`: a worktree of this repository plus worktrees of the
projects a session changes, all on one branch, linked by one `pnpm-workspace.yaml` so changes
across projects build and test together before any release (`tools/ws.mjs`).

**Version pull request**: the "version packages" pull request CI opens from a project's pending
changesets; merging it publishes the versions it applies. The target release path for every
project (`docs/process/README.md` §4, "Transition").
_Avoid_: cascade (umbrella's retired local release of a project and all its dependents).

**Merge gate**: the short review every pull request passes before it merges. It blocks only
critical findings; everything else is fixed when cheap or filed, and the merge then happens
without a human approval step (`docs/process/merging.md`).
_Avoid_: review loop (the per-pull-request process it replaces).

**Health review**: the periodic, per-project review of what merged since the previous one, at
every severity, plus a survey of the project's architecture. It files tickets in the project's
tracker; it never blocks a merge or a release.

**Critical finding**: a review finding whose merge would cause concrete harm right away that a
later follow-up cannot safely repair, backed by the file and line and a specific failure scenario or a
reproduction.
The one kind of finding that blocks a merge (`docs/process/review-rubric.md`).
_Avoid_: blocker, showstopper.

**Deferred bug**: a known bug in a project, not yet fixed: an open issue labelled `bug` in the
project's own tracker, whatever filed it (a merge-gate follow-up, a health review, a session that
found it while working).
