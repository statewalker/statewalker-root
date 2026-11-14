# Refactoring plan

The step-by-step reorganization of the managed projects. This file is the readable overview; the
**work itself is tracked as a Wayfinder map issue** ("Reorganize the statewalker projects") with
one ticket per step below. When a ticket resolves a decision differently from this plan, the
ticket wins: record the decision in an ADR and update this file in the same pull request.

Problems referenced as P1–P10 are listed in `docs/projects.md`.

## Phase 0 — decisions (grilling tickets, human in the loop)

1. **Root and umbrella.** Keep umbrella as the release tool that root points to, or merge its
   tools into root? Recommendation: keep both for now; revisit once root's tools exist.
2. **Project layout convention**: `packages/ examples/ apps/ protos/ site/`
   (`docs/process/README.md` §5). Confirm, including what CI runs for `examples/`.
3. **Where product apps live.** Recommendation: rename sandclaw to an apps project (chat, wiki,
   peershare); alternative: peershare moves to `httpeers/apps`.
4. **Fate of statewalker-sandbox** after phase 2: archive, or keep as `labs` with one folder per
   experiment, an owner and a review date, and no inbound dependencies.
5. **Docs location**: library doc sites next to their code (cellb.dev pattern) or all in
   statewalker-sites.

## Phase 1 — hygiene (small, independent; parallel)

| Step | Project | Change | Fixes |
|---|---|---|---|
| 1.1 | umbrella | Add `cellb.dev` to `repos.json` and the workspace's library list | P1 |
| 1.2 | umbrella | Workspace selects library globs, not repositories, so `httpeers/packages/*`, `sandclaw/packages/*`, `cellb.dev/packages/cellb` join it | P2 |
| 1.3 | .github | Move `tools/consumer-install` into shared scripts (or replace with umbrella's `npmverify.sh`); remove the three copies | P8 |
| 1.4 | umbrella | Update the GitHub description to match the README | P10 |
| 1.5 | root | `tools/ws.mjs`: workspace new / list / sync / rm, built on umbrella's `workspace.mjs` merge logic | — |
| 1.6 | root | CI for this repository: markdown links, `repos.json` equals the organization, skills lint | — |

## Phase 2 — dissolve statewalker-sandbox (one ticket per row; blocked by 0.2 and 0.4)

| Item | Destination | Fixes |
|---|---|---|
| `packages/httpeers.core`, `packages/httpeers-conformance` | Retire; port anything missing into httpeers first | P3 |
| `apps/httpeers-stack`, `httpeers-protos`, `httpeers-lib-protos`, `httpeers-shell-protos` | `httpeers/protos/` (or delete what `httpeers/apps` and `deploy/` cover) | P4 |
| `apps/peershare-protos`, `peershare-ui-protos` | Next to the peershare apps (decision 0.3) | |
| `apps/flue-capfs-do`, `apps/flue-workbench` | `cellb.dev/examples/` | |
| `apps/notes-demo` | `webrun-sites/examples/` | |
| `apps/vcs-protos` | `webrun-vcs/protos/` | |
| `apps/openai-proxy.app` | `statewalker-ai/apps/` | |
| `apps/byok-config-prototype` | `statewalker-shell-react/protos/` | |
| `apps/mvc-blueprint-00…03` | `statewalker-shell-react/examples/blueprints/` | |
| `apps/fm-protos` | `sandclaw/protos/` | |
| `apps/pdf-portabletext-prototype`, `packages/layout-reconstructor-core` | `statewalker-search/protos/` | |
| `packages/service-rpc` | Retire in favour of `webrun-rpc` | P6 |
| `packages/service-http`, `service-http-impl` | Retire, or move to webrun-wire if anything still uses them | P6 |
| `packages/service-pg` | Delete (no consumer) | |
| The repository | Archive or turn into `labs` (decision 0.4) | |

Each move: copy with history where useful (`git filter-repo` or a plain copy plus a link in the
commit message), make it build and test in the destination, then delete from the sandbox.

## Phase 3 — sandclaw (blocked by 0.3)

| Step | Change | Fixes |
|---|---|---|
| 3.1 | Move `apps/chat-mini.chat`, `apps/chat-mini.chat-react` to `packages/` | P5 |
| 3.2 | Publish `app-shell` from statewalker-shell-react | P6 |
| 3.3 | Move `file-mounts.core`, `file-panels.core` down to statewalker-kernel; merge the overlap with `webrun-files-composite` | P6 |
| 3.4 | peershare per decision 0.3; rename the project if decided | P5 |

## Phase 4 — examples convention (one ticket per project, lowest layer first; blocked by 0.2)

| Project | Change |
|---|---|
| statewalker-fsm | `packages/fsm/examples` → `examples/` |
| webrun-wire | `packages/webrun-http-browser/demo` → `examples/` |
| webrun-sites | `apps/*-demo` → `examples/`; `*-spike`, `webrun-build-lab` → `protos/`; `packages/webrun-modules/examples` → `examples/` |
| webrun-vcs | `apps/examples/*`, `apps/demos/*` → `examples/`; benchmarks stay |
| statewalker-db, statewalker-knowledge | `apps/*demo*` → `examples/` |
| cellb.dev | already `examples/`; platform fixtures stay with their package |
| all | CI runs every `examples/*` `test` (or `build`) script as a smoke test |

## Phase 5 — docs location (blocked by 0.5)

If decided in-repo: `statewalker-sites/packages/site-fsm` → `statewalker-fsm/site`,
`site-webrun` → `webrun-sites/site`; statewalker-sites keeps the main site, the blog and site-dots.
