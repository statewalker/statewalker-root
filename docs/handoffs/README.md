# Handoff notes

Snapshots that tell the next session where a piece of work stands and how to continue it
([ADR 2026-11-27 handoff-notes-as-files](../adr/2026-11-27-handoff-notes-as-files.md)).

Only notes for work that is still going on live here. Notes for finished or cancelled work move to
[`docs/handoffs.archive/`](../handoffs.archive/README.md) (see **Archiving a note** below).

## Writing a note

1. **Name:** `YYYY-MM-DD.<note-name>.md`, with today's date in UTC, then a dot.
   - `<note-name>` is kebab-case: `<ticket number>-<topic>` for a handoff on a ticket, or the topic
     alone.
   - A note written on a day when its ticket already has a note ends in its UTC time, `-HHMM`. The
     day's first note keeps its plain name, so no merged note is ever renamed.
   - Example: `2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0710.md`.
2. **Start the file** with `# Handoff: <ticket title> (#<n>)` and the ticket's link. If it replaces
   an earlier note, name that note.
3. **Content:**
   - what was done, linking every pull request and follow-up issue;
   - what is running, and what is left;
   - the decisions and rules the next session needs;
   - the steps waiting on the human;
   - the skills the next session should load.

   Link issues, ADRs and research instead of copying them. Never include secrets.
4. **Commit it** in the session's root pull request, with its index line appended below, newest
   last. Then comment on the ticket with one line linking the note on `main`.
5. **Never edit a note after it merges.** Write a new one instead.

## Archiving a note

A note moves to `docs/handoffs.archive/` when either of these is true:
- **Its work is finished or cancelled.** The ticket is closed (completed, not planned or a
  duplicate), or, for a note with no ticket, its "Left" section is done or the human dropped it.
  Small leftovers that no one will act on don't keep a note live. A leftover that matters becomes an
  issue first, and the note can then be archived.
  **A closed ticket isn't enough on its own.** A note that still has open items no open issue tracks
  stays live: something running, a step waiting on the human, or a "Left" or next-work section.
  An example is a plan ticket closed while its follow-up batches continue.
- **A newer note on the same work replaces it, and no live note links to it.** If the newer note
  says that rules or steps in the older one still apply, the older note stays here until the newer
  one is archived.

How to archive one:
1. `git mv docs/handoffs/<note>.md docs/handoffs.archive/<note>.md`. The folder sits beside this
   one at the same depth, so the note's own relative links still work. Don't change the file:
   moving it doesn't count as editing it.
2. Move its index line, unchanged, from **Notes** below to the end of
   `docs/handoffs.archive/README.md`. Archive the notes of one ticket together.
3. Check that no live document links to the old path (`grep -rn "<note>" --include=*.md .`).
   Point any such link at the archived path.
4. Commit in the session's root pull request. You don't need a ticket comment: the ticket's link
   to the note on `main` still resolves through the history, and the archive keeps the same name.

Who archives:
- the session that closes a ticket archives that ticket's notes in the same root pull request;
- the session that writes a replacing note archives the note it replaces, under the rule above;
- any session may archive notes it finds that meet the rule, for example while reading the index
  at the start of a session.

The `/handoff` skill writes here, not to `$TMPDIR` (`CLAUDE.md`, overrides).

## Notes

Until 2026-11-27, handoffs were comments on their tickets. Each note below up to that date is such a comment, copied
unchanged, and its header links the original.

- [2026-11-26.430-webrun-devtools-per-app-biscuit-capabilities](2026-11-26.430-webrun-devtools-per-app-biscuit-capabilities.md): #430, webrun-devtools: per-app Biscuit capabilities over webrun-wire, and the extension as an HTTPeers peer
- [2026-11-27.282-plan-webrun-vcs-parity-gaps-git](2026-11-27.282-plan-webrun-vcs-parity-gaps-git.md): #282, Plan: webrun-vcs parity gaps from the git/JGit coverage tables (116 tickets, 6 waves)
- [2026-11-27.215-spec-empty-fragment-platform-kernel-core-0703](2026-11-27.215-spec-empty-fragment-platform-kernel-core-0703.md): #215, Spec: the empty fragment platform (kernel, core fragments, shell, demos)
- [2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0710](2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0710.md): #282, Plan: webrun-vcs parity gaps from the git/JGit coverage tables (116 tickets, 6 waves)
- [2026-11-27.232-project-sites-one-standard](2026-11-27.232-project-sites-one-standard.md): #232, Project sites: one standard for every statewalker site
- [2026-11-27.70-ai-harness-cellb-celld-workers](2026-11-27.70-ai-harness-cellb-celld-workers.md): #70, AI harness on CellB, CellD and Workers
- [2026-11-27.430-webrun-devtools-per-app-biscuit-capabilities](2026-11-27.430-webrun-devtools-per-app-biscuit-capabilities.md): #430, webrun-devtools: per-app Biscuit capabilities over webrun-wire, and the extension as an HTTPeers peer
- [2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0835](2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0835.md): #282, Plan: webrun-vcs parity gaps from the git/JGit coverage tables (116 tickets, 6 waves)
- [2026-11-27.kitesurf-on-cellb](2026-11-27.kitesurf-on-cellb.md): no ticket, Kitesurf on CellB (Node and a browser tab), PDF via Page.printToPDF
- [2026-11-27.194-first-paid-wedge](2026-11-27.194-first-paid-wedge.md): #194, Which product is the first paid wedge? (recorded from its session; Q11–Q15 wait on the human)
- [2026-11-27.69-clean-up-open-issues](2026-11-27.69-clean-up-open-issues.md): #69, Clean up the open issues across the projects (npm trusted publisher and httpeers#133 wait on the human)
- [2026-11-27.webrun-vcs-399-sqlite-git-census](2026-11-27.webrun-vcs-399-sqlite-git-census.md): webrun-vcs#399, vcs-store-sql cannot hold git.git
- [2026-11-27.cellb-dev-235-jsx-tsx-cells-source-maps](2026-11-27.cellb-dev-235-jsx-tsx-cells-source-maps.md): cellb.dev#235, jsx/tsx cells, Markdown positions and source maps in themed notebook pages
- [2026-11-27.platform-logical-architecture](2026-11-27.platform-logical-architecture.md): no ticket, StateWalker Platform logical architecture document
