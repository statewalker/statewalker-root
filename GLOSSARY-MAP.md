# Glossary map: the subjects

The ecosystem is developed as **subjects**. A subject is a group of projects that share one
direction, one set of plans and one body of knowledge. This file is the map, in the multi-context
form of the `domain-modeling` skill. Its machine-readable twin is
[`subjects/subjects.json`](subjects/subjects.json), and `tools/check-docs.mjs` keeps the two in step.
For the state of each subject, run `node tools/status.mjs` ([`docs/process/subjects.md`](docs/process/subjects.md)).

## Subjects

| Subject | Folder | Projects | What it covers |
|---|---|---|---|
| `process` | [`docs/`](docs/process/README.md) | statewalker-ci, statewalker-sandbox | How the ecosystem is developed: sessions, the merge gate, CI and releases, health reviews, the tools, the sandbox dissolution |
| `platform` | [`subjects/platform/`](subjects/platform/README.md) | statewalker-shared, statewalker-fsm, statewalker-kernel, statewalker-shell-react, statewalker-shell-theia | The headless kernel, core fragments, the React shell, and the hosts that serve fragments |
| `ai-harness` | [`subjects/ai-harness/`](subjects/ai-harness/README.md) | statewalker-ai | Agent sessions, definitions, access, and code execution on CellB, CellD and Workers |
| `runtimes` | [`subjects/runtimes/`](subjects/runtimes/README.md) | cellb.dev | CellB and CellD, the Durable Objects runtimes, and other engines on them |
| `vcs` | [`subjects/vcs/`](subjects/vcs/README.md) | webrun-vcs | A git-compatible VCS in TypeScript, with parity against native git |
| `p2p` | [`subjects/p2p/`](subjects/p2p/README.md) | webrun-wire, httpeers, webrun-devtools | Byte channels and RPC, the HTTPeers mesh, Biscuit capabilities, the devtools extension |
| `sites` | [`subjects/sites/`](subjects/sites/README.md) | statewalker-knowledge, webrun-sites, statewalker-sites | Notebooks built to static sites, the site kit, every project site |
| `product` | [`subjects/product/`](subjects/product/README.md) | sandclaw | SandClaw's branded applications and the first paid offer |
| `data` | [`subjects/data/`](subjects/data/README.md) | webrun-files, statewalker-db, statewalker-search, webrun-sync | FilesApi, database drivers, indexers and sync |

## Relationships

The arrows follow the published dependencies: lower layers first (`docs/projects.md`).

- **data → everything.** FilesApi (webrun-files) is the storage seam of the platform, the
  harness, VCS, sites and sync.
- **p2p → platform, ai-harness, product.** webrun-wire carries RPC between fragments, hosts and
  agents. HTTPeers meshes connect peers. Biscuit capabilities grant access, and move to
  `webrun-capabilities`, which also hosts the harness's light container.
- **runtimes → platform, ai-harness, sites.** CellB runs fragments' server halves, agent sessions
  and notebook pages in Node and in a browser tab.
- **vcs → platform, ai-harness.** webrun-vcs is a store for workspaces and app images.
- **platform ↔ ai-harness.** Fragments expose commands as agent tools and A2UI surfaces. The
  harness runs inside the platform as `system.agents`.
- **sites ← every subject.** Each project's site content lives in the project. The site kit
  (statewalker-knowledge) and the one build (statewalker-sites) belong to `sites`.
- **product ← platform, ai-harness, p2p.** SandClaw assembles branded applications from the
  technology blocks.
- **process ↔ every subject.** The rules in `docs/process/` apply everywhere.

## Where terms and decisions go

| Scope | Terms | Decisions | Research |
|---|---|---|---|
| One project | the project's `GLOSSARY.md` | the project's `docs/adr/` | the project, or the subject's `research/` when a root ticket asked |
| Several projects of one subject | the subject's `GLOSSARY.md`, created when the first term needs it | `subjects/<s>/adr/` | `subjects/<s>/research/` |
| Several subjects, or the process | [`GLOSSARY.md`](GLOSSARY.md) | [`docs/adr/`](docs/adr/README.md) | [`docs/research/`](docs/research/README.md) |
