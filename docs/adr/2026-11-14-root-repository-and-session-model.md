# Root repository and session model

**Status**: accepted, 2026-11-14

## Context

The ecosystem spans about twenty project repositories. Agent sessions started inside one project
see only that project; skills and agent instructions were duplicated per project; nothing gave
work spanning projects an overview. The Home Repo pattern (aihero.dev, "The Home Repo Pattern")
addresses this; `umbrella` already covers registry and release tooling but not the agent process.

## Decision

1. `statewalker-root` is the root project: every session starts here. It holds the shared skills
   (`.claude/skills/`, copied from `mattpocock/skills`, pinned in `skills-lock.json`), the project
   map (`CLAUDE.md`, `repos.json`), ecosystem-wide glossary and ADRs, process docs and research.
   It holds no product code.
2. **State lives in GitHub issues on this repository**: tickets, Wayfinder maps, specs, progress
   and handoffs. Never in files.
3. **Every session contributes through its own pull request**, merged when the session ends. No
   direct pushes to `main`. Docs-only changes merge on green; changes to agent behaviour
   (`CLAUDE.md`, `.claude/`, `docs/process/`, `docs/agents/`, `tools/`, `repos.json`) need human
   review.
4. ADRs are named `YYYY-MM-DD-<slug>.md`, not numbered, so parallel sessions never collide.
5. Code changes are pull requests in the project repositories, one per project, merged lowest
   layer first; releases stay with umbrella's `tools/sw.mjs`.

## Consequences

- Parallel sessions only conflict on shared files (glossary, `CLAUDE.md`, process docs); small
  edits and rebase-before-merge keep that cheap.
- The skills are editable copies: updating them is a deliberate PR
  (`npx skills@latest update`), reviewed like any change to agent behaviour.
- Two repositories (root and umbrella) carry ecosystem-wide concerns until refactoring decision
  0.1 settles whether to merge them.
