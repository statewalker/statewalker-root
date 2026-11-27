# Handoff notes as dated files

**Status**: accepted, 2026-11-27, at the human's request. Amends decision 2 of
[root-repository-and-session-model](2026-11-14-root-repository-and-session-model.md): handoffs move
out of issue comments into files. Tickets, maps, specs and progress stay in issues.

## Context

A handoff tells the next session where the work stands and how to continue it. Until now each
handoff was a comment on its ticket. There were 37 of them on 36 root issues by 2026-11-27.

Handoffs written as comments are hard to find and read in order:
- they sit among claim comments, gate records and status lines;
- a plan that runs for days collects several, and only the newest is current;
- nothing lists them across tickets;
- a doc can only link one by a comment id.

The `/handoff` skill writes its document to `$TMPDIR`, which a cloud container loses. That is why
the earlier rule sent handoffs to comments.

## Decision

1. **A handoff note is a file**, `docs/handoffs/YYYY-MM-DD.<note-name>.md`:
   - The date is the day the note is written, in UTC, followed by a dot.
   - `<note-name>` is kebab-case. For a handoff on a ticket it is `<ticket number>-<topic>` (e.g.
     `2026-11-27.282-plan-webrun-vcs-parity-gaps-git-0710.md`); for one on no ticket it is the topic
     alone.
   - When a ticket gets more than one note on the same day, each of them ends in its UTC time,
     `-HHMM`, so names sort in writing order.
2. **A note is written once.** It is never edited after its pull request merges. A later note
   replaces it, and names the note it replaces. New files never conflict, so parallel sessions can
   add notes as they add ADRs. A note is a snapshot, not a status file.
3. **The note is linked from its ticket.** The session merges it through its own root pull request
   (the merge gate applies, as for any file here). Then it comments on the ticket with one line
   that links the note on `main`. A note's index line is appended to `docs/handoffs/README.md`.
4. **What a note holds:**
   - what was done, with links to every pull request and follow-up issue;
   - what is running and what is left;
   - the decisions and rules the next session needs;
   - the steps waiting on the human;
   - the skills the next session should load.

   It links issues, ADRs and research rather than copying them, and it never contains secrets.
5. **The `/handoff` skill writes the note there**, not to `$TMPDIR`; `CLAUDE.md` states this
   override.
6. The 37 handoff comments that existed on 2026-11-27 were copied into notes unchanged, each under
   a header that links its ticket and original comment. Docs that linked those comments now link
   the notes.

## Consequences

- Handoffs read in order in one directory, and a plan's newest note is the last one with its
  ticket number.
- Every handoff now costs a root pull request. That is acceptable, since a session already opens
  one to end (`docs/process/sessions.md`).
- The original comments stay where they are, as history. Docs link the files.
