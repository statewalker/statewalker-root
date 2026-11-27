# Handoff notes

A handoff note is a snapshot. It tells the next session where a piece of work stands and how to
continue it ([ADR handoff-notes-as-files](../adr/2026-11-27-handoff-notes-as-files.md),
[ADR archive-finished-handoff-notes](../adr/2026-11-27-archive-finished-handoff-notes.md),
[ADR subjects-layout](../adr/2026-11-27-subjects-layout.md)).

## Where notes live

Each subject keeps its own notes beside its other knowledge (`GLOSSARY-MAP.md`):

| Subject | Live notes | Finished or replaced notes |
|---|---|---|
| `process` (the root's own work) | `docs/handoffs/` | `docs/handoffs.archive/` |
| any other subject `<s>` | `subjects/<s>/handoffs/` | `subjects/<s>/handoffs.archive/` |

- **A note belongs to its ticket's subject:** the ticket's `subject:` label, or for a ticket in a
  project's tracker, that project's subject in `subjects/subjects.json`.
- **Each folder's `README.md` is its index:** one line per note, newest last.
- **The current note:** the last line for a ticket in the live index.
- **The cross-subject view:** `node tools/status.mjs` shows every subject's live notes together.

## When to write a note

**First, checkpoint in the issues** (`docs/agents/issue-tracker.md`, "Checkpoints"): progress
comments, a `Waiting on human:` line, follow-up issues. Then write a note only if a new session
still couldn't continue from the issues alone. That happens when there are:

- standing rules the human gave for a line of work, such as the VCS portability rules;
- a plan in flight across several tickets or repositories: the order, the waves, the release
  sequence;
- running state that no single ticket shows: child sessions, unmerged branches with no pull
  request, a scheduled check;
- decisions taken that haven't landed in an ADR or a ticket yet.

If none applies, write no note: the ticket's comments are the handoff. Update the note at the same
milestones as the progress comments, by writing a replacing note, when its content would otherwise
mislead.

## Writing a note

1. **Name:** `YYYY-MM-DD.<note-name>.md`, with today's date in UTC, then a dot.
   - `<note-name>` is kebab-case: `<ticket number>-<topic>` for a handoff on a root ticket,
     `<project>-<number>-<topic>` for one on a project's issue, or the topic alone.
   - A note written on a day when its ticket already has a note ends in its UTC time, `-HHMM`. The
     day's first note keeps its plain name, so no merged note is ever renamed.
   - Example: `2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0710.md`.
2. **Start the file** with `# Handoff: <ticket title> (#<n>)`, then these reference lines, so a
   session can trace the note to the live plan:

   ```md
   - **Subject:** `<id>` ([README](../README.md))
   - **Plan:** <the map or spec it belongs to, as a link, or "none">
   - **Tickets:** <the ticket it hands off, and the other open tickets it leaves work on>
   - **Replaces:** <the note it replaces, as a link> (omit if none)
   ```

   For the `process` subject the README link is `../process/README.md`.
3. **Content: only what a new session needs to continue the work on its own.** Leave out
   anything already recorded in the code, a commit, a project's docs, an ADR, research or the
   ticket and its comments: link it instead. A note holds:
   - what is left, in the order to do it;
   - what is running (child sessions, scheduled checks, unmerged branches);
   - what waits on the human, exactly;
   - the decisions and standing rules not yet written down anywhere else;
   - the pull requests and follow-up issues, as links;
   - the skills the next session should load.

   Shorter is better: a reader with the ticket and the repository at hand should find nothing
   twice. Never include secrets.
4. **Commit it** in the session's root pull request, with its index line appended to the live
   index (`- [<file name without .md>](<file>): #<n>, <ticket title>`), newest last. Then comment
   on the ticket with one line linking the note on `main`.
5. **Never edit a note after it merges.** Write a new one instead. The one exception is in step 3
   of "How to archive a note".

The `/handoff` skill writes here, not to `$TMPDIR` (`CLAUDE.md`, overrides).

## Archiving a note

A note moves to its subject's `handoffs.archive/` only when one of these is true:

- **Its work is finished, and its ticket is closed.** Completed, not planned (cancelled) and
  duplicate closures all count. A note with no ticket qualifies when its "Left" section is done or
  the human dropped it.
  - A closed ticket alone isn't enough. A note stays live while it has open items that no open
    issue tracks: something running, a step waiting on the human, or a "Left" or next-work
    section. An example is a plan ticket that was closed while its follow-up batches continue.
  - Small leftovers that no one will act on don't keep a note live. A leftover that matters
    becomes an issue first, and then the note can be archived.
- **A newer note on the same work replaces it**, naming it under "Replaces". The older note moves
  even when the newer one says some of its rules or steps still apply. The newer note's link to it
  is repointed at the archive (step 3).

### How to archive a note

1. `git mv <folder>/handoffs/<note>.md <folder>/handoffs.archive/<note>.md`. The archive sits beside
   the live folder at the same depth, so the note's own relative links still work. Don't change the
   file: moving it doesn't count as editing it.
2. Move its index line, unchanged, from the live index to the end of the archive's index. Archive
   the notes of one ticket together.
3. Find every link to the old path (`grep -rn "<note>" --include=*.md .`) and point it at the
   archived path, including links in live notes. Changing only a link's target path is the one
   change allowed in a merged note. `node tools/check-docs.mjs` fails on any link you miss.
4. Commit in the session's root pull request. Once it merges, comment the note's new path on its
   ticket: a `blob/main/...` link to the old path stops resolving.

### Who archives

- The session that closes a ticket archives that ticket's notes, in the same root pull request.
- The session that writes a replacing note archives the note it replaces.
- Any session may archive notes that meet the rule. `node tools/status.mjs` flags them, as live
  notes whose ticket is closed, so a session can check whether the work is finished.
