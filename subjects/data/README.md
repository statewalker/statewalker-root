# Data and storage

FilesApi, database drivers, indexers and sync: the storage layer the other subjects build on.

Subject id `data`. Root issues carry the label `subject:data`. The ecosystem's map of subjects is [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md).

## Where it stands

Nothing here records state: state lives in GitHub issues and in the handoff notes. Get it with:

```bash
node tools/status.mjs data
```

The output lists, for this subject:

- the plans (maps and specs);
- the frontier, the tickets an agent can start now;
- what waits on the human;
- the live handoff notes, and each project's open pull requests and bugs.

## Entry points (2026-11-27)

- Nothing is planned in the root. Bugs and features live in each project's tracker. When work spans these projects, open a map here (`/wayfinder`).

## Projects

| Project | Layer | What it holds |
|---|---|---|
| [webrun-files](https://github.com/statewalker/webrun-files) | L1 | FilesApi: node, browser, mem, S3, SQLite, HTTP, RPC, composite |
| [statewalker-db](https://github.com/statewalker/statewalker-db) | L0 | Database drivers: db-api, DuckDB, PGlite, SQLite (browser, node, DO) |
| [statewalker-search](https://github.com/statewalker/statewalker-search) | L1 | Indexers: full-text, vector, ngram, chunker, DuckDB/PGlite/SQLite backends |
| [webrun-sync](https://github.com/statewalker/webrun-sync) | L2 | Content store, transfer, merge, files sync |

Each project keeps its own `CLAUDE.md`, `GLOSSARY.md`, `docs/adr/` and issue tracker. A decision or term that concerns one project alone goes there, not here (`docs/agents/domain.md`).

## Decisions

None yet. Write the first one as `adr/YYYY-MM-DD-<slug>.md` and list it here (`docs/agents/domain.md`).

## Research

None yet. A note goes in `research/<slug>.md` (`docs/process/subjects.md`).

## Handoffs

- [`handoffs/`](handoffs/README.md): the notes of work still in progress. The last line for a ticket in its index is that ticket's current note.
- [`handoffs.archive/`](handoffs.archive/README.md): the notes of finished work, and notes replaced by newer ones.

The rules for writing and archiving notes are in [`docs/process/handoffs.md`](../../docs/process/handoffs.md).
