# statewalker-root — agent instructions

The root project of the statewalker ecosystem. **Every development session starts here.** This
repository holds no product code: it holds the plan (GitHub issues), the knowledge (glossary, ADRs,
process docs, research), the shared agent skills (`.claude/skills/`), and the map of the projects
below. Code changes are committed in the project's own repository, never here.

## Start of every session

1. Read the ticket you were given (`docs/agents/issue-tracker.md`) and **claim it** by assigning it,
   before any other write. No ticket? Ask, or run `/ask-matt` to route the request.
2. Read `docs/process/README.md` for the workflow that fits the ticket, and
   `docs/process/sessions.md` for how this session contributes to this repository.
3. Clone the projects the ticket touches into `repos/<name>` (gitignored), from `repos.json`.
   Read each project's own `CLAUDE.md` / `README.md` before changing it.

## Projects

All under `github.com/statewalker/<name>`; clone to `repos/<name>`. Layers are computed from
published `@statewalker/*` dependencies: a project depends only on lower layers, so changes land
and release bottom-up. Full inventory, apps and known problems: `docs/projects.md`.

| Layer | Project | What it holds |
|---|---|---|
| L0 | statewalker-shared | Foundation: adapters, baseclass, commands, ids, logger, registry, slots |
| L0 | statewalker-fsm | Hierarchical state machines, validator, charts, viewer |
| L0 | statewalker-db | Database drivers: db-api, DuckDB, PGlite, SQLite (browser, node, DO) |
| L0 | webrun-wire | Request/Response and RPC over byte channels (streams, msgpack, WebRTC, libp2p, ws) |
| L1 | webrun-files | FilesApi: node, browser, mem, S3, SQLite, HTTP, RPC, composite |
| L1 | statewalker-search | Indexers: full-text, vector, ngram, chunker, DuckDB/PGlite/SQLite backends |
| L2 | webrun-sites | Incremental build engine, module resolution and serving, site builder |
| L2 | webrun-sync | Content store, transfer, merge, files sync |
| L2 | httpeers | P2P HTTP mesh libraries + deployables (relay, hub, sites, session shell) |
| L3 | webrun-vcs | Git-compatible VCS in TypeScript; examples, demos, benchmarks |
| L3 | statewalker-knowledge | Observable notebooks on a FilesApi, built to static sites |
| L3 | cellb.dev | cellb: isomorphic Durable Objects runtime; platform packages, examples, site |
| L4 | statewalker-kernel | Headless workbench kernel: backbone, platform, workspace, explorer, shell |
| L5 | statewalker-ai | Agent runtime, model config, local models, OpenAI-compatible providers |
| L6 | statewalker-shell-react | Workbench React views (shell, explorer, settings, mime viewers, shadcn) |
| L7 | sandclaw | Chat and wiki apps; wiki.core, file-mounts.core, file-panels.core |
| app | statewalker-sandbox | Experimental apps and private prototypes; being dissolved (`docs/refactoring/`) |
| app | statewalker-shell-theia | Browser-only Eclipse Theia shell over a FilesApi |
| app | statewalker-sites | Private: documentation sites and blog (Cloudflare Workers) |
| app | webrun-devtools | Chrome extension for browser automation from HTML pages |
| infra | umbrella | Private: release tooling (`tools/sw.mjs`), registry, combined workspace |
| infra | .github | Shared CI workflows and release-planning scripts |

Archived, do not change: `statewalker-content`, `statewalker-ai-legacy`.

## Rules

- **Releases only through umbrella's `tools/sw.mjs`** (`release` / `cascade`), one at a time, from
  a clean `main`. Never `npm publish` or `pnpm publish` by hand.
- **Lower layers first.** A change spanning layers merges and releases bottom-up.
- **Code goes to the project's repository** as a pull request, one per repository, linked from
  the ticket. Knowledge goes here, as a pull request (`docs/process/sessions.md`).
- **Before merging any pull request**, run the review loop in `docs/process/merging.md`: review
  by a separate agent with findings graded critical / high / medium / low, fix them all, review
  again while critical or high remain, merge only when CI is green.
- **Do not create files that track state.** Tickets, maps, specs, progress and handoffs are
  GitHub issues and issue comments, not files.

## Agent skills

### Issue tracker

GitHub issues on `statewalker/statewalker-root`, including Wayfinder maps. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context here: `GLOSSARY.md` and `docs/adr/` at the root hold ecosystem-wide terms and
decisions; each project keeps its own. See `docs/agents/domain.md`.
