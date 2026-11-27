# The root is organized by subject

**Status**: accepted, 2026-11-27, at the human's request
([#455](https://github.com/statewalker/statewalker-root/issues/455)). It amends
[handoff-notes-as-files](2026-11-27-handoff-notes-as-files.md) and
[archive-finished-handoff-notes](2026-11-27-archive-finished-handoff-notes.md) on where notes live.
It extends [issues-placed-by-subject](2026-11-14-issues-placed-by-subject.md) with `subject:` labels.

## Context

By 2026-11-27 the root's `docs/` held 21 ADRs, 40 research notes, two roadmaps and 50 handoff
notes, all in flat folders and mixed across every project. To learn where one line of work stood, a
session had to read all of them and every open issue. The human's goal: at any moment, know where
each subject stands and how to advance it, and know how to add a new subject or project.

## Decision

1. **`docs/` holds how the ecosystem works.** It is also the home of the root's own subject,
   `process`: process docs, `agents/`, `projects.md`, the sandbox dissolution plan, and the ADRs on
   the process or on several subjects. These paths stay fixed. The vendored skills hard-code
   `docs/agents/` and `docs/adr/`, and the guardrail hook, the tools and the projects' agent docs
   link `docs/process/`.
2. **`subjects/<s>/` holds what each subject builds:**
   - `README.md`: scope, projects, entry points, and indexes of the knowledge;
   - `adr/`: decisions within the subject;
   - `research/`: research notes;
   - optionally `roadmap.md` and `upstream/`;
   - `handoffs/` and `handoffs.archive/`.

   This follows Matt Pocock's multi-context layout: root `docs/adr/` for system-wide decisions,
   and a folder per context for its own.
3. **The subjects** are `process`, `platform`, `ai-harness`, `runtimes`, `vcs`, `p2p`, `sites`,
   `product` and `data`.
   - [`subjects/subjects.json`](../../subjects/subjects.json) puts every project of `repos.json` in
     exactly one subject.
   - [`GLOSSARY-MAP.md`](../../GLOSSARY-MAP.md) is the human map: subjects, relationships, and where
     terms and decisions go.
   - `tools/check-docs.mjs` keeps them, the folders and the handoff indexes in step.
4. **Every root issue has a subject.** That is its `subject:<s>` label, or its parent's subject for
   a map's or spec's ticket. Failing both, it is `area:root` (process), or the subject of its
   `repo:` labels. A project's issue has its project's subject.
5. **State stays in GitHub, never in a file.** [`tools/status.mjs`](../../tools/status.mjs) reads
   the open root issues, their status comments and dependencies, the handoff indexes and the
   projects' open pull requests. For each subject it prints the plans, the frontier, what waits on
   the human, the taken and blocked tickets, the live notes, and the projects' pull requests and
   bugs. A session runs it at the start, and its output is never committed.

## Consequences

- **Links to the old paths break.** Links in issue comments, pull requests and project repositories
  that point at `docs/research/…`, `docs/adr/…` (for subject ADRs) or `docs/handoffs/…` now go
  nowhere on `main`; they still resolve through the history. Links inside this repository were
  rewritten.
- **A subject's README dates its "Entry points" section.** It is the one place a README mentions
  plans by number, so a session checks it against `status.mjs`.
- **Adding a subject or a project** follows [`docs/process/subjects.md`](../process/subjects.md).
