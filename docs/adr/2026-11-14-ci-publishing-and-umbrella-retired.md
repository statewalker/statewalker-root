# CI publishing, and umbrella retired into root

**Status**: accepted, 2026-11-14. Supersedes decision 5's release clause in
[root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md).

## Context

Releases were made locally by a human with umbrella's `tools/sw.mjs` (`release`, `cascade`), and
CI was meant never to publish. Meanwhile seven projects' `ci.yml` gained OIDC `npm publish` jobs, so
two release paths existed ([#10](https://github.com/statewalker/statewalker-root/issues/10)). Umbrella
also kept a second project registry beside root's `repos.json`, its own issue tracker and its own
agent docs, so a session got two answers to "which projects exist" and "where do issues go".

## Decision

1. **Publishing happens only in CI**, by npm trusted publishing from the standard `publish` job of
   each project's `ci.yml`. One shape everywhere: changesets open a "version packages" pull
   request, and merging it publishes. That pull request goes through the merge gate
   (`docs/process/merging.md`) like any other, so a session can release without the human.
2. Publishing by hand, or a publish step outside the standard job, is a release-path bypass: the
   shared CI fails it and the review loop grades it critical.
3. Dependents are updated automatically after a publish, with dependencies declared as version
   ranges so a compatible release only moves lockfiles
   ([#15](https://github.com/statewalker/statewalker-root/issues/15)).
4. **Umbrella is archived.** Its repository-management tools live in root's `tools/` (plain Node,
   no dependencies): `repos.mjs`, `ws.mjs` (per-feature workspaces, replacing `workspace.mjs`),
   `packages.mjs` (`sw.mjs`'s read-only `status` and `deps`), and the maintenance tools. `sw.mjs`'s
   `release`, `cascade` and `update` are dropped. Root's `repos.json` is the only registry.

## Consequences

- No human release step between layers: a change spanning layers lands bottom-up as project pull
  request, version pull request, then the next layer (`docs/process/README.md` §3).
- Releases carry npm provenance, and CI needs no long-lived npm token (OIDC).
- A project whose CI does not publish yet cannot release until its CI-publishing ticket lands.
- Umbrella's open issues stay in the archived repository (private, read-only); they were not moved.
