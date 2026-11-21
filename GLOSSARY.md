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
lifecycle, and is installed, enabled, disabled and removed as a whole; each of its halves
activates on its own.
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

**Surface**: a piece of UI described by an A2UI message stream, usually from outside the client
(an agent or a server half) and rarely declared statically by a client half, rendered only from
catalog components.
_Avoid_: generated UI (fine in prose), spec.

**Catalog component**: a component a fragment defines once, with typed props and events, that
surfaces may name; privileged code, reviewed like any fragment code.
_Avoid_: widget.

**Component catalog**: the set of catalog components a surface may use: the platform's base
catalog plus those of the installed fragments.

**Zone**: a named region of the workbench layout where views are placed: left side, right side,
bottom panel, centre.
_Avoid_: area, region, slot (the runtime mechanism behind extension points).

**Device mode**: the layout regime the shell picks from its available width: desktop, compact or
mobile. Each mode keeps its own saved layout.
_Avoid_: breakpoint (the threshold, not the regime), form factor.

**Runtime**: the software that runs Workers and Durable Objects: CellB, CellD, workerd or wrangler,
Cloudflare. The platform runs on a runtime; a host is where one runs.
_Avoid_: platform (the layer above), engine.

**System code**: the platform's own code on top of a runtime, client and server: the kernel and
the core fragments that define extensions, commands, agent sessions, the user's security and
capability model, l10n and branding, and the UI that installs and manages fragments.
_Avoid_: core (alone, ambiguous), framework.

**Sandboxed code**: code that is neither system code nor an installed fragment, such as code
written by the user or an agent and built on the fly from files, or a peer's app; never trusted,
so it runs only inside a sandbox.
_Avoid_: user code (also covers fragments the user wrote), plugin.

**Sandbox**: an execution environment isolated from system code and fragments, such as an iframe
on a random origin with its own runtime or virtual Node, reaching the system only through a broker.
_Avoid_: container (one possible implementation), playground.

**Kernel**: the minimal part of the platform that loads fragments, routes extensions to the
extension points' owners, runs the lifecycle and places fragments on hosts; it declares no
extension points of its own.
_Avoid_: platform (the whole), core (alone, ambiguous).

**Core fragment**: a fragment that ships with the platform as system code, under the reserved
`system.` id prefix; it cannot be uninstalled.
_Avoid_: built-in plugin, system plugin.

**Profile**: the user's stored state on one host: settings values, saved layouts and the vault.
_Avoid_: account (implies a server-side user), workspace.

**Vault**: the encrypted part of a profile that holds secrets, unlocked by the user.
_Avoid_: keychain, keystore, secret store.

**Fragment DO**: the one Durable Object that anchors a fragment's server half, named after the
fragment; it is awake while the server half serves and idle otherwise.
_Avoid_: main DO, root object.

**Fragment host**: the multi-project runtime on a CellB host (browser or server) that loads the
server halves of all enabled fragments side by side and wires them together; Cloudflare has none.
_Avoid_: container, plugin host (Theia's, a different thing).
