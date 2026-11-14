# Projects

Inventory of the managed projects as of 2026-11-14 (shallow clones of every `main`). "Libraries"
are published `@statewalker/*` packages; "private" counts apps, examples, prototypes and test kits.
Regenerate the numbers when they drift; the layer order is the part that matters.

## Dependency layers

Computed from the `dependencies` and `peerDependencies` of published packages. Private packages
can reach sideways: cellb.dev's `packages/notebooks` and `apps/sandbox` depend on
statewalker-knowledge, and `apps/sandbox` also on webrun-vcs, so cellb.dev must be released after
both.

```
L0  statewalker-shared · statewalker-fsm · statewalker-db · webrun-wire
L1  webrun-files (→db) · statewalker-search (→db)
L2  webrun-sites · webrun-sync · httpeers             (→files, wire)
L3  webrun-vcs (→sync) · statewalker-knowledge · cellb.dev (its private packages →knowledge, vcs)
L4  statewalker-kernel (→shared, files, sites, vcs)
L5  statewalker-ai (→kernel, fsm)
L6  statewalker-shell-react (→ai, kernel)
L7  sandclaw (→shell-react, search, kernel)
──  apps: statewalker-sandbox · statewalker-shell-theia · statewalker-sites · webrun-devtools (published)
```

## Per project

| Project | Libraries | Private | Private packages, by kind |
|---|---|---|---|
| statewalker-shared | 9 | 0 | |
| statewalker-fsm | 4 | 0 | examples inside `packages/fsm/examples` |
| statewalker-db | 9 | 3 | `apps/sqlite-search-demo`, `db-tests`, `tools/consumer-install` |
| webrun-wire | 15 | 1 | `tools/consumer-install`; demo inside `packages/webrun-http-browser/demo` |
| webrun-files | 9 | 1 | `webrun-files-tests` |
| statewalker-search | 13 | 2 | `indexer-search`, `indexer-tests` |
| webrun-sites | 7 | 8 | 6 demos/spikes in `apps/`, `webrun-build-lab`, `tools/consumer-install` |
| webrun-sync | 5 | 0 | |
| httpeers | 12 | 9 | apps: relay, hub, sites, session-shell, llm-chat, demos, appliance-prepare; 2 conformance kits |
| webrun-vcs | 14 | 29 | `apps/examples/01–11`, `apps/demos/*` (11), `apps/benchmarks/*` (3), docs, notes, 2 test kits |
| statewalker-knowledge | 3 | 1 | `apps/demo` |
| cellb.dev | 1 | 27 | platform packages, `examples/*`, `apps/sandbox`, `apps/sandbox-hub`, `site` |
| statewalker-kernel | 17 | 0 | |
| statewalker-ai | 6 | 0 | |
| statewalker-shell-react | 15 | 0 | |
| sandclaw | 4 | 10 | apps: chat-mini, peershare, wiki-viewer, ui-protos; `app-shell`; chat libraries under `apps/` |
| statewalker-sandbox | 0 | 25 | 18 apps and prototype ladders, 7 packages (`docs/refactoring/`) |
| statewalker-shell-theia | 0 | 28 | `@theia-shell/*`: app, extensions, prototypes p1, p3–p7; plus two unscoped VS Code plugin fixtures under p6 |
| statewalker-sites | 0 | 5 | site, site-fsm, site-webrun, site-dots, blog |
| webrun-devtools | 1 | 0 | the extension itself is the published package `@statewalker/webrun-devtools` |

## Known problems

The refactoring plan (`docs/refactoring/README.md`) turns each of these into work.

- **P1.** Resolved: `cellb.dev` was missing from umbrella's registry and workspace; umbrella is archived
  and this repository's `repos.json` and `tools/ws.mjs` include it.
- **P2.** Resolved: umbrella's combined workspace left out `httpeers`; `tools/ws.mjs new --libraries`
  links every project's `packages/*`.
- **P3.** Two packages are named `@statewalker/httpeers-conformance` (sandbox and httpeers). The
  sandbox's `httpeers.core` is an older parallel line of the published `httpeers-core`.
- **P4.** statewalker-sandbox's CI needs a sibling checkout of webrun-wire: not self-contained.
- **P5.** sandclaw keeps libraries under `apps/` (`chat-mini.chat`, `chat-mini.chat-react`), and its
  `peershare.*` apps (httpeers-based) fall outside its stated "chat + wiki" scope.
- **P6.** Overlaps: sandbox `service-rpc` vs `webrun-rpc`; `file-mounts.core` vs
  `webrun-files-composite`; `app-shell` is private but generic.
- **P7.** Five conventions for examples: `apps/examples/NN-*` (webrun-vcs), top-level `examples/`
  (cellb.dev), `apps/*-demo` (webrun-sites), `packages/x/demo` (webrun-wire), `packages/x/examples`
  (statewalker-fsm, and webrun-sites' `packages/webrun-modules/examples`).
- **P8.** `tools/consumer-install` is copied into three projects and has already drifted.
- **P9.** Library docs live in two places: cellb.dev and webrun-vcs keep theirs in-repo; fsm and webrun
  docs live in the private statewalker-sites.
- **P10.** Resolved: umbrella's GitHub description no longer matched its README; umbrella is archived.
