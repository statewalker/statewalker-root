# tools

Managing the projects of `repos.json` from one machine. Plain Node (24) and shell, **no
dependencies**: nothing to install. A tool that needs a dependency belongs in the project it
serves. Nothing here publishes: releases happen only in CI (`docs/process/README.md` §4).

| Tool | What it does |
|---|---|
| `repos.mjs clone \| pull \| status \| check` | The clones under `repos/`: clone the missing ones; fetch and fast-forward each clean `main`; branch and ahead/behind per clone; compare `repos.json` with the GitHub organization |
| `ws.mjs new \| list \| sync \| rm` | Per-feature workspaces under `ws/<feature>/`: worktrees on one branch, linked by a generated `pnpm-workspace.yaml` (`docs/process/sessions.md`, "Local") |
| `packages.mjs status \| deps` | Versions not `latest` on npm and `@statewalker` references behind npm, in dependency order (`--deep` also builds and compares contents); the projects that depend on one, in update order |
| `check-metadata.mjs [project…]` | `repository` / `homepage` / `bugs` of every manifest, GitHub references that are renamed or archived, and what npm serves as `latest` |
| `adopt.mjs <dir>` | Bring a project to the conventions: shared CI, Dependabot, changesets. Idempotent |
| `fix-repo-metadata.mjs <dir> <repo>` | Point every manifest's `repository` / `homepage` / `bugs` at the repository it lives in |
| `rename-package.mjs <repo> OLD=NEW…` | Rename `@statewalker` packages inside one project, references included |
| `rename-dirs.mjs <dir> <parent> OLD=NEW…` | Move package folders and rewrite the paths that point at them |
| `ci-local.sh <dir>` | The shared CI steps (`statewalker/.github`), run locally; prints the first failing step |
| `npmverify.sh <registry> <dir> <pkgdir>…` | Install the given packages from npm into an empty folder and import every exported entry |
| `check-docs.mjs` | This repository's own CI: Markdown links, skills lock, `repos.json` format |

They work on the clones in `repos/` (gitignored; `SW_REPOS` overrides). Those clones are for reading
and as worktree sources: never edit them, work in a workspace. `packages.mjs status --deep` and
`ci-local.sh` also need `repos/.github` (`SW_CI_SCRIPTS` overrides its `scripts/` folder).

```sh
node tools/repos.mjs clone          # once; later: node tools/repos.mjs pull
node tools/repos.mjs status
node tools/packages.mjs status
node tools/ws.mjs new 42-sqlite-cache webrun-files webrun-sites && (cd ws/42-sqlite-cache && pnpm install)
node tools/ws.mjs new libs --libraries   # every published library, linked: work across all of them
```

## In cloud sessions

`gh` reaches only the repositories attached to the session, and GraphQL not at all. So
`repos.mjs check` cannot list the organization there, and `check-metadata.mjs` reports every
unattached repository as missing: run both locally. `repos.mjs clone` clones the public projects
over HTTPS; private ones fail unless attached.

## What changed from umbrella

These tools came from the archived `statewalker/umbrella` (statewalker-root#14). `workspace.mjs`
became `ws.mjs` (per-feature, on a branch, instead of one detached workspace); `sw.mjs` kept only
its read-only commands, as `packages.mjs`; `release`, `cascade`, `update`, `unpublished-on-main.mjs`
(covered by `packages.mjs status`) and `merge-when-green.sh` (replaced by the merge gate,
`docs/process/merging.md`) were dropped; `adopt.mjs` no longer strips publishing jobs.
