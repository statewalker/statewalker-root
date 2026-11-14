# statewalker-root — agent instructions

The root project of the statewalker ecosystem. **Every development session starts here.** This
repository holds no product code: it holds the plan (GitHub issues), the knowledge (glossary, ADRs,
process docs, research), the shared agent skills (`.claude/skills/`), and the map of the projects
below. Code changes are committed in the project's own repository, never here.

## Start of every session

1. Read the ticket you were given and **claim it** (assign it and comment the claim,
   `docs/agents/issue-tracker.md`) before any other write. No ticket? Ask the human (they can type
   `/ask-matt` to route the request).
2. Read `docs/process/README.md` for the workflow that fits the ticket, and
   `docs/process/sessions.md` for how this session works and contributes to this repository.
3. Get the projects the ticket touches, from `repos.json`:
   - **cloud**: work in the checkouts of the projects selected for the session (the harness clones
     them beside this repository; before the first commit in each, check `git branch
     --show-current` and, if it is not the session branch, `git checkout -b <session-branch>`);
     clone unselected public projects into
     `repos/<name>` (gitignored) for reading only, since pushes and API calls need the project
     selected or attached;
   - **local**: work in worktrees under `ws/<feature>/`; `repos/` holds clean clones that are
     never edited (`docs/process/sessions.md`).

   Read each project's own `CLAUDE.md` / `README.md` before changing it.

## Precedence

This file and `docs/` win over a project's own agent docs and over the vendored skills where they
disagree. In particular: **the issue tracker is always `statewalker/statewalker-root`**, whatever a
project's docs say (umbrella's still name `statewalker/umbrella`), and the overrides listed under
**Agent skills** below apply.

## Projects

All under `github.com/statewalker/<name>`. Layers are computed from published `@statewalker/*`
dependencies; a project's published packages depend only on lower layers, so changes land and
release bottom-up. Private packages may reach sideways: cellb.dev's depend on
statewalker-knowledge and webrun-vcs, so cellb.dev must come after them. Inventory, apps and known problems:
`docs/projects.md`.

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
| L3 | cellb.dev | cellb: isomorphic Durable Objects runtime; platform packages, examples, site (after statewalker-knowledge) |
| L4 | statewalker-kernel | Headless workbench kernel: backbone, platform, workspace, explorer, shell |
| L5 | statewalker-ai | Agent runtime, model config, local models, OpenAI-compatible providers |
| L6 | statewalker-shell-react | Workbench React views (shell, explorer, settings, mime viewers, shadcn) |
| L7 | sandclaw | Chat and wiki apps; wiki.core, file-mounts.core, file-panels.core |
| app | statewalker-sandbox | Experimental apps and private prototypes; being dissolved (`docs/refactoring/`) |
| app | statewalker-shell-theia | Browser-only Eclipse Theia shell over a FilesApi |
| app | statewalker-sites | Private: documentation sites and blog (Cloudflare Workers) |
| app | webrun-devtools | Chrome extension for browser automation; publishes `@statewalker/webrun-devtools` |
| infra | umbrella | Private: release tooling (`tools/sw.mjs`), its own registry, combined workspace |
| infra | .github | Shared CI workflows and release-planning scripts |

Archived, do not change: `statewalker-content`, `statewalker-ai-legacy`. Private projects
(umbrella, statewalker-sites) must be selected for a cloud session even to read them.

`repos.json` here is the source of truth for which projects exist; umbrella's registry follows it
(`docs/refactoring/README.md`, step 1.1).

## Rules

- **Releases only through umbrella's `tools/sw.mjs`** (`release` / `cascade`), run locally by a
  human logged in to npm (`docs/process/README.md` §4). Never `npm publish` or `pnpm publish` by
  hand, and never from a cloud session.
- **Lower layers first.** A change spanning layers merges and releases bottom-up, with a human
  release between layers (`docs/process/README.md` §3).
- **Code goes to the project's repository** as a pull request, one per repository, linked from
  the ticket; project pull requests reference it in full, `statewalker/statewalker-root#<n>` (a
  bare `#<n>` there points at the project's own issues). Knowledge goes here, as a pull request (`docs/process/sessions.md`).
- **Before merging any pull request**, run the review loop in `docs/process/merging.md`: review
  by a separate agent with findings graded critical / high / medium / low, fix them all, review
  again while critical or high remain, merge only when checks are green. The only exception is
  the commits `sw.mjs` pushes to `main` during `update`, `release` and `cascade`.
- **Do not create files that track state.** Tickets, maps, specs, progress and handoffs are
  GitHub issues and issue comments, not files.

## Agent skills

### Issue tracker

GitHub issues on `statewalker/statewalker-root`, including Wayfinder maps. Always name the
repository explicitly (`-R statewalker/statewalker-root`, or `owner`/`repo` in MCP tools): sessions
run inside project clones, where `gh` would otherwise pick the project. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context here: `GLOSSARY.md` and `docs/adr/` at the root hold ecosystem-wide terms and
decisions; each project keeps its own. See `docs/agents/domain.md`.

### Skills only a human can start

`ask-matt`, `grill-me`, `grill-with-docs`, `handoff`, `implement`, `implement-spec`,
`improve-codebase-architecture`, `retro`, `setup-matt-pocock-skills`, `to-questionnaire`, `to-spec`,
`to-tickets`, `triage`, `wait-what` and `wayfinder` are marked `disable-model-invocation`: the human
types them (`/wayfinder statewalker-root#4`). In a session started with only a ticket, when the
ticket's route needs one of them, read `.claude/skills/<name>/SKILL.md` and follow it, and say so in
the claim comment; for a human-in-the-loop skill (grilling, prototype review), ask the human to
type the command instead.

### Overrides of the vendored skills

- **ADR file names are `docs/adr/YYYY-MM-DD-<slug>.md`**, not sequential numbers: this overrides
  the numbering in `domain-modeling`'s `ADR-FORMAT.md` (parallel sessions would collide on the next
  number). The same applies inside projects that adopt this convention.
- **Wayfinder tickets may carry `repo:<name>` labels** besides their `wayfinder:` label, to say
  which projects a decision concerns; this overrides `wayfinder`'s "only `wayfinder:` labels".
  Triage labels stay off Wayfinder tickets.
- **Wayfinder research lands as `docs/research/<slug>.md`** in the session's root pull request,
  not on a throwaway `research/*` branch. The charting session may resolve its own research
  tickets (through subagents), the one exception to one ticket per session.
- **Wayfinder tickets never take triage labels.** Where this repository's docs say to label a
  ticket `ready-for-human`, a Wayfinder ticket gets only the `Waiting on human: …` status comment
  (`docs/agents/issue-tracker.md`), which keeps it off the frontier until the human comments
  `Resumed`.
- **`/implement-spec` claims the spec and all its tickets**: the session comments a claim on the
  spec issue and on every child ticket it will build, the second exception to one ticket per
  session. Tickets do not close through pull requests: the session closes each one with a comment
  once its project pull request has merged (no closing keywords; they would not reach issues in
  this repository from a project repository anyway).
- **Triage's `.out-of-scope/<concept>.md` files** live at this repository's root
  (`.out-of-scope/`) and need human review to merge.
- **A handoff is a comment on the ticket**, not the `/handoff` skill's file: that file lands in
  `$TMPDIR`, which a cloud container loses.
- **Reviews follow `docs/process/merging.md`**, which overrides `/code-review`'s "do not rerank"
  and its sub-agent fan-out.
