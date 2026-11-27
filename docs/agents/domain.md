# Domain Docs

How the engineering skills consume domain documentation in this root project and in the projects
it manages.

## Layout: multi-context, by subject

This repository uses the `domain-modeling` skill's multi-context layout. **`GLOSSARY-MAP.md`** at
the root lists the contexts, which here are the **subjects**, with where each one lives and how
they relate:

```
GLOSSARY-MAP.md              the subjects, their projects, relationships, where things go
GLOSSARY.md                  terms shared by several subjects
docs/adr/                    decisions on the process, or spanning several subjects
subjects/<s>/README.md       the subject: scope, projects, entry points, index of its ADRs and research
subjects/<s>/GLOSSARY.md     terms of one subject (created when the first one is needed)
subjects/<s>/adr/            decisions within one subject
subjects/<s>/research/       research notes of one subject
```

## Before exploring, read these

- **`GLOSSARY.md`** at this repository's root: ecosystem-wide terms (process words, and concepts
  shared by several projects such as FilesApi, peer, cell, slot).
- **`docs/adr/`**: decisions on the process and those spanning subjects.
- **The subject you work in** (`GLOSSARY-MAP.md` names it): `subjects/<s>/README.md` lists its
  ADRs in `subjects/<s>/adr/`. Read those that touch your area, and its `GLOSSARY.md` if present.
- **In a project clone** (`repos/<name>/`): that project's own `GLOSSARY.md` (or legacy
  `CONTEXT.md`) and `docs/adr/`, if present. They win for terms local to that project.

If any of these files don't exist, **proceed silently**. `/domain-modeling` (reached via
`/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or
decisions actually get resolved.

## Where a new term or decision goes

- Used by **one project** → that project's `GLOSSARY.md` / `docs/adr/`, in that project's PR.
- Used by **several projects of one subject** → `subjects/<s>/GLOSSARY.md` / `subjects/<s>/adr/`,
  with its line in `subjects/<s>/README.md`, in this repository's PR.
- Used by **several subjects**, or about the process → `GLOSSARY.md` / `docs/adr/`, in this
  repository's PR.

## ADR file names

`docs/adr/YYYY-MM-DD-<slug>.md` (the date the decision was made), **not** sequential numbers:
parallel sessions creating ADRs at the same time would collide on the next number. Refer to an ADR
by its slug. Indexes: `docs/adr/README.md` for the cross-subject ADRs, the Decisions list of
`subjects/<s>/README.md` for a subject's.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor proposal, a hypothesis, a test
name), use the term as defined in the glossary. Don't drift to synonyms the glossary avoids. A
concept missing from the glossary is a signal: either invented language (reconsider) or a real gap
(note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, say so explicitly rather than silently overriding:

> _Contradicts ADR `root-repository-and-session-model`, but worth reopening because…_
