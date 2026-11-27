# Archive handoff notes of finished work

**Status**: accepted, 2026-11-27, at the human's request
([#452](https://github.com/statewalker/statewalker-root/issues/452)). Amends
[handoff-notes-as-files](2026-11-27-handoff-notes-as-files.md).

## Context

Within a day of handoff notes moving to files, `docs/handoffs/` held 49 of them. 31 were for
closed tickets with nothing left. A few more were replaced by newer notes. A session looking for
the work to continue had to check every ticket to tell the two kinds apart.

## Decision

1. **Notes of finished or cancelled work move to `docs/handoffs.archive/`.** So do notes that a
   newer note replaces, unless a live note still points to them as still applying.
   `docs/handoffs/` then lists only live work.
2. **The folder sits beside `docs/handoffs/`**, not inside it. Archived notes keep their relative
   links (`../adr/`, `../research/`) without an edit. Moving a note isn't editing it. The
   write-once rule stands.
3. **The index line moves with the note**, unchanged, to `docs/handoffs.archive/README.md`.
4. **Who archives:**
   - the session that closes a ticket, in the same root pull request;
   - the session that writes a replacing note;
   - any session that finds a note meeting the rule.

   The steps are in `docs/handoffs/README.md`, under **Archiving a note**.

## Consequences

- A ticket's comment that links its note on `main` points at the old path once the note is
  archived. The note is still in the history under that path, and in the archive under the same
  name.
- A leftover worth acting on has to become an issue before its note is archived. Otherwise
  archiving would hide it.
