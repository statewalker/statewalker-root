# Glossary

Ecosystem-wide terms. Project-local terms live in each project's own glossary
(`docs/agents/domain.md`).

**Root project**: this repository, `statewalker-root`. Holds the plan, the knowledge and the
skills; no product code. Every session starts here.
_Avoid_: umbrella (that is the release-tooling repository), home repo (the pattern's name).

**Project**: one repository under `github.com/statewalker` listed in `repos.json`, usually a pnpm
monorepo of several packages.
_Avoid_: repo (fine in prose about git), monorepo (says how, not what).

**Package**: one `package.json` inside a project. **Library**: a package published to npm.
**App**: a private package that runs or deploys. **Example**: a small private runnable package
showing one library feature. **Proto**: a throwaway prototype that may break.

**Layer**: a project's position in the dependency order (L0 = depends on no other project). A
project depends only on lower layers; changes merge and release bottom-up.

**Session**: one agent conversation working one ticket, on its own branch of this repository.

**Workspace**: a folder holding worktrees of several projects on one feature branch, linked into
one pnpm workspace, so changes across projects build and test together before any release.

**Cascade**: releasing a project and then updating and releasing every dependent project in layer
order (`umbrella/tools/sw.mjs cascade`).
