# Projects

Inventory of the managed projects as of 2026-11-14 (shallow clones of every `main`). "Libraries"
are published `@statewalker/*` packages; "private" counts apps, examples, prototypes and test kits.
Regenerate the numbers when they drift; the layer order is the part that matters.

## Dependency layers

Computed from the `dependencies` and `peerDependencies` of published packages:

```
L0  statewalker-shared · statewalker-fsm · statewalker-db · webrun-wire
L1  webrun-files (→db) · statewalker-search (→db)
L2  webrun-sites · webrun-sync · httpeers             (→files, wire)
L3  webrun-vcs (→sync) · statewalker-knowledge · cellb.dev
L4  statewalker-kernel (→shared, files, sites, vcs)
L5  statewalker-ai (→kernel, fsm)
L6  statewalker-shell-react (→ai, kernel)
L7  sandclaw (→shell-react, search, kernel)
──  apps: statewalker-sandbox · statewalker-shell-theia · statewalker-sites · webrun-devtools
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
| statewalker-shell-theia | 0 | 26 | `@theia-shell/*`: app, extensions, prototypes p1–p7 |
| statewalker-sites | 0 | 5 | site, site-fsm, site-webrun, site-dots, blog |
| webrun-devtools | 0 | 1 | the extension |

## Known problems

The refactoring plan (`docs/refactoring/README.md`) turns each of these into work.

1. `cellb.dev` is missing from umbrella's `repos.json` and from its combined workspace.
2. Umbrella's combined workspace leaves out `httpeers` entirely, although it publishes 12
   libraries, so a change spanning webrun-wire and httpeers has no linked workspace.
3. Two packages are named `@statewalker/httpeers-conformance` (sandbox and httpeers). The
   sandbox's `httpeers.core` is an older parallel line of the published `httpeers-core`.
4. statewalker-sandbox's CI needs a sibling checkout of webrun-wire: not self-contained.
5. sandclaw keeps libraries under `apps/` (`chat-mini.chat`, `chat-mini.chat-react`), and its
   `peershare.*` apps (httpeers-based) fall outside its stated "chat + wiki" scope.
6. Overlaps: sandbox `service-rpc` vs `webrun-rpc`; `file-mounts.core` vs
   `webrun-files-composite`; `app-shell` is private but generic.
7. Five conventions for examples: `apps/examples/NN-*` (webrun-vcs), top-level `examples/`
   (cellb.dev), `apps/*-demo` (webrun-sites), `packages/x/demo` (webrun-wire), `packages/x/examples`
   (statewalker-fsm, webrun-modules).
8. `tools/consumer-install` is copied into three projects and has already drifted.
9. Library docs live in two places: cellb.dev and webrun-vcs keep theirs in-repo; fsm and webrun
   docs live in the private statewalker-sites.
10. Umbrella's GitHub description (bare mirrors, branch per build configuration) no longer matches
    its README.
