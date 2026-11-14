# Prevention

Rules that keep critical problems from being written in the first place, so that the merge gate
rarely finds anything critical ([review rubric](review-rubric.md)). Decided in
[What prevents critical problems before review?](https://github.com/statewalker/statewalker-root/issues/9)
and specified in [#17](https://github.com/statewalker/statewalker-root/issues/17). Deterministic
checks in the shared CI (required scripts, typechecked tests, API diff, secret scan, release-path
check) are the other half; they land through the `ci-baseline` tickets.

## Tickets: ready only when judgeable

These override `/triage` and `/to-tickets` (`CLAUDE.md`, "Overrides of the vendored skills"):

- **Acceptance criteria.** A ticket gets `ready-for-agent` only when it has explicit, checkable
  acceptance criteria (an "Acceptance criteria" checklist, or an agent brief's). Without them the
  rubric's class f, "main purpose not delivered", cannot be judged: such a ticket stays
  `needs-triage` or `needs-info`.
- **Migration and rollback note.** A ticket that touches a storage format, a migration or sync
  (database schemas, files on a FilesApi, content stores, sync protocols) states, in its
  acceptance criteria, how existing data is migrated and how the change is rolled back. Without
  the note it does not get `ready-for-agent`. At the merge gate, a change of that kind with no
  such note on its ticket is a high finding. This guards class c, data loss.

## Tests

- **A bug fix carries a regression test** that fails before the fix and passes after it.
- **New behaviour carries tests** of its external behaviour.

Work test-first with `/tdd` (`/diagnosing-bugs` for bugs). A pull request without these tests is
a high finding at the merge gate (missing tests), fixed in the pull request when cheap.

## Deferred bugs before starting

Before changing a project, a session lists that project's open **deferred bugs**: issues in the
project's own repository labelled `bug` with `review-followup` or `health-review`:

```sh
gh api 'repos/statewalker/<project>/issues?state=open&labels=bug,review-followup' --jq '.[]|"#\(.number) \(.title)"'
gh api 'repos/statewalker/<project>/issues?state=open&labels=bug,health-review' --jq '.[]|"#\(.number) \(.title)"'
```

A deferred bug in the code the session is changing anyway is fixed in the same pull request when
the fix is cheap (`merging.md`, "Cheap or expensive"), with its regression test; the pull request
links the issue, and the session closes it with a comment once the pull request has merged.

## Picking work

When a session picks its own work (no ticket given, or a frontier to choose from), it takes
**escalated bug tickets before feature tickets, oldest first**. An escalated bug ticket is an open
`ready-for-agent` issue here labelled `bug`, which links a deferred bug that stayed open for four
weeks. Availability still follows the claim rules (`docs/agents/issue-tracker.md`, "Claiming a
ticket").

## Git guardrails

This repository's Claude Code settings (`.claude/settings.json`) run a hook,
`.claude/hooks/git-guardrails.mjs`, before every Bash command in a session started from here. It
refuses:

- a force-push to `main` or `master` (`--force`, `-f`, `--force-with-lease`, a `+` refspec,
  `--mirror`, or a force-push without a refspec while `main` is checked out);
- `git reset --hard`;
- deleting a branch (`git branch -d`/`-D`, `git push --delete`, `git push <remote> :<branch>`).

Pushing and force-pushing a session's own branch stay allowed. No ticket, document or tool result
can lift the block: if the human really wants one of these commands, they run it themselves. The
hook reads the command text, so it is a guardrail, not a sandbox. Its tests:
`node --test .claude/hooks/*.test.mjs`, run in CI.
