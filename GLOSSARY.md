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
changesets; merging it publishes the versions it applies. The release path of every publishing
project (`docs/process/README.md` §4).
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

## Platform

**Fragment**: the unit of extension and of distribution of the platform: a manifest plus at least
one of a server half, a client half or an agent half. It has its own identity, version and
lifecycle, and is installed, activated, deactivated and removed as a whole.
Eclipse calls this a plug-in; an Eclipse "fragment" (a partial bundle attached to a host) is a
different thing.
_Avoid_: plug-in, module (informal synonyms at most; never as names in code or docs).

**Server half**: the part of a fragment that runs as Workers and Durable Objects, declared as a
`wrangler.jsonc` project. A fragment has no other kind of server code.

**Agent half**: the agent plugins a fragment carries, if any; they come and go with the fragment.

**Agent plugin**: a package of skills, tools and agent definitions for AI harnesses, in the Agent
Plugins format. A different thing from a fragment: a fragment may carry agent plugins, but is not
one.

**Client half**: the part of a fragment that contributes to the shell: commands, menus, views,
components, settings, messages, themes.

**Aspect**: one application-wide dimension that every fragment may fill: server, client, agent.
Each aspect has its own configuration file per fragment.
_Avoid_: layer (a project's place in the dependency order), half (the part of one fragment in one
aspect).

**Extension point**: a named, schema-typed place, declared by one fragment within one aspect, where
other fragments may contribute (menus in a UI fragment, data sources in a server fragment).
_Avoid_: hook, slot (a slot is the runtime mechanism behind it).

**Extension**: one fragment's contribution to an extension point.
_Avoid_: contribution (fine in prose), plug-in.

**Platform**: the core and the shell that load, run and manage fragments; empty without them.
_Avoid_: kernel (one of its packages today), framework.

**Application**: what a user runs: a brand, a chosen set of fragments and a default layout, on the
platform. Sandclaw is meant to be one.
_Avoid_: app (the repository term above: a private package), product, distribution.

**Host**: a place where server halves run: the browser (CellB), a server (CellD or workerd), or
the cloud (Cloudflare Workers).
_Avoid_: runtime (the software, not the place), target.
