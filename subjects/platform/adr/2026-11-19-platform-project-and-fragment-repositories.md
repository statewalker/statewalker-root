# statewalker-platform, and one repository per fragment

**Status**: accepted, 2026-11-19. Decided in
[Where is the platform published, and under which name?](https://github.com/statewalker/statewalker-root/issues/118),
on the map [statewalker-root#112](https://github.com/statewalker/statewalker-root/issues/112).

## Context

The platform's kernel and core fragments come out of `statewalker-kernel` (L4), and its shell out of `statewalker-shell-react` (L6). The decisions on the map cut across both projects ([fragment-manifest-and-extension-points](2026-11-18-fragment-manifest-and-extension-points.md), [react-only-shell-with-shared-modules](2026-11-18-react-only-shell-with-shared-modules.md)), so keeping them apart would force lock-step releases.

The unmerged sandclaw branch `claude/statewalker-shell-consolidation-youwvj` (2026-10-18) had already merged both into sandclaw, mixing the platform with an application built on it.

A fragment's client half depends on the platform's client API. Fragments must therefore be published above the platform, never inside the lower libraries they wrap.

## Decision

1. **`statewalker-kernel` is reused and renamed `statewalker-platform`** (layer L4).
   - statewalker-shell-react's packages migrate into it, and shell-react is then archived.
   - Published package names stay.
   - `workspace-vcs.core` moves out to the VCS fragment.
   - "Kernel" keeps its glossary meaning: the minimal loader inside the platform.
2. **Folders in statewalker-platform:**
   - `packages/`: UI-free and isomorphic packages; a lint fails any React import here.
   - `packages-react/`: views, catalog components, the A2UI renderer, the shell.
   - `fragments/`: the core fragments.
   - `apps/`: the demo applications, each with its own fragments and launch configurations for each host.
3. **Sandclaw is an application** in its own project above the platform (amended 2026-11-27: SandClaw's applications live in `github.com/sandclaw-ai`, [ADR blocks-sandclaw-and-managed-services](../../../docs/adr/2026-11-27-blocks-sandclaw-and-managed-services.md)). Its `wiki.core`, `file-mounts.core` and `file-panels.core` become fragments. The consolidation branch's useful code moves to statewalker-platform, and the branch is dropped.
4. **One repository per high-level fragment**, named `statewalker-fragment-<name>`:
   - it publishes `@statewalker/fragment-<name>` (further packages `@statewalker/fragment-<name>.<aspect>`);
   - its fragment id is `org.statewalker.fragment-<name>`;
   - each repository is listed in `repos.json`, with its own CI and releases;
   - the repositories are aggregated through `repos.json` and `tools/ws.mjs`.

## Considered options

- **A new project for the platform.** Rejected: `statewalker-kernel` already has the history, settings and CI, and a rename keeps redirects.
- **The platform inside sandclaw** (the consolidation branch). Rejected: the platform must be publishable empty, without an application's brand and fragments.
- **One project for all integration fragments.** Rejected: fragments release on their own schedules and wrap libraries from different projects.
- **An aggregate monorepo of fragment repositories through git submodules.** Rejected: every fragment release would need a submodule bump, and `repos.json` with `tools/ws.mjs` already link projects into one workspace.
- **No UI folder split.** Rejected: the split, with its lint, enforces "only `*.view.<tech>` may import UI". Naming the folder after the technology leaves room for other renderers.

## Consequences

- When the spec is built, the repository is renamed (an organisation admin's action). `repos.json`, the `CLAUDE.md` project table and `docs/projects.md` follow. statewalker-shell-react leaves L6, and the layers above L4 are recomputed: the fragment repositories and sandclaw land above the platform.
- Steps 3.2 and 3.3 of `docs/refactoring/README.md` are superseded.
- Each new fragment repository joins the ecosystem's CI baseline and merge gate like any project.
