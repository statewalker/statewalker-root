# Architecture decision records

Decisions on the process, and decisions that span several subjects. A decision within one subject
goes to `subjects/<s>/adr/` and is listed in that subject's `README.md` (`GLOSSARY-MAP.md`). A
decision about one project alone goes to that project's own `docs/adr/`. File name:
`YYYY-MM-DD-<slug>.md` (`../agents/domain.md`). Append one line per ADR, newest last.

- [2026-11-14 root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md): this repository is where every session starts; state in issues, knowledge via one PR per session.
- [2026-11-14 ci-publishing-and-umbrella-retired](2026-11-14-ci-publishing-and-umbrella-retired.md): releases only through CI version pull requests; umbrella archived, its tools moved into `tools/`.
- [2026-11-14 two-tier-review](2026-11-14-two-tier-review.md): a short merge gate blocking only critical findings on every pull request, plus a weekly health review per project.
- [2026-11-14 issues-placed-by-subject](2026-11-14-issues-placed-by-subject.md): an issue about one project goes to that project's tracker; root holds plans and the process; deferred bugs are every open `bug` in a project.
- [2026-11-19 code-kinds-and-trust](2026-11-19-code-kinds-and-trust.md): runtime, system code, fragments, sandboxed code; fragments trusted at install; only system code issues capabilities; untrusted code only in sandboxes behind a broker.
- [2026-11-27 handoff-notes-as-files](2026-11-27-handoff-notes-as-files.md): handoffs are dated, write-once notes (`YYYY-MM-DD.<note-name>.md`), linked from a ticket comment; the 37 earlier handoff comments copied there (folders per subject since subjects-layout).
- [2026-11-27 archive-finished-handoff-notes](2026-11-27-archive-finished-handoff-notes.md): notes of finished or cancelled work, and replaced notes no live note relies on, move unchanged to the sibling `handoffs.archive/` with their index lines.
- [2026-11-27 subjects-layout](2026-11-27-subjects-layout.md): `docs/` holds how the ecosystem works, `subjects/<s>/` holds what each subject builds (ADRs, research, roadmap, handoffs); `subjects/subjects.json` assigns every project a subject; root issues carry `subject:` labels; `tools/status.mjs` reports state from GitHub, never a file.
- [2026-11-27 blocks-sandclaw-and-managed-services](2026-11-27-blocks-sandclaw-and-managed-services.md): StateWalker holds the MIT blocks, SandClaw (`sandclaw-ai`) the open-source applications; revenue from managed services and on-premise packages; showcase sites and measured interest decide promotion. Amends platform-project-and-fragment-repositories (decision 3).
