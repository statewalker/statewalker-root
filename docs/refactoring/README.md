# Refactoring plan

The step-by-step reorganization of the managed projects. This file is the readable overview. The
work is to be tracked in issues, created by the first session that works this plan:

- **Phase 0** is a Wayfinder map ("Reorganize the statewalker projects", `/wayfinder`): its five
  decisions are `wayfinder:grilling` tickets, worked with the human. Wayfinder plans; it does not
  execute.
- **Phases 1–5** are implementation tickets (`/to-tickets` from this file, labelled
  `ready-for-agent` and `repo:<name>`), one per row below, with blocking edges where a row says
  "blocked by". Phases 2–5 are ticketed once the decisions they depend on are made.

When a ticket resolves a decision differently from this plan, the ticket wins: record the decision
in an ADR and update this file in the same pull request.

Problems referenced as P1–P10 are listed in `docs/projects.md`.

## Phase 0 — decisions (grilling tickets, human in the loop)

- **0.1** **Root and umbrella.** Keep umbrella as the release tool that root points to, or merge its
   tools into root? Recommendation: keep both for now; revisit once root's tools exist.
- **0.2** **Project layout convention**: `packages/ examples/ apps/ protos/ site/`
   (`docs/process/README.md` §5). Confirm, including what CI runs for `examples/`.
- **0.3** **Where product apps live.** Recommendation: rename sandclaw to an apps project (chat, wiki,
   peershare); alternative: peershare moves to `httpeers/apps`.
- **0.4** **Fate of statewalker-sandbox** after phase 2: archive, or keep as `labs` with one folder per
   experiment, an owner and a review date, and no inbound dependencies.
- **0.5** **Docs location**: library doc sites next to their code (cellb.dev pattern) or all in
   statewalker-sites.

## Phase 1 — hygiene (small, independent; parallel)

| Step | Project | Change | Fixes |
|---|---|---|---|
| 1.1 | umbrella | Bring umbrella's `repos.json` to the same set of names as this repository's, in umbrella's own format (SSH URLs, umbrella itself omitted): add `cellb.dev` (also to the workspace's library list) and `statewalker-root` (or exempt it in `repos.mjs check`, which otherwise fails) | P1 |
| 1.2 | umbrella | Workspace selects library globs, not repositories, so `httpeers/packages/*`, `sandclaw/packages/*`, `cellb.dev/packages/cellb` join it | P2 |
| 1.3 | .github, then statewalker-db, webrun-wire, webrun-sites | Move `tools/consumer-install` into shared scripts (or replace with umbrella's `npmverify.sh`); then one ticket per project removes its copy | P8 |
| 1.4 | umbrella | Update the GitHub description to match the README | P10 |
| 1.4b | umbrella | Point its `CLAUDE.md` and `docs/agents/` at statewalker-root as the issue tracker (or remove them), so agents in umbrella get one answer | — |
| 1.5 | root | `tools/ws.mjs`: workspace new / list / sync / rm, built on umbrella's `workspace.mjs` merge logic | — |
| 1.6 | root | Extend this repository's CI (`tools/check-docs.mjs`): `repos.json` equals the organization (needs a token that can list the org's private repositories, since the default `GITHUB_TOKEN` and cloud sessions cannot; exempt statewalker-root and the archived ones), skills lint | — |
| 1.7 | every project | An agent pointer back to this repository: a short `CLAUDE.md` (or a section in the existing one) saying sessions start from statewalker-root, the tracker is there, and the review loop applies | — |

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
| webrun-sites | `apps/*-demo` and `apps/document-index-example` → `examples/`; `*-spike`, `webrun-build-lab` → `protos/`; `packages/webrun-modules/examples` → `examples/` |
| webrun-vcs | `apps/examples/*`, `apps/demos/*` → `examples/`; benchmarks stay |
| statewalker-db, statewalker-knowledge | `apps/*demo*` → `examples/` |
| cellb.dev | already `examples/`; platform fixtures stay with their package |
| all | CI runs every `examples/*` `test` (or `build`) script as a smoke test |

## Phase 5 — docs location (blocked by 0.5)

If decided in-repo: `statewalker-sites/packages/site-fsm` → `statewalker-fsm/site`,
`site-webrun` → `webrun-sites/site`; statewalker-sites keeps the main site, the blog and site-dots.

## Every project at a glance

| Project | Steps |
|---|---|
| statewalker-shared | 1.7; phase 4: no change (no examples yet) |
| statewalker-fsm | 1.7; 4 (examples); 5 (site, if decided) |
| statewalker-db | 1.3, 1.7; 4 (examples) |
| webrun-wire | 1.3, 1.7; 4 (examples); 2 (service-http, if moved here) |
| webrun-files | 1.7; 3.3 (overlap with file-mounts.core) |
| statewalker-search | 1.7; 2 (receives pdf/layout protos) |
| webrun-sites | 1.3, 1.7; 2 (receives notes-demo); 4 (examples); 5 (site, if decided) |
| webrun-sync | 1.7; no other change |
| httpeers | 1.7; 2 (receives httpeers protos, retires sandbox duplicates); 3.4 (peershare, if decided) |
| webrun-vcs | 1.7; 2 (receives vcs-protos); 4 (examples) |
| statewalker-knowledge | 1.7; 4 (examples) |
| cellb.dev | 1.1, 1.7; 2 (receives flue apps) |
| statewalker-kernel | 1.7; 3.3 (receives file-mounts.core, file-panels.core) |
| statewalker-ai | 1.7; 2 (receives openai-proxy.app) |
| statewalker-shell-react | 1.7; 2 (receives byok prototype, mvc blueprints); 3.2 (app-shell) |
| sandclaw | 1.7; 2 (receives fm-protos); 3 (all) |
| statewalker-sandbox | 2 (dissolved; archived or labs) |
| statewalker-shell-theia | 1.7; no other change (already app + protos) |
| statewalker-sites | 1.7; 5 (if decided) |
| webrun-devtools | 1.7; no other change |
| umbrella | 1.1, 1.2, 1.4, 1.4b |
| .github | 1.3 |
