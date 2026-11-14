# Domain Docs

How the engineering skills consume domain documentation in this root project and in the projects
it manages.

## Before exploring, read these

- **`GLOSSARY.md`** at this repository's root: ecosystem-wide terms (process words, and concepts
  shared by several projects such as FilesApi, peer, cell, slot).
- **`docs/adr/`**: ecosystem-wide decisions. Read the ADRs that touch the area you work in.
- **In a project clone** (`repos/<name>/`): that project's own `GLOSSARY.md` (or legacy
  `CONTEXT.md`) and `docs/adr/`, if present. They win for terms local to that project.

If any of these files don't exist, **proceed silently**. `/domain-modeling` (reached via
`/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or
decisions actually get resolved.

## Where a new term or decision goes

- Used by **one project** → that project's `GLOSSARY.md` / `docs/adr/`, in that project's PR.
- Used by **several projects**, or about the process → here, in this repository's PR.

## ADR file names

`docs/adr/YYYY-MM-DD-<slug>.md` (the date the decision was made), **not** sequential numbers:
parallel sessions creating ADRs at the same time would collide on the next number. Refer to an ADR
by its slug. Index: `docs/adr/README.md`.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor proposal, a hypothesis, a test
name), use the term as defined in the glossary. Don't drift to synonyms the glossary avoids. A
concept missing from the glossary is a signal: either invented language (reconsider) or a real gap
(note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, say so explicitly rather than silently overriding:

> _Contradicts ADR `root-repository-and-session-model`, but worth reopening because…_
