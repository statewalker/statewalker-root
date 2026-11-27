# statewalker-root — agent instructions

The root project of the statewalker ecosystem. **Every development session starts here.** This
repository holds no product code: it holds the plan (GitHub issues), the knowledge (glossary, ADRs,
process docs, research), the shared agent skills (`.claude/skills/`), and the map of the projects
below. Code changes are committed in the project's own repository, never here.

The work is organized by **subject** ([`GLOSSARY-MAP.md`](GLOSSARY-MAP.md)):
- **`docs/`** is how we work: process, agents, cross-subject ADRs. It is also the home of the
  `process` subject.
- **`subjects/<s>/`** is what each subject builds: README, `adr/`, `research/`, `roadmap.md`,
  `handoffs/`.
- **Projects:** every project belongs to one subject (`subjects/subjects.json`).
- **State:** where each subject stands and what comes next is never in a file. Run
  `node tools/status.mjs` (`docs/process/subjects.md`).

## Start of every session

0. **Get the state:** `node tools/status.mjs <subject…>` for the subjects the request touches, or
   with no arguments when the human asks where things stand. Then read those subjects' `README.md`
   and the current handoff note of the ticket you will work (`docs/process/subjects.md`, §1 and §3).
1. Read the ticket you were given and **claim it** (assign it and comment the claim,
   `docs/agents/issue-tracker.md`) before any other write. No ticket? Show the human the state of
   the subject they mean and the frontier, and ask which ticket to take (they can type `/ask-matt`
   to route the request). To add a subject or a project, follow `docs/process/subjects.md` §4 and
   §5.
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

   Read each project's own `CLAUDE.md` / `README.md` before changing it, and list its open
   deferred bugs; fix those in the code you touch in the same pull request when cheap
   (`docs/process/prevention.md`).

## Precedence

This file and `docs/` win over a project's own agent docs and over the vendored skills where they
disagree. In particular, **issues are placed by subject**, whatever a project's docs say: an issue
about one project alone (a bug, a design question, an improvement, a review follow-up, a health
review's finding) goes to **that project's tracker**; plans and the process go to
**`statewalker/statewalker-root`**: Wayfinder maps and their tickets, specs and the tickets they
break into (even for one project), `area:root` tickets, health-review record tickets and
escalations (`docs/agents/issue-tracker.md`).
The overrides listed under **Agent skills** below apply.

## Projects

All under `github.com/statewalker/<name>`. Layers are computed from published `@statewalker/*`
dependencies; a project's published packages depend only on lower layers, so changes land and
release bottom-up. Private packages may reach sideways: cellb.dev's depend on
statewalker-knowledge and webrun-vcs, so cellb.dev must come after them. Inventory, apps and known problems:
`docs/projects.md`. Each project's subject: `subjects/subjects.json` (source of truth; `GLOSSARY-MAP.md` is its readable twin).

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
| L3 | statewalker-ai | The AI harness: environment, access, definitions, sessions, Flue adapter, hosting, OpenAI/UHP projections (spec statewalker-root#111) |
| L4 | statewalker-kernel | Headless workbench kernel: backbone, platform, workspace, explorer, shell |
| L6 | statewalker-shell-react | Workbench React views (shell, explorer, settings, mime viewers, shadcn) |
| L7 | sandclaw | Chat and wiki apps; wiki.core, file-mounts.core, file-panels.core |
| app | statewalker-sandbox | Experimental apps and private prototypes; being dissolved (`docs/refactoring/`) |
| app | statewalker-shell-theia | Browser-only Eclipse Theia shell over a FilesApi |
| app | statewalker-sites | Private: documentation sites and blog (Cloudflare Workers) |
| app | webrun-devtools | Chrome extension for browser automation; publishes `@statewalker/webrun-devtools` |
| infra | statewalker-ci | Shared CI workflows and release-planning scripts (`statewalker/.github` resolves to the same repository) |

Archived, do not change: `statewalker-content`, `statewalker-ai-legacy`, `umbrella` (its
repository-management tools now live in this repository's `tools/`). The private project
(statewalker-sites) must be selected for a cloud session even to read it.

`repos.json` here is the source of truth for which projects exist. `tools/` manages them from one
machine, plain Node with no dependencies (`tools/README.md`): `repos.mjs` (clone, pull, status,
check against the organization), `ws.mjs` (per-feature workspaces), `packages.mjs` (what is
unpublished, what is behind npm, dependency order).

## Rules

- **Releases only through CI** (npm trusted publishing from each project's `ci.yml`): changesets
  open a "version packages" pull request, and merging it, through the merge gate like any other,
  publishes (`docs/process/README.md` §4). Never `npm publish` or `pnpm publish` by hand, from any
  machine: a publish outside the standard `publish` job is a release-path bypass, a critical
  finding. The one exception (a package's first version is published once by a human): §4.
- **Lower layers first.** A change spanning layers merges and releases bottom-up: the lower
  project's version pull request merges and publishes before the upper project moves to the new
  version (`docs/process/README.md` §3).
- **Code goes to the project's repository** as a pull request, one per repository, linked from
  the ticket; project pull requests reference a root ticket in full,
  `statewalker/statewalker-root#<n>` (a bare `#<n>` there points at the project's own issues), and
  a ticket in the same project as `#<n>`. Knowledge goes here, as a pull request (`docs/process/sessions.md`).
- **Before merging any pull request**, pass the merge gate in `docs/process/merging.md`,
  automatically: once CI is green, one separate reviewer agent reports only critical findings
  (the classes and evidence bar of `docs/process/review-rubric.md`) and high findings in the
  changed lines; you judge each one real or speculative; fix critical always, re-verified on the
  fix diff only, for at most three passes; fix high when cheap, otherwise file one follow-up issue
  in the pull request's own repository; post one record comment per pass; then **merge
  automatically** once no critical finding is open, every high finding is fixed or filed, and
  checks are green. Only the human, in their own message, overrides a critical finding. No
  exceptions: the version pull requests that publish pass the same gate.
- **Tests first.** A bug fix carries a regression test; new behaviour carries tests (`/tdd`).
- **Picking your own work:** escalated bug tickets before feature tickets, oldest first
  (`docs/process/prevention.md`).
- **Git guardrails.** `.claude/settings.json` runs a hook that refuses force-pushing `main`,
  `git reset --hard` and deleting branches. Never work around it; the human runs such commands
  themselves.
- **Do not create files that track state.** Tickets, maps, specs and progress are GitHub issues
  and issue comments, not files: `tools/status.mjs` reads them. Handoffs are dated, write-once
  notes in the subject's `handoffs/` (`subjects/<s>/handoffs/`, or `docs/handoffs/` for the process;
  rules in `docs/process/handoffs.md`), linked from a one-line comment on the ticket. Notes of
  finished work, or replaced ones, move unchanged to the sibling `handoffs.archive/`.
- **Checkpoint as you go.** Any session can be interrupted. At each milestone (pull request
  opened or merged, release, decision, child session, blocker), comment `Progress: …` on the
  ticket with links. Comment `Waiting on human: …` the moment the human is needed. File what is
  left as issues. A new session must be able to rebuild the state from GitHub and the root alone.
  Write a handoff note only for what issues can't hold (`docs/agents/issue-tracker.md`,
  "Checkpoints"; `docs/process/handoffs.md`).
- **The root records only what continuation needs.** When a subject advances, update its root
  files only where a new session needs it to continue on its own: dated entry points, ADRs,
  research, a handoff note. Never repeat what the code, a project's docs or a ticket already holds
  (`docs/process/subjects.md` §6).
- **Every root issue has a subject:** a `subject:<s>` label on plans and standalone issues; a
  map's or spec's tickets inherit it (`docs/agents/issue-tracker.md`).

## Agent skills

### Issue tracker

GitHub issues, placed by subject (**Precedence** above): plans, Wayfinder maps, specs and the
process on `statewalker/statewalker-root`; an issue about one project alone in that project's
tracker. Always name the repository explicitly (`-R statewalker/<repo>`, or `owner`/`repo` in MCP
tools): sessions run inside project clones, where `gh` would otherwise pick the project.
Pull-request operations name the pull request's own repository. Before creating any issue, check
it is not already filed (update the existing one only if the new finding changes its scope). See
`docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context by subject. `GLOSSARY-MAP.md` lists the subjects. `GLOSSARY.md` and `docs/adr/`
hold the terms and decisions that span subjects, and the process ones. `subjects/<s>/adr/` holds a
subject's own decisions, and each project keeps its own. See `docs/agents/domain.md`.

### Skills only a human can start

`ask-matt`, `followup`, `grill-me`, `grill-with-docs`, `handoff`, `implement`, `implement-spec`,
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
  which projects a decision concerns, and a map carries its `subject:<id>` label; this overrides
  `wayfinder`'s "only `wayfinder:` labels".
  Triage labels stay off Wayfinder tickets.
- **Wayfinder research lands as `subjects/<s>/research/<slug>.md`** (`docs/research/` for the
  process or several subjects), in the session's root pull request, not on a throwaway `research/*` branch. The charting session may resolve its own research
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
- **`/triage` and `/to-tickets` set `ready-for-agent` only on a ticket with explicit acceptance
  criteria**, and, for a ticket touching storage formats, migrations or sync, a migration and
  rollback note in them; otherwise the ticket stays `needs-triage` or `needs-info`
  (`docs/process/prevention.md`). This overrides `/to-tickets`' "apply `ready-for-agent` unless
  instructed otherwise".
- **Triage's `.out-of-scope/<concept>.md` files** live at this repository's root
  (`.out-of-scope/`).
- **A handoff is a note in its subject's `handoffs/`**, `YYYY-MM-DD.<note-name>.md`, not the
  `/handoff` skill's `$TMPDIR` file, which a cloud container loses. It is written once and committed
  in the session's root pull request, with its line in that folder's `README.md`. Then a one-line
  comment on the ticket links it. Closing a ticket, or replacing its note, archives the old notes
  in the same pull request (`docs/process/handoffs.md`).
- **Reviews follow `docs/process/merging.md`**, which overrides `/code-review`'s "do not rerank"
  and its sub-agent fan-out, and the review steps of `/implement` and `/implement-spec` ("fix all
  issues", "mark ready for review"): they pass the merge gate and merge as it says.
